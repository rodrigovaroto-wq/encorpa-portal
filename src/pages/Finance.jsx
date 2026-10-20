// Financeiro: demonstrativo de resultado (o "P&L ledger" do Glassy CRM), consumo de API, caixa e comparação entre períodos.
import { useState } from "react";
import { ALL, BUCKETS, PERIODS } from "../lib/constants.js";
import { periodDays } from "../lib/data.js";
import { DELIVERY_DAYS, IDEAL, RELEASE_DAYS, cashPlan, codUpfront } from "../lib/economics.js";
import { bucketLabels, fmt, metricBy, parseBrl } from "../lib/format.js";
import { HBars, Lines } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi, Note, PageHead, Table } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";


export function Finance({ data, period, route, tabs }) {
  const p = data.periods[period] || {}, g = data.global, sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Financeiro" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/money/${k}`)}
        right={sub === "result" ? <button className="glass pill print-btn" onClick={() => window.print()}><Icon name="print" size={15} /> Exportar PDF</button> : null} />
      {sub === "result" && <Result p={p} g={g} />}
      {sub === "api" && <Api p={p} period={period} updated={data.updated} />}
      {sub === "cash" && <Cash p={p} period={period} />}
      {sub === "compare" && <Compare p={p} />}
    </div>
  );
}

function Result({ p, g }) {
  // Os mesmos números dos cartões (lib/build.mjs › profit): nenhuma conta própria aqui, para nunca divergirem.
  // Retrato antigo (sem a abertura de custos): IA cai no total de API e WhatsApp e fixos ficam "—".
  const m = p.metrics || {}, v = (id) => m[id]?.value, money = p.money || {};
  const rev = v("revenue") ?? 0, contrib = v("gross_profit");
  const lines = [
    { label: "Faturamento (pedidos válidos)", value: rev, sign: 1 },
    { label: "Custo dos pedidos (produto, entrega, manuseio, taxa, recusas e devoluções)", value: contrib == null ? null : rev - contrib, sign: -1 },
    { label: "= Margem dos pedidos", value: contrib, sum: true },
    { label: "Anúncio na Meta (imposto já incluído no gasto)", value: v("spend") ?? null, sign: -1 },
    { label: "Modelo de IA (chamadas dos leads)", value: money.ai ?? money.api_cost ?? 0, sign: -1 },
    { label: "WhatsApp (template de pós-venda)", value: money.whatsapp ?? null, sign: -1 },
    { label: "Custos fixos que venceram (recarga da PikaPods, mensalidade do número)", value: money.fixed ?? null, sign: -1 },
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
      <Note>Margem de cada pedido pelo status de hoje: na entrega conta a margem cheia ao criar e vira − R$ 9,99 se recusado; antecipado só depois de pago; devolução perde a margem e paga R$ 30 (na entrega) ou R$ 50 (antecipado). O anúncio entra pelo gasto da Meta, que já traz o imposto. A IA é a soma das chamadas de modelo dos leads. Os fixos entram só quando vencem e são pagos de novo: cada recarga automática de US$ 10 da PikaPods (R$ 54) e cada mensalidade de R$ 35 do número, no dia 5. Não entram no ROI. Sem gasto de anúncio conhecido, o resultado fica "—".</Note>
      {g.invested && <Invested inv={g.invested} />}
    </>
  );
}

