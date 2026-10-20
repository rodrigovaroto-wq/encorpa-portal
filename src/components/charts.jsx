// Gráficos em SVG puro, com leitura ao passar o mouse (inspirados no Glassy CRM: barras com dica, rosca, linhas e medidores).
import { useId, useState } from "react";
import { fmt } from "../lib/format.js";

// Barras verticais. items: [{ label, value }]. A barra sob o mouse acende e mostra o valor.
export function Bars({ items, unit = "n", height = 220, highlight }) {
  const [hover, setHover] = useState(null);
  const id = useId().replace(/:/g, "");
  if (!items?.length || items.every((x) => !x.value)) return <Empty />;
  const max = Math.max(...items.map((x) => x.value || 0)) || 1, w = 100 / items.length;
  const active = hover ?? highlight ?? null;
  return (
    <div className="bars-chart" style={{ height }}>
      <div className="bars-grid">{[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f}><em>{fmt(max * f, unit)}</em></span>)}</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="bars-svg">
        <defs>
          <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent-2)" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".35" /></linearGradient>
        </defs>
        {items.map((x, i) => {
          const h = ((x.value || 0) / max) * 96;
          return <rect key={i} x={i * w + w * 0.22} y={100 - h} width={w * 0.56} height={h} rx="1.4" fill={`url(#bg${id})`} className={active === i ? "on" : ""} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
        })}
      </svg>
      {active != null && items[active] && (
        <div className="chart-tip" style={{ left: `${(active + 0.5) * w}%`, bottom: `${((items[active].value || 0) / max) * 100}%` }}>
          <b>{fmt(items[active].value, unit)}</b> <span>{items[active].label}</span>
        </div>
      )}
      <div className="bars-labels">{items.map((x, i) => <span key={i} className={active === i ? "on" : ""}>{x.short ?? x.label}</span>)}</div>
    </div>
  );
}

// Linhas (uma ou mais séries). series: [{ name, values, color }]; labels: rótulo de cada ponto.
// axes: mostra o eixo de valor (esquerda) e o de data (embaixo).
export function Lines({ series, labels, unit = "n", height = 220, axes = false }) {
  if (axes) return (
    <div className="axes-chart" style={{ height }}>
      <AxisY series={series} unit={unit} />
      <div className="axes-plot"><Lines series={series} labels={labels} unit={unit} height={height - 24} /></div>
      <div className="axis-x">{(labels || []).map((l, i, a) => (i % Math.ceil(a.length / 6) === 0 || i === a.length - 1) && <span key={i} style={{ left: `${a.length > 1 ? (i / (a.length - 1)) * 100 : 50}%` }}>{l}</span>)}</div>
    </div>
  );
  return <LinesPlot series={series} labels={labels} unit={unit} height={height} />;
}

// Eixo de valor: 5 marcas do mínimo ao máximo, com o mesmo critério de escala das linhas.
function AxisY({ series, unit }) {
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (all.length < 2) return <div className="axis-y" />;
  const max = Math.max(...all) || 1, min = Math.min(0, ...all), span = max - min || 1;
  return <div className="axis-y">{[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f} style={{ top: `${94 - f * 86}%` }}>{fmt(min + span * f, unit)}</span>)}</div>;
}

