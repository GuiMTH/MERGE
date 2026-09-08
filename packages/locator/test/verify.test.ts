import { describe, expect, it } from 'vitest';
import { normalizar } from '../src/normalize.js';
import { verifyQuote } from '../src/verify.js';
import { acervoDe, paginaDe, TEXTO_ESTUDO } from './fabrica.js';

const acervo = acervoDe(paginaDe(TEXTO_ESTUDO, { pagina: 12, rotulo: 'e1421' }));

function verificar(quote: string, pagina = 12) {
  return verifyQuote({ quote, paginaAlegada: pagina, paginas: acervo });
}

function ancoraDe(quote: string, pagina = 12) {
  const r = verificar(quote, pagina);
  if (r.status !== 'verificada') throw new Error(`esperava verificada, veio ${r.diagnostico.motivo}: ${r.diagnostico.detalhe}`);
  return r.ancora;
}

function rejeicaoDe(quote: string, pagina = 12) {
  const r = verificar(quote, pagina);
  if (r.status !== 'rejeitada') throw new Error(`esperava rejeitada, veio verificada em ${r.ancora.tier}`);
  return r.diagnostico;
}

describe('tiers', () => {
  it('T0 — citação literal casa na string crua', () => {
    const a = ancoraDe('a dapagliflozina reduziu o desfecho primario composto');
    expect(a.tier).toBe('t0');
    expect(a.similaridade).toBe(1);
    expect(a.requerRevisaoHumana).toBe(false);
  });

  it('T1 — a frase atravessa quebra de linha no documento e vem numa linha só', () => {
    // O documento quebra entre "com razao de" e "risco de 0,74", então T0 falha
    // e T1 resolve via colapso de espaço em branco.
    const a = ancoraDe('com razao de risco de 0,74 (IC 95% 0,65 a 0,85) em comparacao com placebo');
    expect(a.tier).toBe('t1');
    expect(a.sinalizadores.caixaDivergente).toBe(false);
  });

  it('T1 — glifos diferentes: travessão longo e espaço inquebrável', () => {
    // O documento tem hífen ASCII e espaço comum; o modelo devolve travessão
    // longo e NBSP, que é o que um copy-paste de PDF costuma produzir.
    const a = ancoraDe('No estudo DAPA\u2013HF,\u00a0a dapagliflozina reduziu o desfecho');
    expect(a.tier).toBe('t1');
    expect(a.quoteVerificada).toContain('DAPA-HF');
  });

  it('T1 — citação que atravessa quebra de linha no meio de uma palavra', () => {
    const a = ancoraDe('desfecho primario composto de piora da insuficiencia cardiaca');
    expect(a.tier).toBe('t1');
    expect(normalizar(a.quoteVerificada).norm).toContain('piora da insuficiencia');
  });

  it('T2 — só a caixa difere, e isso fica registrado como benigno', () => {
    const a = ancoraDe('A DAPAGLIFLOZINA REDUZIU O DESFECHO PRIMARIO');
    expect(a.tier).toBe('t2');
    expect(a.sinalizadores.caixaDivergente).toBe(true);
    expect(a.requerRevisaoHumana).toBe(false);
  });

  it('a quote persistida é a fatia LITERAL do documento, não a string do modelo', () => {
    const a = ancoraDe('A DAPAGLIFLOZINA REDUZIU O DESFECHO PRIMARIO');
    expect(a.quoteVerificada).toBe('a dapagliflozina reduziu o desfecho primario');
  });
});

