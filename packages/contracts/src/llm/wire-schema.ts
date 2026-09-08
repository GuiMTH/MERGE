import { z } from 'zod';
import { InvarianteViolada } from '../errors.js';

/**
 * Um `WireSchema` é um schema zod que se sabe representável em JSON Schema
 * sem perda, e portanto seguro para virar o `input_schema` de uma tool.
 *
 * A marca não é decorativa: `LlmAdapter.generateStructured` aceita só
 * `WireSchema`, então um schema que nunca passou por `assertWireSchema` não
 * consegue chegar ao modelo. É assim que I5 deixa de depender de disciplina.
 */
declare const marcaWire: unique symbol;

export type WireSchema<TOut> = z.ZodType<TOut> & { readonly [marcaWire]: true };

/**
 * Constructs que NUNCA podem aparecer num wire schema.
 *
 * Os motivos foram verificados empiricamente contra o zod em uso, não supostos:
 *
 *  - `pipe` (e portanto `transform`, que o zod representa como pipe): o
 *    `toJSONSchema` emite só o lado de saída, então a restrição de entrada
 *    desaparece do schema enviado ao modelo — ou lança, no caso de transform.
 *  - `lazy`: resolve silenciosamente, e schema recursivo não tem representação
 *    fiel numa tool de um turno.
 *  - `default` / `prefault` / `catch`: preenchem um campo que o modelo NÃO
 *    produziu. `catch` é o pior: engole a falha de validação, que é
 *    exatamente o "texto salvo cru" que I5 proíbe.
 *  - `date` / `bigint` / `map` / `set` / `symbol` / `function` / `promise` /
 *    `file`: não existem em JSON.
 *  - `any` / `unknown` / `never` / `void`: um campo sem forma declarada é um
 *    campo sem contrato.
 */
const TIPOS_PROIBIDOS = new Set([
  'pipe',
  'transform',
  'lazy',
  'default',
  'prefault',
  'catch',
  'date',
  'bigint',
  'map',
  'set',
  'symbol',
  'function',
  'promise',
  'file',
  'any',
  'unknown',
  'never',
  'void',
  'custom',
  'intersection',
]);

interface DefZod {
  readonly type?: string;
  readonly shape?: Record<string, unknown>;
  readonly element?: unknown;
  readonly innerType?: unknown;
  readonly options?: readonly unknown[];
  readonly discriminator?: string;
  readonly keyType?: unknown;
  readonly valueType?: unknown;
  readonly catchall?: unknown;
  readonly checks?: readonly unknown[];
}

function def(no: unknown): DefZod | undefined {
  if (typeof no !== 'object' || no === null) return undefined;
  const interno = (no as { _zod?: { def?: unknown } })._zod;
  const d = interno?.def;
  return typeof d === 'object' && d !== null ? (d as DefZod) : undefined;
}

function temRefinamentoCustom(d: DefZod): boolean {
  return (d.checks ?? []).some((c) => def(c)?.type === 'custom' || nomeDoCheck(c) === 'custom');
}

function nomeDoCheck(check: unknown): string | undefined {
  if (typeof check !== 'object' || check === null) return undefined;
  const d = (check as { _zod?: { def?: { check?: unknown } } })._zod?.def;
  return typeof d?.check === 'string' ? d.check : undefined;
}

function falhar(caminho: string, motivo: string): never {
  throw new InvarianteViolada(
    'SCHEMA_NAO_SERIALIZAVEL',
    `wire schema inválido em \`${caminho}\`: ${motivo}`,
    { caminho },
  );
}

