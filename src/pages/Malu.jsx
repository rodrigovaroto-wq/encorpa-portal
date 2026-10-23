// Malu: resultados por desfecho, lacunas, atendimento e saúde. Desfecho de cada conversa em lib/build.mjs › conversationStatus.
import { AGENT_HEALTH, BUCKETS, CHANNEL, FUNNEL, OUTCOMES, SERVICE } from "../lib/constants.js";
import { ago, bucketLabels, fmt, metricBy, when } from "../lib/format.js";
import { Bars, Donut, Gauge, HBars, Lines, Spark } from "../components/charts.jsx";
import { useState } from "react";
import { periodDays } from "../lib/data.js";
import { Card, Chip, DeltaBadge, Kpi, Note, PageHead, Table, Tabs } from "../components/ui.jsx";

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
      {sub === "number" && <NumberHealth n={g.number} demo={data.demo} />}
      {sub === "hermes" && <Hermes h={g.hermes} period={period} now={g.updated} />}
    </div>
  );
}

function Results({ p, g, period }) {
  const o = p.outcomes || {}, m = p.metrics || {}, res = m.resolution?.series || [];
  const card = (label, v, sub) => <div className="glass kpi"><div className="kpi-top"><h3>{label}</h3></div><div className="kpi-value">{fmt(v, "n")}</div><div className="kpi-foot"><span className="delta none">{sub}</span></div></div>;
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
      <Card title="Resolução por intervalo do período"><Lines series={[{ name: "Resolução", values: res, color: "var(--accent-2)" }]} labels={bucketLabels(period, BUCKETS, res.length, g.updated)} unit="pct" /></Card>
      <h2 className="section-title">Resultado por versão da Malu</h2>
      <Table name="versoes" head={["Versão", "Publicada em", "Conversas", "Resolução", "Não resolvidas", "Abandonadas", "Resposta pronta", "Custo"]}
        rows={(g.versions || []).map((r) => [r.version, when(r.published), fmt(r.conversations, "n"), fmt(r.resolution, "pct"), fmt(r.unresolved, "n"), fmt(r.abandoned, "n"), fmt(r.fallback, "pct"), fmt(r.cost, "brl")])}
        csv={(g.versions || []).map((r) => [r.version, r.published ?? "", r.conversations, r.resolution, r.unresolved, r.abandoned, r.fallback, r.cost])} />
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
            <div className="kpi-foot"><DeltaBadge metric={m[id]} unit={x.unit} id={id} /><Spark values={m[id]?.series} unit={x.unit} height={44} />{x.goal && <div className="kpi-goal">META {x.goal}</div>}</div></div>
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
      <Table name="versoes-tecnico" head={["Versão", "Publicada em", "Respostas", "Handoff", "Resposta pronta", "Reescritas", "Custo"]}
        rows={(g.versions || []).map((r) => [r.version, when(r.published), fmt(r.turns, "n"), fmt(r.handoff, "pct"), fmt(r.fallback, "pct"), fmt(r.rewrites, "n"), fmt(r.cost, "brl")])} />
    </>
  );
}

// Número do WhatsApp na Meta (lib/whatsapp.mjs, a cada 15 min): o que a Meta acha do número. Qualidade cai com bloqueio e denúncia
// das clientes; o limite é quantas clientes novas o número pode chamar por dia fora da janela. Leitura de gestão, sem custo de mensagem.
const NUM_STATUS = { CONNECTED: ["Conectado", "ok"], PENDING: ["Pendente", "warn"], FLAGGED: ["Sinalizado", "bad"], RESTRICTED: ["Restrito", "bad"], BANNED: ["Banido", "bad"], DISCONNECTED: ["Desconectado", "bad"], RATE_LIMITED: ["Limite excedido", "bad"], UNVERIFIED: ["Não verificado", "warn"], MIGRATED: ["Migrado", ""], DELETED: ["Apagado", "bad"] };
const QUALITY = { GREEN: ["Alta", "ok", "as clientes recebem bem as mensagens"], YELLOW: ["Média", "warn", "muitas clientes bloquearam ou denunciaram nos últimos 7 dias"], RED: ["Baixa", "bad", "a Meta pode restringir o número: reveja o que está sendo enviado"], UNKNOWN: ["Sem nota ainda", "", "a Meta ainda não avaliou"] };
const TIER = { TIER_50: "50", TIER_250: "250", TIER_1K: "1.000", TIER_2K: "2.000", TIER_10K: "10.000", TIER_100K: "100.000", TIER_UNLIMITED: "sem limite" };
const NAME = { APPROVED: ["Aprovado", "ok"], AVAILABLE_WITHOUT_REVIEW: ["Liberado sem revisão", "ok"], PENDING_REVIEW: ["Em revisão", "warn"], DECLINED: ["Recusado", "bad"], EXPIRED: ["Expirado", "bad"], NONE: ["Sem nome", ""] };
const REVIEW = { APPROVED: "aprovada", PENDING: "pendente", REJECTED: "recusada", verified: "verificada", unverified: "não verificada", pending: "pendente", VERIFIED: "verificado", NOT_VERIFIED: "não verificado", EXPIRED: "expirada" };
const TPL = { APPROVED: ["Aprovado", "ok"], PENDING: ["Em análise", "warn"], REJECTED: ["Recusado", "bad"], PAUSED: ["Pausado", "warn"], DISABLED: ["Desativado", "bad"], IN_APPEAL: ["Em recurso", "warn"] };