describe('T4 — spillover de página', () => {
  const doisAcervo = acervoDe(
    paginaDe('primeira pagina termina com uma frase que continua na', { pagina: 12 }),
    paginaDe('proxima pagina do mesmo artigo cientifico revisado', { pagina: 13 }),
  );

  it('encontra citação que atravessa a quebra de página e exige revisão humana', () => {
    const r = verifyQuote({
      quote: 'uma frase que continua na proxima pagina do mesmo artigo',
      paginaAlegada: 12,
      paginas: doisAcervo,
    });
    if (r.status !== 'verificada') throw new Error(`veio ${r.diagnostico.motivo}`);
    expect(r.ancora.tier).toBe('t4');
    expect(r.ancora.sinalizadores.atravessaPaginas).toBe(true);
    expect(r.ancora.requerRevisaoHumana).toBe(true);
    // Retângulos em ambas as páginas: o destaque não pode sumir na costura.
    expect(new Set(r.ancora.retangulos.map((x) => x.pagina))).toEqual(new Set([12, 13]));
  });

  it('página corrigida força revisão humana, porque o modelo errou a página', () => {
    const r = verifyQuote({
      quote: 'proxima pagina do mesmo artigo cientifico revisado',
      paginaAlegada: 12,
      paginas: doisAcervo,
    });
    if (r.status !== 'verificada') throw new Error(`veio ${r.diagnostico.motivo}`);
    expect(r.ancora.sinalizadores.paginaCorrigida).toBe(true);
    expect(r.ancora.pagina).toBe(13);
    expect(r.ancora.requerRevisaoHumana).toBe(true);
  });

  it('não busca além de ±1 página', () => {
    const distante = acervoDe(
      paginaDe('pagina alegada sem nada relevante aqui dentro dela', { pagina: 12 }),
      paginaDe('a frase que o modelo citou vive muito longe daqui', { pagina: 40 }),
    );
    expect(
      verifyQuote({
        quote: 'a frase que o modelo citou vive muito longe daqui',
        paginaAlegada: 12,
        paginas: distante,
      }).status,
    ).toBe('rejeitada');
  });
});

describe('as três guardas do tier fuzzy', () => {
  it('deriva numérica — direção certa, número errado, é REJEIÇÃO', () => {
    // Similaridade altíssima e conclusão errada: o tamanho de efeito é o que a
    // peça vai afirmar. Aceitar isto seria o incidente regulatório do §6.2.
    const d = rejeicaoDe('risco de 0,84 (IC 95% 0,65 a 0,85) em comparacao com placebo');
    expect(d.motivo).toBe('deriva_numerica');
  });

  it('deriva de negação — apagar o "Nao" do MEIO da citação inverte a conclusão', () => {
    // A citação começa antes e termina depois do "Nao", então a janela de
    // alinhamento é obrigada a contê-lo, e a guarda morde. Similaridade ~0,96:
    // nenhum threshold agregado pegaria isso.
    const d = rejeicaoDe(
      'no momento da randomizacao. houve diferenca significativa na incidencia de eventos adversos graves',
    );
    expect(d.motivo).toBe('deriva_de_negacao');
  });

  it('deriva de negação — inserir uma negação também é rejeitado', () => {
    const d = rejeicaoDe('a dapagliflozina nao reduziu o desfecho primario composto de piora');
    expect(d.motivo).toBe('deriva_de_negacao');
  });

  it('cláusula elidida — trecho contíguo cortado do meio, com similaridade AINDA acima do limite', () => {
    // Construído de propósito para passar pelo threshold: 12 caracteres
    // apagados de uma citação de ~200 dão similaridade ~0,94. Sem a guarda de
    // deleção contígua, isto entraria como âncora válida.
    const literal = normalizar(TEXTO_ESTUDO).norm.slice(0, 205);
    const recorte = ' de piora da';
    expect(literal).toContain(recorte);
    const elidida = literal.replace(recorte, '');
    expect(literal.length - elidida.length).toBeGreaterThan(8);

    const d = rejeicaoDe(elidida);
    expect(d.motivo).toBe('clausula_elidida');
    expect(d.melhorSimilaridade).toBeGreaterThanOrEqual(0.92);
  });

  it('LIMITE CONHECIDO: soltar uma negação da BORDA produz substring literal, e verifica', () => {
    // O documento diz "Nao houve diferenca significativa". A citação abaixo
    // omite o "Nao" inicial — e é, literalmente, um trecho do documento.
    // T0 casa, corretamente: `verifyQuote` responde "este texto está no
    // documento?", não "esta claim é fiel ao contexto da fonte?".
    //
    // Fidelidade semântica da claim à sua âncora é outra checagem, e é humana:
    // é justamente para isso que a âncora leva o revisor à página exata. O que
    // esta função garante é que existe uma página exata para ir.
    const a = ancoraDe('houve diferenca significativa na incidencia de eventos adversos graves');
    // t1 e não t0 apenas porque a frase atravessa uma quebra de linha no
    // documento; segue sendo trecho literal, módulo espaço em branco.
    expect(['t0', 't1']).toContain(a.tier);
    expect(TEXTO_ESTUDO.replace(/\n/gu, ' ')).toContain(a.quoteVerificada.replace(/\n/gu, ' '));
  });

  it('citação com elipse é rejeitada de saída: não é texto literal', () => {
    expect(rejeicaoDe('a dapagliflozina reduziu … morte cardiovascular').motivo).toBe('quote_com_elipse');
    expect(rejeicaoDe('a dapagliflozina reduziu ... morte cardiovascular').motivo).toBe('quote_com_elipse');
  });

  it('fuzzy não entra em citação curta, onde 8% de distância é uma palavra inteira', () => {
    // Abaixo de `minimoParaFuzzy`, um erro tipográfico não é tolerado.
    expect(rejeicaoDe('dapagliflozona reduziu').motivo).toBe('nao_encontrada');
  });
});

