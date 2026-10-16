// Malu: resultados por desfecho, lacunas, atendimento e saúde. Desfecho de cada conversa em lib/build.mjs › conversationStatus.
import { AGENT_HEALTH, BUCKETS, CHANNEL, FUNNEL, OUTCOMES, SERVICE } from "../lib/constants.js";
import { ago, bucketLabels, fmt, metricBy, when } from "../lib/format.js";
import { Bars, Donut, Gauge, HBars, Lines, Spark } from "../components/charts.jsx";
import { useState } from "react";
import { Card, Chip, DeltaBadge, Kpi, Note, PageHead, Table, Tabs } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

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
      {sub === "hermes" && <Hermes h={g.hermes} />}
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

// Hermes: o supervisor offline (Ricos-com-AI › hermes/). Roda todo dia às 08:47 e só lê as conversas quando chegaram 50 leads
// novos (R6.2); propõe, o operador decide na Rotina "Hermes – decisão", e a aprovada é implementada, provada e publicada.
const HERMES_STATUS = { proposed: ["Aguardando decisão", "warn"], accepted: ["Aprovada", ""], implementing: ["Implementando", ""], published: ["Publicada", "ok"], rejected: ["Recusada", "bad"], failed: ["Falhou", "bad"] };
const HERMES_RUN_URL = "https://github.com/rodrigovaroto-wq/Ricos-com-AI/actions/workflows/hermes.yml";

function Hermes({ h }) {
  const [filter, setFilter] = useState("all");
  if (!h) return <Note>Os dados do Hermes ainda não chegaram. Eles vêm das tabelas hermes_runs, hermes_proposals e hermes_backlog do Supabase.</Note>;
  const props = h.proposals || [], runs = h.runs || [], b = h.backlog;
  const count = (st) => props.filter((x) => x.status === st).length;
  const list = props.filter((x) => filter === "all" || x.status === filter);
  const mins = (r) => (r.started_at ? Math.max(1, Math.round((new Date(r.created_at) - new Date(r.started_at)) / 60000)) : null);
  const card = (label, value, sub) => <div className="glass kpi"><div className="kpi-top"><h3>{label}</h3></div><div className="kpi-value">{value}</div><span className="delta none">{sub}</span></div>;
  return (
    <>
      <div className="kpis">
        {card("Estado", "Ativo", "confere todo dia às 08:47 e roda a cada 50 leads novos")}
        {card("Próxima rodada", b ? `${fmt(b.leads, "n")} / ${h.every}` : "—", b ? (b.due ? "na próxima conferência diária" : `faltam ${Math.max(0, h.every - b.leads)} leads`) : "sem leitura do backlog")}
        {card("Rodadas", fmt(runs.length, "n"), runs[0] ? `última ${ago(runs[0].created_at)}` : "nenhuma rodada em produção ainda")}
        {card("Propostas", fmt(props.length, "n"), `${count("published")} publicadas · ${count("rejected")} recusadas · ${count("proposed")} aguardando`)}
      </div>
      <Card title="Rodar agora" sub="Para ler as conversas antes de completar 50 leads">
        <p className="why">No GitHub, clique em <b>Run workflow</b>, marque <b>"Rodar mesmo sem 50 leads novos"</b> e confirme. As propostas aparecem aqui em até 5 minutos depois da rodada.</p>
        <a className="ghost" href={HERMES_RUN_URL} target="_blank" rel="noreferrer"><Icon name="bolt" /> Abrir o Hermes no GitHub</a>
      </Card>
      <Card title="Rodadas" sub="cada leitura em lote das conversas, com o tempo, os leads e o custo">
        <Table name="hermes-rodadas" head={["Data", "Tempo", "Leads", "Conversas lidas", "Propostas válidas", "Descartadas", "Premissa indevida", "Custo", "Propostas"]}
          rows={runs.map((r) => [when(r.created_at), mins(r) ? `${mins(r)} min` : "—", fmt(r.leads_seen, "n"), fmt(r.conversations_seen, "n"), fmt(r.proposals_ok, "n"), fmt(r.proposals_rejected, "n"),
            r.premise_conversations == null ? "—" : `${r.premise_conversations} conversa${r.premise_conversations === 1 ? "" : "s"}`, r.cost_usd == null ? "—" : `US$ ${r.cost_usd.toFixed(2)}`, r.proposals.join(", ") || "—"])}
          csv={runs.map((r) => [r.created_at, mins(r) ?? "", r.leads_seen ?? "", r.conversations_seen ?? "", r.proposals_ok ?? "", r.proposals_rejected ?? "", r.premise_conversations ?? "", r.cost_usd ?? "", r.proposals.join(" ")])} />
      </Card>
      <Card title="Propostas e alterações" sub="o motivo, a evidência, a decisão e o que mudou na Malu">
        <Tabs items={[["all", "Todas"], ...Object.entries(HERMES_STATUS).map(([k, [l]]) => [k, l])]} value={filter} onChange={setFilter} counts={Object.fromEntries([["all", props.length], ...Object.keys(HERMES_STATUS).map((k) => [k, count(k) || null])])} />
        <div className="hermes-list">
          {list.map((x) => <Proposal key={x.id} x={x} />)}
          {!list.length && <p className="empty">Nenhuma proposta neste filtro.</p>}
        </div>
      </Card>
    </>
  );
}

function Proposal({ x }) {
  const [label, tone] = HERMES_STATUS[x.status] || [x.status, ""];
  const ev = x.evidence && typeof x.evidence === "object" ? x.evidence : null;
  const rows = [
    ["Proposta em", when(x.created_at)],
    ["Leads da rodada", x.leads_seen != null ? fmt(x.leads_seen, "n") : x.run_id ? "—" : "registrada à mão (antes das rodadas)"],
    ["Evidência", ev ? (ev.o_que ? <>{ev.o_que}<pre>{JSON.stringify(Object.fromEntries(Object.entries(ev).filter(([k]) => k !== "o_que")), null, 2)}</pre></> : <pre>{JSON.stringify(ev, null, 2)}</pre>) : null],
    ["Mudança proposta", x.diff ? <pre>{x.diff}</pre> : null],
    ["Decisão", x.decided_at ? `${when(x.decided_at)}${x.decision_reason ? ` · ${x.decision_reason}` : ""}` : x.status === "proposed" ? "aguardando o operador" : null],
    ["Implementada", x.executed_at ? `${when(x.executed_at)}${x.execution_ref ? ` · ${x.execution_ref}` : ""}` : null],
    ["Publicada", x.published_at ? when(x.published_at) : null],
    ["Resultado", x.result],
  ].filter(([, v]) => v != null && v !== "");
  return (
    <details className="hermes-item">
      <summary><b>{x.code || x.id.slice(0, 8)}</b><Chip>{x.target}</Chip><Chip tone={tone}>{label}</Chip><small>{when(x.created_at)}</small></summary>
      <p className="why">{x.rationale}</p>
      <dl>{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </details>
  );
}
