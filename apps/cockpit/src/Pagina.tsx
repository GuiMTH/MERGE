import { layoutDaPagina, type AncoraVerificada, type CamadaTextoPagina } from '@merge/locator';
import { useLayoutEffect, useRef } from 'react';

function pct(n: number): string {
  return `${(n * 100).toFixed(4)}%`;
}

/**
 * A página com o destaque da âncora.
 *
 * Toda a matemática vem de `layoutDaPagina`, no anel 0 e testada. Aqui só se
 * mapeia número para estilo — e o destaque é `bbox_norm` escrito direto como
 * porcentagem CSS, sem nenhuma conversão em runtime, exatamente como o dossiê
 * do módulo 7 vai fazer.
 */
export function Pagina({
  pagina,
  ancora,
}: {
  readonly pagina: CamadaTextoPagina;
  readonly ancora: AncoraVerificada | null;
}) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const l = layoutDaPagina(pagina, ancora);

  // Ajusta cada palavra à largura da sua caixa, como a camada de texto do
  // pdf.js faz. Sem isto a fonte não bate com o avanço que a geometria
  // declara, e o texto vaza da caixa.
  useLayoutEffect(() => {
    const folha = folhaRef.current;
    if (folha === null) return;
    for (const el of folha.querySelectorAll<HTMLElement>('.tk')) {
      el.style.transform = '';
      const alvo = el.getBoundingClientRect().width;
      if (alvo <= 0) continue;
      const largura = el.style.width;
      el.style.width = 'auto';
      const natural = el.getBoundingClientRect().width;
      el.style.width = largura;
      if (natural > 0) el.style.transform = `scaleX(${(alvo / natural).toFixed(4)})`;
    }
  });

  return (
    <figure className="fonte">
      <div className="janela" style={{ aspectRatio: l.proporcao.toFixed(4) }}>
        <div
          className="folha"
          ref={folhaRef}
          style={{
            width: pct(l.folha.largura),
            height: pct(l.folha.altura),
            left: pct(l.folha.esquerda),
            top: pct(l.folha.topo),
          }}
        >
          {l.realces.map((r, i) => (
            <div
              key={`realce-${String(i)}`}
              className="realce"
              style={{
                left: pct(r.esquerda),
                top: pct(r.topo),
                width: pct(r.largura),
                height: pct(r.altura),
              }}
            />
          ))}
          {l.palavras.map((w, i) => (
            <span
              key={`tk-${String(i)}`}
              className="tk"
              style={{
                left: pct(w.esquerda),
                top: pct(w.topo),
                width: pct(w.largura),
                fontSize: `${(w.corpoFonte * 100).toFixed(3)}cqh`,
              }}
            >
              {w.texto}
            </span>
          ))}
        </div>
      </div>
      <figcaption>
        recorte da página {l.pagina}
        {l.rotulo === null ? '' : ` · rótulo ${l.rotulo}`} · {l.larguraPt}×{l.alturaPt}pt
      </figcaption>
    </figure>
  );
}
