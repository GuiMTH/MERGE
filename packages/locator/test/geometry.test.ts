import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { BBoxPdf, GeometriaPagina, Rotacao } from '../src/contract.js';
import { dimensoesRenderizadas, normParaPdf, paraCropBoxRelativo, pdfParaNorm } from '../src/geometry.js';

const ROTACOES: readonly Rotacao[] = [0, 90, 180, 270];

describe('pdfParaNorm', () => {
  const g: GeometriaPagina = { larguraPt: 600, alturaPt: 800, rotacao: 0 };

  it('vira o eixo y: o topo da página em PDF é y=0 normalizado', () => {
    // Caixa colada no topo em espaço PDF (y alto).
    const [x0, y0, x1, y1] = pdfParaNorm([0, 780, 60, 800], g);
    expect(x0).toBeCloseTo(0, 6);
    expect(y0).toBeCloseTo(0, 6);
    expect(x1).toBeCloseTo(0.1, 6);
    expect(y1).toBeCloseTo(0.025, 6);
  });

  it('rotação 90 leva o canto superior-esquerdo ao superior-direito', () => {
    const canto: BBoxPdf = [0, 640, 60, 800]; // topo-esquerda, y para cima
    const [x0, y0, x1, y1] = pdfParaNorm(canto, { ...g, rotacao: 90 });
    expect(x1).toBeCloseTo(1, 6);
    expect(x0).toBeCloseTo(0.8, 6);
    expect(y0).toBeCloseTo(0, 6);
    expect(y1).toBeCloseTo(0.1, 6);
  });

  it('rotação 270 leva o canto superior-esquerdo ao inferior-esquerdo', () => {
    const [x0, y0, x1, y1] = pdfParaNorm([0, 640, 60, 800], { ...g, rotacao: 270 });
    expect(x0).toBeCloseTo(0, 6);
    expect(x1).toBeCloseTo(0.2, 6);
    expect(y1).toBeCloseTo(1, 6);
    expect(y0).toBeCloseTo(0.9, 6);
  });

  it('as dimensões renderizadas trocam em 90 e 270', () => {
    expect(dimensoesRenderizadas({ ...g, rotacao: 0 })).toEqual({ largura: 600, altura: 800 });
    expect(dimensoesRenderizadas({ ...g, rotacao: 90 })).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesRenderizadas({ ...g, rotacao: 270 })).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesRenderizadas({ ...g, rotacao: 180 })).toEqual({ largura: 600, altura: 800 });
  });

  it('rejeita geometria degenerada em vez de devolver NaN', () => {
    expect(() => pdfParaNorm([0, 0, 1, 1], { larguraPt: 0, alturaPt: 800, rotacao: 0 })).toThrow(RangeError);
  });
});

describe('paraCropBoxRelativo', () => {
  it('subtrai a origem do CropBox', () => {
    // Um CropBox deslocado é comum em PDF de publisher, e é a causa clássica
    // de destaque plausível mas deslocado.
    expect(paraCropBoxRelativo([100, 200, 160, 220], [10, 20])).toEqual([90, 180, 150, 200]);
  });
});

describe('round-trip pdf -> norm -> pdf', () => {
  it('recupera a caixa original em todas as rotações e proporções', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 1200 }),
        fc.integer({ min: 200, max: 1200 }),
        fc.constantFrom(...ROTACOES),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (larguraPt, alturaPt, rotacao, a, b, c, d) => {
          const g: GeometriaPagina = { larguraPt, alturaPt, rotacao };
          const original: BBoxPdf = [
            Math.min(a, b) * larguraPt,
            Math.min(c, d) * alturaPt,
            Math.max(a, b) * larguraPt,
            Math.max(c, d) * alturaPt,
          ];
          const volta = normParaPdf(pdfParaNorm(original, g), g);
          for (let i = 0; i < 4; i += 1) {
            const esperado = original[i];
            const obtido = volta[i];
            if (esperado === undefined || obtido === undefined) throw new Error('caixa incompleta');
            expect(obtido).toBeCloseTo(esperado, 5);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
