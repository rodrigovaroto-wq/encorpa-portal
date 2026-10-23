// Clientes (a "Customer Intelligence" do Glassy CRM), em duas sub-abas (23/10): Origem e recompra (de onde vêm, conversão por estado e
// recompra, com um gráfico de linha que troca de métrica como o do Painel) e Score e Perfil (a antiga aba Leads, pages/Score.jsx).
import { useState } from "react";
import { BUCKETS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store } from "../lib/format.js";
import { Donut, HBars, Lines } from "../components/charts.jsx";
import { Card, Kpi, Note, PageHead } from "../components/ui.jsx";
import { usePopover } from "../components/Topbar.jsx";
import { Icon } from "../components/icons.jsx";
import { Score } from "./Score.jsx";

export function Customers({ data, period, route, tabs }) {
  const sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Clientes" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/customers/${k}`)} />
      {sub === "origin" && <Origin data={data} period={period} />}
      {sub === "score" && <Score data={data} period={period} />}
    </div>
  );
}

// As métricas desta aba que o gráfico mostra. "Anúncio × orgânico" desenha as duas linhas juntas.
const LINES = [["origin", "Anúncio × orgânico"], ["leads", "Leads"], ["leads_ad", "Vindas de anúncio"], ["leads_organic", "Orgânicas"], ["orders", "Pedidos"], ["conversion", "Taxa de conversão"]];

function Origin({ data, period }) {
  const p = data.periods[period] || {}, m = p.metrics || {}, orders = data.global.orders || [];
  const [sel, setSelState] = useState(() => (LINES.some(([k]) => k === store.get("customers:metric")) ? store.get("customers:metric") : "origin"));
  const setSel = (id) => { setSelState(id); store.set("customers:metric", id); };
  const pick = usePopover();
  const buyers = {};
  for (const o of orders) if (["created", "en_route", "delivered"].includes(o.step)) buyers[o.lead || o.name] = (buyers[o.lead || o.name] || 0) + 1;
  const n = Object.keys(buyers).length, repeat = Object.values(buyers).filter((x) => x > 1).length;
  const st = (p.states || []).filter((x) => x.state !== "sem estado");
  const ad = m.leads_ad?.series || [], org = m.leads_organic?.series || [];
  const series = sel === "origin"
    ? [{ name: "Anúncio", values: ad, color: "var(--accent-2)" }, { name: "Orgânico", values: org, color: "var(--ok)" }]
    : [{ name: metricBy(sel)?.label || LINES.find(([k]) => k === sel)[1], values: m[sel]?.series || [], color: "var(--accent-2)" }];
  const unit = sel === "origin" ? "n" : metricBy(sel)?.unit || "n";
  return (
    <>
      <div className="kpis">
        <Kpi label="Leads" id="leads" metric={m.leads} unit="n" />
        <Kpi label="Vindas de anúncio" id="leads_ad" metric={m.leads_ad} unit="n" />
        <Kpi label="Orgânicas" id="leads_organic" metric={m.leads_organic} unit="n" />
        <div className="glass kpi"><div className="kpi-top"><h3>Recompra</h3></div><div className="kpi-value">{n ? fmt((repeat / n) * 100, "pct") : "—"}</div><div className="kpi-foot"><span className="delta none">{repeat} de {n} compradoras fizeram mais de um pedido</span></div></div>
      </div>
      <div className="row r-2-1">
        <Card className="main-chart" title={LINES.find(([k]) => k === sel)[1]} sub="por intervalo do período" action={
          <div className="pop" ref={pick.ref}>
            <button className="glass pill" aria-haspopup="listbox" aria-expanded={pick.open} onClick={() => pick.setOpen(!pick.open)}>Métrica<Icon name="chevron" size={14} /></button>
            {pick.open && <div className="glass popover" role="listbox">{LINES.map(([k, l]) => <button key={k} role="option" aria-selected={sel === k} className={sel === k ? "on" : ""} onClick={() => { setSel(k); pick.setOpen(false); }}>{l}</button>)}</div>}
          </div>
        }>
          <Lines key={sel} series={series} labels={bucketLabels(period, BUCKETS, series[0].values.length, data.updated)} unit={unit} height={260} axes />
        </Card>
        <Card title="Origem no período"><Donut items={[{ label: "Anúncio", value: m.leads_ad?.value, color: "var(--accent-2)" }, { label: "Orgânico", value: m.leads_organic?.value, color: "var(--ok)" }]} /></Card>
      </div>
      <div className="row r-1-1">
        <Card title="Conversão por estado" sub="pedidos ÷ leads"><HBars items={st.map((x) => ({ label: `${x.state} · ${x.orders}/${x.leads}`, value: x.conversion || 0 }))} /></Card>
        <Card title="Leads por estado"><HBars unit="n" items={st.map((x) => ({ label: x.state, value: x.leads }))} /></Card>
      </div>
      <Note>Estado = UF do CEP que a cliente passou na conversa (quem não chegou a passar o CEP fica fora dos dois gráficos de estado). Anúncio = a conversa começou pelo clique num anúncio de WhatsApp (CTWA).</Note>
    </>
  );
}
