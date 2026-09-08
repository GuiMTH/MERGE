/**
 * A política de verificação de citação, congelada.
 *
 * **Não é arquivo de config e não é variável de ambiente**, e isso é
 * deliberado. I1 diz "sem exceção, sem flag de bypass, sem modo de
 * desenvolvimento que relaxe isso". Um threshold ajustável por ambiente é
 * flag de bypass com outro nome: alguém baixa para 0.80 numa terça para
 * destravar uma demo, e a partir daí o produto aceita âncoras que ninguém
 * revisou.
 *
 * Mudar qualquer número aqui exige mudança de código, PR, e uma rodada do
 * harness de avaliação. `versao` é persistida em cada âncora, para que uma
 * âncora de 2026 continue interpretável sob a política com que foi verificada
 * — que é exatamente o tipo de pergunta que auditoria regulatória faz.
 */
export const POLITICA_VERIFICACAO = Object.freeze({
  versao: 'qv-1',

  /** Abaixo disto, a citação é curta demais para identificar um trecho. */
  minimoCaracteresNormalizados: 12,

  /**
   * Fuzzy só entra em citação longa. Numa citação curta, 8% de distância de
   * edição é uma palavra inteira diferente.
   */
  minimoParaFuzzy: 40,

  /** Similaridade mínima no tier fuzzy. */
  limiteSimilaridade: 0.92,

  /**
   * Tamanho máximo da região onde a citação e o documento podem divergir,
   * depois de descontar prefixo e sufixo comuns.
   *
   * Existe porque similaridade agregada é cega à FORMA do erro: numa citação
   * de 200 caracteres, 0,94 de similaridade cabe uma cláusula inteira apagada,
   * e uma cláusula trocada por outra de mesmo tamanho passa até por um teste
   * de comprimento. Exigir que a divergência seja pequena E localizada fecha
   * os dois casos, e deixa o tier fuzzy fazer só o que deve: tolerar ruído
   * residual de extração, nunca reescrita.
   */
  maxDelecaoContigua: 8,

  /** A busca nunca vai além de uma página de distância da alegada. */
  raioSpilloverPaginas: 1,

  /**
   * Léxico de negação e comparação.
   *
   * Existe porque similaridade é cega ao que importa: "não foi superior ao
   * placebo" contra "foi superior ao placebo" tem similaridade ~0.94 e
   * conclusões opostas. Nenhum threshold agregado pega isso; só comparar os
   * tokens de negação pega.
   */
  lexicoNegacao: Object.freeze([
    'nao',
    'não',
    'not',
    'no',
    'non',
    'nor',
    'neither',
    'nem',
    'sem',
    'without',
    'ausencia',
    'ausência',
    'absence',
    'ausente',
    'falhou',
    'failed',
    'nunca',
    'never',
    'nenhum',
    'nenhuma',
    'none',
    'exceto',
    'except',
    'negativo',
    'negative',
    'inferior',
    'superior',
    'menor',
    'maior',
    'reduziu',
    'aumentou',
    'reduction',
    'increase',
  ] as const),
} as const);

export type PoliticaVerificacao = typeof POLITICA_VERIFICACAO;
