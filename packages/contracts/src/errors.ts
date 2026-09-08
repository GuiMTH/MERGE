/**
 * Taxonomia de erro.
 *
 * Duas famílias que nunca se confundem:
 *  - falha de infraestrutura (transporte, banco, storage) — retentável;
 *  - violação de invariante — nunca retentável, e nunca contornável.
 *
 * `MergeError.retentavel` existe para que a política de retry da camada de
 * LLM não possa, por acidente, retentar uma violação de I1. Reperguntar ao
 * modelo depois de uma quote reprovada enviesa para recall, que é exatamente
 * a calibração que o §6.2 rejeita.
 */

export type CodigoErro =
  | 'ANCORAGEM_NAO_VERIFICADA'
  | 'CLAIM_SEM_ANCORAGEM'
  | 'ESCOPO_NEGADO'
  | 'LLM_SCHEMA_VIOLADO'
  | 'LLM_RECUSA'
  | 'LLM_ORCAMENTO_EXCEDIDO'
  | 'LLM_TRANSPORTE'
  | 'PROMPT_NAO_REGISTRADO'
  | 'PROMPT_VARIAVEL_INVALIDA'
  | 'SCHEMA_NAO_SERIALIZAVEL'
  | 'VERSAO_IMUTAVEL'
  | 'PARSER_SEM_LOCALIZADOR';

export interface DetalhesErro {
  readonly [chave: string]: unknown;
}

export class MergeError extends Error {
  readonly codigo: CodigoErro;
  readonly retentavel: boolean;
  readonly detalhes: DetalhesErro;

  constructor(
    codigo: CodigoErro,
    mensagem: string,
    opcoes: { retentavel?: boolean; detalhes?: DetalhesErro; cause?: unknown } = {},
  ) {
    super(mensagem, opcoes.cause === undefined ? undefined : { cause: opcoes.cause });
    this.name = 'MergeError';
    this.codigo = codigo;
    this.retentavel = opcoes.retentavel ?? false;
    this.detalhes = opcoes.detalhes ?? {};
  }
}

/**
 * Violação de invariante. Sempre `retentavel: false`, sem parâmetro para
 * mudar isso — se fosse configurável, alguém acabaria configurando.
 */
export class InvarianteViolada extends MergeError {
  constructor(codigo: CodigoErro, mensagem: string, detalhes?: DetalhesErro) {
    super(codigo, mensagem, { retentavel: false, ...(detalhes ? { detalhes } : {}) });
    this.name = 'InvarianteViolada';
  }
}
