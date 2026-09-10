import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Rotacao } from '../src/contract.js';
import { layoutDaPagina } from '../src/layout.js';
import { recorteDoConteudo } from '../src/geometry.js';
import { verifyQuote } from '../src/verify.js';
import { acervoDe, paginaSintetica, TEXTO_ESTUDO } from '../src/sintetico.js';

const ROTACOES: readonly Rotacao[] = [0, 90, 180, 270];

function ancoraDe(quote: string, rotacao: Rotacao = 0) {
  const p = paginaSintetica(TEXTO_ESTUDO, { pagina: 12, rotacao });
  const r = verifyQuote({ quote, paginaAlegada: 12, paginas: acervoDe(p) });
  if (r.status !== 'verificada') throw new Error(`esperava verificada: ${r.diagnostico.motivo}`);
  return { pagina: p, ancora: r.ancora };
}

describe('recorteDoConteudo', () => {
  it('contém todas as palavras', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROTACOES), (rotacao) => {
        const p = paginaSintetica(TEXTO_ESTUDO, { rotacao });
        const [cx0, cy0, cx1] = recorteDoConteudo(p);
        for (const w of layoutDaPagina(p, null).palavras) {
          expect(w.esquerda).toBeGreaterThanOrEqual(cx0 - 1e-9);
          expect(w.topo).toBeGreaterThanOrEqual(cy0 - 1e-9);
          expect(w.esquerda + w.largura).toBeLessThanOrEqual(cx1 + 1e-9);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('fica dentro da página e não é degenerado', () => {
    for (const rotacao of ROTACOES) {
      const [x0, y0, x1, y1] = recorteDoConteudo(paginaSintetica(TEXTO_ESTUDO, { rotacao }));
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(y1).toBeLessThanOrEqual(1);
      expect(x1 - x0).toBeGreaterThan(0.05);
      expect(y1 - y0).toBeGreaterThan(0.01);
    }
  });

  it('página sem tokens devolve a página inteira em vez de caixa invertida', () => {
    const vazia = { ...paginaSintetica(TEXTO_ESTUDO), tokens: [] };
    expect(recorteDoConteudo(vazia)).toEqual([0, 0, 1, 1]);
  });
});

describe('layoutDaPagina', () => {
  it('a folha ampliada e deslocada faz o recorte preencher a janela', () => {
    // Prova aritmética do posicionamento: o canto do recorte, mapeado pela
    // folha, tem de cair exatamente no canto da janela. Se esta conta estiver
    // errada, o texto sai deslocado — foi o bug que motivou este módulo.
    fc.assert(
      fc.property(fc.constantFrom(...ROTACOES), (rotacao) => {
        const p = paginaSintetica(TEXTO_ESTUDO, { rotacao });
        const { folha } = layoutDaPagina(p, null);
        const [cx0, cy0, cx1, cy1] = recorteDoConteudo(p);

        // Ponto do recorte -> posição na janela = deslocamento + fração * escala
        expect(folha.esquerda + cx0 * folha.largura).toBeCloseTo(0, 9);
        expect(folha.topo + cy0 * folha.altura).toBeCloseTo(0, 9);
        expect(folha.esquerda + cx1 * folha.largura).toBeCloseTo(1, 9);
        expect(folha.topo + cy1 * folha.altura).toBeCloseTo(1, 9);
      }),
      { numRuns: 40 },
    );
  });

  it('todo realce cai sobre a linha da palavra que ele destaca', () => {
    const { pagina, ancora } = ancoraDe('a dapagliflozina reduziu o desfecho primario composto');
    const { palavras, realces } = layoutDaPagina(pagina, ancora);
    expect(realces.length).toBeGreaterThan(0);

    for (const r of realces) {
      const sobrepostas = palavras.filter(
        (w) =>
          w.esquerda < r.esquerda + r.largura &&
          w.esquerda + w.largura > r.esquerda &&
          Math.abs(w.topo - r.topo) < 0.01,
      );
      expect(sobrepostas.length, 'realce sem palavra sob ele').toBeGreaterThan(0);
    }
  });

  it('uma citação em duas linhas rende dois realces em alturas diferentes', () => {
    const { pagina, ancora } = ancoraDe('com razao de risco de 0,74 (IC 95% 0,65 a 0,85) em comparacao');
    const { realces } = layoutDaPagina(pagina, ancora);
    expect(realces).toHaveLength(2);
    const [a, b] = realces;
    if (a === undefined || b === undefined) throw new Error('faltou realce');
    expect(Math.abs(a.topo - b.topo)).toBeGreaterThan(0.005);
  });

  it('sem âncora não há realce, e as palavras continuam lá', () => {
    const l = layoutDaPagina(paginaSintetica(TEXTO_ESTUDO), null);
    expect(l.realces).toHaveLength(0);
    expect(l.palavras.length).toBeGreaterThan(30);
  });

  it('a proporção da janela troca em 90 e 270, como as dimensões renderizadas', () => {
    const retrato = layoutDaPagina(paginaSintetica(TEXTO_ESTUDO, { rotacao: 0 }), null);
    const paisagem = layoutDaPagina(paginaSintetica(TEXTO_ESTUDO, { rotacao: 90 }), null);
    expect(retrato.larguraPt).toBe(612);
    expect(paisagem.larguraPt).toBe(792);
    expect(paisagem.proporcao).not.toBeCloseTo(retrato.proporcao, 3);
  });
});
