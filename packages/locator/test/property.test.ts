import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizar } from '../src/normalize.js';
import { POLITICA_VERIFICACAO } from '../src/policy.js';
import { verifyQuote } from '../src/verify.js';
import { acervoDe, paginaDe, TEXTO_ESTUDO } from './fabrica.js';

/**
 * A especificação executável de I1.
 *
 * Duas famílias de mutação, e a assimetria entre elas é o produto:
 *
 *  - **Legal** — o modelo reescreveu a APRESENTAÇÃO do mesmo texto (glifo,
 *    caixa, espaço, ligadura). Tem de verificar, e os offsets têm de apontar
 *    para o trecho certo. Falha aqui é falso-rejeite: vai para backlog.
 *  - **Ilegal** — o modelo mudou o SENTIDO (dígito, negação, cláusula
 *    cortada). Tem de rejeitar. **Zero falso-aceite é barra dura**: uma claim
 *    inventada que sobrevive à revisão é incidente regulatório, e é
 *    exatamente o que o §6.2 manda calibrar contra.
 */

const pagina = paginaDe(TEXTO_ESTUDO, { pagina: 12 });
const acervo = acervoDe(pagina);
const NORM = normalizar(TEXTO_ESTUDO).norm;

function verificar(quote: string) {
  return verifyQuote({ quote, paginaAlegada: 12, paginas: acervo });
}

/** Um trecho literal do documento, longo o bastante para o tier fuzzy. */
const trechoLiteral = fc
  .tuple(
    fc.integer({ min: 0, max: NORM.length - POLITICA_VERIFICACAO.minimoParaFuzzy - 60 }),
    fc.integer({ min: POLITICA_VERIFICACAO.minimoParaFuzzy + 20, max: 160 }),
  )
  .map(([inicio, tamanho]) => NORM.slice(inicio, Math.min(inicio + tamanho, NORM.length)).trim())
  .filter((s) => normalizar(s).norm.length >= POLITICA_VERIFICACAO.minimoParaFuzzy + 10);

/* ─────────────────────────── mutações legais ──────────────────────────── */

