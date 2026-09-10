import type { ResultadoVerificacao } from '@merge/locator';

function Linha({ rotulo, children, mono }: { rotulo: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd className={mono === true ? 'mono' : 'num'}>{children}</dd>
    </>
  );
}

/**
 * O veredito, com o que importa para calibrar intuição sobre as guardas:
 * o tier que casou, a similaridade, qual guarda mordeu e o detalhe dela, e a
 * fatia LITERAL que seria persistida — que não é a string do modelo.
 */
export function Veredito({ resultado }: { readonly resultado: ResultadoVerificacao }) {
  if (resultado.status === 'verificada') {
    const a = resultado.ancora;
    const bandeiras = [
      a.sinalizadores.caixaDivergente ? 'caixa divergente' : null,
      a.sinalizadores.paginaCorrigida ? 'página corrigida' : null,
      a.sinalizadores.atravessaPaginas ? 'atravessa páginas' : null,
    ].filter((x): x is string => x !== null);

    return (
      <div className="veredito ok">
        <p className="status">
          <span className="selo ok">verificada</span>
          <span className="selo tier">{a.tier}</span>
          {a.requerRevisaoHumana ? <span className="selo atencao">exige revisão humana</span> : null}
        </p>
        <dl>
          <Linha rotulo="persistido" mono>
            {a.quoteVerificada}
          </Linha>
          <Linha rotulo="localizador">
            p. {a.pagina}
            {a.rotulo === null ? '' : ` (${a.rotulo})`}, offsets {a.cruInicio}–{a.cruFim}
          </Linha>
          <Linha rotulo="similaridade">{a.similaridade.toFixed(4)}</Linha>
          <Linha rotulo="retângulos">{a.retangulos.length}</Linha>
          {bandeiras.length > 0 ? <Linha rotulo="sinalizadores">{bandeiras.join(' · ')}</Linha> : null}
          <Linha rotulo="política">{a.politicaVersao}</Linha>
        </dl>
        <p className="nota">
          O texto persistido é a fatia literal do <strong>documento</strong>, não a string que o modelo
          emitiu. Se o modelo escreveu com aspas curvas e o documento tem retas, vale o do documento.
        </p>
      </div>
    );
  }

  const d = resultado.diagnostico;
  return (
    <div className="veredito nao">
      <p className="status">
        <span className="selo nao">rejeitada</span>
        <span className="selo motivo">{d.motivo}</span>
      </p>
      <dl>
        <Linha rotulo="o que a guarda viu" mono>
          {d.detalhe}
        </Linha>
        <Linha rotulo="melhor similaridade">
          {d.melhorSimilaridade === null ? 'não chegou aos tiers' : d.melhorSimilaridade.toFixed(4)}
        </Linha>
      </dl>
      <p className="nota">
        A claim <strong>não</strong> entra na tabela de claims: vira gap. E reperguntar ao modelo não é
        opção — reperguntar enviesa para recall, e este motor é calibrado para precisão.
      </p>
    </div>
  );
}
