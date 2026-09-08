import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertWireSchema, jsonSchemaDe } from '../src/llm/wire-schema.js';
import { InvarianteViolada } from '../src/errors.js';

/**
 * Cada caso aqui corresponde a uma forma verificada de o `toJSONSchema`
 * produzir um schema que não é o que o autor pensa que escreveu. As
 * asserções foram derivadas de sondagem do zod em uso, não de suposição.
 */
describe('assertWireSchema', () => {
  it('aceita um objeto estrito de tipos JSON', () => {
    const s = assertWireSchema(
      z.strictObject({
        texto: z.string().min(1),
        n: z.int().min(1).max(5),
        flag: z.boolean(),
        lista: z.array(z.strictObject({ p: z.int() })),
        enumerado: z.enum(['a', 'b']),
        opcional: z.string().optional(),
        anulavel: z.string().nullable(),
      }),
      'Ok',
    );
    expect(jsonSchemaDe(s)['additionalProperties']).toBe(false);
  });

  it('rejeita .refine(), que o toJSONSchema OMITE em silêncio', () => {
    // A regra desapareceria do schema enviado ao modelo sem nenhum erro.
    // Este é o caso mais perigoso da lista, e o motivo do walker existir.
    const cru = z.strictObject({ a: z.string().refine((v) => v.length > 2) });
    expect(z.toJSONSchema(cru, { target: 'draft-2020-12' })).toMatchObject({
      properties: { a: { type: 'string' } },
    });
    expect(() => assertWireSchema(cru, 'ComRefine')).toThrow(InvarianteViolada);
    expect(() => assertWireSchema(cru, 'ComRefine')).toThrow(/refine/);
  });

  it('rejeita .superRefine()', () => {
    expect(() => assertWireSchema(z.strictObject({ a: z.string().superRefine(() => {}) }), 'X')).toThrow(
      InvarianteViolada,
    );
  });

  it('rejeita .transform() e .pipe()', () => {
    expect(() => assertWireSchema(z.strictObject({ a: z.string().transform((v) => v.length) }), 'T')).toThrow(
      /pipe|transform/,
    );
    expect(() => assertWireSchema(z.strictObject({ a: z.string().pipe(z.string()) }), 'P')).toThrow(/pipe/);
  });

  it('rejeita .default() e .catch(), que preenchem campo que o modelo não produziu', () => {
    expect(() => assertWireSchema(z.strictObject({ a: z.string().default('x') }), 'D')).toThrow(/default/);
    // `catch` engole a falha de validação — exatamente o "texto salvo cru" que I5 proíbe.
    expect(() => assertWireSchema(z.strictObject({ a: z.string().catch('x') }), 'C')).toThrow(/catch/);
  });

  it('rejeita objeto não-estrito', () => {
    expect(() => assertWireSchema(z.object({ a: z.string() }), 'Solto')).toThrow(/strictObject/);
    expect(() => assertWireSchema(z.looseObject({ a: z.string() }), 'Loose')).toThrow(/strictObject/);
  });

  it('rejeita objeto não-estrito ANINHADO', () => {
    expect(() =>
      assertWireSchema(z.strictObject({ a: z.array(z.object({ p: z.string() })) }), 'Aninhado'),
    ).toThrow(/strictObject/);
  });

  it('rejeita união não discriminada e aceita discriminada', () => {
    expect(() => assertWireSchema(z.strictObject({ a: z.union([z.string(), z.number()]) }), 'U')).toThrow(
      /discriminad/,
    );
    expect(() =>
      assertWireSchema(
        z.strictObject({
          a: z.discriminatedUnion('k', [
            z.strictObject({ k: z.literal('x'), v: z.string() }),
            z.strictObject({ k: z.literal('y'), v: z.int() }),
          ]),
        }),
        'DU',
      ),
    ).not.toThrow();
  });

  it('rejeita tipos que não existem em JSON', () => {
    for (const [nome, s] of [
      ['date', z.date()],
      ['bigint', z.bigint()],
      ['map', z.map(z.string(), z.string())],
      ['set', z.set(z.string())],
      ['any', z.any()],
      ['unknown', z.unknown()],
    ] as const) {
      expect(() => assertWireSchema(z.strictObject({ a: s }), nome), nome).toThrow(InvarianteViolada);
    }
  });

  it('exige objeto na raiz', () => {
    expect(() => assertWireSchema(z.array(z.strictObject({})), 'Raiz')).toThrow(/raiz/);
  });

  it('rejeita schema recursivo', () => {
    expect(() => assertWireSchema(z.strictObject({ a: z.lazy(() => z.string()) }), 'L')).toThrow(/lazy/);
  });

  it('jsonSchemaDe remove $schema para não poluir o hash de contrato', () => {
    expect(jsonSchemaDe(assertWireSchema(z.strictObject({ a: z.string() }), 'H'))).not.toHaveProperty('$schema');
  });
});
