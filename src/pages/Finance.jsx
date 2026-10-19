// Financeiro: demonstrativo de resultado (o "P&L ledger" do Glassy CRM), consumo de API, caixa e comparação entre períodos.
import { useState } from "react";
import { ALL, BUCKETS, PERIODS } from "../lib/constants.js";
import { periodDays } from "../lib/data.js";
import { CASH_LIMIT, DELIVERY_DAYS, IDEAL, META_TAX, RELEASE_DAYS, cashPlan, codUpfront } from "../lib/economics.js";
import { bucketLabels, fmt, metricBy } from "../lib/format.js";
import { Gauge, HBars, Lines } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi, Note, PageHead, Table } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";


export function Finance({ data, period, route, tabs }) {
  const p = data.periods[period] || {}, g = data.global, sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Financeiro" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/money/${k}`)}
        right={sub === "result" ? <button className="glass pill print-btn" onClick={() => window.print()}><Icon name="print" size={15} /> Exportar PDF</button> : null} />
      {sub === "result" && <Result p={p} />}
      {sub === "api" && <Api p={p} period={period} updated={data.updated} />}
      {sub === "cash" && <Cash g={g} period={period} />}
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

function Api({ p, period, updated }) {
  const m = p.money || {}, s = p.metrics?.api_per_lead;
  return (
    <>
      <div className="kpis">
        {[["api_cost", "No período"], ["api_per_day", "Média por dia"], ["api_30d", "Projeção para 30 dias"]].map(([id, l]) => <div key={id} className="glass kpi"><div className="kpi-top"><h3>{l}</h3></div><div className="kpi-value">{fmt(m[id], "brl")}</div></div>)}
        <Kpi label="Custo de API por lead" id="api_per_lead" metric={s} unit="brl" goal="teto R$ 1,00" />
      </div>
      <Card title="Custo de API por lead" sub="por intervalo do período"><Lines series={[{ name: "Por lead", values: s?.series || [], color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, (s?.series || []).length, updated)} unit="brl" /></Card>
    </>
  );
}

// Caixa necessário (operador, 19/10): o orçamento dos anúncios ativos na Meta, ou um orçamento digitado para simular, passa
// pelas premissas ideais do teste. Mostra o período escolhido e todos os períodos lado a lado.
function Cash({ g, period }) {
  const meta = g.ad_budget;
  const [weekly, setWeekly] = useState("");
  // "1.500,50" (pt-BR) ou "1500.50": com vírgula, o ponto é milhar.
  const typed = Number(/,/.test(weekly) ? weekly.replace(/\./g, "").replace(",", ".") : weekly);
  const daily = weekly !== "" && typed > 0 ? typed / 7 : meta;
  const plan = cashPlan(daily, periodDays(period)), label = PERIODS.find((x) => x.id === period)?.label.toLowerCase();
  const pct = plan ? (plan.need / CASH_LIMIT) * 100 : null;
  return (
    <>
      <div className="row r-1-2">
        <Card title="Caixa necessário" sub={`para rodar o anúncio por ${label}, contra o caixa utilizável de ${fmt(CASH_LIMIT, "brl")}`}>
          <Gauge value={pct} tone={pct == null ? "" : pct > 100 ? "bad" : pct > 75 ? "warn" : "ok"} label={plan ? fmt(plan.need, "brl") : "—"} sub={plan ? `${fmt(plan.spend, "brl")} de anúncio no período` : "sem orçamento"} size={160} />
          <label className="cash-input"><span>Orçamento por semana para simular</span>
            <input inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder={meta ? `${fmt(meta * 7, "brl")} (Meta)` : "ex.: 100"} />
          </label>
          <Note>{weekly !== "" && typed > 0 ? "Simulação: o valor digitado substitui o orçamento da Meta. Apague para voltar." : meta ? `Orçamento dos anúncios ativos na Meta: ${fmt(meta, "brl")} por dia.` : meta === 0 ? "Nenhum anúncio ativo com orçamento na Meta. Digite um orçamento para simular." : "Meta Ads não ligado. Digite um orçamento para simular."}</Note>
        </Card>
        <Card title="Como a conta é feita" sub="premissas ideais do teste">
          {plan ? <HBars unit="brl" items={[
            { label: `Anúncio + imposto da Meta (${fmt(META_TAX * 100, "pct")})`, value: plan.ad },
            { label: `IA (${fmt(IDEAL.api_per_lead, "brl")} por lead) + WhatsApp pós-venda`, value: plan.api },
            { label: `Adiantado nos pedidos na entrega (${fmt(plan.cod_orders, "n")} de ${fmt(plan.orders, "n")} pedidos)`, value: plan.upfront },
            { label: "Sai do caixa no período", value: plan.total },
            { label: `Caixa necessário (até ${plan.cycle} dias, antes do primeiro repasse)`, value: plan.need, tone: pct > 100 ? "bad" : "ok" }]} /> : <p className="empty">Sem orçamento para calcular.</p>}
          <Note>CPL de {fmt(IDEAL.cpl, "brl")} e conversão de {fmt(IDEAL.conversion, "pct")}: cada {fmt(IDEAL.cpl, "brl")} de anúncio traz um lead, e 1 em cada 10 leads compra. {fmt(IDEAL.cod_share * 100, "pct")} dos pedidos na entrega, 1 peça de {fmt(IDEAL.cod_price, "brl")}: cada um adianta {fmt(codUpfront(IDEAL.cod_price, 1), "brl")} (produto, entrega, manuseio e taxa), que voltam no repasse da Logzz {RELEASE_DAYS} dias depois do "Completo". Com {DELIVERY_DAYS} dias até entregar (premissa do portal), nada volta antes de {DELIVERY_DAYS + RELEASE_DAYS} dias; depois disso o repasse dos pedidos antigos paga os novos, então o caixa necessário é o de no máximo esse ciclo. O que entra do antecipado na hora não é descontado.</Note>
        </Card>
      </div>
      <h2 className="section-title">Caixa necessário por período</h2>
      <Table name="caixa-por-periodo" head={["Período", "Anúncio", "Leads", "Pedidos", "Sai do caixa", "Caixa necessário"]}
        rows={PERIODS.map((x) => { const pl = cashPlan(daily, periodDays(x.id)); return [x.label, fmt(pl?.spend, "brl"), fmt(pl?.leads, "n"), fmt(pl?.orders, "n"), fmt(pl?.total, "brl"), fmt(pl?.need, "brl")]; })}
        csv={PERIODS.map((x) => { const pl = cashPlan(daily, periodDays(x.id)); return [x.label, pl?.spend, pl?.leads, pl?.orders, pl?.total, pl?.need]; })} />
    </>
  );
}

function Compare({ p }) {
  const m = p.metrics || {};
  const rows = ALL.filter((x) => m[x.id]?.value != null || m[x.id]?.previous != null);
  return <Table name="comparacao-periodos" head={["Métrica", "Período atual", "Período anterior", "Variação"]}
    rows={rows.map((x) => [x.label, fmt(m[x.id]?.value, x.unit), fmt(m[x.id]?.previous, x.unit), <DeltaBadge key={x.id} metric={m[x.id]} unit={x.unit} id={x.id} label={false} />])}
    csv={rows.map((x) => [x.label, m[x.id]?.value, m[x.id]?.previous])} />;
}
