import { comoId, type ReferenciaId } from '@merge/contracts';
import type { AcervoPaginas, CamadaTextoPagina, Rotacao, TokenTexto } from './contract.js';

/**
 * Páginas sintéticas que cumprem o contrato do parser.
 *
 * Não imita um PDF — imita o CONTRATO que um parser de verdade tem de
 * cumprir. Isso é útil em três lugares e por isso vive no pacote em vez de na
 * pasta de testes: nos testes de `verifyQuote`, no verificador visual de
 * geometria (`pnpm demo`), e depois como caso de controle do bake-off, onde
 * um candidato real é comparado contra uma página cuja resposta é conhecida
 * exatamente.
 */

const LARGURA_PADRAO = 612;
const ALTURA_PADRAO = 792;
const MARGEM = 54;
const ALTURA_LINHA = 14;
const LARGURA_CARACTERE = 5.2;

export interface OpcoesPaginaSintetica {
  readonly pagina?: number;
  readonly rotacao?: Rotacao;
  readonly rotulo?: string | null;
  readonly referenciaId?: ReferenciaId;
}

const REF_PADRAO: ReferenciaId = comoId<'ReferenciaId'>('9f1c3b7a-2d4e-4a6b-8c1d-5e7f9a0b1c2d');

/**
 * Constrói uma página a partir de um texto com quebras de linha.
 *
 * Os tokens são as palavras, com avanço horizontal uniforme e uma linha por
 * quebra. As caixas saem em espaço PDF (y para cima, relativo ao CropBox),
 * como um parser de verdade as entrega.
 */
export function paginaSintetica(texto: string, opcoes: OpcoesPaginaSintetica = {}): CamadaTextoPagina {
  const tokens: TokenTexto[] = [];
  let deslocamento = 0;

  texto.split('\n').forEach((linhaTexto, linha) => {
    const topo = ALTURA_PADRAO - MARGEM - linha * ALTURA_LINHA;
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
    referenciaId: opcoes.referenciaId ?? REF_PADRAO,
    referenciaVersao: 1,
    documentoSha256: 'a'.repeat(64),
    pagina: opcoes.pagina ?? 12,
    rotulo: opcoes.rotulo ?? null,
    cru: texto,
    tokens,
    geometria: { larguraPt: LARGURA_PADRAO, alturaPt: ALTURA_PADRAO, rotacao: opcoes.rotacao ?? 0 },
  };
}

export function acervoDe(...paginas: readonly CamadaTextoPagina[]): AcervoPaginas {
  const mapa = new Map(paginas.map((p) => [p.pagina, p]));
  return { obter: (n) => mapa.get(n), totalPaginas: paginas.length };
}

/**
 * Texto de estudo com números e termos de negação, para as guardas do tier
 * fuzzy terem no que morder.
 */
export const TEXTO_ESTUDO = [
  'No estudo DAPA-HF, a dapagliflozina reduziu o desfecho primario composto',
  'de piora da insuficiencia cardiaca ou morte cardiovascular, com razao de',
  'risco de 0,74 (IC 95% 0,65 a 0,85) em comparacao com placebo. A reducao',
  'foi consistente entre pacientes com e sem diabetes tipo 2 no momento da',
  'randomizacao. Nao houve diferenca significativa na incidencia de eventos',
  'adversos graves entre os grupos, e a taxa de descontinuacao foi de 4,7%.',
].join('\n');
