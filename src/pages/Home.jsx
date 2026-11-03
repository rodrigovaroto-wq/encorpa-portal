// Painel (operador, 03/11): 4 cartões com minigráfico neon (faturamento, pedidos, conversão, margem operacional), o gráfico de linha de
// ponta a ponta do cartão escolhido, a caixa de entrada em 3 blocos e, embaixo, forma de pagamento e peças por pedido.
// As cores dos minigráficos seguem a referência do operador, nesta ordem: azul, verde, laranja, roxo.
import { useState } from "react";
import { BUCKETS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store } from "../lib/format.js";
import { Donut, NeonSpark, TrendLine } from "../components/charts.jsx";
import { Card, Kpi } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";
import { INBOX, inboxCounts } from "../lib/inbox.js";

const HOME_KPIS = [["revenue", "var(--neon-blue)"], ["orders", "var(--neon-green)"], ["conversion", "var(--neon-orange)"], ["op_margin", "var(--neon-purple)"]];
const HREF = { orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", op_margin: "#/money/result", pay: "#/orders", units: "#/orders" };

export function Home({ data, period }) {
  const p = data.periods[period] || {}, m = p.metrics || {};
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const label = PERIODS.find((x) => x.id === period)?.label;
  const [sel, setSelState] = useState(() => (HOME_KPIS.some(([k]) => k === store.get("home:metric")) ? store.get("home:metric") : "revenue"));
  const setSel = (id) => { setSelState(id); store.set("home:metric", id); };
  const pay = [{ label: "Na entrega", value: p.mix?.cod, color: "var(--neon-blue)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--neon-orange)" }];
  const units = [1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--neon-blue)", "var(--neon-green)", "var(--neon-purple)"][i] }));
  const x = metricBy(sel), series = m[sel]?.series || [], color = HOME_KPIS.find(([k]) => k === sel)[1];

  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}</h1>
        <p>{label === "Dia" ? "Últimas 24 horas" : `Período: ${label?.toLowerCase()}`}. Clique num cartão para ver a linha dele.</p>
      </div>
      <div className="kpis home-kpis">
        {HOME_KPIS.map(([id, c]) => { const k = metricBy(id); return <Kpi key={id} id={id} label={k.label} metric={m[id]} unit={k.unit} href={HREF[id]} selected={sel === id} onSelect={() => setSel(id)} color={c} spark={<NeonSpark values={m[id]?.series} color={c} />} />; })}
      </div>
      <Card className="main-chart" title={x.label} sub={label}>
        <TrendLine key={sel} values={series} labels={bucketLabels(period, BUCKETS, series.length, data.updated)} unit={x.unit} color={color} />
      </Card>
      <Inbox chats={data.global.chats} />
      <div className="home-donuts">
        <DonutBlock title="Forma de pagamento" items={pay} href={HREF.pay} />
        <DonutBlock title="Peças por pedido" items={units} href={HREF.units} />
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

// Rosca no formato dos cartões: título, seta para o detalhe e a rosca com a legenda.
function DonutBlock({ title, items, href }) {
  return (
    <div className="glass kpi donut-block">
      <div className="kpi-top"><h3>{title}</h3><a className="round" href={href} aria-label={`Abrir ${title}`}><Icon name="arrow" /></a></div>
      <Donut items={items} size={125} />
    </div>
  );
}
