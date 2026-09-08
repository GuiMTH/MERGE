import type { BBoxNorm, BBoxPdf, GeometriaPagina, Rotacao } from './contract.js';

/**
 * Conversão de geometria. Um único lugar decide, de propósito.
 *
 * Quatro sistemas de coordenadas colidem neste projeto: espaço de usuário do
 * PDF (origem embaixo à esquerda), o espaço `top`-based do pdfplumber (y para
 * baixo, relativo ao MediaBox), o espaço do pdfium/MuPDF (y para baixo,
 * relativo ao CropBox) e o viewport pós-transform do pdf.js. Some `/Rotate` e
 * um CropBox deslocado, e há oito maneiras de errar por um sinal.
 *
 * Espalhar essa conversão por adaptadores é como se produz uma caixa
 * perfeitamente plausível 40 pontos acima do texto que ela deveria destacar.
 */

/**
 * Traz uma caixa em coordenadas absolutas de página para relativa ao CropBox.
 *
 * Chame isto na borda do parser, uma vez. `BBoxPdf` é definido como
 * CropBox-relativo, e o resto do sistema conta com isso.
 */
export function paraCropBoxRelativo(bbox: BBoxPdf, cropBoxOrigem: readonly [number, number]): BBoxPdf {
  const [ox, oy] = cropBoxOrigem;
  const [x0, y0, x1, y1] = bbox;
  return [x0 - ox, y0 - oy, x1 - ox, y1 - oy];
}

/** Dimensões da página como ela é RENDERIZADA, isto é, depois da rotação. */
export function dimensoesRenderizadas(g: GeometriaPagina): { largura: number; altura: number } {
  return g.rotacao === 90 || g.rotacao === 270
    ? { largura: g.alturaPt, altura: g.larguraPt }
    : { largura: g.larguraPt, altura: g.alturaPt };
}

/**
 * Aplica a rotação de página a um ponto já em fração 0..1, y para baixo.
 *
 * `/Rotate 90` significa "gire 90° no sentido horário ao exibir". Girar o
 * conteúdo 90° horário leva o canto superior-esquerdo ao superior-direito,
 * que é o que `(u,v) -> (1-v, u)` faz.
 */
function rotacionarUnitario(u: number, v: number, rotacao: Rotacao): readonly [number, number] {
  switch (rotacao) {
    case 0:
      return [u, v];
    case 90:
      return [1 - v, u];
    case 180:
      return [1 - u, 1 - v];
    case 270:
      return [v, 1 - u];
  }
}

function grampear(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * PDF (CropBox-relativo, y para cima, pré-rotação) -> normalizado
 * (0..1 da página renderizada, y para baixo, pós-rotação).
 */
export function pdfParaNorm(bbox: BBoxPdf, g: GeometriaPagina): BBoxNorm {
  if (g.larguraPt <= 0 || g.alturaPt <= 0) {
    throw new RangeError(`geometria de página inválida: ${g.larguraPt}x${g.alturaPt}`);
  }
  const [x0, y0, x1, y1] = bbox;

  // Normaliza no referencial pré-rotação e vira o eixo y (PDF é y para cima,
  // tela é y para baixo).
  const cantos = [
    rotacionarUnitario(x0 / g.larguraPt, 1 - y1 / g.alturaPt, g.rotacao),
    rotacionarUnitario(x1 / g.larguraPt, 1 - y0 / g.alturaPt, g.rotacao),
  ] as const;

  const xs = cantos.map(([u]) => u);
  const ys = cantos.map(([, v]) => v);
  return [
    grampear(Math.min(...xs)),
    grampear(Math.min(...ys)),
    grampear(Math.max(...xs)),
    grampear(Math.max(...ys)),
  ];
}

/** Inverso de `pdfParaNorm`. Existe para que o round-trip seja testável. */
export function normParaPdf(bbox: BBoxNorm, g: GeometriaPagina): BBoxPdf {
  const [nx0, ny0, nx1, ny1] = bbox;

  const desrotacionar = (u: number, v: number): readonly [number, number] => {
    switch (g.rotacao) {
      case 0:
        return [u, v];
      case 90:
        return [v, 1 - u];
      case 180:
        return [1 - u, 1 - v];
      case 270:
        return [1 - v, u];
    }
  };

  const cantos = [desrotacionar(nx0, ny0), desrotacionar(nx1, ny1)] as const;
  const us = cantos.map(([u]) => u);
  const vs = cantos.map(([, v]) => v);

  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);

  return [u0 * g.larguraPt, (1 - v1) * g.alturaPt, u1 * g.larguraPt, (1 - v0) * g.alturaPt];
}

/** União de dois retângulos normalizados. */
export function unir(a: BBoxNorm, b: BBoxNorm): BBoxNorm {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * Clipa horizontalmente um retângulo por interpolação linear dentro do token.
 *
 * Usado quando a citação começa ou termina no MEIO de um token: o destaque
 * tem de cobrir a parte citada, não a palavra inteira. A interpolação assume
 * avanço horizontal uniforme dentro do token, que é uma aproximação — mas
 * bem melhor que destacar a palavra toda, e o erro fica dentro de um glifo.
 */
export function clipeHorizontal(bbox: BBoxNorm, fracaoInicio: number, fracaoFim: number): BBoxNorm {
  const [x0, y0, x1, y1] = bbox;
  const largura = x1 - x0;
  return [x0 + largura * grampear(fracaoInicio), y0, x0 + largura * grampear(fracaoFim), y1];
}
