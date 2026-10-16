// Painel inicial no layout do Glassy CRM: saudação, 8 cartões (4 por linha) com variação, faturamento por intervalo,
// forma de pagamento, pedidos a caminho, conversas não resolvidas e um gráfico por métrica.
import { BUCKETS, KPIS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy } from "../lib/format.js";
import { Bars, Donut, Spark } from "../components/charts.jsx";
import { Card, CountUp, Kpi } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const HREF = { leads: "#/customers", orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", resolution: "#/malu/results", api_per_lead: "#/money/api", net_profit: "#/money/result", op_margin: "#/money/result" };

export function Home({ data, period }) {
  const p = data.periods[period] || {}, g = data.global, m = p.metrics || {};
  const rev = m.revenue?.series || [], labels = bucketLabels(period, BUCKETS, rev.length);
  const waiting = (g.orders || []).filter((o) => ["created", "en_route"].includes(o.step));
  const unresolved = (g.chats || []).filter((c) => c.status === "unresolved");
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}, Rodrigo <span className="wave-hand">👋</span></h1>
        <p>Isso é o que está acontecendo {PERIODS.find((x) => x.id === period)?.label === "Dia" ? "nas últimas 24 horas" : `no período: ${PERIODS.find((x) => x.id === period)?.label.toLowerCase()}`}.</p>
      </div>
      <div className="kpis">
        {KPIS.map((id, i) => { const x = metricBy(id); return <Kpi key={id} id={id} label={x.label} metric={m[id]} unit={x.unit} goal={x.goal} href={HREF[id]} accent={i === 0} />; })}
      </div>
      <div className="row r-2-1">
        <Card title="Faturamento" sub="por intervalo do período" onOpen={() => (location.hash = "#/money/result")}>
          <Bars items={rev.map((v, i) => ({ value: v, label: labels[i], short: i % Math.ceil(rev.length / 10) ? "" : labels[i] }))} unit="brl" />
        </Card>
        <Card title="Forma de pagamento" sub="pedidos válidos no período">
          <Donut items={[{ label: "Na entrega", value: p.mix?.cod, color: "var(--accent-2)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--pink)" }]} />
        </Card>
      </div>
      <div className="row r-1-1-1">
        <a className="glass card big-stat" href="#/orders">
          <span className="round icon-badge"><Icon name="box" /></span>
          <div><b><CountUp value={waiting.length} unit="n" /></b> pedidos</div>
          <p><em>{waiting.filter((o) => o.step === "created").length} aguardando envio</em> e {waiting.filter((o) => o.step === "en_route").length} a caminho.</p>
        </a>
        <a className="glass card big-stat" href="#/chat">
          <span className="round icon-badge"><Icon name="chat" /></span>
          <div><b><CountUp value={unresolved.length} unit="n" /></b> conversas</div>
          <p><em className="bad">não resolvidas</em> pela Malu: viraram aviso ao operador.</p>
        </a>
        <Card title="Peças por pedido" sub="kits vendidos no período">
          <Donut items={[1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--accent-2)", "var(--pink)", "var(--ok)"][i] }))} size={140} />
        </Card>
      </div>
      <h2 className="section-title">Cada métrica no período</h2>
      <div className="kpis">
        {KPIS.map((id) => { const x = metricBy(id); return (
          <Card key={id} title={x.label} className="spark-card" sub={fmt(m[id]?.value, x.unit)}><Spark values={m[id]?.series} unit={x.unit} height={80} /></Card>
        ); })}
      </div>
    </div>
  );
}
