// Painel (operador, 03/11): 4 cartões com minigráfico neon (faturamento, pedidos, conversão, margem operacional), o gráfico de linha de
// ponta a ponta do cartão escolhido, a caixa de entrada em 3 blocos e, embaixo, forma de pagamento e peças por pedido.
// As cores dos minigráficos seguem a referência do operador, nesta ordem: azul, verde, laranja, roxo.
import { useState } from "react";
import { BUCKETS, COMPARE_LABEL, periodLabel } from "../lib/constants.js";
import { periodRange } from "../lib/data.js";
import { bucketLabels, fmt, metricBy, parseBrl, store, when } from "../lib/format.js";
import { goalPace } from "../lib/economics.js";
import { Donut, Gauge, NeonSpark, TrendLine } from "../components/charts.jsx";
import { Card, Chip, Kpi, Kv } from "../components/ui.jsx";
import { CHANNEL } from "./Orders.jsx";
import { useChartPeriod } from "../components/Topbar.jsx";
import { SiteLive } from "./Site.jsx";
import { Icon } from "../components/icons.jsx";
import { INBOX, inboxCounts } from "../lib/inbox.js";

const HOME_KPIS = [["revenue", "var(--neon-blue)"], ["orders", "var(--neon-green)"], ["conversion", "var(--neon-orange)"], ["op_margin", "var(--neon-purple)"]];
const HREF = { orders: "#/orders", conversion: "#/customers", revenue: "#/money/result", op_margin: "#/money/result", pay: "#/orders", units: "#/orders" };

export function Home({ data, period }) {
  const p = data.periods[period] || {}, m = p.metrics || {};
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const label = periodLabel(period);
  const [sel, setSelState] = useState(() => (HOME_KPIS.some(([k]) => k === store.get("home:metric")) ? store.get("home:metric") : "revenue"));
  const setSel = (id) => { setSelState(id); store.set("home:metric", id); };
  const pay = [{ label: "Na entrega", value: p.mix?.cod, color: "var(--neon-blue)" }, { label: "Antecipado", value: p.mix?.prepay, color: "var(--neon-orange)" }];
  const units = [1, 2, 3].map((n, i) => ({ label: `${n} peça${n > 1 ? "s" : ""}`, value: p.mix?.units?.[i], color: ["var(--neon-blue)", "var(--neon-green)", "var(--neon-purple)"][i] }));
  const cp = useChartPeriod(data, period), cm = cp.p?.metrics?.[sel];
  const x = metricBy(sel), series = cm?.series || [], color = HOME_KPIS.find(([k]) => k === sel)[1];

  return (
    <div className="page home">
      <div className="greeting">
        <h1>{hello}</h1>
        <p>{label === "Dia" ? "Últimas 24 horas" : `Período: ${label?.toLowerCase()}`}. Clique num cartão para ver a linha dele.</p>
      </div>
      <div className="kpis home-kpis">
        {HOME_KPIS.map(([id, c]) => { const k = metricBy(id); return <Kpi key={id} id={id} label={k.label} metric={m[id]} unit={k.unit} href={HREF[id]} selected={sel === id} onSelect={() => setSel(id)} color={c} spark={<NeonSpark values={m[id]?.series} color={c} />} />; })}
      </div>
      <Card className="main-chart" title={x.label} sub={periodLabel(cp.id)} action={cp.picker}>
        {cp.p ? <TrendLine key={`${sel}${cp.id}`} values={series} compare={cm?.compare} compareLabel={COMPARE_LABEL[cp.p.compare]} labels={bucketLabels(cp.id, BUCKETS, series.length, data.updated)} unit={x.unit} color={color} /> : <div className="loading"><span className="spinner" /> Carregando o período…</div>}
      </Card>
      <Inbox chats={data.global.chats} />
      <div className="home-donuts">
        <DonutBlock title="Forma de pagamento" items={pay} href={HREF.pay} />
        <DonutBlock title="Peças por pedido" items={units} href={HREF.units} />
      </div>
      <Today data={data} />
      <SiteLive data={data} compact />
      <div className="row r-2-1">
        <MonthGoal g={data.global} demo={data.demo} />
        <DonutBlock title="Origem das vendas" items={[["whatsapp", "var(--neon-green)"], ["site", "var(--neon-blue)"], ["organic", "var(--neon-purple)"]].map(([k, c]) => ({ label: CHANNEL[k], value: p.mix?.channel?.[k], color: c }))} href="#/orders" />
      </div>
      <div className="row r-2-1">
        <LastOrders orders={data.global.orders || []} />
        <BestSellers orders={data.global.orders || []} range={periodRange(period, data.updated)} />
      </div>
    </div>
  );
}

