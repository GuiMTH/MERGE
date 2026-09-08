import { comoId, type ReferenciaId } from '@merge/contracts';
import type { AcervoPaginas, CamadaTextoPagina, Rotacao, TokenTexto } from '../src/contract.js';

const REF: ReferenciaId = comoId<'ReferenciaId'>('9f1c3b7a-2d4e-4a6b-8c1d-5e7f9a0b1c2d');

const LARGURA = 612;
const ALTURA = 792;
const MARGEM = 54;
const ALTURA_LINHA = 14;
const LARGURA_CARACTERE = 5.2;

/**
 * Constrói uma página sintética a partir de um texto com quebras de linha.
 *
 * Os tokens são as palavras, com bbox sintético em avanço horizontal uniforme
 * e uma linha por quebra. Não imita um PDF de verdade — imita o CONTRATO que
 * um parser de verdade tem de cumprir, que é o que estes testes exercitam.
 */
export function paginaDe(
  texto: string,
  opcoes: { pagina?: number; rotacao?: Rotacao; rotulo?: string | null } = {},
): CamadaTextoPagina {
  const tokens: TokenTexto[] = [];
  let deslocamento = 0;

  texto.split('\n').forEach((linhaTexto, linha) => {
    const topo = ALTURA - MARGEM - linha * ALTURA_LINHA;
    let x = MARGEM;
    let coluna = 0;

    for (const palavra of linhaTexto.split(' ')) {
      if (palavra.length > 0) {
        const largura = palavra.length * LARGURA_CARACTERE;
        tokens.push({
          texto: palavra,
          cruInicio: deslocamento + coluna,
          cruFim: deslocamento + coluna + palavra.length,
          bbox: [x, topo - ALTURA_LINHA + 3, x + largura, topo],
          linha,
        });
        x += largura;
      }
      x += LARGURA_CARACTERE;
      coluna += palavra.length + 1;
    }

    deslocamento += linhaTexto.length + 1; // +1 pela quebra de linha
  });

  return {
    referenciaId: REF,
    referenciaVersao: 1,
    documentoSha256: 'a'.repeat(64),
    pagina: opcoes.pagina ?? 12,
    rotulo: opcoes.rotulo ?? null,
    cru: texto,
    tokens,
    geometria: { larguraPt: LARGURA, alturaPt: ALTURA, rotacao: opcoes.rotacao ?? 0 },
  };
}

export function acervoDe(...paginas: readonly CamadaTextoPagina[]): AcervoPaginas {
  const mapa = new Map(paginas.map((p) => [p.pagina, p]));
  return {
    obter: (n) => mapa.get(n),
    totalPaginas: paginas.length,
  };
}

/** Texto de estudo, com números e termos de negação para as guardas morderem. */
export const TEXTO_ESTUDO = [
  'No estudo DAPA-HF, a dapagliflozina reduziu o desfecho primario composto',
  'de piora da insuficiencia cardiaca ou morte cardiovascular, com razao de',
  'risco de 0,74 (IC 95% 0,65 a 0,85) em comparacao com placebo. A reducao',
  'foi consistente entre pacientes com e sem diabetes tipo 2 no momento da',
  'randomizacao. Nao houve diferenca significativa na incidencia de eventos',
  'adversos graves entre os grupos, e a taxa de descontinuacao foi de 4,7%.',
].join('\n');
