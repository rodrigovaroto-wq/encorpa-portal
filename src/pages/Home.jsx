// Painel inicial: saudação, 6 cartões (3 por linha) na ordem do operador, a caixa de entrada em 3 blocos de meia altura (23/10) e um só
// gráfico de barras com seletor, com forma de pagamento e peças por pedido empilhadas à direita (30% mais altas que os cartões).
// Clicar num bloco também escolhe o gráfico. Metas ficam nas seções próprias.
import { useState } from "react";
import { BUCKETS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store } from "../lib/format.js";
import { Bars, Donut } from "../components/charts.jsx";
import { Card, Kpi } from "../components/ui.jsx";
import { usePopover } from "../components/Topbar.jsx";
import { Icon } from "../components/icons.jsx";
import { INBOX, inboxCounts } from "../lib/inbox.js";

// Ordem pedida pelo operador (16/10): faturamento → conversão → margem → lucro → pedidos → resolução.
const HOME_KPIS = ["revenue", "conversion", "op_margin", "net_profit", "orders", "resolution"];
const HREF = { orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", resolution: "#/malu/results", net_profit: "#/money/result", op_margin: "#/money/result", pay: "#/orders", units: "#/orders" };
const OPTIONS = [...HOME_KPIS.map((id) => [id, metricBy(id).label]), ["pay", "Forma de pagamento"], ["units", "Peças por pedido"]];

export function Home({ data, period }) {
  const p = data.periods[period] || {}, g = data.global, m = p.metrics || {};
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const label = PERIODS.find((x) => x.id === period)?.label;
  const [sel, setSelState] = useState(() => (OPTIONS.some(([k]) => k === store.get("home:metric")) ? store.get("home:metric") : "revenue"));
  const setSel = (id) => { setSelState(id); store.set("home:metric", id); };
  const pick = usePopover();
  const pay = [{ label: "Na entrega", value: p.mix?.cod, color: "var(--accent-2)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--pink)" }];
  const units = [1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--accent-2)", "var(--pink)", "var(--ok)"][i] }));

  // O que o gráfico mostra para cada opção: as métricas por intervalo do período; pagamento e peças por categoria.
  const chart = (() => {
    if (sel === "pay") return { unit: "n", items: pay.map((x) => ({ ...x, short: x.label })) };
    if (sel === "units") return { unit: "n", items: units.map((x) => ({ ...x, short: x.label })) };
    const x = metricBy(sel), s = m[sel]?.series || [], labels = bucketLabels(period, BUCKETS, s.length, data.updated);
    return { unit: x.unit, items: s.map((v, i) => ({ value: v, label: labels[i], short: i % Math.ceil(s.length / 10) ? "" : labels[i] })) };
  })();

  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello} <span className="wave-hand">👋</span></h1>
        <p>Isso é o que está acontecendo {label === "Dia" ? "nas últimas 24 horas" : `no período: ${label?.toLowerCase()}`}. Clique num bloco para ver o gráfico dele.</p>
      </div>
      <div className="kpis k3 home-kpis">
        {HOME_KPIS.map((id) => { const k = metricBy(id); return <Kpi key={id} id={id} label={k.label} metric={m[id]} unit={k.unit} href={HREF[id]} selected={sel === id} onSelect={() => setSel(id)} />; })}
      </div>
      <Inbox chats={data.global.chats} />
      <div className="home-chart-row">
        <Card className="main-chart" title={OPTIONS.find(([k]) => k === sel)[1]} action={
          <div className="pop" ref={pick.ref}>
            <button className="glass pill" aria-haspopup="listbox" aria-expanded={pick.open} onClick={() => pick.setOpen(!pick.open)}>Métrica<Icon name="chevron" size={14} /></button>
            {pick.open && <div className="glass popover" role="listbox">{OPTIONS.map(([k, l]) => <button key={k} role="option" aria-selected={sel === k} className={sel === k ? "on" : ""} onClick={() => { setSel(k); pick.setOpen(false); }}>{l}</button>)}</div>}
          </div>
        }>
          <Bars key={sel} items={chart.items} unit={chart.unit} />
        </Card>
        <div className="home-side home-kpis">
          <DonutBlock title="Forma de pagamento" items={pay} href={HREF.pay} selected={sel === "pay"} onSelect={() => setSel("pay")} />
          <DonutBlock title="Peças por pedido" items={units} href={HREF.units} selected={sel === "units"} onSelect={() => setSel("units")} />
        </div>
      </div>
    </div>
  );
}

// Caixa de entrada: quantas conversas esperam resposta, estão com pessoa ou passaram do tempo. Cada bloco abre Conversas no filtro.
function Inbox({ chats }) {
  const n = inboxCounts(chats);
  return (
    <div className="kpis k3 half inbox">
      {INBOX.map(([id, label, sub]) => (
        <a key={id} href={`#/chat?f=${id}`} className={`glass kpi inbox-block ${id === "overdue" && n[id] ? "alert" : ""}`}>
          <div><h3>{label}</h3><span className="delta none">{sub}</span></div>
          <b className="kpi-value">{fmt(n[id], "n")}</b>
        </a>
      ))}
    </div>
  );
}

// Bloco de rosca no mesmo formato dos cartões de número: título, seta para o detalhe e a rosca com a legenda.
function DonutBlock({ title, items, href, selected, onSelect }) {
  return (
    <div className={`glass kpi selectable donut-block ${selected ? "accent" : ""}`} role="button" tabIndex={0} aria-pressed={selected}
      onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}>
      <div className="kpi-top"><h3>{title}</h3><a className="round" href={href} onClick={(e) => e.stopPropagation()} aria-label={`Abrir ${title}`}><Icon name="arrow" /></a></div>
      <Donut items={items} size={125} />
    </div>
  );
}
