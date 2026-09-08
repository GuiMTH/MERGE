/**
 * Normalização PRESERVANDO OFFSETS.
 *
 * A decisão central: cada passo mantém um mapa de índice do texto normalizado
 * de volta para o texto cru. Normalizar destrutivamente é fácil e inútil aqui
 * — você consegue verificar que a citação existe, mas não consegue dizer ONDE,
 * e o dossiê inteiro repousa em destacar o trecho exato na página exata.
 */

export interface TextoNormalizado {
  readonly norm: string;
  /**
   * `paraCru[i]` é o índice, no texto cru, do caractere que produziu
   * `norm[i]`. Tem comprimento `norm.length + 1`: a última posição guarda
   * `cru.length`, para que um intervalo `[a, b)` em `norm` mapeie para
   * `[paraCru[a], paraCru[b])` mesmo quando `b` é o fim da string.
   */
  readonly paraCru: Int32Array;
}

/** Aspas de todo tipo, dobradas para a forma reta. */
const ASPAS_DUPLAS = /[«»“”„‟″‶〝〞]/u;
const ASPAS_SIMPLES = /[‘’‚‛′‵‹›]/u;
/** Travessões e menos tipográfico, dobrados para hífen ASCII. */
const TRACOS = /[‐‑‒–—―−⁃]/u;
/** Espaços que não são U+0020 e que o NFKC não resolve. */
const ESPACOS_EXOTICOS = /[  -   　]/u;
/** Largura zero e hífen suave: somem sem deixar rastro. */
const INVISIVEIS = /[­​‌‍⁠﻿]/u;
const COMBINANTE = /\p{Mn}/u;

/**
 * Termos legitimamente hifenizados no domínio.
 *
 * A regra de de-hifenização junta `efi-\ncácia` em `eficácia`, o que é certo.
 * Mas `duplo-\ncego` tem de virar `duplo-cego`, e não `duplocego`. Sem esta
 * lista, todo termo composto quebrado em fim de linha é corrompido em
 * silêncio — e `intention-to-treat` corrompido é um desenho de estudo
 * corrompido.
 */
const HIFEN_LEGITIMO: ReadonlySet<string> = new Set([
  'duplo-cego',
  'duplocego',
  'open-label',
  'head-to-head',
  'intention-to-treat',
  'per-protocol',
  'pos-hoc',
  'pós-hoc',
  'placebo-controlado',
  'nao-inferioridade',
  'não-inferioridade',
  'non-inferiority',
  'first-line',
  'follow-up',
  'end-of-study',
  'time-to-event',
  'meta-analise',
  'meta-análise',
  'custo-efetividade',
  'risco-beneficio',
  'risco-benefício',
]);

function ehLetra(c: string | undefined): boolean {
  return c !== undefined && /\p{L}/u.test(c);
}

function ehMinuscula(c: string | undefined): boolean {
  return c !== undefined && /\p{Ll}/u.test(c);
}

/** Palavra imediatamente antes de `i` no texto. */
function palavraAntes(texto: string, i: number): string {
  let j = i;
  while (j > 0 && /[\p{L}\p{M}]/u.test(texto.charAt(j - 1))) j -= 1;
  return texto.slice(j, i);
}

/**
 * Token que começa em `i`, incluindo hífens INTERNOS.
 *
 * Consumir hífen interno é o que permite reconhecer `intention-to-treat`
 * quebrado em `intention-\nto-treat`: parar no primeiro hífen produziria a
 * chave `intention-to`, que não está na lista-guarda, e o termo seria
 * corrompido em silêncio.
 */
function tokenApos(texto: string, i: number): string {
  let j = i;
  while (j < texto.length) {
    const c = texto.charAt(j);
    if (/[\p{L}\p{M}]/u.test(c)) {
      j += 1;
      continue;
    }
    // Hífen só continua o token se houver letra depois dele.
    if (c === '-' && /[\p{L}]/u.test(texto.charAt(j + 1))) {
      j += 1;
      continue;
    }
    break;
  }
  return texto.slice(i, j);
}

/**
 * Agrupa um caractere base com as marcas combinantes que o seguem.
 *
 * O NFKC não é composável caractere a caractere: `e` + U+0301 só vira `é` se
 * os dois forem normalizados juntos. Alguns PDFs emitem exatamente essa forma
 * decomposta, e o modelo cita a forma precomposta — sem agrupar, `ção` na
 * página nunca casa com `ção` na citação, e em português isso é a maioria dos
 * casos, não uma borda.
 */
function tamanhoDoCluster(cru: string, i: number): number {
  let n = 1;
  while (i + n < cru.length && COMBINANTE.test(cru.charAt(i + n))) n += 1;
  return n;
}

