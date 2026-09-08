import { describe, expect, it } from 'vitest';
import {
  briefingEnrichmentOutputV1,
  claimExtractionOutputV1,
  labelConfrontationOutputV1,
} from '../src/llm/index.js';
import { jsonSchemaDe } from '../src/llm/wire-schema.js';

/**
 * Snapshots golden do JSON Schema que vai literalmente no `input_schema` da
 * tool.
 *
 * O ponto não é detectar mudança de tipos — o tsc já faz isso. É que uma
 * mudança no schema muda o que o MODELO vê, e portanto invalida a baseline do
 * harness de avaliação. Um diff revisável aqui obriga alguém a decidir se a
 * mudança justifica re-rodar o gold set.
 */
describe('JSON Schema dos contratos do §6', () => {
  it('6.1 enriquecimento de briefing', () => {
    expect(jsonSchemaDe(briefingEnrichmentOutputV1)).toMatchSnapshot();
  });

  it('6.2 extração e ancoragem de claims', () => {
    expect(jsonSchemaDe(claimExtractionOutputV1)).toMatchSnapshot();
  });

  it('6.3 confronto com label', () => {
    expect(jsonSchemaDe(labelConfrontationOutputV1)).toMatchSnapshot();
  });

  it('I1 no fio: ancoragem tem minItems 1, então claim sem localizador é inválida antes do banco', () => {
    const js = jsonSchemaDe(claimExtractionOutputV1) as {
      properties: { claims: { items: { properties: { ancoragem: { minItems?: number } } } } };
    };
    expect(js.properties.claims.items.properties.ancoragem.minItems).toBe(1);
  });

  it('toda a árvore proíbe campo extra, então o modelo não contrabandeia dado não validado', () => {
    const visitar = (no: unknown, caminho: string): void => {
      if (typeof no !== 'object' || no === null) return;
      const n = no as Record<string, unknown>;
      if (n['type'] === 'object') {
        expect(n['additionalProperties'], `${caminho} permite campo extra`).toBe(false);
      }
      for (const [k, v] of Object.entries(n)) visitar(v, `${caminho}.${k}`);
    };
    // Os JSON Schemas são gerados antes de entrar na lista: um array
    // heterogêneo de `WireSchema<T>` unifica os T e o tsc reclama, com razão.
    for (const [nome, js] of [
      ['6.1', jsonSchemaDe(briefingEnrichmentOutputV1)],
      ['6.2', jsonSchemaDe(claimExtractionOutputV1)],
      ['6.3', jsonSchemaDe(labelConfrontationOutputV1)],
    ] as const) {
      visitar(js, nome);
    }
  });
});