const MUTACOES_LEGAIS: readonly { nome: string; aplicar: (s: string) => string }[] = [
  { nome: 'ligadura fi', aplicar: (s) => s.replace(/fi/gu, 'ﬁ') },
  { nome: 'aspas curvas', aplicar: (s) => s.replace(/"/gu, '“') },
  { nome: 'travessão longo', aplicar: (s) => s.replace(/-/gu, '—') },
  { nome: 'espaço inquebrável', aplicar: (s) => s.replace(/ /gu, ' ') },
  { nome: 'espaço fino', aplicar: (s) => s.replace(/ /gu, ' ') },
  { nome: 'corrida de espaços', aplicar: (s) => s.replace(/ /gu, '   ') },
  { nome: 'quebra de linha', aplicar: (s) => s.replace(/ /gu, '\n') },
  { nome: 'tudo minúsculo', aplicar: (s) => s.toLowerCase() },
  { nome: 'tudo maiúsculo', aplicar: (s) => s.toUpperCase() },
  { nome: 'largura zero intercalada', aplicar: (s) => s.replace(/ /gu, '​ ') },
  { nome: 'hífen suave', aplicar: (s) => s.replace(/ /gu, '­ ') },
  { nome: 'decomposição NFD', aplicar: (s) => s.normalize('NFD') },
];

describe('mutações LEGAIS — mesma apresentação, sentido intacto', () => {
  it.each(MUTACOES_LEGAIS)('$nome verifica e ancora no trecho certo', ({ aplicar }) => {
    fc.assert(
      fc.property(trechoLiteral, (literal) => {
        const r = verificar(aplicar(literal));
        if (r.status !== 'verificada') {
          throw new Error(`falso-rejeite em ${JSON.stringify(literal.slice(0, 50))}: ${r.diagnostico.motivo}`);
        }
        // O que prova que os offsets estão certos: o texto ancorado, uma vez
        // normalizado, é o mesmo trecho literal de onde partimos.
        expect(normalizar(r.ancora.quoteVerificada).norm).toBe(literal);
        expect(r.ancora.retangulos.length).toBeGreaterThan(0);
      }),
      { numRuns: 60 },
    );
  });
});

/* ────────────────────────── mutações ilegais ──────────────────────────── */

function virarDigito(s: string): string | undefined {
  const i = s.search(/\d/u);
  if (i < 0) return undefined;
  const d = Number(s.charAt(i));
  return `${s.slice(0, i)}${String((d + 4) % 10)}${s.slice(i + 1)}`;
}

function elidirMeio(s: string): string | undefined {
  const corte = POLITICA_VERIFICACAO.maxDelecaoContigua + 6;
  if (s.length < corte * 4) return undefined;
  const meio = Math.floor(s.length / 2);
  return s.slice(0, meio) + s.slice(meio + corte);
}

function inserirNegacao(s: string): string | undefined {
  const i = s.indexOf(' ', Math.floor(s.length / 3));
  if (i < 0) return undefined;
  return `${s.slice(0, i)} nao${s.slice(i)}`;
}

function trocarClausula(s: string): string | undefined {
  const corte = POLITICA_VERIFICACAO.maxDelecaoContigua + 6;
  if (s.length < corte * 4) return undefined;
  const meio = Math.floor(s.length / 2);
  // Troca por outra cláusula do MESMO tamanho: comprimento total bate, e um
  // teste de comprimento não veria nada.
  return s.slice(0, meio) + 'z'.repeat(corte) + s.slice(meio + corte);
}

const MUTACOES_ILEGAIS: readonly { nome: string; aplicar: (s: string) => string | undefined }[] = [
  { nome: 'dígito virado', aplicar: virarDigito },
  { nome: 'cláusula elidida', aplicar: elidirMeio },
  { nome: 'negação inserida', aplicar: inserirNegacao },
  { nome: 'cláusula trocada por outra de mesmo tamanho', aplicar: trocarClausula },
];

describe('mutações ILEGAIS — sentido alterado. Zero falso-aceite é barra dura', () => {
  it.each(MUTACOES_ILEGAIS)('$nome é sempre rejeitado', ({ nome, aplicar }) => {
    let exercitados = 0;
    fc.assert(
      fc.property(trechoLiteral, (literal) => {
        const mutado = aplicar(literal);
        if (mutado === undefined || mutado === literal) return;
        // Se a mutação por acaso produziu outro trecho literal do documento,
        // verificar está correto — não é falso-aceite.
        if (normalizar(NORM).norm.includes(normalizar(mutado).norm)) return;
        exercitados += 1;

        const r = verificar(mutado);
        if (r.status === 'verificada') {
          throw new Error(
            `FALSO-ACEITE em "${nome}": ${JSON.stringify(mutado.slice(0, 80))} ` +
              `aceito em ${r.ancora.tier} com similaridade ${String(r.ancora.similaridade)}`,
          );
        }
      }),
      { numRuns: 120 },
    );
    expect(exercitados, `a mutação "${nome}" nunca foi exercitada`).toBeGreaterThan(0);
  });
});

/* ──────────────────────── invariantes estruturais ─────────────────────── */

describe('invariantes estruturais de qualquer resultado', () => {
  it('nenhuma entrada produz âncora sem retângulo, nem exceção não tratada', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (arbitrario) => {
        const r = verificar(arbitrario);
        if (r.status === 'verificada') {
          // Uma âncora sem retângulo é uma âncora que o dossiê não consegue
          // destacar, e um dossiê que diz "página 12" sem mostrar onde não
          // cumpre a promessa do produto.
          expect(r.ancora.retangulos.length).toBeGreaterThan(0);
          expect(r.ancora.politicaVersao).toBe(POLITICA_VERIFICACAO.versao);
          expect(r.ancora.cruFim).toBeGreaterThan(r.ancora.cruInicio);
          expect(r.ancora.similaridade).toBeGreaterThanOrEqual(POLITICA_VERIFICACAO.limiteSimilaridade);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('a política é congelada: não há como relaxar o limite em runtime', () => {
    // I1 proíbe "flag de bypass" e "modo de desenvolvimento que relaxe isso".
    // Um threshold mutável seria exatamente isso, com outro nome.
    expect(Object.isFrozen(POLITICA_VERIFICACAO)).toBe(true);
    expect(() => {
      (POLITICA_VERIFICACAO as { limiteSimilaridade: number }).limiteSimilaridade = 0.5;
    }).toThrow(TypeError);
    expect(POLITICA_VERIFICACAO.limiteSimilaridade).toBe(0.92);
  });
});