// Tudo o que o projeto já gastou, pelo que saiu do cartão, contra o que os pedidos já valem. Recalculado a cada leitura dos dados.
function Invested({ inv }) {
  return (
    <>
      <h2 className="section-title">Investido até agora</h2>
      <Table name="investido-ate-agora" head={["Custo", "Tipo", "Como é contado", "Total"]}
        rows={[...inv.rows.map((r) => [r.label, r.kind, r.how, fmt(r.total, "brl")]),
          [<b key="t">Total investido</b>, "", "", <b key="v">{fmt(inv.total, "brl")}</b>],
          ["Margem dos pedidos até hoje", "", "", fmt(inv.contribution, "brl")],
          [<b key="r">Resultado acumulado</b>, "", "", <b key="w" className={inv.result < 0 ? "neg" : ""}>{fmt(inv.result, "brl")}</b>]]}
        csv={[...inv.rows.map((r) => [r.label, r.kind, r.how, r.total]), ["Total investido", "", "", inv.total], ["Margem dos pedidos até hoje", "", "", inv.contribution], ["Resultado acumulado", "", "", inv.result]]} />
      <Note>Desde o início do projeto, pelo que já saiu do cartão, e atualizado sozinho a cada leitura dos dados (a cada 5 min): anúncio pela Meta, IA pelas chamadas de modelo dos leads (sem personas nem Hermes), WhatsApp pelos pedidos, PikaPods pelas recargas automáticas de US$ 10 (o consumo de US$ 3,73 por mês leva o saldo abaixo de US$ 1) e o número pelas mensalidades de cada dia 5. Dólar a R$ 5,40. </Note>
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

// Caixa necessário (operador, 19/10): o gasto médio por dia com anúncios no período (Meta), ou um gasto por dia digitado para simular
// (operador, 20/10: gasto, não orçamento), passa pelas premissas ideais do teste. CPL e conversão também podem ser digitados para simular (operador, 20/10); vazio = premissa ideal.
// Mostra o período escolhido e todos os períodos lado a lado.
const typedOr = (text, fallback, ok) => { const v = parseBrl(String(text).replace("%", "")); return text.trim() !== "" && ok(v) ? v : fallback; };
function Cash({ p, period }) {
  const spent = p.metrics?.spend?.value, meta = spent == null ? null : spent / periodDays(period); // média por dia no período
  const [spendText, setSpend] = useState(""), [cplText, setCpl] = useState(""), [convText, setConv] = useState("");
  const typed = parseBrl(spendText);
  const daily = spendText !== "" && typed > 0 ? typed : meta;
  const sim = { cpl: typedOr(cplText, IDEAL.cpl, (v) => v > 0), conversion: typedOr(convText, IDEAL.conversion, (v) => v >= 0 && v <= 100) };
  const simulated = sim.cpl !== IDEAL.cpl || sim.conversion !== IDEAL.conversion;
  const plan = cashPlan(daily, periodDays(period), sim), label = PERIODS.find((x) => x.id === period)?.label.toLowerCase();
  return (
    <>
      <div className="row r-1-2">
        <Card title="Caixa necessário" sub={`para rodar a operação por ${label}`}>
          <div className="cash-need">
            <div className="kpi-value">{plan ? fmt(plan.need, "brl") : "—"}</div>
            <p className="desc">{plan ? `${fmt(plan.spend, "brl")} de anúncio no período` : "sem gasto com anúncios"}</p>
          </div>
          <div className="cash-grid">
            <label className="cash-input"><span>Gasto com anúncios por dia</span>
              <input inputMode="decimal" value={spendText} onChange={(e) => setSpend(e.target.value)} placeholder={meta ? `${fmt(meta, "brl")} (Meta)` : "ex.: 50"} />
            </label>
            <label className="cash-input"><span>CPL</span>
              <input inputMode="decimal" value={cplText} onChange={(e) => setCpl(e.target.value)} placeholder={`${fmt(IDEAL.cpl, "brl")} (ideal)`} />
            </label>
            <label className="cash-input"><span>Conversão (%)</span>
              <input inputMode="decimal" value={convText} onChange={(e) => setConv(e.target.value)} placeholder={`${fmt(IDEAL.conversion, "pct")} (ideal)`} />
            </label>
          </div>
          <Note>{spendText !== "" && typed > 0 ? "Simulação: o gasto digitado substitui o gasto real da Meta." : meta ? `Gasto com anúncios na Meta: média de ${fmt(meta, "brl")} por dia no período.` : meta === 0 ? "Nenhum gasto com anúncios no período. Digite um gasto por dia para simular." : "Meta Ads não ligado. Digite um gasto por dia para simular."} {simulated ? `CPL de ${fmt(sim.cpl, "brl")} e conversão de ${fmt(sim.conversion, "pct")} digitados.` : "CPL e conversão das premissas ideais."} Apague um campo para voltar ao valor de origem.</Note>
        </Card>
        <Card title="Como a conta é feita" sub={simulated ? "com o CPL e a conversão digitados" : "premissas ideais do teste"}>
          {plan ? <HBars unit="brl" items={[
            { label: "Anúncio (imposto da Meta já incluído)", value: plan.ad },
            { label: `IA (${fmt(IDEAL.api_per_lead, "brl")} por lead) + WhatsApp pós-venda`, value: plan.api },
            { label: `Adiantado nos pedidos na entrega (${fmt(plan.cod_orders, "n")} de ${fmt(plan.orders, "n")} pedidos)`, value: plan.upfront },
            { label: "Sai do caixa no período", value: plan.total },
            { label: `Caixa necessário (até ${plan.cycle} dias, antes do primeiro repasse)`, value: plan.need }]} /> : <p className="empty">Sem gasto com anúncios para calcular.</p>}
          <Note>CPL de {fmt(sim.cpl, "brl")} e conversão de {fmt(sim.conversion, "pct")}: cada {fmt(sim.cpl, "brl")} de anúncio traz um lead, e {fmt(sim.conversion, "pct")} dos leads compram. {fmt(IDEAL.cod_share * 100, "pct")} dos pedidos na entrega, 1 peça de {fmt(IDEAL.cod_price, "brl")}: cada um adianta {fmt(codUpfront(IDEAL.cod_price, 1), "brl")} (produto, entrega, manuseio e taxa), que voltam no repasse da Logzz {RELEASE_DAYS} dias depois do "Completo". Com {DELIVERY_DAYS} dias até entregar (premissa do portal), nada volta antes de {DELIVERY_DAYS + RELEASE_DAYS} dias; depois disso o repasse dos pedidos antigos paga os novos, então o caixa necessário é o de no máximo esse ciclo. O que entra do antecipado na hora não é descontado.</Note>
        </Card>
      </div>
      <h2 className="section-title">Caixa necessário por período</h2>
      <Table name="caixa-por-periodo" head={["Período", "Anúncio", "Leads", "Pedidos", "Sai do caixa", "Caixa necessário"]}
        rows={PERIODS.map((x) => { const pl = cashPlan(daily, periodDays(x.id), sim); return [x.label, fmt(pl?.spend, "brl"), fmt(pl?.leads, "n"), fmt(pl?.orders, "n"), fmt(pl?.total, "brl"), fmt(pl?.need, "brl")]; })}
        csv={PERIODS.map((x) => { const pl = cashPlan(daily, periodDays(x.id), sim); return [x.label, pl?.spend, pl?.leads, pl?.orders, pl?.total, pl?.need]; })} />
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
