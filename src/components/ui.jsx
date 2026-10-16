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
export function Kpi({ label, metric, unit, id, goal, href, accent, onSelect, selected, sub }) {
  const body = (
    <>
      <div className="kpi-top"><h3>{label}</h3>{href && (onSelect
        ? <a className="round" href={href} onClick={(e) => e.stopPropagation()} aria-label={`Abrir ${label}`}><Icon name="arrow" /></a>
        : <span className="round"><Icon name="arrow" /></span>)}</div>
      <div className="kpi-value"><CountUp value={metric?.value} unit={unit} /></div>
      {sub !== undefined ? <span className="delta none">{sub}</span> : <DeltaBadge metric={metric} unit={unit} id={id} />}
      {goal && <div className="kpi-goal">META {goal}</div>}
    </>
  );
  // Com onSelect o cartão escolhe o gráfico grande do Painel; a seta continua abrindo o detalhe.
  if (onSelect) return (
    <div className={`glass kpi selectable ${selected ? "accent" : ""}`} role="button" tabIndex={0} aria-pressed={selected}
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