/**
 * A escada de normalização.
 *
 * Ordem, e o motivo de cada passo:
 *  1. NFKC por cluster — dobra ligaduras (`ﬁ`->`fi`), formas de largura
 *     total, e compõe marcas combinantes.
 *  2. De-hifenização em quebra de linha, só quando o hífen encerra a linha E a
 *     próxima linha começa em minúscula. A condição de fim de linha é o que
 *     protege `beta-bloqueador` no meio da linha.
 *  3. Dobra de aspas, traços, espaços exóticos e invisíveis.
 *  4. Colapso de corridas de espaço em um só.
 *
 * **Numerais NUNCA são normalizados.** `p<0,05` da bula não vira `p<0.05`:
 * separador decimal é diferença semântica real em pt-BR, e dobrar número em
 * silêncio é como uma claim acaba ancorada no tamanho de efeito errado.
 *
 * **Marcadores de referência sobrescritos NÃO são removidos.** O desenho
 * original previa tirar o `¹²` de `efficacy¹²`, mas o NFKC já os dobra em
 * dígitos (`efficacy12`), e um removedor que apague sobrescrito depois de
 * letra também come o `²` de `m²` e o `³` de `cm³` — unidade corrompida é
 * pior que falso-rejeite. A consequência é benigna e na direção segura: a
 * guarda de deriva numérica vê `{12}` contra `{}` e REJEITA, em vez de
 * aceitar uma âncora torta.
 */
export function normalizar(cru: string): TextoNormalizado {
  const saida: string[] = [];
  const mapa: number[] = [];
  let i = 0;
  let ultimoFoiEspaco = false;

  const empurrar = (texto: string, indiceCru: number): void => {
    for (const ch of texto) {
      saida.push(ch);
      mapa.push(indiceCru);
    }
  };

  while (i < cru.length) {
    const ch = cru.charAt(i);

    if (INVISIVEIS.test(ch)) {
      i += 1;
      continue;
    }

    // De-hifenização: hífen (de qualquer forma) seguido de quebra de linha.
    if ((ch === '-' || TRACOS.test(ch)) && i + 1 < cru.length) {
      let j = i + 1;
      while (j < cru.length && (cru.charAt(j) === ' ' || cru.charAt(j) === '\t' || cru.charAt(j) === '\r')) j += 1;
      if (cru.charAt(j) === '\n') {
        let k = j + 1;
        while (k < cru.length && /[ \t\r]/u.test(cru.charAt(k))) k += 1;
        const proxima = cru.charAt(k);
        const anterior = palavraAntes(cru, i);

        if (ehLetra(anterior.charAt(anterior.length - 1)) && ehMinuscula(proxima)) {
          const composto = `${anterior}-${tokenApos(cru, k)}`.toLowerCase();
          const composta = composto.normalize('NFKC');
          if (HIFEN_LEGITIMO.has(composta) || HIFEN_LEGITIMO.has(composto)) {
            // Termo composto legítimo: o hífen fica, só a quebra sai.
            empurrar('-', i);
          }
          // Caso comum: palavra quebrada. Hífen e quebra somem, a palavra se junta.
          i = k;
          ultimoFoiEspaco = false;
          continue;
        }
        // Próxima linha começa em maiúscula ou dígito: não é palavra quebrada.
        // Mantém o hífen; a quebra é tratada como espaço no passo de colapso.
        empurrar('-', i);
        i = j;
        ultimoFoiEspaco = false;
        continue;
      }
    }

    if (/\s/u.test(ch) || ESPACOS_EXOTICOS.test(ch)) {
      if (!ultimoFoiEspaco) {
        empurrar(' ', i);
        ultimoFoiEspaco = true;
      }
      i += 1;
      continue;
    }

    ultimoFoiEspaco = false;

    if (ASPAS_DUPLAS.test(ch)) {
      empurrar('"', i);
      i += 1;
      continue;
    }
    if (ASPAS_SIMPLES.test(ch)) {
      empurrar("'", i);
      i += 1;
      continue;
    }
    if (TRACOS.test(ch)) {
      empurrar('-', i);
      i += 1;
      continue;
    }

    const n = tamanhoDoCluster(cru, i);
    empurrar(cru.slice(i, i + n).normalize('NFKC'), i);
    i += n;
  }

  mapa.push(cru.length);
  return { norm: saida.join(''), paraCru: Int32Array.from(mapa) };
}

/**
 * Minúsculas preservando comprimento.
 *
 * `String.prototype.toLowerCase` não preserva comprimento em todo Unicode —
 * `İ` (U+0130) vira dois caracteres. Se isso acontecesse, o mapa de offsets
 * compartilhado entre a camada estrita e a frouxa sairia de sincronia e as
 * âncoras apontariam para o lugar errado, silenciosamente. Aqui, um
 * caractere cuja minúscula seria mais longa fica como está: perde-se um
 * casamento por caixa, o que é falso-rejeite, e não um offset torto.
 */
export function minusculasPreservandoComprimento(texto: string): string {
  let mudou = false;
  const chars = Array.from(texto);
  const saida = chars.map((c) => {
    const min = c.toLowerCase();
    if (min.length !== c.length) return c;
    if (min !== c) mudou = true;
    return min;
  });
  return mudou ? saida.join('') : texto;
}
