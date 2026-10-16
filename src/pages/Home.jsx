// Painel inicial: saudação, 6 cartões (3 por linha) na ordem do operador, dois avisos compactos, faturamento por intervalo com
// forma de pagamento e peças por pedido ao lado, e um gráfico com eixos (data e valor) por métrica. Metas ficam nas seções próprias.
import { BUCKETS, PERIODS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy } from "../lib/format.js";
import { Bars, Donut, Lines } from "../components/charts.jsx";
import { Card, CountUp, Kpi } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

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
  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}, Rodrigo <span className="wave-hand">👋</span></h1>
        <p>Isso é o que está acontecendo {label === "Dia" ? "nas últimas 24 horas" : `no período: ${label?.toLowerCase()}`}.</p>
      </div>
      <div className="kpis k3 home-kpis">
        {HOME_KPIS.map((id, i) => { const x = metricBy(id); return <Kpi key={id} id={id} label={x.label} metric={m[id]} unit={x.unit} href={HREF[id]} accent={i === 0} />; })}
      </div>
      <div className="row r-1-1">
        <a className="glass card mini-stat" href="#/orders">
          <span className="round icon-badge"><Icon name="box" /></span>
          <div><h3>Pedidos a caminho</h3><p><em>{waiting.filter((o) => o.step === "created").length} aguardando envio</em> · {waiting.filter((o) => o.step === "en_route").length} em rota</p></div>
          <b><CountUp value={waiting.length} unit="n" /></b>
        </a>
        <a className="glass card mini-stat" href="#/chat">
          <span className="round icon-badge"><Icon name="chat" /></span>
          <div><h3>Conversas não resolvidas</h3><p><em className="bad">viraram aviso ao operador</em></p></div>
          <b><CountUp value={unresolved.length} unit="n" /></b>
        </a>
      </div>
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
      <h2 className="section-title">Cada métrica no período</h2>
      <div className="row r-1-1">
        {HOME_KPIS.map((id) => { const x = metricBy(id), s = m[id]?.series || []; return (
          <Card key={id} title={x.label} sub={fmt(m[id]?.value, x.unit)} className="metric-chart">
            <Lines series={[{ name: x.label, values: s, color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, s.length)} unit={x.unit} height={240} axes />
          </Card>
        ); })}
      </div>
    </div>
  );
}
