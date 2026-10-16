// Financeiro: demonstrativo de resultado (o "P&L ledger" do Glassy CRM), consumo de API, caixa e comparação entre períodos.
import { ALL, BUCKETS } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy } from "../lib/format.js";
import { Gauge, HBars, Lines } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi, Note, PageHead, Table } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const META_TAX = 0.1383, CASH_LIMIT = 1075; // mesmos valores de lib/build.mjs

export function Finance({ data, period, route, tabs }) {
  const p = data.periods[period] || {}, g = data.global, sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Financeiro" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/money/${k}`)}
        right={sub === "result" ? <button className="glass pill print-btn" onClick={() => window.print()}><Icon name="print" size={15} /> Exportar PDF</button> : null} />
      {sub === "result" && <Result p={p} />}
      {sub === "api" && <Api p={p} period={period} />}
      {sub === "cash" && <Cash g={g} />}
      {sub === "compare" && <Compare p={p} />}
    </div>
  );
}

function Result({ p }) {
  // Os mesmos números dos cartões (lib/build.mjs › profit): nenhuma conta própria aqui, para nunca divergirem.
  const m = p.metrics || {}, v = (id) => m[id]?.value;
  const rev = v("revenue") ?? 0, contrib = v("gross_profit"), spend = v("spend"), api = p.money?.api_cost ?? 0;
  const adCost = spend == null ? null : spend * (1 + META_TAX);
  const lines = [
    { label: "Faturamento (pedidos válidos)", value: rev, sign: 1 },
    { label: "Custo dos pedidos (produto, entrega, manuseio, taxa, recusas e devoluções)", value: contrib == null ? null : rev - contrib, sign: -1 },
    { label: "= Margem dos pedidos", value: contrib, sum: true },
    { label: "Anúncio com imposto da Meta (13,83%)", value: adCost, sign: -1 },
    { label: "API (modelo + WhatsApp pós-venda)", value: api, sign: -1 },
    { label: "= Resultado", value: v("net_profit") ?? null, sum: true },
  ];
  const max = Math.max(1, ...lines.map((l) => Math.abs(l.value || 0)));
  return (
    <>
      <div className="kpis">
        <Kpi label="Faturamento" id="revenue" metric={m.revenue} unit="brl" />
        <Kpi label="Lucro líquido" id="net_profit" metric={m.net_profit} unit="brl" />
        <Kpi label="Margem operacional" id="op_margin" metric={m.op_margin} unit="pct" goal="> 0%" />
        <Kpi label="ROI" id="roi" metric={m.roi} unit="x" goal={metricBy("roi")?.goal} />
      </div>
      <Card title="Demonstrativo de resultado" sub="do faturamento ao que sobra, no período">
        <div className="ledger">
          {lines.map((l, i) => (
            <div key={i} className={`ledger-row ${l.sum ? "sum" : ""}`}>
              <span>{l.label}</span>
              <div className="ledger-bar"><i className={l.sum ? ((l.value || 0) >= 0 ? "ok" : "bad") : l.sign < 0 ? "neg" : ""} style={{ width: `${Math.max(1, (Math.abs(l.value || 0) / max) * 100)}%` }} /></div>
              <b className={(l.value || 0) < 0 || l.sign < 0 ? "neg" : ""}>{l.value == null ? "—" : `${l.sign < 0 ? "− " : ""}${fmt(Math.abs(l.value), "brl")}`}</b>
            </div>
          ))}
        </div>
      </Card>
      <Note>Margem de cada pedido pelo status de hoje: na entrega conta a margem cheia ao criar e vira − R$ 9,99 se recusado; antecipado só depois de pago; devolução perde a margem e paga R$ 30 (na entrega) ou R$ 50 (antecipado). Sem gasto de anúncio conhecido, o resultado fica "—".</Note>
    </>
  );
}

function Api({ p, period }) {
  const m = p.money || {}, s = p.metrics?.api_per_lead;
  return (
    <>
      <div className="kpis">
        {[["api_cost", "No período"], ["api_per_day", "Média por dia"], ["api_30d", "Projeção para 30 dias"]].map(([id, l]) => <div key={id} className="glass kpi"><div className="kpi-top"><h3>{l}</h3></div><div className="kpi-value">{fmt(m[id], "brl")}</div></div>)}
        <Kpi label="Custo de API por lead" id="api_per_lead" metric={s} unit="brl" goal="teto R$ 1,00" />
      </div>
      <Card title="Custo de API por lead" sub="por intervalo do período"><Lines series={[{ name: "Por lead", values: s?.series || [], color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, (s?.series || []).length)} unit="brl" /></Card>
    </>
  );
}

function Cash({ g }) {
  const need = g.cash_need || 0, pct = (need / CASH_LIMIT) * 100;
  return (
    <div className="row r-1-2">
      <Card title="Necessidade de caixa" sub={`contra o caixa utilizável de ${fmt(CASH_LIMIT, "brl")}`}>
        <Gauge value={pct} tone={pct > 100 ? "bad" : pct > 75 ? "warn" : "ok"} label={fmt(need, "brl")} sub="adiantado em pedidos na entrega" size={160} />
      </Card>
      <Card title="Como a conta é feita">
        <HBars unit="brl" items={[{ label: "Adiantado agora", value: need, tone: pct > 100 ? "bad" : "" }, { label: "Limite do teste", value: CASH_LIMIT, tone: "ok" }]} />
        <Note>Cada pedido na entrega adianta produto (R$ 30 por peça), entrega (R$ 19,99), manuseio (R$ 5,00) e a taxa da Logzz quando vai para separação. O dinheiro volta no repasse, 14 dias depois de "Completo". O antecipado cai na hora e não entra aqui. O saldo atual da Logzz e do Mercado Pago não tem API: por isso o portal mostra a necessidade, não o saldo.</Note>
      </Card>
    </div>
  );
}

function Compare({ p }) {
  const m = p.metrics || {};
  const rows = ALL.filter((x) => m[x.id]?.value != null || m[x.id]?.previous != null);
  return <Table name="comparacao-periodos" head={["Métrica", "Período atual", "Período anterior", "Variação"]}
    rows={rows.map((x) => [x.label, fmt(m[x.id]?.value, x.unit), fmt(m[x.id]?.previous, x.unit), <DeltaBadge key={x.id} metric={m[x.id]} unit={x.unit} id={x.id} label={false} />])}
    csv={rows.map((x) => [x.label, m[x.id]?.value, m[x.id]?.previous])} />;
}
