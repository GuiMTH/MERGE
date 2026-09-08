import { describe, expect, it } from 'vitest';
import { comoId, ehUuid } from '../src/ids.js';
import { exigeRevisaoHumana } from '../src/domain/enums.js';

describe('ids', () => {
  it('aceita uuid e rejeita o resto', () => {
    expect(ehUuid('9f1c3b7a-2d4e-4a6b-8c1d-5e7f9a0b1c2d')).toBe(true);
    expect(ehUuid('nao-sou-uuid')).toBe(false);
    expect(() => comoId('nao-sou-uuid')).toThrow(TypeError);
  });
});

describe('exigeRevisaoHumana (§6.3)', () => {
  it('off_label e parcial sempre exigem olho humano', () => {
    expect(exigeRevisaoHumana('off_label')).toBe(true);
    expect(exigeRevisaoHumana('parcial')).toBe(true);
  });

  it('coberta e nao_avaliada não são forçadas por esta regra', () => {
    expect(exigeRevisaoHumana('coberta')).toBe(false);
    expect(exigeRevisaoHumana('nao_avaliada')).toBe(false);
  });
});
