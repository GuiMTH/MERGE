import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { minusculasPreservandoComprimento, normalizar } from '../src/normalize.js';

/** Confere que o mapa aponta de volta para o caractere que gerou cada posição. */
function fatiarViaMapa(cru: string, a: number, b: number): string {
  const { paraCru } = normalizar(cru);
  const i = paraCru[a];
  const j = paraCru[b];
  if (i === undefined || j === undefined) throw new Error('mapa incompleto');
  return cru.slice(i, j);
}

describe('normalizar — o mapa de offsets', () => {
  it('tem comprimento norm.length + 1, para que o fim de um intervalo seja mapeável', () => {
    const r = normalizar('abc def');
    expect(r.paraCru.length).toBe(r.norm.length + 1);
    expect(r.paraCru[r.norm.length]).toBe('abc def'.length);
  });

  it('mapeia de volta para a fatia crua correspondente', () => {
    const cru = 'a  reducao   foi de 30%';
    const { norm } = normalizar(cru);
    const i = norm.indexOf('reducao');
    expect(fatiarViaMapa(cru, i, i + 'reducao'.length)).toBe('reducao');
  });

  it('é monotônico: posições normalizadas nunca voltam no texto cru', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (cru) => {
        const { paraCru } = normalizar(cru);
        for (let i = 1; i < paraCru.length; i += 1) {
          const anterior = paraCru[i - 1];
          const atual = paraCru[i];
          if (anterior === undefined || atual === undefined) throw new Error('mapa incompleto');
          expect(atual).toBeGreaterThanOrEqual(anterior);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('normalizar — dobras', () => {
  it('dobra ligadura, aspas curvas, travessão e espaço exótico', () => {
    expect(normalizar('eﬁcácia').norm).toBe('eficácia');
    expect(normalizar('“texto”').norm).toBe('"texto"');
    expect(normalizar('‘x’').norm).toBe("'x'");
    expect(normalizar('0,65 – 0,85').norm).toBe('0,65 - 0,85');
    expect(normalizar('a b').norm).toBe('a b');
  });

  it('remove largura zero e hífen suave sem deixar rastro', () => {
    expect(normalizar('a​b­c').norm).toBe('abc');
  });

  it('colapsa corridas de espaço, inclusive quebras de linha', () => {
    expect(normalizar('a  \n\t b').norm).toBe('a b');
  });

  it('compõe marca combinante com a base, que é o caso comum em português', () => {
    // Alguns PDFs emitem `c` + U+0327 em vez do `ç` precomposto. Sem agrupar o
    // cluster, `reducao` da página nunca casaria com `redução` da citação.
    expect(normalizar('redução').norm).toBe('redução');
    expect(normalizar('redução').norm.normalize('NFC')).toBe('redução');
  });
});

describe('normalizar — de-hifenização', () => {
  it('junta palavra quebrada em fim de linha', () => {
    expect(normalizar('efi-\ncácia').norm).toBe('eficácia');
  });

  it('preserva o hífen de termo composto legítimo do domínio', () => {
    // Sem a lista-guarda, `duplo-cego` viraria `duplocego` em silêncio, e
    // `intention-to-treat` corrompido é um desenho de estudo corrompido.
    expect(normalizar('duplo-\ncego').norm).toBe('duplo-cego');
    expect(normalizar('intention-\nto-treat').norm).toBe('intention-to-treat');
  });

  it('não junta quando a linha seguinte começa em maiúscula ou dígito', () => {
    expect(normalizar('placebo-\nDapagliflozina').norm).toBe('placebo- Dapagliflozina');
    expect(normalizar('fase-\n3 do estudo').norm).toBe('fase- 3 do estudo');
  });

  it('preserva hífen no meio da linha', () => {
    expect(normalizar('beta-bloqueador oral').norm).toBe('beta-bloqueador oral');
  });
});

describe('normalizar — o que NÃO se toca', () => {
  it('não converte separador decimal', () => {
    // `p<0,05` da bula não vira `p<0.05`: separador decimal é diferença
    // semântica real em pt-BR, e dobrar número em silêncio é como uma claim
    // acaba ancorada no tamanho de efeito errado.
    expect(normalizar('p<0,05').norm).toBe('p<0,05');
    expect(normalizar('1,5 mg').norm).toBe('1,5 mg');
  });

  it('preserva a caixa: minúsculas é uma camada separada, não a normalização', () => {
    expect(normalizar('Dapagliflozina').norm).toBe('Dapagliflozina');
  });

  it('documenta que o NFKC dobra sobrescrito em dígito, e por que isso é seguro', () => {
    // Não removemos marcador de referência sobrescrito: um removedor que
    // apague sobrescrito depois de letra também come o `²` de `m²`, e unidade
    // corrompida é pior que falso-rejeite. A consequência fica na direção
    // segura — a guarda de deriva numérica vê um número a mais e REJEITA.
    expect(normalizar('eficácia¹²').norm).toBe('eficácia12');
    expect(normalizar('120 m²').norm).toBe('120 m2');
  });
});

describe('minusculasPreservandoComprimento', () => {
  it('preserva comprimento mesmo onde toLowerCase não preservaria', () => {
    // U+0130 minúsculo são dois caracteres. Se o comprimento mudasse, o mapa
    // de offsets compartilhado sairia de sincronia e a âncora apontaria para o
    // lugar errado — em silêncio, que é o pior modo de falha aqui.
    expect('İ'.toLowerCase().length).toBe(2);
    expect(minusculasPreservandoComprimento('İ')).toHaveLength(1);
  });

  it('preserva comprimento para qualquer entrada', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        expect(minusculasPreservandoComprimento(s)).toHaveLength(s.length);
      }),
      { numRuns: 500 },
    );
  });
});
