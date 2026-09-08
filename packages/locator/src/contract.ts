import type { ReferenciaId } from '@merge/contracts';

/**
 * Retângulo em espaço de usuário do PDF: **relativo ao CropBox**, y para
 * cima, pré-rotação, em pontos.
 *
 * "Relativo ao CropBox" é a parte que morde: muitos PDFs de publisher trazem
 * um CropBox deslocado em relação ao MediaBox, e um adaptador que devolve
 * coordenadas de MediaBox produz caixas visivelmente tortas. Use
 * `paraCropBoxRelativo()` na borda do parser, uma vez, e nunca mais pense
 * nisso.
 */
export type BBoxPdf = readonly [x0: number, y0: number, x1: number, y1: number];

/**
 * Retângulo em fração 0..1 da página **renderizada**: y para baixo,
 * pós-rotação.
 *
 * Definido contra a página como um humano a vê, porque é isto que o dossiê
 * escreve direto como porcentagem CSS. Zero matemática em runtime, zero
 * acoplamento a DPI, e independente da versão do renderizador — que vai
 * mudar ao longo dos anos em que o dossiê tem de continuar reproduzível.
 */
export type BBoxNorm = readonly [x0: number, y0: number, x1: number, y1: number];

export type Rotacao = 0 | 90 | 180 | 270;

/** Geometria da página, o suficiente para converter caixas sem adivinhar. */
export interface GeometriaPagina {
  /** Largura do CropBox em pontos, PRÉ-rotação. */
  readonly larguraPt: number;
  /** Altura do CropBox em pontos, PRÉ-rotação. */
  readonly alturaPt: number;
  readonly rotacao: Rotacao;
}

/** Um token de texto com sua posição no texto cru e na página. */
export interface TokenTexto {
  readonly texto: string;
  /** Offset inicial em `CamadaTextoPagina.cru`. */
  readonly cruInicio: number;
  /** Offset final exclusivo em `CamadaTextoPagina.cru`. */
  readonly cruFim: number;
  readonly bbox: BBoxPdf;
  /** Índice da linha visual. Uma citação que atravessa 3 linhas rende 3 retângulos. */
  readonly linha: number;
}

/**
 * O que o parser tem de entregar por página. É o contrato do bake-off da
 * Fase 0 e o contrato de produção — o mesmo, de propósito: se o harness
 * medisse uma coisa e a produção rodasse outra, o bake-off não provaria nada.
 */
export interface CamadaTextoPagina {
  readonly referenciaId: ReferenciaId;
  readonly referenciaVersao: number;
  /** sha256 do documento. Amarra o localizador aos bytes exatos (I6/I7). */
  readonly documentoSha256: string;
  /** Índice da página na árvore, 1-based. */
  readonly pagina: number;
  /**
   * O número IMPRESSO na página, quando difere do índice.
   *
   * Material suplementar numera `S1..Sn` e artigo de periódico costuma numerar
   * pela paginação do volume. Dizer "página 12" a um revisor que cai numa
   * página estampada `S3` custa a confiança na hora — e confiança é o produto.
   */
  readonly rotulo: string | null;
  /** Texto em ordem de leitura. Os offsets dos tokens indexam esta string. */
  readonly cru: string;
  readonly tokens: readonly TokenTexto[];
  readonly geometria: GeometriaPagina;
}

/** Acesso às páginas de um documento, sem impor de onde elas vêm. */
export interface AcervoPaginas {
  obter(pagina: number): CamadaTextoPagina | undefined;
  readonly totalPaginas: number;
}

/** Um retângulo já resolvido para render, com a página a que pertence. */
export interface RetanguloPagina {
  readonly pagina: number;
  readonly bbox: BBoxNorm;
}

export type TierCorrespondencia = 't0' | 't1' | 't2' | 't3' | 't4';

export interface SinalizadoresAncora {
  /** Correspondeu só ignorando caixa. Benigno por si só. */
  readonly caixaDivergente: boolean;
  /** A citação estava na página vizinha. O modelo errou a página: força revisão humana. */
  readonly paginaCorrigida: boolean;
  /** A citação atravessa a quebra de página. */
  readonly atravessaPaginas: boolean;
}

/**
 * Uma âncora verificada. É o que vai para o banco e o que o dossiê renderiza.
 *
 * `quoteVerificada` é a fatia LITERAL do documento nos offsets encontrados —
 * não a string que o modelo emitiu. Se o modelo escreveu com aspas curvas e o
 * documento tem retas, o que se persiste e se exibe é o do documento.
 */
export interface AncoraVerificada {
  readonly referenciaId: ReferenciaId;
  readonly referenciaVersao: number;
  readonly documentoSha256: string;
  readonly pagina: number;
  readonly rotulo: string | null;
  readonly quoteVerificada: string;
  readonly cruInicio: number;
  readonly cruFim: number;
  readonly tier: TierCorrespondencia;
  readonly similaridade: number;
  readonly retangulos: readonly RetanguloPagina[];
  readonly geometria: GeometriaPagina;
  readonly sinalizadores: SinalizadoresAncora;
  readonly politicaVersao: string;
  /** Verdadeiro quando algum sinalizador obriga olho humano antes do sign-off. */
  readonly requerRevisaoHumana: boolean;
}

export type MotivoRejeicao =
  | 'quote_vazia'
  | 'quote_curta_demais'
  | 'pagina_inexistente'
  | 'quote_com_elipse'
  | 'nao_encontrada'
  | 'similaridade_abaixo_do_limite'
  | 'deriva_numerica'
  | 'deriva_de_negacao'
  | 'clausula_elidida'
  | 'geometria_ausente';

export interface DiagnosticoRejeicao {
  readonly motivo: MotivoRejeicao;
  readonly melhorSimilaridade: number | null;
  readonly detalhe: string;
}

/**
 * O resultado é uma união discriminada, e não um objeto com campos opcionais,
 * porque não existe "aceite parcial": ou a âncora está verificada e a claim
 * pode existir, ou ela vira gap (I1). Um `AncoraVerificada | undefined` num
 * mesmo objeto convidaria alguém a persistir a claim e ver a âncora depois.
 */
export type ResultadoVerificacao =
  | { readonly status: 'verificada'; readonly ancora: AncoraVerificada }
  | { readonly status: 'rejeitada'; readonly diagnostico: DiagnosticoRejeicao };

export interface EntradaVerificacao {
  /** A citação como o modelo a emitiu. Não confiamos que seja literal. */
  readonly quote: string;
  /** A página que o modelo alegou. Verificamos, e corrigimos em ±1 no máximo. */
  readonly paginaAlegada: number;
  readonly paginas: AcervoPaginas;
}
