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

/* ─────────────────────── casos canônicos ─────────────────────────────── */

/**
 * Os oito casos canônicos do verificador.
 *
 * Pareados de propósito: cada rejeição tem uma aceitação vizinha de texto
 * quase idêntico. Sem o par, um leitor conclui que o sistema rejeita o que é
 * "diferente"; com o par, fica visível que ele rejeita o que muda o SENTIDO e
 * aceita o que muda só a apresentação.
 */
export interface Caso {
  readonly id: string;
  readonly titulo: string;
  readonly porque: string;
  readonly quote: string;
  /** O caso de contraste, quando existe. */
  readonly par?: { readonly id: string; readonly nota: string };
}

export const CASOS: readonly Caso[] = [
  {
    id: 'literal',
    titulo: 'Citação literal',
    porque: 'O modelo copiou fiel. Casa direto na string crua, sem normalizar nada.',
    quote: 'a dapagliflozina reduziu o desfecho primario composto',
  },
  {
    id: 'quebra-linha',
    titulo: 'Atravessa quebra de linha',
    porque:
      'No documento a frase quebra entre duas linhas; o modelo devolveu numa linha só. ' +
      'O destaque tem de sair em dois retângulos, um por linha — e não como um caixote sobre o parágrafo.',
    quote: 'com razao de risco de 0,74 (IC 95% 0,65 a 0,85) em comparacao com placebo',
    par: { id: 'numerica', nota: 'a mesma frase com 0,84 no lugar de 0,74 é rejeitada' },
  },
  {
    id: 'glifos',
    titulo: 'Glifos trocados',
    porque:
      'Travessão longo e espaço inquebrável onde o documento tem hífen e espaço comum — ' +
      'o que um copy-paste de PDF costuma produzir.',
    quote: 'No estudo DAPA–HF, a dapagliflozina reduziu o desfecho',
  },
  {
    id: 'caixa',
    titulo: 'Só a caixa difere',
    porque:
      'Benigno por si só, e fica registrado. Note que o texto persistido é o do DOCUMENTO, ' +
      'não a string que o modelo emitiu.',
    quote: 'A DAPAGLIFLOZINA REDUZIU O DESFECHO PRIMARIO',
  },
  {
    id: 'numerica',
    titulo: 'Deriva numérica',
    porque:
      'Idêntica à citação de risco aceita acima, com 0,84 no lugar de 0,74. Similaridade acima ' +
      'de 0,98 e o tamanho de efeito errado — que é justamente o número que a peça ia afirmar.',
    quote: 'risco de 0,84 (IC 95% 0,65 a 0,85) em comparacao com placebo',
    par: { id: 'quebra-linha', nota: 'a versão com 0,74 é aceita, no tier t1' },
  },
  {
    id: 'negacao',
    titulo: 'Deriva de negação',
    porque:
      'O documento diz "Nao houve diferenca". A citação começa antes e termina depois do "Nao", ' +
      'então a janela de alinhamento é obrigada a contê-lo e a guarda morde. Similaridade ~0,96, ' +
      'conclusão invertida.',
    quote: 'no momento da randomizacao. houve diferenca significativa na incidencia de eventos adversos graves',
  },
  {
    id: 'elidida',
    titulo: 'Cláusula elidida',
    porque:
      'Doze caracteres cortados do meio. Similaridade ~0,94, acima do limite — nem o threshold ' +
      'agregado nem um teste de comprimento pegariam. Só a guarda de divergência concentrada pega.',
    quote:
      'No estudo DAPA-HF, a dapagliflozina reduziu o desfecho primario composto insuficiencia cardiaca ' +
      'ou morte cardiovascular, com razao de risco de 0,74 (IC 95%',
  },
  {
    id: 'elipse',
    titulo: 'Elipse',
    porque:
      'Elipse é confissão de que o texto não é literal: o modelo costurou dois trechos, e a costura ' +
      'é onde o sentido se perde. Rejeitada de saída, sem chegar aos tiers.',
    quote: 'a dapagliflozina reduziu … morte cardiovascular',
  },
];