function visitar(no: unknown, caminho: string, vistos: Set<unknown>): void {
  const d = def(no);
  if (!d) falhar(caminho, 'não é um schema zod');
  if (vistos.has(no)) falhar(caminho, 'schema recursivo — sem representação fiel numa tool de um turno');
  vistos.add(no);

  const tipo = d.type ?? '<desconhecido>';

  if (TIPOS_PROIBIDOS.has(tipo)) {
    falhar(caminho, `\`${tipo}\` não sobrevive à conversão para JSON Schema`);
  }

  // O caso mais perigoso, porque é silencioso: `.refine()` / `.superRefine()`
  // são simplesmente omitidos do JSON Schema. O modelo nunca vê a regra, e o
  // autor do schema acha que viu. Regra de negócio se computa em código e se
  // impõe no banco — nunca se pede gentilmente ao modelo.
  if (temRefinamentoCustom(d)) {
    falhar(
      caminho,
      '`.refine()`/`.superRefine()` desaparecem do JSON Schema sem erro. ' +
        'Compute a regra no domínio e imponha por CHECK no banco.',
    );
  }

  switch (tipo) {
    case 'object': {
      const catchall = def(d.catchall)?.type;
      if (catchall !== 'never') {
        falhar(
          caminho,
          'use `z.strictObject`. Objeto não-estrito emite JSON Schema sem `additionalProperties: false`, ' +
            'e o modelo pode devolver campos que ninguém validou.',
        );
      }
      for (const [chave, filho] of Object.entries(d.shape ?? {})) {
        visitar(filho, `${caminho}.${chave}`, vistos);
      }
      break;
    }
    case 'array':
      visitar(d.element, `${caminho}[]`, vistos);
      break;
    case 'optional':
    case 'nullable':
    case 'readonly':
    case 'nonoptional':
      visitar(d.innerType, caminho, vistos);
      break;
    case 'union': {
      if (d.discriminator === undefined) {
        falhar(
          caminho,
          'união não discriminada. O JSON Schema resultante não diz ao modelo qual variante produzir; ' +
            'use `z.discriminatedUnion`.',
        );
      }
      (d.options ?? []).forEach((opcao, i) => visitar(opcao, `${caminho}|${String(i)}`, vistos));
      break;
    }
    case 'record':
      visitar(d.keyType, `${caminho}{chave}`, vistos);
      visitar(d.valueType, `${caminho}{valor}`, vistos);
      break;
    case 'string':
    case 'number':
    case 'boolean':
    case 'enum':
    case 'literal':
    case 'null':
      break;
    default:
      falhar(caminho, `tipo \`${tipo}\` não está na lista de tipos permitidos em wire schema`);
  }

  vistos.delete(no);
}

/**
 * Valida que um schema é seguro como contrato de fio e o marca como tal.
 *
 * Duas camadas de propósito: o walker pega o que o zod converte
 * silenciosamente errado (refine, pipe, objeto não-estrito), e o
 * `toJSONSchema` com `unrepresentable: 'throw'` pega o resto.
 *
 * Chamado uma vez por contrato, no módulo do contrato — não em runtime por
 * chamada.
 */
export function assertWireSchema<TOut>(schema: z.ZodType<TOut>, nome: string): WireSchema<TOut> {
  visitar(schema, nome, new Set());

  const d = def(schema);
  if (d?.type !== 'object') {
    falhar(nome, `a raiz de um wire schema tem de ser um objeto, não \`${d?.type ?? '?'}\``);
  }

  // Se isto lançar, há um construct irrepresentável que o walker não conhece.
  // Falhar aqui é o comportamento certo: schema novo, regra nova.
  try {
    jsonSchemaDe(schema as WireSchema<TOut>);
  } catch (causa) {
    throw new InvarianteViolada(
      'SCHEMA_NAO_SERIALIZAVEL',
      `\`${nome}\` não converte para JSON Schema: ${causa instanceof Error ? causa.message : String(causa)}`,
      { nome },
    );
  }

  return schema as WireSchema<TOut>;
}

/**
 * O JSON Schema que vai literalmente no `input_schema` da tool.
 *
 * `$schema` é removido porque é metadado do documento, não do contrato, e sua
 * presença polui o hash usado para detectar drift de schema.
 */
export function jsonSchemaDe<TOut>(schema: WireSchema<TOut>): Record<string, unknown> {
  const gerado = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'output',
    unrepresentable: 'throw',
  }) as Record<string, unknown>;
  const { $schema: _descartado, ...resto } = gerado;
  return resto;
}
