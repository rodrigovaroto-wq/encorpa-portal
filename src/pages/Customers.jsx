// Clientes (a "Customer Intelligence" do Glassy CRM), em duas sub-abas (23/10): Origem e recompra (de onde vêm, conversão por estado e
// recompra, com um gráfico de linha que troca de métrica como o do Painel) e Score e Perfil (a antiga aba Leads, pages/Score.jsx).
import { useState } from "react";
import { BUCKETS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, store, when } from "../lib/format.js";
import { Donut, HBars, Lines } from "../components/charts.jsx";
import { Card, Chip, Drawer, Kpi, Kv, Note, PageHead, Pager, Table } from "../components/ui.jsx";
import { CHANNEL } from "./Orders.jsx";
import { usePopover } from "../components/Topbar.jsx";
import { Icon } from "../components/icons.jsx";
import { Score } from "./Score.jsx";

export function Customers({ data, period, route, tabs }) {
  const sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Clientes" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/customers/${k}`)} />
      {sub === "origin" && <Origin data={data} period={period} />}
      {sub === "list" && <List data={data} route={route} />}
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
    ? [{ name: "Anúncio", values: ad, color: "var(--neon-blue)" }, { name: "Orgânico", values: org, color: "var(--ok)" }]
    : [{ name: metricBy(sel)?.label || LINES.find(([k]) => k === sel)[1], values: m[sel]?.series || [], color: "var(--neon-blue)" }];
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
        <Card title="Origem no período"><Donut items={[{ label: "Anúncio", value: m.leads_ad?.value, color: "var(--neon-blue)" }, { label: "Orgânico", value: m.leads_organic?.value, color: "var(--ok)" }]} /></Card>
      </div>
      <div className="row r-1-1">
        <Card title="Conversão por estado" sub="pedidos ÷ leads"><HBars items={st.map((x) => ({ label: `${x.state} · ${x.orders}/${x.leads}`, value: x.conversion || 0 }))} /></Card>
        <Card title="Leads por estado"><HBars unit="n" items={st.map((x) => ({ label: x.state, value: x.leads }))} /></Card>
      </div>
      <Note>Estado = UF do CEP que a cliente passou na conversa (quem não chegou a passar o CEP fica fora dos dois gráficos de estado). Anúncio = a conversa começou pelo clique num anúncio de WhatsApp (CTWA).</Note>
    </>
  );
}

// Lista e segmentos (protótipo do painel, itens 26 e 27): a conta do segmento é do servidor (lib/build.mjs › customerList).
const SEG = [["vip", "VIP", "Top 20% em gasto entre as clientes.", "ok"], ["regular", "Recorrente", "Compraram há menos de 75 dias e não estão no topo de gasto.", ""],
  ["new", "Novo", "Primeira compra há menos de 45 dias.", "ok"], ["risk", "Em risco", "Sem comprar há mais de 75 dias.", "warn"]];
const SEG_LABEL = Object.fromEntries(SEG.map(([k, l]) => [k, l])), SEG_TONE = Object.fromEntries(SEG.map(([k, , , t]) => [k, t]));
const SORTS = { spent: ["Maior gasto", (a, b) => b.spent - a.spent], orders: ["Mais pedidos", (a, b) => b.orders - a.orders], last: ["Compra mais recente", (a, b) => Date.parse(b.last) - Date.parse(a.last)], name: ["Nome", (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")] };
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function List({ data, route }) {
  const all = data.global.customers || [];
  const [seg, setSeg] = useState(""), [sort, setSort] = useState("spent"), [q, setQ] = useState(""), [page, setPage] = useState(1);
  const total = all.reduce((a, c) => a + c.spent, 0) || 1, t = fold(q).trim();
  const rows = all.filter((c) => (!seg || c.seg === seg) && (!t || fold(`${c.name} ${c.state} ${c.phone}`).includes(t))).sort(SORTS[sort][1]);
  const open = all.find((c) => c.id === route.query.c);
  if (!all.length) return <Card><p className="empty">Nenhuma cliente com venda ainda. A lista aparece com o primeiro pedido pago ou entregue.</p></Card>;
  return (
    <>
      <div className="kpis">
        {SEG.map(([k, l, d, tone]) => { const xs = all.filter((c) => c.seg === k), sp = xs.reduce((a, c) => a + c.spent, 0);
          return <button key={k} className={`glass kpi seg-card ${seg === k ? "on" : ""}`} aria-pressed={seg === k} onClick={() => { setSeg(seg === k ? "" : k); setPage(1); }}>
            <Chip tone={tone}>{l}</Chip><b className="kpi-value">{xs.length}</b><span className="delta none">{d}</span><span className="delta none">{fmt(sp, "brl")} · {fmt((sp / total) * 100, "pct")} do faturamento</span></button>; })}
      </div>
      <div className="filters">
        <label className="chat-search"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por nome, UF ou final do telefone" aria-label="Buscar cliente" /></label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">{Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <Table name="clientes" head={["Cliente", "UF", "Canal", "Segmento", "Pedidos", "Gasto", "Última compra", ""]}
        rows={rows.slice((page - 1) * 25, page * 25).map((c) => [c.name || "Cliente", c.state || "—", CHANNEL[c.channel], <Chip key="s" tone={SEG_TONE[c.seg]}>{SEG_LABEL[c.seg]}</Chip>, c.orders, fmt(c.spent, "brl"), when(c.last),
          <a key="o" className="ghost" href={`#/customers/list?c=${c.id}`}>Abrir</a>])}
        csv={rows.map((c) => [c.name, c.state, CHANNEL[c.channel], SEG_LABEL[c.seg], c.orders, c.spent, c.first, c.last])} />
      <Pager page={page} per={25} total={rows.length} onPage={setPage} />
      {open && <CustomerDrawer c={open} onClose={() => (location.hash = "#/customers/list")} />}
    </>
  );
}

function CustomerDrawer({ c, onClose }) {
  return (
    <Drawer title={c.name || "Cliente"} onClose={onClose}>
      <Chip tone={SEG_TONE[c.seg]}>{SEG_LABEL[c.seg]}</Chip>
      <Kv items={[["UF", c.state || "—"], ["Telefone", c.phone || "—"], ["Canal", CHANNEL[c.channel]], ["Pedidos pagos ou entregues", c.orders], ["Gasto", fmt(c.spent, "brl")],
        ["Ticket médio", fmt(c.spent / c.orders, "brl")], ["Primeira compra", when(c.first)], ["Última compra", when(c.last)]]} />
      <h3>Histórico de pedidos</h3>
      {c.history.map((o) => <a key={o.id} className="list-row" href={`#/orders?o=${o.id}`}><span><b>#{o.id}</b><small>{when(o.created)} · {o.units} peça{o.units > 1 ? "s" : ""}{o.size ? ` · ${o.size}` : ""}</small></span><span><b>{fmt(o.amount, "brl")}</b><small>{o.status}</small></span></a>)}
    </Drawer>
  );
}
