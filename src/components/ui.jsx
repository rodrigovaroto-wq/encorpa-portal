// Peças de interface do portal: cartões de vidro, número que sobe ao aparecer, selo de variação, abas e tabelas.
import { useEffect, useRef, useState } from "react";
import { delta, downloadCsv, fmt } from "../lib/format.js";
import { Icon } from "./icons.jsx";

export function Card({ title, sub, action, className = "", children, onOpen }) {
  return (
    <section className={`glass card ${className}`}>
      {(title || action || onOpen) && (
        <header className="card-head">
          <div><h3>{title}</h3>{sub && <span className="sub">{sub}</span>}</div>
          <div className="card-actions">{action}{onOpen && <button className="round" onClick={onOpen} aria-label={`Abrir ${title}`}><Icon name="arrow" /></button>}</div>
        </header>
      )}
      {children}
    </section>
  );
}

// Número que sobe do zero até o valor quando aparece (o "numberSlideUp" do Glassy CRM), respeitando "reduzir animação".
export function CountUp({ value, unit }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || document.documentElement.dataset.motion === "off") { setShown(value); return; }
    const start = performance.now(), a = from.current || 0, dur = 700;
    let raf;
    const tick = (now) => { const k = Math.min(1, (now - start) / dur), e = 1 - (1 - k) ** 3; setShown(a + (value - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const rounded = unit === "n" && shown != null && Number.isInteger(value) ? Math.round(shown) : shown;
  return <>{fmt(rounded, unit)}</>;
}

export function DeltaBadge({ metric, unit, id, label = true }) {
  const d = delta(metric, unit, id);
  if (!d) return <span className="delta none">sem dado do período anterior</span>;
  return (
    <span className={`delta ${d.good === true ? "good" : d.good === false ? "bad" : ""}`}>
      <i>{d.zero ? "=" : d.up ? "↑" : "↓"} {d.text}</i>{label && <small>vs período anterior</small>}
    </span>
  );
}

// Cartão de número (o MetricCard do Glassy CRM): título, seta para abrir o detalhe, número animado, variação e meta.
export function Kpi({ label, metric, unit, id, goal, href, accent, onSelect, selected, sub, spark, color }) {
  const body = (
    <>
      <div className="kpi-top"><h3>{label}</h3>{href && (onSelect
        ? <a className="round" href={href} onClick={(e) => e.stopPropagation()} aria-label={`Abrir ${label}`}><Icon name="arrow" /></a>
        : <span className="round"><Icon name="arrow" /></span>)}</div>
      <div className="kpi-value"><CountUp value={metric?.value} unit={unit} /></div>
      <div className="kpi-foot">
        {sub !== undefined ? <span className="delta none">{sub}</span> : <DeltaBadge metric={metric} unit={unit} id={id} />}
        {goal && <div className="kpi-goal">META {goal}</div>}
      </div>
      {spark}
    </>
  );
  // Com onSelect o cartão escolhe o gráfico grande do Painel; a seta continua abrindo o detalhe.
  if (onSelect) return (
    <div className={`glass kpi selectable ${selected ? "accent" : ""} ${spark ? "has-spark" : ""}`} style={color ? { "--c": color } : undefined} role="button" tabIndex={0} aria-pressed={selected}
      onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}>{body}</div>
  );
  return <a className={`glass kpi ${accent ? "accent" : ""}`} href={href || undefined}>{body}</a>;
}

export function Tabs({ items, value, onChange, counts }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {l}{counts?.[k] != null && <em>{counts[k]}</em>}
        </button>
      ))}
    </div>
  );
}

export const Chip = ({ tone = "", children, title }) => <span className={`chip ${tone}`} title={title}><i />{children}</span>;

// Tabela de vidro com botão de exportar CSV. rows: arrays de células (texto ou JSX); csv: arrays de texto puro (opcional).
export function Table({ head, rows, csv, name = "tabela", className = "" }) {
  if (!rows?.length) return <p className="empty">Sem dados no período.</p>;
  return (
    <div className={`glass table-wrap ${className}`}>
      {csv && <button className="ghost export" onClick={() => downloadCsv(name, head, csv)}><Icon name="download" /> CSV</button>}
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={c?.props?.["data-win"] ? "win" : ""}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function PageHead({ crumb, title, desc, tabs, tab, onTab, counts, right }) {
  return (
    <div className="page-head">
      <div className="page-title">
        <p className="crumb">{crumb}</p>
        <h1>{title}</h1>
        {desc && <p className="desc">{desc}</p>}
      </div>
      {right}
      {tabs && <Tabs items={tabs} value={tab} onChange={onTab} counts={counts} />}
    </div>
  );
}

export const Note = ({ children }) => <p className="note">{children}</p>;

// Gaveta lateral (protótipo do painel, 04/11): detalhe do pedido ou da cliente. Esc ou clique fora fecha.
export function Drawer({ title, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="overlay drawer-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="glass drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head"><h2>{title}</h2><button className="glass round" aria-label="Fechar" autoFocus onClick={onClose}><Icon name="x" /></button></div>
        {children}
      </aside>
    </div>
  );
}

// Paginação: "1–25 de 180", as setas e, com numbered, as páginas 1, 2, 3… (as vizinhas da atual, a primeira e a última).
export function Pager({ page, per, total, onPage, numbered = false }) {
  const pages = Math.max(1, Math.ceil(total / per));
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <div className="pager">
      <span>{total ? (page - 1) * per + 1 : 0}–{Math.min(total, page * per)} de {total}</span>
      <span className="seg small">
        <button disabled={page <= 1} aria-label="Página anterior" onClick={() => onPage(page - 1)}>‹</button>
        {numbered && nums.flatMap((n, i) => [...(i && n - nums[i - 1] > 1 ? [<span key={`g${n}`} className="gap">…</span>] : []), <button key={n} className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} aria-label={`Página ${n}`} onClick={() => onPage(n)}>{n}</button>])}
        <button disabled={page >= pages} aria-label="Próxima página" onClick={() => onPage(page + 1)}>›</button>
      </span>
    </div>
  );
}

// Lista de definição do protótipo: rótulo à esquerda, valor à direita.
export const Kv = ({ items }) => <ul className="kv">{items.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>;
