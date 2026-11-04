// Pedidos no layout do terminal de pedidos do Glassy CRM: abas por etapa com contador, selo de status, o que cada pedido vale,
// pedidos criados × entregues no período e a agenda de entregas agendadas (calendário do Glassy Dashboard).
import { useMemo, useState } from "react";
import { BUCKETS } from "../lib/constants.js";
import { periodRange } from "../lib/data.js";
import { COMPARE_LABEL, periodLabel } from "../lib/constants.js";
import { useChartPeriod } from "../components/Topbar.jsx";
import { bucketLabels, fmt, when } from "../lib/format.js";
import { HBars, Lines } from "../components/charts.jsx";
import { Card, Chip, Drawer, Kv, PageHead, Pager, Table, Tabs, Kpi } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const STEPS = [["all", "Todos"], ["created", "Criados"], ["en_route", "A caminho"], ["delivered", "Entregues"], ["refused", "Recusados"], ["returned", "Devolvidos"], ["unpaid", "Pix pendente"], ["void", "Cancelados"]];
const TONE = { created: "", en_route: "warn", delivered: "ok", refused: "bad", returned: "bad", unpaid: "", void: "" };
const LABEL = Object.fromEntries(STEPS);
export const CHANNEL = { whatsapp: "WhatsApp", site: "Site", organic: "Orgânico" }; // origem do lead do pedido (lib/build.mjs › leadOrigins)
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PER = 25;