// Hoje (protótipo, item 7): faturamento de hoje e dos 7 dias e pedidos de hoje, cada um contra o intervalo anterior, seja qual for o período do topo.
function Today({ data }) {
  const d = data.periods.day?.metrics || {}, w = data.periods.week?.metrics || {};
  return (
    <div className="kpis k3">
      <Kpi id="revenue" label="Faturamento nas últimas 24 h" metric={d.revenue} unit="brl" color="var(--neon-blue)" spark={<NeonSpark values={d.revenue?.series} color="var(--neon-blue)" />} />
      <Kpi id="revenue" label="Faturamento em 7 dias" metric={w.revenue} unit="brl" color="var(--neon-green)" spark={<NeonSpark values={w.revenue?.series} color="var(--neon-green)" />} />
      <Kpi id="orders" label="Pedidos nas últimas 24 h" metric={d.orders} unit="n" color="var(--neon-orange)" spark={<NeonSpark values={d.orders?.series} color="var(--neon-orange)" />} />
    </div>
  );
}

// Meta do mês (item 9): anel de progresso, ritmo diário necessário e o mês anterior. Faturamento só de venda, mês de Brasília.
// A meta muda aqui mesmo (operador, 04/11): admin ou operador salva em portal_settings (api/team.js, ação "goal").
function MonthGoal({ g, demo }) {
  const [own, setOwn] = useState(null), [edit, setEdit] = useState(false), [err, setErr] = useState(null);
  const goal = own ?? g.goal ?? 0, months = g.months || [], done = months.at(-1)?.revenue ?? 0, last = months.at(-2)?.revenue, left = g.month_days_left ?? 1;
  const name = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  return (
    <Card title={`Meta de ${name}`} sub={`faltam ${left} dia${left > 1 ? "s" : ""}`} action={<button className="glass pill small" onClick={() => setEdit(!edit)}>{goal ? "Editar meta" : "Definir meta"}</button>}>
      {edit && <form className="cash-input" onSubmit={async (e) => {
        e.preventDefault(); const v = parseBrl(new FormData(e.currentTarget).get("goal"));
        if (!Number.isFinite(v) || v < 0) return setErr("Digite um valor em reais, ex.: 5.000");
        const r = demo ? { status: "ok" } : await fetch("api/team", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "goal", month_goal: v }) }).then((x) => x.json()).catch(() => ({ error: "sem conexão" }));
        if (r.error) return setErr(r.error);
        setOwn(v); setEdit(false); setErr(null);
      }}>
        <span>Meta de faturamento do mês (R$){demo ? " · exemplo: não salva" : ""}</span><input name="goal" inputMode="decimal" autoFocus defaultValue={goal || ""} placeholder="ex.: 5.000" aria-label="Meta do mês em reais" />
        {err && <span className="neg">{err}</span>}
      </form>}
      <div className="goal-card">
        <Gauge value={goal ? (done / goal) * 100 : null} sub={goal ? `de ${fmt(goal, "brl")}` : "sem meta"} />
        <Kv items={[["Realizado no mês", fmt(done, "brl")], ["Ritmo diário necessário", fmt(goalPace(goal, done, left), "brl")], ["Mês anterior fechou em", fmt(last, "brl")]]} />
      </div>
    </Card>
  );
}

// Últimos pedidos (item 14): os 6 mais recentes; cada um abre a gaveta em Pedidos.
function LastOrders({ orders }) {
  return (
    <Card title="Últimos pedidos" action={<a className="round" href="#/orders" aria-label="Abrir Pedidos"><Icon name="arrow" /></a>}>
      {orders.slice(0, 6).map((o) => (
        <a key={o.id} className="list-row" href={`#/orders?o=${o.id}`}>
          <span><b>#{o.id}</b><small>{o.name || "Cliente"}{o.state ? ` · ${o.state}` : ""} · {when(o.created)}</small></span>
          <span><b>{fmt(o.amount, "brl")}</b><small><Chip>{o.status}</Chip></small></span>
        </a>
      ))}
      {!orders.length && <p className="empty">Nenhum pedido ainda.</p>}
    </Card>
  );
}

// Mais vendidos (item 14): kit e tamanho dos pedidos feitos no período (sem cancelado e sem antecipado não pago).
function BestSellers({ orders, range: [a, b] }) {
  const n = {};
  for (const o of orders) if (Date.parse(o.created) >= a && Date.parse(o.created) < b && !["void", "unpaid"].includes(o.step)) { const k = `${o.units} peça${o.units > 1 ? "s" : ""}${o.size ? ` · ${o.size}` : ""}`; n[k] = (n[k] || 0) + 1; }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <Card title="Mais vendidos" sub="kit e tamanho, no período">
      {top.map(([k, v]) => <div key={k} className="list-row"><span>{k}</span><b>{v}</b></div>)}
      {!top.length && <p className="empty">Sem pedidos no período.</p>}
    </Card>
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
