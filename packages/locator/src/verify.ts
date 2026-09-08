import type {
  AncoraVerificada,
  BBoxNorm,
  CamadaTextoPagina,
  DiagnosticoRejeicao,
  EntradaVerificacao,
  GeometriaPagina,
  MotivoRejeicao,
  ResultadoVerificacao,
  RetanguloPagina,
  TierCorrespondencia,
} from './contract.js';
import { clipeHorizontal, pdfParaNorm, unir } from './geometry.js';
import { minusculasPreservandoComprimento, normalizar, type TextoNormalizado } from './normalize.js';
import { buscaAproximada, regiaoDivergente } from './fuzzy.js';
import { POLITICA_VERIFICACAO as P } from './policy.js';

/* ────────────────────────────── camada de busca ───────────────────────── */

interface TokenIndexado {
  readonly pagina: number;
  readonly linha: number;
  readonly bboxNorm: BBoxNorm;
  readonly cruInicio: number;
  readonly cruFim: number;
}

interface FaixaPagina {
  readonly pagina: number;
  readonly rotulo: string | null;
  readonly geometria: GeometriaPagina;
  readonly inicio: number;
  readonly fim: number;
}

/**
 * Uma ou duas páginas apresentadas como um texto contínuo.
 *
 * Existe para que os tiers rodem uma única vez, iguais, tanto na página
 * alegada quanto no par de páginas do tier de spillover. Duplicar a lógica dos
 * tiers para o caso de duas páginas seria duplicar o ponto de imposição de I1.
 */
interface Camada {
  readonly cru: string;
  readonly tokens: readonly TokenIndexado[];
  readonly faixas: readonly FaixaPagina[];
}

function indexarTokens(p: CamadaTextoPagina, deslocamento: number): TokenIndexado[] {
  return p.tokens.map((t) => ({
    pagina: p.pagina,
    linha: t.linha,
    bboxNorm: pdfParaNorm(t.bbox, p.geometria),
    cruInicio: t.cruInicio + deslocamento,
    cruFim: t.cruFim + deslocamento,
  }));
}

function camadaDe(paginas: readonly CamadaTextoPagina[]): Camada {
  const partes: string[] = [];
  const tokens: TokenIndexado[] = [];
  const faixas: FaixaPagina[] = [];
  let deslocamento = 0;

  paginas.forEach((p, i) => {
    // Separador de página é uma quebra de linha: o normalizador a colapsa em
    // um espaço, então uma citação que atravessa a quebra ainda casa.
    if (i > 0) {
      partes.push('\n');
      deslocamento += 1;
    }
    partes.push(p.cru);
    tokens.push(...indexarTokens(p, deslocamento));
    faixas.push({
      pagina: p.pagina,
      rotulo: p.rotulo,
      geometria: p.geometria,
      inicio: deslocamento,
      fim: deslocamento + p.cru.length,
    });
    deslocamento += p.cru.length;
  });

  return { cru: partes.join(''), tokens, faixas };
}

function faixaEm(c: Camada, indice: number): FaixaPagina {
  for (const f of c.faixas) {
    if (indice >= f.inicio && indice <= f.fim) return f;
  }
  const primeira = c.faixas[0];
  if (primeira === undefined) throw new RangeError('camada sem páginas');
  return primeira;
}

/* ─────────────────────────────── guardas ──────────────────────────────── */

const RE_NUMERO = /\d+(?:[.,]\d+)?/gu;
const RE_PALAVRA = /\p{L}+/gu;
const LEXICO: ReadonlySet<string> = new Set(P.lexicoNegacao);

function multiconjuntoNumerico(s: string): string {
  return (s.match(RE_NUMERO) ?? []).sort().join('|');
}

function multiconjuntoNegacao(s: string): string {
  const achados = (minusculasPreservandoComprimento(s).match(RE_PALAVRA) ?? []).filter((w) => LEXICO.has(w));
  return achados.sort().join('|');
}

/* ─────────────────────────── mapa de offsets ──────────────────────────── */

function em(a: Int32Array, i: number): number {
  const v = a[i];
  if (v === undefined) throw new RangeError(`offset fora do mapa: ${i}`);
  return v;
}

interface CamadaNormalizada {
  readonly estrito: TextoNormalizado;
  readonly frouxo: string;
}