describe('rejeições de entrada', () => {
  it('citação vazia', () => {
    expect(rejeicaoDe('   ').motivo).toBe('quote_vazia');
  });

  it('citação curta demais para identificar um trecho', () => {
    expect(rejeicaoDe('reduziu').motivo).toBe('quote_curta_demais');
  });

  it('página inexistente', () => {
    expect(rejeicaoDe('a dapagliflozina reduziu o desfecho', 999).motivo).toBe('pagina_inexistente');
  });
});

describe('geometria da âncora', () => {
  it('uma citação em três linhas rende um retângulo por linha, não um caixote', () => {
    const a = ancoraDe('reduziu o desfecho primario composto de piora da insuficiencia cardiaca ou morte');
    expect(a.retangulos.length).toBeGreaterThanOrEqual(2);
    for (const r of a.retangulos) {
      const [x0, y0, x1, y1] = r.bbox;
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y1).toBeLessThanOrEqual(1);
    }
  });

  it('o destaque começa na palavra citada, não na anterior', () => {
    const inteira = ancoraDe('No estudo DAPA-HF, a dapagliflozina reduziu o desfecho');
    const parcial = ancoraDe('dapagliflozina reduziu o desfecho primario composto');
    const primeiroInteira = inteira.retangulos[0];
    const primeiroParcial = parcial.retangulos[0];
    if (primeiroInteira === undefined || primeiroParcial === undefined) throw new Error('sem retângulos');
    expect(primeiroParcial.bbox[0]).toBeGreaterThan(primeiroInteira.bbox[0]);
  });

  it('carrega o rótulo impresso da página, que é o que o revisor cita', () => {
    expect(ancoraDe('a dapagliflozina reduziu o desfecho primario').rotulo).toBe('e1421');
  });

  it('correspondência sem token que a cubra é rejeitada, não emitida meia-boca', () => {
    // Página com texto mas sem geometria: um parser que devolva texto sem bbox
    // não pode produzir âncora, porque o dossiê não teria o que destacar.
    const semTokens = { ...paginaDe(TEXTO_ESTUDO, { pagina: 5 }), tokens: [] };
    const r = verifyQuote({
      quote: 'a dapagliflozina reduziu o desfecho primario composto',
      paginaAlegada: 5,
      paginas: acervoDe(semTokens),
    });
    if (r.status !== 'rejeitada') throw new Error('deveria rejeitar');
    expect(r.diagnostico.motivo).toBe('geometria_ausente');
  });
});