export function Orders({ data, period, route }) {
  const orders = data.global.orders || [], p = data.periods[period] || {}, m = p.metrics || {};
  const [tab, setTabState] = useState("all"), [q, setQ] = useState(""), [ch, setCh] = useState("all"), [inPeriod, setInPeriod] = useState(false), [page, setPage] = useState(1);
  const setTab = (k) => { setTabState(k); setPage(1); };
  const [since, until] = periodRange(period, data.updated), t = norm(q).trim();
  // Filtros do protótipo (canal, período, busca); as abas contam só o que passa nos outros filtros.
  const base = orders.filter((o) => (ch === "all" || o.channel === ch) && (!inPeriod || (Date.parse(o.created) >= since && Date.parse(o.created) < until)) && (!t || norm(`${o.id} ${o.name} ${o.state} ${o.status}`).includes(t)));
  const counts = Object.fromEntries(STEPS.map(([k]) => [k, k === "all" ? base.length : base.filter((o) => o.step === k).length]));
  const rows = base.filter((o) => tab === "all" || o.step === tab);
  const open = orders.find((o) => o.id === route?.query?.o);
  const cp = useChartPeriod(data, period), cm = cp.p?.metrics || {};
  const created = cm.orders?.series || [], delivered = cm.delivered_orders?.series || [];
  const labels = bucketLabels(cp.id, BUCKETS, created.length, data.updated);
  // Pedidos criados no período escolhido, como os outros números da tela. A data de entrega é a última atualização do pedido.
  const days = orders.filter((o) => o.step === "delivered" && o.updated && Date.parse(o.created) >= since && Date.parse(o.created) < until).map((o) => (new Date(o.updated) - new Date(o.created)) / 864e5);
  return (
    <div className="page">
      <PageHead crumb="Operação" title="Pedidos" desc="Cada pedido na Logzz e na Coinzz, onde está e a agenda de entregas." />
      <div className="kpis">
        <Kpi label="Pedidos no período" id="orders" metric={m.orders} unit="n" />
        <Kpi label="Entregues no período" id="delivered_orders" metric={m.delivered_orders} unit="n" />
        <div className="glass kpi"><div className="kpi-top"><h3>Tempo médio até entregar</h3></div><div className="kpi-value">{days.length ? `${fmt(days.reduce((a, b) => a + b, 0) / days.length, "n")} dias` : "—"}</div><div className="kpi-foot"><span className="delta none">pedidos do período, da criação ao "Completo"</span></div></div>
        <Kpi label="Recusa na porta" id="refusal" metric={m.refusal} unit="pct" goal="≤ 17%" />
      </div>
      <div className="row r-2-1">
        <Card title="Terminal de pedidos" sub={`${orders.length} pedidos, do mais novo ao mais antigo`} className="terminal">
          <div className="filters">
            <label className="chat-search"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar pedido, cliente, UF ou status" aria-label="Buscar pedido" /></label>
            <select value={ch} onChange={(e) => { setCh(e.target.value); setPage(1); }} aria-label="Canal"><option value="all">Todos os canais</option>{Object.entries(CHANNEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={inPeriod ? "period" : "all"} onChange={(e) => { setInPeriod(e.target.value === "period"); setPage(1); }} aria-label="Período"><option value="all">Qualquer data</option><option value="period">Criados no período do topo</option></select>
          </div>
          <Tabs items={STEPS} value={tab} onChange={setTab} counts={counts} />
          <div className="order-list">
            {rows.slice((page - 1) * PER, page * PER).map((o, i) => (
              <div key={i} className="order" role="button" tabIndex={0} aria-label={`Abrir pedido ${o.id}`} onClick={() => (location.hash = `#/orders?o=${o.id}`)} onKeyDown={(e) => e.key === "Enter" && (location.hash = `#/orders?o=${o.id}`)}>
                <div><b>#{o.id}</b><small>{o.name || "Cliente"}{o.state ? ` · ${o.state}` : ""}</small></div>
                <div><span>{o.units} peça{o.units > 1 ? "s" : ""}{o.size ? ` ${o.size}` : ""} · {o.method === "prepay" ? "antecipado" : "na entrega"}</span><small>{when(o.created)}</small></div>
                <div className="r"><b>{fmt(o.amount, "brl")}</b><small className={o.value < 0 ? "neg" : ""}>vale {fmt(o.value, "brl")}</small></div>
                <Chip tone={TONE[o.step]}>{LABEL[o.step] || o.status}</Chip>
              </div>
            ))}
            {!rows.length && <p className="empty">Nenhum pedido com esses filtros.</p>}
          </div>
          <Pager page={page} per={PER} total={rows.length} onPage={setPage} />
        </Card>
        <Agenda orders={orders} />
      </div>
      <div className="row r-2-1">
        <Card title="Criados × entregues" sub={periodLabel(cp.id)} action={cp.picker}>
          <Lines series={[{ name: "Criados", values: created, color: "var(--neon-blue)" }, { name: "Entregues", values: delivered, color: "var(--ok)" },
            ...(cm.orders?.compare ? [{ name: `Criados · ${COMPARE_LABEL[cp.p.compare].toLowerCase()}`, values: cm.orders.compare, color: "var(--neon-blue)", dashed: true }] : [])]} labels={labels} axes />
        </Card>
        <Card title="Por forma de pagamento e kit">
          <HBars unit="n" items={[
            { label: "Na entrega", value: p.mix?.cod || 0 }, { label: "Antecipado", value: p.mix?.prepay || 0, tone: "pink" },
            { label: "1 peça", value: p.mix?.units?.[0] || 0 }, { label: "2 peças", value: p.mix?.units?.[1] || 0 }, { label: "3 peças", value: p.mix?.units?.[2] || 0 }]} />
        </Card>
      </div>
      <Table name="pedidos" head={["Pedido", "Cliente", "UF", "Canal", "Status", "Forma", "Peças", "Valor", "Vale", "Criado", "Agendado"]}
        rows={rows.map((o) => [`#${o.id}`, o.name || "—", o.state || "—", CHANNEL[o.channel] || "—", o.status, o.method === "prepay" ? "antecipado" : "na entrega", o.units, fmt(o.amount, "brl"), fmt(o.value, "brl"), when(o.created), o.scheduled || "—"])}
        csv={rows.map((o) => [o.id, o.name, o.state, CHANNEL[o.channel], o.status, o.method, o.units, o.amount, o.value, o.created, o.scheduled])} />
      {open && <OrderDrawer o={open} onClose={() => (location.hash = "#/orders")} />}
    </div>
  );
}

// Gaveta do pedido. O status vem do webhook da Logzz/Coinzz: mudar, cancelar ou devolver é na plataforma (decisão de 04/11).
export function OrderDrawer({ o, onClose }) {
  return (
    <Drawer title={`Pedido #${o.id}`} onClose={onClose}>
      <Chip tone={TONE[o.step]}>{LABEL[o.step] || o.status}</Chip>
      <Kv items={[["Cliente", `${o.name || "Cliente"}${o.state ? ` · ${o.state}` : ""}`], ["Canal", CHANNEL[o.channel] || "—"], ["Status na plataforma", o.status],
        ["Forma", o.method === "prepay" ? "antecipado (Coinzz)" : "na entrega (Logzz)"], ["Kit", `${o.units} peça${o.units > 1 ? "s" : ""}${o.size ? ` · tamanho ${o.size}` : ""}`],
        ["Valor", fmt(o.amount, "brl")], ["Vale hoje", fmt(o.value, "brl")], ["Criado", when(o.created)], ["Atualizado", when(o.updated)], ["Entrega agendada", o.scheduled || "—"]]} />
      <p className="note">O status muda pelo webhook da plataforma. Cancelar ou devolver é feito na Logzz ou na Coinzz.</p>
    </Drawer>
  );
}

// Calendário do mês com os dias que têm entrega agendada (pagamento na entrega) e a lista do dia escolhido.
function Agenda({ orders }) {
  const today = new Date(new Date().getTime() - 3 * 3600000);
  const [month, setMonth] = useState(new Date(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [day, setDay] = useState(today.toISOString().slice(0, 10));
  const byDay = useMemo(() => { const m = {}; for (const o of orders) if (o.scheduled) (m[o.scheduled.slice(0, 10)] ??= []).push(o); return m; }, [orders]);
  const first = (month.getDay() + 6) % 7, total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const key = (d) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const list = byDay[day] || [];
  return (
    <Card title="Agenda de entregas" sub={month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      action={<span className="seg small"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></span>}>
      <div className="calendar">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <span key={d} className="dow">{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: total }, (_, i) => { const k = key(i + 1), n = byDay[k]?.length;
          return <button key={k} className={`${k === day ? "on" : ""} ${k === today.toISOString().slice(0, 10) ? "today" : ""}`} onClick={() => setDay(k)}>{i + 1}{n ? <em>{n}</em> : null}</button>; })}
      </div>
      <p className="pop-title">{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}: {list.length} entrega{list.length === 1 ? "" : "s"}</p>
      {list.map((o, i) => <p key={i} className="agenda-item"><b>#{o.id}</b> {o.name || "Cliente"} · {o.state || ""} · {fmt(o.amount, "brl")}</p>)}
    </Card>
  );
}
