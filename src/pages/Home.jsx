// Painel inicial: saudação, grade de 3 × 3 (6 métricas na ordem do operador, necessidade de caixa, forma de pagamento e peças por
// pedido) e um só gráfico de barras com seletor entre os 9 blocos. Clicar num bloco também escolhe o gráfico. Metas ficam nas seções próprias.
import { useState } from "react";
import { BUCKETS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store } from "../lib/format.js";
import { Bars, Donut } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

// Ordem pedida pelo operador (16/10): faturamento → conversão → margem → lucro → pedidos → resolução.
const HOME_KPIS = ["revenue", "conversion", "op_margin", "net_profit", "orders", "resolution"];
const HREF = { orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", resolution: "#/malu/results", net_profit: "#/money/result", op_margin: "#/money/result", cash: "#/money/cash", pay: "#/orders", units: "#/orders" };
const CASH_LIMIT = 1075;
const OPTIONS = [...HOME_KPIS.map((id) => [id, metricBy(id).label]), ["cash", "Necessidade de caixa"], ["pay", "Forma de pagamento"], ["units", "Peças por pedido"]];

export function Home({ data, period }) {
  const p = data.periods[period] || {}, g = data.global, m = p.metrics || {};
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const label = PERIODS.find((x) => x.id === period)?.label;
  const [sel, setSelState] = useState(() => (OPTIONS.some(([k]) => k === store.get("home:metric")) ? store.get("home:metric") : "revenue"));
  const setSel = (id) => { setSelState(id); store.set("home:metric", id); };
  const pay = [{ label: "Na entrega", value: p.mix?.cod, color: "var(--accent-2)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--pink)" }];
  const units = [1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--accent-2)", "var(--pink)", "var(--ok)"][i] }));

  // O que o gráfico mostra para cada opção: as métricas por intervalo do período; caixa, pagamento e peças por categoria.
  const chart = (() => {
    if (sel === "cash") return { unit: "brl", value: fmt(g.cash_need, "brl"), items: [{ label: "Adiantado agora", short: "Adiantado agora", value: g.cash_need || 0 }, { label: "Limite do teste", short: "Limite do teste", value: CASH_LIMIT }] };
    if (sel === "pay") return { unit: "n", value: `${fmt((p.mix?.cod || 0) + (p.mix?.prepay || 0), "n")} pedidos`, items: pay.map((x) => ({ ...x, short: x.label })) };
    if (sel === "units") return { unit: "n", value: `${fmt(units.reduce((a, b) => a + (b.value || 0), 0), "n")} pedidos`, items: units.map((x) => ({ ...x, short: x.label })) };
    const x = metricBy(sel), s = m[sel]?.series || [], labels = bucketLabels(period, BUCKETS, s.length);
    return { unit: x.unit, value: fmt(m[sel]?.value, x.unit), delta: <DeltaBadge metric={m[sel]} unit={x.unit} id={sel} />, items: s.map((v, i) => ({ value: v, label: labels[i], short: i % Math.ceil(s.length / 10) ? "" : labels[i] })) };
  })();

  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}, Rodrigo <span className="wave-hand">👋</span></h1>
        <p>Isso é o que está acontecendo {label === "Dia" ? "nas últimas 24 horas" : `no período: ${label?.toLowerCase()}`}. Clique num bloco para ver o gráfico dele.</p>
      </div>
      <div className="kpis k3 home-kpis">
        {HOME_KPIS.map((id) => { const k = metricBy(id); return <Kpi key={id} id={id} label={k.label} metric={m[id]} unit={k.unit} href={HREF[id]} selected={sel === id} onSelect={() => setSel(id)} />; })}
        <Kpi label="Necessidade de caixa" metric={{ value: g.cash_need ?? null }} unit="brl" href={HREF.cash} sub={`adiantado em pedidos · limite ${fmt(CASH_LIMIT, "brl")}`} selected={sel === "cash"} onSelect={() => setSel("cash")} />
        <DonutBlock title="Forma de pagamento" items={pay} href={HREF.pay} selected={sel === "pay"} onSelect={() => setSel("pay")} />
        <DonutBlock title="Peças por pedido" items={units} href={HREF.units} selected={sel === "units"} onSelect={() => setSel("units")} />
      </div>
      <Card className="main-chart" title={<span className="chart-title">{OPTIONS.find(([k]) => k === sel)[1]} <b>{chart.value}</b> {chart.delta}</span>}>
        <div className="chart-picker" role="tablist" aria-label="Métrica do gráfico">
          {OPTIONS.map(([k, l]) => <button key={k} role="tab" aria-selected={sel === k} className={sel === k ? "on" : ""} onClick={() => setSel(k)}>{l}</button>)}
        </div>
        <Bars key={sel} items={chart.items} unit={chart.unit} height={360} />
      </Card>
    </div>
  );
}

// Bloco de rosca no mesmo formato dos cartões de número: título, seta para o detalhe e a rosca com a legenda.
function DonutBlock({ title, items, href, selected, onSelect }) {
  return (
    <div className={`glass kpi selectable donut-block ${selected ? "accent" : ""}`} role="button" tabIndex={0} aria-pressed={selected}
      onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}>
      <div className="kpi-top"><h3>{title}</h3><a className="round" href={href} onClick={(e) => e.stopPropagation()} aria-label={`Abrir ${title}`}><Icon name="arrow" /></a></div>
      <Donut items={items} size={96} />
    </div>
  );
}