function LinesPlot({ series, labels, unit = "n", height = 220 }) {
  const [hover, setHover] = useState(null);
  const id = useId().replace(/:/g, "");
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (all.length < 2) return <Empty />;
  const n = Math.max(...series.map((s) => s.values.length)), max = Math.max(...all) || 1, min = Math.min(0, ...all), span = max - min || 1;
  const X = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50), Y = (v) => 94 - ((v - min) / span) * 86;
  // Intervalo sem dado (taxa sem base) fica como lacuna, nunca como zero: a linha para e recomeça.
  const runs = (vals) => vals.reduce((out, v, i) => { if (v == null) return out; const last = out.at(-1); if (last && last.at(-1)[2] === i - 1) last.push([X(i), Y(v), i]); else out.push([[X(i), Y(v), i]]); return out; }, []);
  const smooth = (p) => p.reduce((d, [x, y], i) => { if (!i) return `M${x},${y}`; const [px, py] = p[i - 1], cx = (px + x) / 2; return `${d} C${cx},${py} ${cx},${y} ${x},${y}`; }, "");
  return (
    <div className="lines-chart" style={{ height }} onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))); }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>{series.map((s, k) => <linearGradient key={k} id={`lg${id}${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2="100" y1={8 + f * 86} y2={8 + f * 86} className="grid" />)}
        {series.map((s, k) => (
          <g key={k}>
            {runs(s.values).map((p, j) => p.length > 1 ? (
              <g key={j}><path d={`${smooth(p)} L${p.at(-1)[0]},100 L${p[0][0]},100 Z`} fill={`url(#lg${id}${k})`} /><path d={smooth(p)} stroke={s.color} className="line" /></g>
            ) : <circle key={j} cx={p[0][0]} cy={p[0][1]} r="1.2" fill={s.color} />)}
          </g>
        ))}
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1="0" y2="100" className="cross" />}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${X(hover)}%`, top: 0 }}>
          {labels?.[hover] && <span>{labels[hover]}</span>}
          {series.map((s, k) => <b key={k} style={{ color: s.color }}>{s.name ? `${s.name}: ` : ""}{fmt(s.values[hover], unit)}</b>)}
        </div>
      )}
      {series.length > 1 && <div className="legend">{series.map((s, k) => <span key={k}><i style={{ background: s.color }} />{s.name}</span>)}</div>}
    </div>
  );
}

// Rosca com legenda. items: [{ label, value, color }]
export function Donut({ items, unit = "n", size = 170, center }) {
  const [hover, setHover] = useState(null);
  const total = items.reduce((a, b) => a + (b.value || 0), 0);
  if (!total) return <Empty />;
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={R} className="track" />
        {items.map((x, i) => {
          const len = ((x.value || 0) / total) * C, dash = `${Math.max(0, len - 1.2)} ${C}`, off = -acc;
          acc += len;
          return <circle key={i} cx="50" cy="50" r={R} stroke={x.color} strokeDasharray={dash} strokeDashoffset={off} className={`seg ${hover === i ? "on" : ""}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
        })}
        <text x="50" y="48" className="big">{hover != null ? `${Math.round(((items[hover].value || 0) / total) * 100)}%` : center ?? fmt(total, unit)}</text>
        <text x="50" y="61" className="small">{hover != null ? items[hover].label : "total"}</text>
      </svg>
      <ul>{items.map((x, i) => <li key={i} className={hover === i ? "on" : ""} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}><i style={{ background: x.color }} />{x.label}<b>{fmt(x.value, unit)}</b></li>)}</ul>
    </div>
  );
}

// Medidor em anel (0 a 100%). tone: ok | warn | bad
export function Gauge({ value, label, sub, tone, size = 132 }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value)), R = 40, C = 2 * Math.PI * R;
  const color = tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : tone === "ok" ? "var(--ok)" : "var(--accent-2)";
  return (
    <div className="gauge">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={R} className="track" />
        {v != null && <circle cx="50" cy="50" r={R} stroke={color} strokeDasharray={`${(v / 100) * C} ${C}`} className="arc" />}
        <text x="50" y="54" className="big">{v == null ? "—" : `${Math.round(value)}%`}</text>
      </svg>
      {label && <b>{label}</b>}
      {sub && <span>{sub}</span>}
    </div>
  );
}

// Mini gráfico de linha para dentro dos cartões, com o valor do ponto sob o mouse.
export function Spark({ values, unit, height = 56 }) {
  const [hover, setHover] = useState(null);
  const known = (values || []).filter((v) => v != null);
  if (known.length < 2) return <div className="spark empty" style={{ height }} />;
  const max = Math.max(...known), min = Math.min(...known), span = max - min || 1, n = values.length;
  const pts = values.map((v, i) => [(i / (n - 1)) * 100, v == null ? null : 92 - ((v - min) / span) * 80]);
  // Sem dado no intervalo: a linha para (lacuna), não cai a zero.
  const d = pts.map(([x, y], i) => (y == null ? "" : `${i && pts[i - 1][1] != null ? "L" : "M"}${x},${y}`)).join(" ");
  return (
    <div className="spark" style={{ height }} onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))); }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {pts.every(([, y]) => y != null) && <path d={`${d} L100,100 L0,100 Z`} className="area" />}
        <path d={d} className="line" />
        {hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1="0" y2="100" className="cross" />}
      </svg>
      {hover != null && <div className="chart-tip mini" style={{ left: `${pts[hover][0]}%` }}><b>{fmt(values[hover], unit)}</b></div>}
    </div>
  );
}

// Barras horizontais (eficiência por item). items: [{ label, value (0-100), right }]
export function HBars({ items, unit = "pct", tone }) {
  if (!items?.length) return <Empty />;
  const max = unit === "pct" ? 100 : Math.max(...items.map((x) => x.value || 0)) || 1;
  return (
    <div className="hbars">
      {items.map((x, i) => (
        <div key={i} className="hbar">
          <div className="hbar-head"><span>{x.label}</span><b>{x.right ?? fmt(x.value, unit)}</b></div>
          <div className="hbar-track"><div className={`hbar-fill ${x.tone || tone || ""}`} style={{ width: `${Math.max(1.5, ((x.value || 0) / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export const Empty = ({ text = "Sem dados no período." }) => <p className="empty">{text}</p>;
