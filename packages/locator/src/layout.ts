import type { AncoraVerificada, CamadaTextoPagina } from './contract.js';
import { dimensoesRenderizadas, pdfParaNorm, recorteDoConteudo } from './geometry.js';

/**
 * O modelo de layout de uma página com sua âncora destacada.
 *
 * Só números, nada de DOM: quem renderiza mapeia isto para markup, seja
 * string HTML ou JSX. **Esta é a razão de o módulo existir.** O cálculo do
 * recorte, da ampliação da folha e do corpo da fonte vivia dentro de um
 * gerador de HTML, e duplicá-lo num componente React seria convite a errar de
 * novo — e de formas diferentes em cada lado. Já errei esta conta uma vez: o
 * texto desenhado por CSS divergia dos bboxes em uma linha inteira, o que é
 * indistinguível de um bug de geometria.
 *
 * Todas as medidas são frações. Multiplique por 100 para escrever porcentagem
 * CSS; nenhuma conversão além dessa é necessária, e é de propósito.
 */

export interface PalavraLayout {
  readonly texto: string;
  /** Fração da largura da página inteira. */
  readonly esquerda: number;
  readonly topo: number;
  readonly largura: number;
  /**
   * Fração da altura da página inteira. Em CSS, `${corpoFonte * 100}cqh` com
   * `container-type: size` na folha.
   *
   * O fator embutido (0.78) é a razão entre a altura do glifo e a da caixa de
   * linha — conhecimento tipográfico, que pertence aqui e não a cada
   * renderizador.
   */
  readonly corpoFonte: number;
}

export interface RealceLayout {
  readonly pagina: number;
  readonly esquerda: number;
  readonly topo: number;
  readonly largura: number;
  readonly altura: number;
}

/**
 * Como posicionar a folha dentro da janela do recorte.
 *
 * A folha é a página COMPLETA, ampliada e deslocada para que só o recorte
 * apareça pela janela. Os tokens seguem em coordenadas da página inteira, o
 * que é o ponto: nenhuma coordenada é recalculada para o recorte, então o
 * recorte não pode introduzir erro de geometria.
 */
export interface FolhaLayout {
  /** Fração da largura da janela. Maior que 1 quando o recorte amplia. */
  readonly largura: number;
  readonly altura: number;
  /** Deslocamento, fração da largura da janela. Negativo. */
  readonly esquerda: number;
  readonly topo: number;
}

export interface LayoutPagina {
  readonly pagina: number;
  readonly rotulo: string | null;
  /** `aspect-ratio` da janela do recorte. */
  readonly proporcao: number;
  readonly folha: FolhaLayout;
  readonly palavras: readonly PalavraLayout[];
  readonly realces: readonly RealceLayout[];
  /** Dimensões da página renderizada, em pontos. Para a legenda. */
  readonly larguraPt: number;
  readonly alturaPt: number;
}

const RAZAO_GLIFO_LINHA = 0.78;

export function layoutDaPagina(p: CamadaTextoPagina, ancora: AncoraVerificada | null): LayoutPagina {
  const { largura: larguraPt, altura: alturaPt } = dimensoesRenderizadas(p.geometria);
  const [cx0, cy0, cx1, cy1] = recorteDoConteudo(p);
  const larguraRecorte = cx1 - cx0;
  const alturaRecorte = cy1 - cy0;

  const palavras = p.tokens.map((t): PalavraLayout => {
    const [x0, y0, x1, y1] = pdfParaNorm(t.bbox, p.geometria);
    return {
      texto: t.texto,
      esquerda: x0,
      topo: y0,
      largura: x1 - x0,
      corpoFonte: (y1 - y0) * RAZAO_GLIFO_LINHA,
    };
  });

  const realces = (ancora?.retangulos ?? [])
    .filter((r) => r.pagina === p.pagina)
    .map(
      (r): RealceLayout => ({
        pagina: r.pagina,
        esquerda: r.bbox[0],
        topo: r.bbox[1],
        largura: r.bbox[2] - r.bbox[0],
        altura: r.bbox[3] - r.bbox[1],
      }),
    );

  return {
    pagina: p.pagina,
    rotulo: p.rotulo,
    proporcao: (larguraPt * larguraRecorte) / (alturaPt * alturaRecorte),
    folha: {
      largura: 1 / larguraRecorte,
      altura: 1 / alturaRecorte,
      esquerda: -(cx0 / larguraRecorte),
      topo: -(cy0 / alturaRecorte),
    },
    palavras,
    realces,
    larguraPt,
    alturaPt,
  };
}
