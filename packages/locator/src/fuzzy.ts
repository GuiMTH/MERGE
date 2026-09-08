/**
 * Busca aproximada de subcadeia e detecção de elisão.
 *
 * Programação dinâmica clássica em vez de Myers bit-paralelo: a citação tem no
 * máximo 2000 caracteres e o tier fuzzy só roda depois de T0..T2 falharem, o
 * que é raro. Uma matriz de 200x3000 são 600 mil células, milissegundos. Trocar
 * clareza por constante de tempo num ponto de imposição de invariante é mau
 * negócio: aqui, código que se consegue reler é a característica que importa.
 */

function em(a: Int32Array | Uint16Array, i: number): number {
  const v = a[i];
  if (v === undefined) throw new RangeError(`índice fora da matriz: ${i}`);
  return v;
}

export interface JanelaAproximada {
  readonly inicio: number;
  readonly fim: number;
  readonly distancia: number;
}

/**
 * Encontra a subcadeia de `texto` mais próxima de `padrao`.
 *
 * A primeira linha da matriz fica em zero, e é isso que transforma
 * "distância entre duas strings" em "melhor casamento em qualquer posição".
 * Duas passadas: a de ida acha o FIM da melhor janela, e a de volta, sobre as
 * strings invertidas, acha o INÍCIO. Guardar a matriz inteira para fazer
 * traceback custaria dezenas de MB numa página grande.
 */
export function buscaAproximada(texto: string, padrao: string, maxDistancia: number): JanelaAproximada | undefined {
  const ida = melhorFim(texto, padrao, maxDistancia);
  if (ida === undefined) return undefined;

  // Passada de volta: inverte o padrão e o prefixo do texto até o fim achado.
  // A janela não pode ser maior que o padrão mais o orçamento de edição, então
  // o trecho invertido é cortado nesse limite.
  const limite = Math.min(ida.posicao, padrao.length + maxDistancia + 1);
  const trecho = texto.slice(ida.posicao - limite, ida.posicao);
  const volta = melhorFim(inverter(trecho), inverter(padrao), maxDistancia);
  if (volta === undefined) return undefined;

  return {
    inicio: ida.posicao - volta.posicao,
    fim: ida.posicao,
    // A distância vem da passada de ida, que é a canônica: ela mede a melhor
    // janela do texto inteiro, sem o corte de `limite`.
    distancia: ida.distancia,
  };
}

function inverter(s: string): string {
  return Array.from(s).reverse().join('');
}

function melhorFim(
  texto: string,
  padrao: string,
  maxDistancia: number,
): { posicao: number; distancia: number } | undefined {
  const n = texto.length;
  const m = padrao.length;
  if (m === 0 || n === 0) return undefined;

  let anterior = new Int32Array(n + 1); // D[0][j] = 0: pode começar em qualquer lugar
  let atual = new Int32Array(n + 1);

  for (let i = 1; i <= m; i += 1) {
    atual[0] = i;
    const pi = padrao.charAt(i - 1);
    for (let j = 1; j <= n; j += 1) {
      const custo = pi === texto.charAt(j - 1) ? 0 : 1;
      const d = Math.min(em(anterior, j) + 1, em(atual, j - 1) + 1, em(anterior, j - 1) + custo);
      atual[j] = d;
    }
    const t = anterior;
    anterior = atual;
    atual = t;
  }

  let melhorJ = -1;
  let melhorD = Number.POSITIVE_INFINITY;
  for (let j = 1; j <= n; j += 1) {
    const d = em(anterior, j);
    if (d < melhorD) {
      melhorD = d;
      melhorJ = j;
    }
  }

  if (melhorJ < 0 || melhorD > maxDistancia) return undefined;
  return { posicao: melhorJ, distancia: melhorD };
}

/**
 * A região onde a citação e a janela divergem, depois de descontar o prefixo e
 * o sufixo comuns.
 *
 * Substitui uma tentativa anterior de contar a maior deleção contígua por
 * traceback da matriz de edição. Aquilo não funciona, e o motivo é
 * instrutivo: o alinhamento de custo mínimo **não é único**, e qualquer
 * desempate espalha ou concentra a deleção arbitrariamente. Apagar
 * " de piora da" de uma citação de 200 caracteres dá distância 12, mas o
 * traceback com "diagonal primeiro" relatava uma corrida de 7, porque
 * substituições de mesmo custo quebravam a corrida. Medir "a maior corrida"
 * exige escolher entre alinhamentos empatados, e essa escolha é justamente o
 * que não se pode fazer de forma defensável num ponto de imposição de
 * invariante.
 *
 * Prefixo e sufixo comuns são únicos e não têm desempate. O que sobra no meio
 * é a divergência, e o tamanho dela distingue os dois casos que importam:
 *
 *  - uma diferença pequena e localizada (ruído residual de extração) deixa os
 *    dois meios curtos;
 *  - uma cláusula apagada, inserida ou trocada deixa o meio do lado
 *    correspondente longo — inclusive quando os comprimentos totais batem,
 *    que é o caso que um simples teste de comprimento não pegaria.
 */
export function regiaoDivergente(padrao: string, janela: string): { padraoMeio: number; janelaMeio: number } {
  const n = Math.min(padrao.length, janela.length);

  let prefixo = 0;
  while (prefixo < n && padrao.charAt(prefixo) === janela.charAt(prefixo)) prefixo += 1;

  let sufixo = 0;
  while (
    sufixo < n - prefixo &&
    padrao.charAt(padrao.length - 1 - sufixo) === janela.charAt(janela.length - 1 - sufixo)
  ) {
    sufixo += 1;
  }

  return {
    padraoMeio: padrao.length - prefixo - sufixo,
    janelaMeio: janela.length - prefixo - sufixo,
  };
}
