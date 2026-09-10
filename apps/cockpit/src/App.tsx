import { useMemo, useState } from 'react';
import { verifyQuote } from '@merge/locator';
import { acervoDe, CASOS, paginaSintetica, TEXTO_ESTUDO } from '@merge/locator/sintetico';
import { Pagina } from './Pagina.js';
import { Veredito } from './Veredito.js';

const PAGINA = 12;

export function App() {
  const [documento, setDocumento] = useState(TEXTO_ESTUDO);
  const [quote, setQuote] = useState(CASOS[0]?.quote ?? '');
  const [paginaAlegada, setPaginaAlegada] = useState(PAGINA);

  // `verifyQuote` é puro e síncrono e custa microssegundos: recalcular a cada
  // tecla é mais simples e mais honesto que debounce, e mostra o momento exato
  // em que uma citação deixa de ancorar.
  const { pagina, resultado } = useMemo(() => {
    const p = paginaSintetica(documento, { pagina: PAGINA, rotulo: 'e1421' });
    return { pagina: p, resultado: verifyQuote({ quote, paginaAlegada, paginas: acervoDe(p) }) };
  }, [documento, quote, paginaAlegada]);

  const ancora = resultado.status === 'verificada' ? resultado.ancora : null;

  return (
    <div className="app">
      <header>
        <p className="eyebrow">MERGE · bancada do anel 0</p>
        <h1>Bancada de Âncoras</h1>
        <p className="lede">
          Cole um trecho de estudo à esquerda e a citação que um modelo proporia. A cada tecla,{' '}
          <code>verifyQuote</code> diz se ela ancoraria — e, quando não, qual guarda mordeu.
        </p>
        <p className="aviso">
          Aqui a verificação roda no browser porque isto é bancada. No caminho de produção ela é{' '}
          <strong>server-side</strong>, antes de qualquer persistência: a imposição de I1 nunca é do
          cliente.
        </p>
      </header>

      <section className="presets">
        <h2>Casos canônicos</h2>
        <div className="chips">
          {CASOS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.quote === quote ? 'chip ativo' : 'chip'}
              onClick={() => {
                setDocumento(TEXTO_ESTUDO);
                setPaginaAlegada(PAGINA);
                setQuote(c.quote);
              }}
            >
              {c.titulo}
            </button>
          ))}
        </div>
        {CASOS.filter((c) => c.quote === quote).map((c) => (
          <p className="porque" key={c.id}>
            {c.porque}
          </p>
        ))}
      </section>

      <main>
        <div className="controles">
          <label htmlFor="quote">
            Citação proposta
            <span className="dica">o que o modelo alega ter copiado do estudo</span>
          </label>
          <textarea
            id="quote"
            value={quote}
            rows={4}
            spellCheck={false}
            onChange={(e) => setQuote(e.target.value)}
          />

          <label htmlFor="pagina">
            Página alegada
            <span className="dica">a busca corrige em ±1 no máximo, e isso força revisão humana</span>
          </label>
          <input
            id="pagina"
            type="number"
            min={1}
            value={paginaAlegada}
            onChange={(e) => setPaginaAlegada(Number(e.target.value))}
          />

          <label htmlFor="documento">
            Texto do documento
            <span className="dica">a página sintética; as quebras de linha são as do documento</span>
          </label>
          {/*
            `wrap="off"` não é estética. As quebras de linha do documento SÃO o
            dado aqui: a de-hifenização depende de o hífen encerrar a linha, e o
            tier T0 falha justamente quando a citação atravessa uma quebra. Com
            envolvimento automático, uma linha dobrada pela largura da caixa
            fica indistinguível de uma quebra real, e a bancada passaria a
            mentir sobre a única coisa que ela existe para mostrar.
          */}
          <textarea
            id="documento"
            value={documento}
            rows={8}
            spellCheck={false}
            wrap="off"
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>

        <div className="resultado">
          <Veredito resultado={resultado} />
          <Pagina pagina={pagina} ancora={ancora} />
        </div>
      </main>

      <footer>
        <p>
          A página é <strong>sintética</strong>: cumpre o contrato do parser, mas não é um PDF. O gate da
          Fase 0 exige rodar a mesma verificação sobre página real antes de a Fase 1 começar.
        </p>
      </footer>
    </div>
  );
}
