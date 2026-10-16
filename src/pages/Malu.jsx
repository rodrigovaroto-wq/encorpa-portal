// Malu: resultados por desfecho, lacunas, atendimento e saúde. Desfecho de cada conversa em lib/build.mjs › conversationStatus.
import { AGENT_HEALTH, BUCKETS, CHANNEL, FUNNEL, OUTCOMES, SERVICE } from "../lib/constants.js";
import { bucketLabels, fmt, metricBy, when } from "../lib/format.js";
import { Bars, Donut, Gauge, HBars, Lines, Spark } from "../components/charts.jsx";
import { Card, DeltaBadge, Kpi, Note, PageHead, Table } from "../components/ui.jsx";

const COLOR = { bought: "var(--ok)", declined: "var(--accent-2)", unresolved: "var(--bad)", abandoned: "var(--warn)", open: "var(--muted)" };

export function Malu({ data, period, route, tabs }) {
  const p = data.periods[period] || {}, g = data.global;
  const sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Análise › Malu" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/malu/${k}`)} counts={{ gaps: p.gaps?.length || null }} />
      {sub === "results" && <Results p={p} g={g} period={period} />}
      {sub === "gaps" && <Gaps p={p} />}
      {sub === "service" && <Service p={p} g={g} />}
      {sub === "health" && <Health p={p} g={g} />}
    </div>
  );
}

function Results({ p, g, period }) {
  const o = p.outcomes || {}, m = p.metrics || {}, res = m.resolution?.series || [];
  const card = (label, v, sub) => <div className="glass kpi"><div className="kpi-top"><h3>{label}</h3></div><div className="kpi-value">{fmt(v, "n")}</div><span className="delta none">{sub}</span></div>;
  return (
    <>
      <div className="kpis">
        {card("Atendidas", o.attended, "conversas abertas no período")}
        {card("Resolvidas pela Malu", o.solved, "compraram ou encerraram sem compra")}
        {card("Não resolvidas", o.unresolved, "a Malu avisou o operador")}
        {card("Abandonadas", o.abandoned, "24 h sem resposta dela, sem decisão")}
      </div>
      <div className="row r-1-2">
        <Card title="Taxa de resolução" sub="resolvidas ÷ encerradas · meta ≥ 90%">
          <Gauge value={o.resolution} tone={o.resolution == null ? "" : o.resolution >= 90 ? "ok" : o.resolution >= 75 ? "warn" : "bad"} size={150} />
          <DeltaBadge metric={m.resolution} unit="pct" id="resolution" />
        </Card>
        <Card title="Desfecho das conversas">
          <Donut items={OUTCOMES.map(([id, l]) => ({ label: l, value: o[id], color: COLOR[id] }))} />
        </Card>
      </div>
      <Card title="Resolução por intervalo do período"><Lines series={[{ name: "Resolução", values: res, color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, res.length)} unit="pct" /></Card>
      <h2 className="section-title">Resultado por versão da Malu</h2>
      <Table name="versoes" head={["Versão", "Conversas", "Resolução", "Não resolvidas", "Abandonadas", "Resposta pronta", "Custo"]}
        rows={(g.versions || []).map((r) => [r.version, fmt(r.conversations, "n"), fmt(r.resolution, "pct"), fmt(r.unresolved, "n"), fmt(r.abandoned, "n"), fmt(r.fallback, "pct"), fmt(r.cost, "brl")])}
        csv={(g.versions || []).map((r) => [r.version, r.conversations, r.resolution, r.unresolved, r.abandoned, r.fallback, r.cost])} />
      <Note>Abaixo do piso de amostra (500 leads) a diferença entre versões é ruído: leia como direção, não como veredito.</Note>
    </>
  );
}

function Gaps({ p }) {
  const gaps = p.gaps || [];
  return (
    <>
      <Note>O que a Malu não resolveu sozinha, agrupado pelo motivo que o código gravou. Cada linha é um contorno a construir para ela resolver sem pessoa (meta R21.1). As mais frequentes primeiro.</Note>
      {gaps.length > 0 && <Card title="Onde a Malu mais precisa de contorno"><HBars unit="n" tone="bad" items={gaps.slice(0, 8).map((x) => ({ label: x.reason, value: x.count }))} /></Card>}
      <Table name="lacunas" head={["Motivo", "Ocorrências", "Conversas", "Última vez", "Versão"]}
        rows={gaps.map((x) => [x.reason, fmt(x.count, "n"), fmt(x.conversations, "n"), when(x.last), x.version != null ? `v${x.version}` : "—"])}
        csv={gaps.map((x) => [x.reason, x.count, x.conversations, x.last, x.version])} />
    </>
  );
}

function Service({ p, g }) {
  const f = g.funnel || {}, m = p.metrics || {};
  return (
    <>
      <div className="kpis">{SERVICE.map(([id, label]) => { const x = metricBy(id); return <Kpi key={id} id={id} label={label || x.label} metric={m[id]} unit={x.unit} goal={x.goal} />; })}</div>
      <div className="row r-1-1">
        <Card title="Funil da conversa" sub="desde o começo"><HBars unit="n" items={FUNNEL.map(([id, l]) => ({ label: l, value: f[id] ?? 0, right: f[id] == null ? "—" : fmt(f[id], "n") }))} /></Card>
        <Card title="Mensagens recebidas por hora" sub="horário de Brasília"><Bars items={(p.hourly || []).map((v, h) => ({ value: v, label: `${h} h`, short: h % 3 ? "" : `${h}h` }))} height={200} /></Card>
      </div>
    </>
  );
}

function Health({ p, g }) {
  const m = p.metrics || {};
  return (
    <>
      <div className="kpis">
        {AGENT_HEALTH.map((id) => { const x = metricBy(id); return (
          <div key={id} className="glass kpi"><div className="kpi-top"><h3>{x.label}</h3></div><div className="kpi-value">{fmt(m[id]?.value, x.unit)}</div>
            <DeltaBadge metric={m[id]} unit={x.unit} id={id} /><Spark values={m[id]?.series} unit={x.unit} height={44} />{x.goal && <div className="kpi-goal">META {x.goal}</div>}</div>
        ); })}
      </div>
      <div className="row r-1-1">
        <Card title="O que a verificação barra" sub="bloqueios ÷ checagens por gate">
          <HBars items={(g.gates || []).slice(0, 10).map((x) => ({ label: x.gate, value: x.rate, right: `${fmt(x.blocks, "n")} de ${fmt(x.checks, "n")}` }))} />
        </Card>
        <Card title="Canal">
          <dl className="facts">{CHANNEL.map(([id, l]) => <div key={id}><dt>{l}</dt><dd>{g.channel?.[id] ?? "—"}</dd></div>)}</dl>
        </Card>
      </div>
      <Table name="versoes-tecnico" head={["Versão", "Respostas", "Handoff", "Resposta pronta", "Reescritas", "Custo"]}
        rows={(g.versions || []).map((r) => [r.version, fmt(r.turns, "n"), fmt(r.handoff, "pct"), fmt(r.fallback, "pct"), fmt(r.rewrites, "n"), fmt(r.cost, "brl")])} />
    </>
  );
}