function NumberHealth({ n, demo }) {
  if (!n) return <Note>A leitura do número na Meta ainda não está ligada. No Vercel, crie WHATSAPP_TOKEN (token com whatsapp_business_management), WHATSAPP_PHONE_NUMBER_ID e, para os templates, WHATSAPP_WABA_ID. É leitura de gestão da Graph API, sem custo de mensagem.</Note>;
  if (!n.ok) return <Note>Não consegui ler o número na Meta: {n.error}</Note>;
  const chip = (map, v) => { const [l, tone] = map[v] || [v || "—", ""]; return <Chip tone={tone}>{l}</Chip>; };
  const card = (label, value, sub) => <div className="glass kpi"><div className="kpi-top"><h3>{label}</h3></div><div className="kpi-value num-value">{value}</div><div className="kpi-foot"><span className="delta none">{sub}</span></div></div>;
  const q = QUALITY[n.quality] || QUALITY.UNKNOWN;
  const tpl = n.templates || [];
  return (
    <>
      <div className="kpis">
        {card("Estado", chip(NUM_STATUS, n.status), n.phone ? `${n.phone} · ${n.name || ""}` : "número na Cloud API")}
        {card("Qualidade", <Chip tone={q[1]}>{q[0]}</Chip>, q[2])}
        {card("Limite de envio", n.tier ? TIER[n.tier] || n.tier : "—", "clientes novas por dia fora da janela de 24 h")}
        {card("Nome exibido", chip(NAME, n.name_status), n.name ? `"${n.name}" no perfil do WhatsApp` : "nome que a cliente vê")}
      </div>
      <div className="row r-1-1">
        <Card title="Conta e número">
          <dl className="facts">
            {[["Conta do WhatsApp Business", n.account?.name], ["Revisão da conta", REVIEW[n.account?.review] || n.account?.review], ["Verificação da empresa", REVIEW[n.account?.verification] || n.account?.verification], ["Verificação do número", REVIEW[n.verification] || n.verification], ["Vazão de envio", n.throughput === "HIGH" ? "alta" : n.throughput === "STANDARD" ? "padrão (80 mensagens/s)" : n.throughput], ["Modo", n.mode === "LIVE" ? "produção" : n.mode], ["Lido em", demo ? "dados de exemplo" : n.at ? when(n.at) : null]]
              .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
          </dl>
        </Card>
        <Card title="O que fazer" sub="quando a Meta muda a nota do número">
          <ul className="todo">
            <li><b>Qualidade média ou baixa:</b> veja em Malu › Lacunas e no opt-out se alguma mensagem está incomodando; a régua de lembretes é a primeira suspeita.</li>
            <li><b>Restrito ou sinalizado:</b> o critério de pausa do teste fica vermelho; pause os anúncios até a nota voltar.</li>
            <li><b>Limite perto do teto:</b> o limite sobe sozinho quando o número usa metade dele com qualidade alta por 7 dias.</li>
          </ul>
        </Card>
      </div>
      {n.templates && <Table name="templates" head={["Template", "Categoria", "Idioma", "Estado", "Qualidade"]}
        rows={tpl.map((t) => [t.name, t.category === "UTILITY" ? "Utilidade" : t.category === "MARKETING" ? "Marketing" : t.category === "AUTHENTICATION" ? "Autenticação" : t.category, t.language, chip(TPL, t.status), t.quality ? <Chip tone={QUALITY[t.quality]?.[1]}>{QUALITY[t.quality]?.[0] || t.quality}</Chip> : "—"])}
        csv={tpl.map((t) => [t.name, t.category, t.language, t.status, t.quality])} />}
    </>
  );
}

// Hermes: o supervisor offline (Ricos-com-AI › hermes/). Roda todo dia às 08:47 e só lê as conversas quando chegaram 50 leads
// novos (R6.2); propõe, o operador decide na Rotina "Hermes – decisão", e a aprovada é implementada, provada e publicada.
const HERMES_STATUS = { proposed: ["Aguardando decisão", "warn"], accepted: ["Aprovada", ""], implementing: ["Implementando", ""], published: ["Publicada", "ok"], rejected: ["Recusada", "bad"], failed: ["Falhou", "bad"] };
const hermesName = (v) => (v != null ? `Hermes V${v}` : "Hermes");
const SEVERITY = { alta: "Alta", media: "Média", baixa: "Baixa" };
const KIND = { mentira: "Informação errada", resposta_pronta: "Resposta pronta", venda_perdida: "Venda perdida", tom: "Tom da conversa" };


function Hermes({ h, period, now }) {
  const [filter, setFilter] = useState("all");
  if (!h) return <Note>Os dados do Hermes ainda não chegaram. Eles vêm das tabelas hermes_runs, hermes_proposals e hermes_backlog do Supabase.</Note>;
  const from = new Date(now || Date.now()).getTime() - periodDays(period) * 864e5;
  const inPeriod = (x) => new Date(x.created_at).getTime() >= from;
  const props = (h.proposals || []).filter(inPeriod), runs = (h.runs || []).filter(inPeriod), b = h.backlog, everRan = (h.runs || []).length > 0;
  const count = (st) => props.filter((x) => x.status === st).length;
  const list = props.filter((x) => filter === "all" || x.status === filter);
  const mins = (r) => (r.started_at ? Math.max(1, Math.round((new Date(r.created_at) - new Date(r.started_at)) / 60000)) : null);
  const card = (label, value, sub) => <div className="glass kpi"><div className="kpi-top"><h3>{label}</h3></div><div className="kpi-value">{value}</div><div className="kpi-foot"><span className="delta none">{sub}</span></div></div>;
  return (
    <>
      <div className="kpis">
        {card("Estado", "Ativo", "confere todo dia às 08:47 e roda a cada 50 leads novos")}
        {card("Próxima rodada", b ? `${fmt(b.leads, "n")} / ${h.every}` : "—", b ? (b.due ? "na próxima conferência diária" : `faltam ${Math.max(0, h.every - b.leads)} leads`) : "sem leitura do backlog")}
        {card("Rodadas no período", fmt(runs.length, "n"), runs[0] ? `última ${ago(runs[0].created_at)}` : everRan ? `última ${ago(h.runs[0].created_at)}` : "nenhuma rodada em produção ainda")}
        {card("Propostas no período", fmt(props.length, "n"), `${count("published")} publicadas · ${count("rejected")} recusadas · ${count("proposed")} aguardando`)}
      </div>
      <Card title="Rodadas" sub="cada leitura em lote das conversas, com o tempo, os leads e o custo">
        {!runs.length ? <p className="empty">{everRan ? "Nenhuma rodada neste período." : `Nenhuma rodada ainda: o Hermes só lê as conversas quando chegam ${h.every} leads novos${b ? ` (hoje ${b.leads} de ${h.every})` : ""}.`}</p> : <Table name="hermes-rodadas" head={["Data", "Tempo", "Leads", "Conversas lidas", "Propostas válidas", "Descartadas", "Premissa indevida", "Custo", "Propostas"]}
          rows={runs.map((r) => [when(r.created_at), mins(r) ? `${mins(r)} min` : "—", fmt(r.leads_seen, "n"), fmt(r.conversations_seen, "n"), fmt(r.proposals_ok, "n"), fmt(r.proposals_rejected, "n"),
            r.premise_conversations == null ? "—" : `${r.premise_conversations} conversa${r.premise_conversations === 1 ? "" : "s"}`, r.cost_brl == null ? "—" : fmt(r.cost_brl, "brl"), r.proposals ? <span style={{ whiteSpace: "nowrap" }}>{r.proposals} · {hermesName(r.version)}</span> : "—"])}
          csv={runs.map((r) => [r.created_at, mins(r) ?? "", r.leads_seen ?? "", r.conversations_seen ?? "", r.proposals_ok ?? "", r.proposals_rejected ?? "", r.premise_conversations ?? "", r.cost_brl ?? "", r.proposals ? `${r.proposals} ${hermesName(r.version)}` : ""])} />}
      </Card>
      <Card title="Propostas e alterações" sub="o motivo, a evidência, a decisão e o que mudou na Malu">
        <Tabs items={[["all", "Todas"], ...Object.entries(HERMES_STATUS).map(([k, [l]]) => [k, l])]} value={filter} onChange={setFilter} counts={Object.fromEntries([["all", props.length], ...Object.keys(HERMES_STATUS).map((k) => [k, count(k) || null])])} />
        <div className="hermes-list">
          {list.map((x) => <Proposal key={x.id} x={x} />)}
          {!list.length && <p className="empty">Nenhuma proposta {filter === "all" ? "neste período" : "neste filtro e período"}.</p>}
        </div>
      </Card>
    </>
  );
}

// A evidência que o Hermes grava (hermes-core › storedEvidence) e a alteração, escritas como texto para ler, não como código.
function evidenceRows(ev) {
  if (!ev || typeof ev !== "object") return [];
  const quotes = (ev.evidencias || ev.trechos || []).map((e) => (typeof e === "string" ? { trecho: e } : e)).filter((e) => e?.trecho);
  return [
    ["O que mudar", ev.o_que],
    ["Por quê", ev.por_que],
    ["Objetivo", ev.objetivo],
    ["Como medir", ev.como_medir],
    ["Tipo", KIND[ev.classe] || ev.classe],
    ["Gravidade", SEVERITY[ev.severidade] || ev.severidade],
    ["O que o prompt diz", ev.fato_contradito],
    ["Frase parecida que continua proibida", ev.mentira_vizinha],
    ["Trechos das conversas", quotes.length ? <ul className="quotes">{quotes.map((e, i) => <li key={i}>“{e.trecho.replace(/^["“]|["”]$/g, "")}”{e.conversa ? <small> · {e.conversa}{e.mensagem != null ? `, mensagem ${e.mensagem}` : ""}</small> : null}</li>)}</ul> : null],
    ["Origem", typeof ev.source === "string" ? (ev.source.startsWith("personas:") ? "rodada de personas" : ev.source) : null],
  ];
}

// "+ linha" vira "Acrescentar: linha" e "- linha" vira "Tirar: linha"; o resto fica como frase.
function changeText(diff) {
  const lines = String(diff).split("\n").map((l) => l.trim()).filter((l) => l && !/^(@@|\+\+\+|---)/.test(l));
  return lines.map((l, i) => {
    const add = l.startsWith("+"), del = l.startsWith("-"), body = add || del ? l.slice(1).trim() : l;
    return <p key={i}>{add ? <b>Acrescentar: </b> : del ? <b>Tirar: </b> : null}{body}</p>;
  });
}

function Proposal({ x }) {
  const [label, tone] = HERMES_STATUS[x.status] || [x.status, ""];
  const rows = [
    ["Proposta em", when(x.created_at)],
    ["Leads da rodada", x.leads_seen != null ? fmt(x.leads_seen, "n") : x.run_id ? "—" : "registrada à mão (antes das rodadas)"],
    ...evidenceRows(x.evidence),
    ["Alteração proposta", x.diff ? <div className="change">{changeText(x.diff)}</div> : null],
    ["Decisão", x.decided_at ? `${when(x.decided_at)}${x.decision_reason ? ` · ${x.decision_reason}` : ""}` : x.status === "proposed" ? "aguardando o operador" : null],
    ["Implementada", x.executed_at ? `${when(x.executed_at)}${x.execution_ref ? ` · ${x.execution_ref}` : ""}` : null],
    ["Publicada", x.published_at ? when(x.published_at) : null],
    ["Resultado", x.result],
  ].filter(([, v]) => v != null && v !== "");
  return (
    <details className="hermes-item">
      <summary>
        <span className="hermes-head"><b>{hermesName(x.version)}</b><Chip>{x.target}</Chip><Chip tone={tone}>{label}</Chip>{!x.run_id && <Chip>registrada à mão</Chip>}<small>{when(x.created_at)}</small></span>
        <span className="why">{x.rationale}</span>
      </summary>
      <dl>{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </details>
  );
}
