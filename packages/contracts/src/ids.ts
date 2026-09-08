/**
 * Ids brandeados.
 *
 * Todo id no sistema é um uuid, e por isso todos são intercambiáveis para o
 * compilador se forem `string`. Num domínio onde passar um `referencia_id`
 * onde se esperava um `trecho_id` produz uma âncora que aponta para o
 * documento errado, isso não é aceitável.
 */

declare const marca: unique symbol;

type Brand<T, Nome extends string> = T & { readonly [marca]: Nome };

export type TenantId = Brand<string, 'TenantId'>;
export type UsuarioId = Brand<string, 'UsuarioId'>;
export type ClienteId = Brand<string, 'ClienteId'>;
export type ProdutoId = Brand<string, 'ProdutoId'>;
export type JobId = Brand<string, 'JobId'>;
export type BriefingId = Brand<string, 'BriefingId'>;
export type RequisitoId = Brand<string, 'RequisitoId'>;
export type ReferenciaId = Brand<string, 'ReferenciaId'>;
export type TrechoId = Brand<string, 'TrechoId'>;
export type LabelId = Brand<string, 'LabelId'>;
export type TrechoLabelId = Brand<string, 'TrechoLabelId'>;
export type ClaimId = Brand<string, 'ClaimId'>;
export type AncoragemId = Brand<string, 'AncoragemId'>;
export type AssetId = Brand<string, 'AssetId'>;
export type DossieId = Brand<string, 'DossieId'>;
export type LlmCallId = Brand<string, 'LlmCallId'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function ehUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}

/**
 * Constrói um id tipado a partir de uma string validada.
 *
 * O ponto de entrada é estreito de propósito: brandear um id acontece na
 * borda (leitura do banco, parse de request), nunca espalhado pelo domínio.
 */
export function comoId<T extends string>(valor: string): Brand<string, T> {
  if (!ehUuid(valor)) {
    throw new TypeError(`id inválido: esperava uuid, recebi ${JSON.stringify(valor)}`);
  }
  return valor as Brand<string, T>;
}
