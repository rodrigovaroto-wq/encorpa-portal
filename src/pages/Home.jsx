// Painel inicial: saudação, grade única de 3 colunas (6 métricas na ordem do operador + 3 avisos), um gráfico grande que mostra a
// métrica do cartão escolhido, e faturamento por intervalo com forma de pagamento e peças por pedido ao lado. Metas ficam nas seções próprias.
import { useState } from "react";
import { BUCKETS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store } from "../lib/format.js";
import { Bars, Donut, Lines } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi } from "../components/ui.jsx";

// Ordem pedida pelo operador (16/10): faturamento → conversão → margem → lucro → pedidos → resolução.
const HOME_KPIS = ["revenue", "conversion", "op_margin", "net_profit", "orders", "resolution"];
const HREF = { orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", resolution: "#/malu/results", net_profit: "#/money/result", op_margin: "#/money/result" };

export function Home({ data, period }) {
  const p = data.periods[period] || {}, g = data.global, m = p.metrics || {};
  const rev = m.revenue?.series || [], labels = bucketLabels(period, BUCKETS, rev.length);
  const waiting = (g.orders || []).filter((o) => ["created", "en_route"].includes(o.step));
  const unresolved = (g.chats || []).filter((c) => c.status === "unresolved");
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const label = PERIODS.find((x) => x.id === period)?.label;
  const [sel, setSelState] = useState(() => (HOME_KPIS.includes(store.get("home:metric")) ? store.get("home:metric") : "revenue"));
  const setSel = (id) => { setSelState(id); store.set("home:metric", id); };
  const x = metricBy(sel), series = m[sel]?.series || [];
  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}, Rodrigo <span className="wave-hand">👋</span></h1>
        <p>Isso é o que está acontecendo {label === "Dia" ? "nas últimas 24 horas" : `no período: ${label?.toLowerCase()}`}. Clique num cartão para ver o gráfico dele.</p>
      </div>
      <div className="kpis k3 home-kpis">
        {HOME_KPIS.map((id) => { const k = metricBy(id); return <Kpi key={id} id={id} label={k.label} metric={m[id]} unit={k.unit} href={HREF[id]} selected={sel === id} onSelect={() => setSel(id)} />; })}
        <Kpi label="Pedidos a caminho" metric={{ value: waiting.length }} unit="n" href="#/orders" sub={`${waiting.filter((o) => o.step === "created").length} aguardando envio · ${waiting.filter((o) => o.step === "en_route").length} em rota`} />
        <Kpi label="Não resolvidas" metric={{ value: unresolved.length }} unit="n" href="#/chat" sub="conversas que viraram aviso ao operador" />
        <Kpi label="Necessidade de caixa" metric={{ value: g.cash_need ?? null }} unit="brl" href="#/money/cash" sub={`adiantado em pedidos · limite ${fmt(1075, "brl")}`} />
      </div>
      <Card title={x.label} sub={<span className="big-sub">{fmt(m[sel]?.value, x.unit)} <DeltaBadge metric={m[sel]} unit={x.unit} id={sel} /></span>} className="metric-chart main-chart">
        <Lines key={sel} series={[{ name: x.label, values: series, color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, series.length)} unit={x.unit} height={360} axes />
      </Card>
      <div className="home-revenue">
        <Card title="Faturamento" sub="por intervalo do período" className="rev-card" onOpen={() => (location.hash = "#/money/result")}>
          <Bars items={rev.map((v, i) => ({ value: v, label: labels[i], short: i % Math.ceil(rev.length / 10) ? "" : labels[i] }))} unit="brl" height={340} />
        </Card>
        <Card title="Forma de pagamento" sub="pedidos válidos no período">
          <Donut items={[{ label: "Na entrega", value: p.mix?.cod, color: "var(--accent-2)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--pink)" }]} size={150} />
        </Card>
        <Card title="Peças por pedido" sub="kits vendidos no período">
          <Donut items={[1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--accent-2)", "var(--pink)", "var(--ok)"][i] }))} size={150} />
        </Card>
      </div>
    </div>
  );
}
