// Clientes (a "Customer Intelligence" do Glassy CRM), em duas sub-abas (23/10): Origem e recompra (de onde vêm, conversão por estado e
// recompra, com um gráfico de linha que troca de métrica como o do Painel) e Score e Perfil (a antiga aba Leads, pages/Score.jsx).
import { useState } from "react";
import { BUCKETS, COMPARE_LABEL, periodLabel } from "../lib/constants.js";
import { bucketLabels, metricBy, store } from "../lib/format.js";
import { Donut, HBars, Lines } from "../components/charts.jsx";
import { Card, Kpi, Note, PageHead } from "../components/ui.jsx";
import { useChartPeriod, usePopover } from "../components/Topbar.jsx";
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

// As métricas desta aba que o gráfico mostra. "WhatsApp × Site × Orgânico" desenha as três origens juntas (operador, 04/11).
const LINES = [["origin", "WhatsApp × Site × Orgânico"], ["leads", "Leads"], ["leads_whatsapp", "Leads → WhatsApp"], ["leads_site", "Leads → Site"], ["leads_organic", "Leads → Orgânico"], ["orders", "Pedidos"], ["conversion", "Taxa de conversão"]];
const ORIGINS = [["leads_whatsapp", "WhatsApp", "var(--neon-green)"], ["leads_site", "Site", "var(--neon-blue)"], ["leads_organic", "Orgânico", "var(--neon-purple)"]];

function Origin({ data, period }) {
  const p = data.periods[period] || {}, m = p.metrics || {};
  const cp = useChartPeriod(data, period), cm = cp.p?.metrics || {};
  const [sel, setSelState] = useState(() => (LINES.some(([k]) => k === store.get("customers:metric")) ? store.get("customers:metric") : "origin"));
  const setSel = (id) => { setSelState(id); store.set("customers:metric", id); };
  const pick = usePopover();
  const st = (p.states || []).filter((x) => x.state !== "sem estado");
  const series = sel === "origin"
    ? ORIGINS.map(([k, name, color]) => ({ name, values: cm[k]?.series || [], color }))
    : [{ name: metricBy(sel)?.label || LINES.find(([k]) => k === sel)[1], values: cm[sel]?.series || [], color: "var(--neon-blue)" },
      ...(cm[sel]?.compare ? [{ name: COMPARE_LABEL[cp.p.compare], values: cm[sel].compare, color: "var(--neon-blue)", dashed: true }] : [])];
  const unit = sel === "origin" ? "n" : metricBy(sel)?.unit || "n";
  return (
    <>
      <div className="kpis">
        <Kpi label="Leads" id="leads" metric={m.leads} unit="n" />
        {ORIGINS.map(([k, name]) => <Kpi key={k} label={`Leads → ${name}`} id={k} metric={m[k]} unit="n" />)}
      </div>
      <div className="row r-2-1">
        <Card className="main-chart" title={LINES.find(([k]) => k === sel)[1]} sub={periodLabel(cp.id)} action={<>
          {cp.picker}
          <div className="pop" ref={pick.ref}>
            <button className="glass pill" aria-haspopup="listbox" aria-expanded={pick.open} onClick={() => pick.setOpen(!pick.open)}>Métrica<Icon name="chevron" size={14} /></button>
            {pick.open && <div className="glass popover" role="listbox">{LINES.map(([k, l]) => <button key={k} role="option" aria-selected={sel === k} className={sel === k ? "on" : ""} onClick={() => { setSel(k); pick.setOpen(false); }}>{l}</button>)}</div>}
          </div>
        </>}>
          <Lines key={sel + cp.id} series={series} labels={bucketLabels(cp.id, BUCKETS, series[0].values.length, data.updated)} unit={unit} height={260} axes />
        </Card>
        <Card title="Origem no período"><Donut items={ORIGINS.map(([k, label, color]) => ({ label, value: m[k]?.value, color }))} /></Card>
      </div>
      <div className="row r-1-1">
        <Card title="Conversão por estado" sub="pedidos ÷ leads"><HBars items={st.map((x) => ({ label: `${x.state} · ${x.orders}/${x.leads}`, value: x.conversion || 0 }))} /></Card>
        <Card title="Leads por estado"><HBars unit="n" items={st.map((x) => ({ label: x.state, value: x.leads }))} /></Card>
      </div>
      <Note>Estado = UF do CEP que a cliente passou na conversa (quem não chegou a passar o CEP fica fora dos dois gráficos de estado). WhatsApp = o lead veio de um anúncio de WhatsApp (clique CTWA); Site = de um anúncio de um conjunto Site; Orgânico = não veio de anúncio.</Note>
    </>
  );
}
