// Pedidos no layout do terminal de pedidos do Glassy CRM: abas por etapa com contador, selo de status, o que cada pedido vale,
// pedidos criados × entregues no período e a agenda de entregas agendadas (calendário do Glassy Dashboard).
import { useMemo, useState } from "react";
import { BUCKETS } from "../lib/constants.js";
import { periodDays } from "../lib/data.js";
import { bucketLabels, fmt, when } from "../lib/format.js";
import { HBars, Lines } from "../components/charts.jsx";
import { Card, Chip, PageHead, Table, Tabs, Kpi } from "../components/ui.jsx";

const STEPS = [["all", "Todos"], ["created", "Criados"], ["en_route", "A caminho"], ["delivered", "Entregues"], ["refused", "Recusados"], ["returned", "Devolvidos"], ["unpaid", "Pix pendente"], ["void", "Cancelados"]];
const TONE = { created: "", en_route: "warn", delivered: "ok", refused: "bad", returned: "bad", unpaid: "", void: "" };
const LABEL = Object.fromEntries(STEPS);

export function Orders({ data, period }) {
  const orders = data.global.orders || [], p = data.periods[period] || {}, m = p.metrics || {};
  const [tab, setTab] = useState("all");
  const counts = Object.fromEntries(STEPS.map(([k]) => [k, k === "all" ? orders.length : orders.filter((o) => o.step === k).length]));
  const rows = orders.filter((o) => tab === "all" || o.step === tab);
  const created = m.orders?.series || [], delivered = m.delivered_orders?.series || [];
  const labels = bucketLabels(period, BUCKETS, created.length, data.updated);
  // Pedidos criados no período escolhido, como os outros números da tela. A data de entrega é a última atualização do pedido.
  const from = Date.parse(data.updated) - periodDays(period) * 864e5;
  const days = orders.filter((o) => o.step === "delivered" && o.updated && Date.parse(o.created) >= from).map((o) => (new Date(o.updated) - new Date(o.created)) / 864e5);
  return (
    <div className="page">
      <PageHead crumb="Operação" title="Pedidos" desc="Cada pedido na Logzz e na Coinzz, onde está e a agenda de entregas." />
      <div className="kpis">
        <Kpi label="Pedidos no período" id="orders" metric={m.orders} unit="n" />
        <Kpi label="Entregues no período" id="delivered_orders" metric={m.delivered_orders} unit="n" />
        <div className="glass kpi"><div className="kpi-top"><h3>Tempo médio até entregar</h3></div><div className="kpi-value">{days.length ? `${fmt(days.reduce((a, b) => a + b, 0) / days.length, "n")} dias` : "—"}</div><span className="delta none">pedidos do período, da criação ao "Completo"</span></div>
        <Kpi label="Recusa na porta" id="refusal" metric={m.refusal} unit="pct" goal="≤ 17%" />
      </div>
      <div className="row r-2-1">
        <Card title="Terminal de pedidos" sub="os 200 mais recentes" className="terminal">
          <Tabs items={STEPS} value={tab} onChange={setTab} counts={counts} />
          <div className="order-list">
            {rows.map((o, i) => (
              <div key={i} className="order">
                <div><b>#{o.id}</b><small>{o.name || "Cliente"}{o.state ? ` · ${o.state}` : ""}</small></div>
                <div><span>{o.units} peça{o.units > 1 ? "s" : ""}{o.size ? ` ${o.size}` : ""} · {o.method === "prepay" ? "antecipado" : "na entrega"}</span><small>{when(o.created)}</small></div>
                <div className="r"><b>{fmt(o.amount, "brl")}</b><small className={o.value < 0 ? "neg" : ""}>vale {fmt(o.value, "brl")}</small></div>
                <Chip tone={TONE[o.step]}>{LABEL[o.step] || o.status}</Chip>
              </div>
            ))}
            {!rows.length && <p className="empty">Nenhum pedido nesta etapa.</p>}
          </div>
        </Card>
        <Agenda orders={orders} />
      </div>
      <div className="row r-2-1">
        <Card title="Criados × entregues" sub="por intervalo do período">
          <Lines series={[{ name: "Criados", values: created, color: "var(--accent-2)" }, { name: "Entregues", values: delivered, color: "var(--ok)" }]} labels={labels} />
        </Card>
        <Card title="Por forma de pagamento e kit">
          <HBars unit="n" items={[
            { label: "Na entrega", value: p.mix?.cod || 0 }, { label: "Antecipado", value: p.mix?.prepay || 0, tone: "pink" },
            { label: "1 peça", value: p.mix?.units?.[0] || 0 }, { label: "2 peças", value: p.mix?.units?.[1] || 0 }, { label: "3 peças", value: p.mix?.units?.[2] || 0 }]} />
        </Card>
      </div>
      <Table name="pedidos" head={["Pedido", "Cliente", "UF", "Status", "Forma", "Peças", "Valor", "Vale", "Criado", "Agendado"]}
        rows={rows.map((o) => [`#${o.id}`, o.name || "—", o.state || "—", o.status, o.method === "prepay" ? "antecipado" : "na entrega", o.units, fmt(o.amount, "brl"), fmt(o.value, "brl"), when(o.created), o.scheduled || "—"])}
        csv={rows.map((o) => [o.id, o.name, o.state, o.status, o.method, o.units, o.amount, o.value, o.created, o.scheduled])} />
    </div>
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
