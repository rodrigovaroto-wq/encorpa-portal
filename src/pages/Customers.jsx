// Clientes (a "Customer Intelligence" do Glassy CRM): de onde vêm (anúncio × orgânico), conversão por estado e recompra.
import { BUCKETS } from "../lib/constants.js";
import { bucketLabels, fmt } from "../lib/format.js";
import { Donut, HBars, Lines } from "../components/charts.jsx";
import { Card, Kpi, Note, PageHead } from "../components/ui.jsx";

export function Customers({ data, period }) {
  const p = data.periods[period] || {}, m = p.metrics || {}, orders = data.global.orders || [];
  const ad = m.leads_ad?.series || [], org = m.leads_organic?.series || [];
  const buyers = {};
  for (const o of orders) if (["created", "en_route", "delivered"].includes(o.step)) buyers[o.lead || o.name] = (buyers[o.lead || o.name] || 0) + 1;
  const n = Object.keys(buyers).length, repeat = Object.values(buyers).filter((x) => x > 1).length;
  const st = (p.states || []).filter((x) => x.state !== "sem estado");
  return (
    <div className="page">
      <PageHead crumb="Análise" title="Clientes" desc="De onde vêm as clientes, em que estado compram mais e quantas voltam." />
      <div className="kpis">
        <Kpi label="Leads" id="leads" metric={m.leads} unit="n" />
        <Kpi label="Vindas de anúncio" id="leads_ad" metric={m.leads_ad} unit="n" />
        <Kpi label="Orgânicas" id="leads_organic" metric={m.leads_organic} unit="n" />
        <div className="glass kpi"><div className="kpi-top"><h3>Recompra</h3></div><div className="kpi-value">{n ? fmt((repeat / n) * 100, "pct") : "—"}</div><span className="delta none">{repeat} de {n} compradoras fizeram mais de um pedido</span></div>
      </div>
      <div className="row r-2-1">
        <Card title="Leads por origem" sub="anúncio (clique no WhatsApp) × orgânico">
          <Lines series={[{ name: "Anúncio", values: ad, color: "var(--accent-2)" }, { name: "Orgânico", values: org, color: "var(--ok)" }]} labels={bucketLabels(period, BUCKETS, ad.length)} />
        </Card>
        <Card title="Origem no período"><Donut items={[{ label: "Anúncio", value: m.leads_ad?.value, color: "var(--accent-2)" }, { label: "Orgânico", value: m.leads_organic?.value, color: "var(--ok)" }]} /></Card>
      </div>
      <div className="row r-1-1">
        <Card title="Conversão por estado" sub="pedidos ÷ leads"><HBars items={st.map((x) => ({ label: `${x.state} · ${x.orders}/${x.leads}`, value: x.conversion || 0 }))} /></Card>
        <Card title="Leads por estado"><HBars unit="n" items={st.map((x) => ({ label: x.state, value: x.leads }))} /></Card>
      </div>
      <Note>Estado = UF do CEP que a cliente passou na conversa. Anúncio = a conversa começou pelo clique num anúncio de WhatsApp (CTWA).</Note>
    </div>
  );
}