function normalizarCamada(c: Camada): CamadaNormalizada {
  const estrito = normalizar(c.cru);
  const frouxo = minusculasPreservandoComprimento(estrito.norm);
  if (frouxo.length !== estrito.norm.length) {
    // Não deveria acontecer: `minusculasPreservandoComprimento` garante o
    // comprimento. Se acontecer, o mapa de offsets compartilhado estaria
    // dessincronizado e as âncoras apontariam para o lugar errado — falhar
    // alto é a única resposta aceitável.
    throw new RangeError('camada frouxa divergiu em comprimento da estrita');
  }
  return { estrito, frouxo };
}

/* ────────────────────────── retângulos do destaque ────────────────────── */

/**
 * Converte um intervalo de caracteres nos retângulos que o destacam.
 *
 * Uma citação que atravessa três linhas rende três retângulos, não um caixote
 * cobrindo o parágrafo. Os tokens parcialmente cobertos nas pontas são
 * clipados por interpolação dentro do token, para que o destaque comece na
 * palavra citada e não na anterior.
 */
export function intervaloParaRetangulos(c: Camada, inicio: number, fim: number): RetanguloPagina[] {
  const porLinha = new Map<string, { pagina: number; bbox: BBoxNorm }>();

  for (const t of c.tokens) {
    if (t.cruFim <= inicio || t.cruInicio >= fim) continue;
    const largura = t.cruFim - t.cruInicio;
    if (largura <= 0) continue;

    const fracaoInicio = Math.max(0, (inicio - t.cruInicio) / largura);
    const fracaoFim = Math.min(1, (fim - t.cruInicio) / largura);
    const bbox =
      fracaoInicio === 0 && fracaoFim === 1 ? t.bboxNorm : clipeHorizontal(t.bboxNorm, fracaoInicio, fracaoFim);

    const chave = `${String(t.pagina)}:${String(t.linha)}`;
    const existente = porLinha.get(chave);
    porLinha.set(chave, {
      pagina: t.pagina,
      bbox: existente === undefined ? bbox : unir(existente.bbox, bbox),
    });
  }

  return [...porLinha.values()]
    .map(({ pagina, bbox }) => ({ pagina, bbox }))
    .sort((a, b) => a.pagina - b.pagina || a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
}

/* ──────────────────────────────── tiers ───────────────────────────────── */

interface Acerto {
  readonly inicio: number;
  readonly fim: number;
  readonly tier: TierCorrespondencia;
  readonly similaridade: number;
  readonly caixaDivergente: boolean;
}

interface FalhaTier {
  readonly motivo: MotivoRejeicao;
  readonly melhorSimilaridade: number | null;
  readonly detalhe: string;
}

function rodarTiers(
  c: Camada,
  n: CamadaNormalizada,
  quote: string,
  quoteNorm: TextoNormalizado,
  permitirFuzzy: boolean,
): Acerto | FalhaTier {
  // T0 — literal, na string crua. É o caso comum quando o modelo copia fiel,
  // e é o mais barato.
  const t0 = c.cru.indexOf(quote);
  if (t0 >= 0) {
    return { inicio: t0, fim: t0 + quote.length, tier: 't0', similaridade: 1, caixaDivergente: false };
  }

  const alvo = quoteNorm.norm;
  const mapear = (indiceNorm: number): number => em(n.estrito.paraCru, indiceNorm);

  // T1 — normalizado estrito. Resolve ligadura, glifo de aspas, hifenização de
  // fim de linha e quebra de linha no meio da frase.
  const t1 = n.estrito.norm.indexOf(alvo);
  if (t1 >= 0) {
    return {
      inicio: mapear(t1),
      fim: mapear(t1 + alvo.length),
      tier: 't1',
      similaridade: 1,
      caixaDivergente: false,
    };
  }

  // T2 — ignora caixa. Benigno por si só, mas fica registrado.
  const alvoFrouxo = minusculasPreservandoComprimento(alvo);
  const t2 = n.frouxo.indexOf(alvoFrouxo);
  if (t2 >= 0) {
    return {
      inicio: mapear(t2),
      fim: mapear(t2 + alvoFrouxo.length),
      tier: 't2',
      similaridade: 1,
      caixaDivergente: true,
    };
  }

  if (!permitirFuzzy || alvo.length < P.minimoParaFuzzy) {
    return { motivo: 'nao_encontrada', melhorSimilaridade: null, detalhe: 'sem correspondência literal' };
  }

  // T3 — fuzzy, com três guardas. Sem elas, similaridade agregada aceita
  // exatamente os erros que mais importam.
  const maxDistancia = Math.floor(alvoFrouxo.length * (1 - P.limiteSimilaridade));
  const janela = buscaAproximada(n.frouxo, alvoFrouxo, maxDistancia);
  if (janela === undefined) {
    return {
      motivo: 'similaridade_abaixo_do_limite',
      melhorSimilaridade: null,
      detalhe: `nenhuma janela dentro de ${String(maxDistancia)} edições`,
    };
  }

  const similaridade = 1 - janela.distancia / alvoFrouxo.length;
  if (similaridade < P.limiteSimilaridade) {
    return {
      motivo: 'similaridade_abaixo_do_limite',
      melhorSimilaridade: similaridade,
      detalhe: `similaridade ${similaridade.toFixed(3)} < ${String(P.limiteSimilaridade)}`,
    };
  }

  const textoJanela = n.estrito.norm.slice(janela.inicio, janela.fim);

  if (multiconjuntoNumerico(textoJanela) !== multiconjuntoNumerico(alvo)) {
    return {
      motivo: 'deriva_numerica',
      melhorSimilaridade: similaridade,
      detalhe: `números divergem: citação [${multiconjuntoNumerico(alvo)}] vs documento [${multiconjuntoNumerico(textoJanela)}]`,
    };
  }

  if (multiconjuntoNegacao(textoJanela) !== multiconjuntoNegacao(alvo)) {
    return {
      motivo: 'deriva_de_negacao',
      melhorSimilaridade: similaridade,
      detalhe: `termos de negação/comparação divergem: citação [${multiconjuntoNegacao(alvo)}] vs documento [${multiconjuntoNegacao(textoJanela)}]`,
    };
  }

  // A similaridade agregada é cega à FORMA do erro. 12 caracteres apagados de
  // uma citação de 200 dão 0,94 e passariam; e uma cláusula trocada por outra
  // de mesmo tamanho passaria até por um teste de comprimento. Exigir que a
  // divergência seja pequena E localizada é o que fecha os dois casos.
  const regiao = regiaoDivergente(alvoFrouxo, minusculasPreservandoComprimento(textoJanela));
  const maiorMeio = Math.max(regiao.padraoMeio, regiao.janelaMeio);
  if (maiorMeio > P.maxDelecaoContigua) {
    return {
      motivo: 'clausula_elidida',
      melhorSimilaridade: similaridade,
      detalhe:
        `divergência concentrada de ${String(maiorMeio)} caracteres ` +
        `(citação ${String(regiao.padraoMeio)}, documento ${String(regiao.janelaMeio)}), ` +
        `máximo ${String(P.maxDelecaoContigua)}`,
    };
  }

  return {
    inicio: mapear(janela.inicio),
    fim: mapear(janela.fim),
    tier: 't3',
    similaridade,
    caixaDivergente: textoJanela !== alvo,
  };
}

function ehAcerto(r: Acerto | FalhaTier): r is Acerto {
  return 'tier' in r;
}

/* ─────────────────────────────── entrada ──────────────────────────────── */

function rejeitar(motivo: MotivoRejeicao, detalhe: string, melhor: number | null = null): ResultadoVerificacao {
  const diagnostico: DiagnosticoRejeicao = { motivo, melhorSimilaridade: melhor, detalhe };
  return { status: 'rejeitada', diagnostico };
}

/**
 * Verifica que uma citação proposta por um modelo existe literalmente no
 * documento, e devolve onde.
 *
 * Pura e síncrona: sem I/O, sem relógio, sem config. É o que permite que a
 * suíte de propriedade rode milhares de casos e que este módulo viva no anel 0.
 *
 * O contrato de retorno não tem meio-termo. Ou sai `verificada`, e a claim
 * pode existir no banco, ou sai `rejeitada`, e a claim vira gap (I1). Não há
 * terceiro caminho, não há flag, e uma citação reprovada **não** é motivo para
 * reperguntar ao modelo — reperguntar enviesa para recall, que é exatamente a
 * calibração que o §6.2 rejeita.
 */
export function verifyQuote(entrada: EntradaVerificacao): ResultadoVerificacao {
  const { quote, paginaAlegada, paginas } = entrada;

  if (quote.trim() === '') {
    return rejeitar('quote_vazia', 'citação vazia');
  }

  // Elipse é confissão de que o texto não é literal. Um "…" no meio significa
  // que o modelo costurou dois trechos, e costura é onde o sentido se perde.
  if (/…|\.\.\./u.test(quote)) {
    return rejeitar('quote_com_elipse', 'citação contém elipse: não é texto literal');
  }

  const paginaBase = paginas.obter(paginaAlegada);
  if (paginaBase === undefined) {
    return rejeitar('pagina_inexistente', `página ${String(paginaAlegada)} não existe no documento`);
  }

  const quoteNorm = normalizar(quote.trim());
  if (quoteNorm.norm.length < P.minimoCaracteresNormalizados) {
    return rejeitar(
      'quote_curta_demais',
      `${String(quoteNorm.norm.length)} caracteres normalizados, mínimo ${String(P.minimoCaracteresNormalizados)}`,
    );
  }

  // Tentativa 1: a página alegada, sozinha.
  const camadaBase = camadaDe([paginaBase]);
  const resultado = rodarTiers(camadaBase, normalizarCamada(camadaBase), quote.trim(), quoteNorm, true);
  if (ehAcerto(resultado)) {
    return montar(camadaBase, paginaBase, resultado, paginaAlegada);
  }

  // T4 — spillover de ±1 página, e só. Uma busca no documento inteiro é como
  // uma citação da discussão acaba ancorada na seção de métodos.
  const r = P.raioSpilloverPaginas;
  const pares: readonly (readonly number[])[] = [
    [paginaAlegada, paginaAlegada + r],
    [paginaAlegada - r, paginaAlegada],
  ];

  for (const par of pares) {
    const carregadas = par
      .map((n) => paginas.obter(n))
      .filter((p): p is CamadaTextoPagina => p !== undefined)
      .sort((a, b) => a.pagina - b.pagina);
    if (carregadas.length < 2) continue;

    const camada = camadaDe(carregadas);
    const acerto = rodarTiers(camada, normalizarCamada(camada), quote.trim(), quoteNorm, true);
    if (ehAcerto(acerto)) {
      const inicial = faixaEm(camada, acerto.inicio);
      const paginaInicial = carregadas.find((p) => p.pagina === inicial.pagina) ?? carregadas[0];
      if (paginaInicial === undefined) continue;
      return montar(camada, paginaInicial, { ...acerto, tier: 't4' }, paginaAlegada);
    }
  }

  return rejeitar(resultado.motivo, resultado.detalhe, resultado.melhorSimilaridade);
}

function montar(
  camada: Camada,
  paginaInicial: CamadaTextoPagina,
  acerto: Acerto,
  paginaAlegada: number,
): ResultadoVerificacao {
  const faixaInicio = faixaEm(camada, acerto.inicio);
  const faixaFim = faixaEm(camada, Math.max(acerto.inicio, acerto.fim - 1));

  const atravessaPaginas = faixaInicio.pagina !== faixaFim.pagina;
  const paginaCorrigida = faixaInicio.pagina !== paginaAlegada;

  const retangulos = intervaloParaRetangulos(camada, acerto.inicio, acerto.fim);

  // Sem retângulo não há como destacar, e um dossiê que diz "página 12" sem
  // mostrar onde não cumpre a promessa do produto. Falhar aqui, e não emitir
  // uma âncora meia-boca.
  if (retangulos.length === 0) {
    return rejeitar(
      'geometria_ausente',
      'correspondência encontrada mas nenhum token cobre o intervalo: geometria do parser incompleta',
      acerto.similaridade,
    );
  }

  const sinalizadores = {
    caixaDivergente: acerto.caixaDivergente,
    paginaCorrigida,
    atravessaPaginas,
  };

  const ancora: AncoraVerificada = {
    referenciaId: paginaInicial.referenciaId,
    referenciaVersao: paginaInicial.referenciaVersao,
    documentoSha256: paginaInicial.documentoSha256,
    pagina: faixaInicio.pagina,
    rotulo: faixaInicio.rotulo,
    // A fatia LITERAL do documento, não a string que o modelo emitiu.
    quoteVerificada: camada.cru.slice(acerto.inicio, acerto.fim),
    cruInicio: acerto.inicio - faixaInicio.inicio,
    cruFim: acerto.fim - faixaInicio.inicio,
    tier: acerto.tier,
    similaridade: acerto.similaridade,
    retangulos,
    geometria: faixaInicio.geometria,
    sinalizadores,
    politicaVersao: P.versao,
    // Página corrigida significa que o modelo errou a página: um humano
    // confirma. Atravessar páginas também, porque a costura é onde o
    // sentido se perde. Divergência de caixa, sozinha, é benigna.
    requerRevisaoHumana: paginaCorrigida || atravessaPaginas,
  };

  return { status: 'verificada', ancora };
}
