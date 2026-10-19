import { meta, adTotals, rates } from "./meta.mjs";
import { BUCKETS } from "../src/lib/constants.js";
import { META_TAX, PREPAY_MARGIN, REFUSAL_COST, RETURN_COST, WA_PER_ORDER, codMargin } from "../src/lib/economics.js";
// Lógica compartilhada: gera os dados do portal a partir do Supabase, do n8n e da Meta.
// Desde 16/10 (operador) o portal mostra as conversas com as clientes: nome, final do telefone, UF e o texto das mensagens.
// Nunca endereço completo, CPF ou telefone inteiro. O portal fica atrás do login (middleware.js).
const TIMEOUT = 20_000; // uma fonte travada não segura o portal inteiro
export const TABLES = {
  leads: "id,name,phone,size,created_at,handoff_at,opted_out_at,state:address->region->place->>state,ctwa:source->>ctwa_clid", // UF, nunca o endereço
  orders: "id,external_id,lead_id,created_at,updated_at,amount_brl,status,payment_method,units,size,scheduled_for",
  eval_turn_outcomes: "day,turns,sent,fallbacks,handoffs,avg_rewrites,cost_brl",
  eval_gate_blocks: "day,gate,checks,blocks",
  eval_conversation_cost: "day,cost_brl",
  eval_version_outcomes: "agent_version,turns,fallbacks,handoffs,avg_rewrites,cost_brl",
  // shortcut: lê todas as mensagens a cada 5 min; com milhares de conversas, filtrar pelas conversas recentes no servidor.
  messages: "id,conversation_id,direction,body,created_at,external_id", // external_id "human:…" = resposta do operador (turn › humanReply)
  conversations: "id,lead_id,stage,cost_brl,last_inbound_at,last_outbound_at,created_at",
  // `reason` é texto interno do código (porta do aviso, gate que vetou), nunca mensagem dela; o portal guarda só o trecho antes de ":".
  turn_outcomes: "id,conversation_id,outcome,reason,rewrites,agent_version,created_at",
  eval_attribution: "ad,headline,leads,leads_ordered,leads_delivered,leads_opted_out",
  // premissa indevida por rodada do Hermes (Ricos-com-AI, migração 0027, grafo §101)
  hermes_runs: "id,created_at,started_at,source,model,conversations_seen,leads_seen,proposals_ok,proposals_rejected,cost_usd,premise_conversations,commit_sha",
  // Histórico do Hermes para Malu › Hermes: propostas (motivo, evidência, decisão, o que mudou) e quantos leads faltam para a próxima rodada.
  hermes_proposals: "id,code,target,status,rationale,diff,evidence,leads_seen,run_id,created_at,decided_at,decision_reason,executed_at,result,execution_ref,published_at",
  hermes_backlog: "leads_since_last_run,last_run_at,due",
  agent_versions: "version,published_at,note",
};
// O id desempata: duas linhas com o mesmo created_at (um POST com várias bolhas) poderiam se repetir ou sumir entre páginas.
const ORDER = { leads: "id", orders: "id", conversations: "id", messages: "created_at,conversation_id,id", turn_outcomes: "created_at,conversation_id,id" };
const OPTIONAL = new Set(["hermes_runs", "hermes_proposals", "hermes_backlog"]);
const CHANNEL = { number: "Ligado e testado (06/10)", cloud_api: "Operando", window: "—", templates: "Aprovados (09/10)" }; // manual: ajuste quando mudar
const DAY = 86400000;
const LINK_STAGES = new Set(["link_enviado", "pedido_criado", "em_rota", "entregue_pago", "recusado"]);
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// O que um pedido vale hoje, pelo status que o webhook gravou (vocabulário Logzz/Coinzz do Ricos-com-AI, grafo §57).
// Na entrega: margem cheia ao criar; recusa ou frustração troca por − R$ 9,99; cancelado antes de sair não custa nada
// (operador, 19/10: no vocabulário da Logzz, a porta que falha é "Frustrado"). Antecipado: só conta depois de pago.
// Devolução ou reembolso: perde a margem e paga o frete de volta.
export function orderValue(o) {
  const s = norm(o.status), cod = o.payment_method !== "prepay", n = Math.max(1, +o.units || 1);
  const revenue = +o.amount_brl || 0;
  const margin = cod ? codMargin(revenue, n) : n <= 3 ? PREPAY_MARGIN[n - 1] : PREPAY_MARGIN[0] * n;
  if (/devolv|reembols|estorn|chargeback/.test(s)) return { kind: "returned", revenue: 0, contribution: -RETURN_COST[cod ? "cod" : "prepay"] };
  if (!cod && /nao (pag|aprovad|confirmad)|recusad|reprovad/.test(s)) return { kind: /recus|reprov/.test(s) ? "void" : "unpaid", revenue: 0, contribution: 0 };
  if (cod && /recus|frustrad|nao entreg|sem sucesso/.test(s)) return { kind: "refused", revenue: 0, contribution: -REFUSAL_COST };
  if (/cancel/.test(s) || (!cod && /recus|expirad/.test(s))) return { kind: "void", revenue: 0, contribution: 0 };
  if (!cod && !/aprovad|pago|paga\b|paid|approved|confirmad|envi|transit|transporte|postado|rota|caminho|entregue|separacao|coleta/.test(s)) return { kind: "unpaid", revenue: 0, contribution: 0 };
  return { kind: "sale", revenue, contribution: margin };
}
const MIN = 60000;
const DELIVERED = /\bcomplet|(?<!nao )entregue/; // "Completo", nunca "Incompleto"
const share = (n, p) => (n == null || p == null ? null : Math.round((n * p) / 100));
const BRT = -3 * 3600000; // Brasil sem horário de verão desde 2019

// Uma linha por conversa, com as métricas de atendimento da Octadesk:
// 1ª resposta = 1ª mensagem dela → 1ª nossa depois dela (a saudação automática conta, como lá);
// atendimento = 1ª mensagem dela → nossa resposta à última mensagem dela (lembrete sem resposta não estica o tempo).
export function conversationTimes(messages) {
  const by = {};
  for (const m of messages) (by[m.conversation_id] ??= []).push({ out: m.direction === "outbound", at: t(m.created_at) });
  const rows = [];
  for (const [id, ms] of Object.entries(by)) {
    ms.id = id;
    ms.sort((a, b) => a.at - b.at);
    const firstIn = ms.find((m) => !m.out);
    if (!firstIn) continue;
    const lastIn = ms.findLast((m) => !m.out);
    const reply = ms.find((m) => m.out && m.at >= firstIn.at);
    const end = ms.find((m) => m.out && m.at >= lastIn.at) ?? lastIn;
    rows.push({ id: ms.id, start: firstIn.at, first_response: reply ? (reply.at - firstIn.at) / MIN : null, handle_time: (end.at - firstIn.at) / MIN });
  }
  return rows;
}
// Primeiro fluxo de cada lead (operador, 17/10): da primeira mensagem dela até a resposta da Malu à última mensagem dela antes de
// um silêncio dela de mais de 24 h. Junta as conversas do lead; os lembretes que saem depois do silêncio não contam.
function leadSpans(D) {
  const leadOf = Object.fromEntries(D.conversations.map((c) => [c.id, c.lead_id])), by = {};
  for (const m of D.messages) (by[leadOf[m.conversation_id] ?? m.conversation_id] ??= []).push({ out: m.direction === "outbound", at: t(m.created_at) });
  const rows = [];
  for (const ms of Object.values(by)) {
    const ins = ms.filter((m) => !m.out).map((m) => m.at).sort((a, b) => a - b), outs = ms.filter((m) => m.out).map((m) => m.at).sort((a, b) => a - b);
    if (!ins.length) continue;
    let i = 0;
    while (i + 1 < ins.length && ins[i + 1] - ins[i] <= DAY) i++;
    const lastIn = ins[i], next = ins[i + 1] ?? Infinity, reply = outs.find((o) => o >= lastIn && o < next && o - lastIn <= DAY);
    rows.push({ first: ins[0], last: reply ?? lastIn });
  }
  return rows;
}
// Desfecho de cada conversa. Abandono fica à parte, e conversa em que a Malu avisou o operador (R22.1) é "não resolvida".
// Precedência: comprou > não resolvida > recusou > em andamento > abandonada.
const BOUGHT = new Set(["pedido_criado", "em_rota", "entregue_pago"]);
const DECLINED = new Set(["recusado", "perdido", "bloqueado"]);
const gist = (r) => String(r || "sem motivo").split(":")[0].trim().slice(0, 80);
export function conversationStatus(D, now) {
  const outs = {};
  for (const o of D.turn_outcomes) (outs[o.conversation_id] ??= []).push(o);
  const msgs = {};
  for (const m of D.messages) msgs[m.conversation_id] = (msgs[m.conversation_id] || 0) + 1;
  const times = Object.fromEntries((D.times ??= conversationTimes(D.messages)).map((r) => [r.id, r]));
  return D.conversations.map((c) => {
    const os = (outs[c.id] || []).sort((a, b) => t(a.created_at) - t(b.created_at));
    const fails = os.filter((o) => o.outcome === "handoff" || o.outcome === "fallback");
    // Em andamento x abandonada pela última mensagem DELA: lembrete da Malu não mantém a conversa aberta.
    const last = Math.max(t(c.last_inbound_at || 0), t(c.created_at));
    const status = BOUGHT.has(c.stage) ? "bought" : fails.length ? "unresolved" : DECLINED.has(c.stage) || os.some((o) => o.outcome === "opted_out") ? "declined" : now - last < DAY ? "open" : "abandoned";
    const version = [...os].reverse().find((o) => o.agent_version != null)?.agent_version ?? null;
    return { id: c.id, start: t(c.created_at), stage: c.stage, status, version, messages: msgs[c.id] || 0, first_response: times[c.id]?.first_response ?? null, reasons: fails.map((o) => ({ reason: gist(o.reason), at: t(o.created_at), version: o.agent_version })) };
  });
}
// Contagem por desfecho e a taxa de resolução: resolvidas ÷ encerradas (abandono e em andamento não entram como resolvidas).
export function outcomeCounts(rows) {
  const n = { attended: rows.length, bought: 0, declined: 0, unresolved: 0, abandoned: 0, open: 0 };
  for (const r of rows) n[r.status]++;
  const solved = n.bought + n.declined, closed = n.attended - n.open;
  return { ...n, solved, resolution: pct(solved, closed), unresolved_rate: pct(n.unresolved, closed) };
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function getAll(table, { url, key, fixture } = {}) {
  if (fixture) return fixture[table] ?? [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    // Ordem fixa: sem ela, o Postgres pode repetir ou pular linhas entre páginas de 1000.
    const r = await fetch(`${url}/rest/v1/${table}?select=${TABLES[table]}${ORDER[table] ? `&order=${ORDER[table]}` : ""}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// Rodada de personas do Ricos-com-AI (src/dev/persona-run-core.ts): passa pela turn de produção com telefones 5500099…
// e apaga o lead no fim. Sem este filtro a conversa aparecia no portal, recebia resposta do operador e sumia.
const SYNTHETIC = /^5500099/;
export function dropSynthetic(D) {
  const leads = new Set(D.leads.filter((l) => SYNTHETIC.test(String(l.phone ?? ""))).map((l) => l.id));
  if (!leads.size) return D;
  const convs = new Set(D.conversations.filter((c) => leads.has(c.lead_id)).map((c) => c.id));
  D.leads = D.leads.filter((l) => !leads.has(l.id));
  D.conversations = D.conversations.filter((c) => !convs.has(c.id));
  for (const name of ["messages", "turn_outcomes"]) if (D[name]) D[name] = D[name].filter((r) => !convs.has(r.conversation_id));
  if (D.orders) D.orders = D.orders.filter((o) => !leads.has(o.lead_id));
  return D;
}

export async function buildAll(opts, now = Date.now()) {
  const D = {};
  // Em paralelo: em série, a soma das leituras deixava a função lenta e, quando ela falha, a tela de conversas fica sem dados.
  // As tabelas do Hermes são extras: se uma falhar, o portal segue sem a aba Hermes, como segue sem a Meta ou o n8n.
  await Promise.all(Object.keys(TABLES).map(async (name) => { D[name] = OPTIONAL.has(name) ? await getAll(name, opts).catch(() => []) : await getAll(name, opts); }));
  dropSynthetic(D);
  D.meta = await meta(opts, now).catch((e) => ({ error: String(e.message || e).slice(0, 200) }));
  const data = build(D, now);
  const automations = await n8n(opts).catch((e) => ({ error: String(e.message || e).slice(0, 200) }));
  data.global.automations = automations;
  data.global.channel = channel(data.global.health.whatsapp, automations);
  data.global.health.n8n = !automations ? { ok: null, detail: "não configurado" } : automations.error ? { ok: false, detail: automations.error } : { ok: true, detail: `${automations.workflows.filter((w) => w.active).length} workflows ativos` };
  return { data, D };
}

// Estado do número a partir do que se vê (antes era texto fixo e o critério de pausa ficava sempre verde): erro no workflow
// "WhatsApp envio" entre as últimas execuções ou nenhuma mensagem da Malu em 3 dias. Erro pode ser um número só (atenção, não pausa).
export function channel(whatsapp, automations) {
  const envio = automations?.workflows?.find((w) => /whatsapp envio/i.test(w.name));
  if (envio?.errors) return { ...CHANNEL, number: `Envio com erro: ${envio.errors} entre as últimas execuções do n8n`, status: "warn" };
  if (whatsapp?.ok === false) return { ...CHANNEL, number: "Nenhuma mensagem da Malu há mais de 3 dias", status: "warn" };
  if (whatsapp?.ok) return { ...CHANNEL, number: "Enviando, sem erro nas últimas execuções", status: "ok" };
  return { ...CHANNEL, status: null };
}

// Orçamento diário dos anúncios ativos (Meta): o da campanha (orçamento na campanha) ou a soma dos conjuntos ativos.
// Orçamento total de conjunto com início e fim entra dividido pelos dias; orçamento total de campanha não tem data e fica fora.
export function adBudget(m, now) {
  if (!m || m.error) return null;
  const on = (x) => x.status === "ACTIVE", sets = m.adsets.filter(on);
  let daily = 0;
  for (const c of m.campaigns.filter(on)) {
    if (c.daily_budget) { daily += c.daily_budget; continue; }
    for (const s of sets.filter((x) => x.campaign_id === c.id)) {
      if (s.daily_budget) daily += s.daily_budget;
      else if (s.lifetime_budget && s.start && s.end && t(s.end) > now) daily += s.lifetime_budget / Math.max(1, (t(s.end) - t(s.start)) / DAY);
    }
  }
  return daily;
}

// n8n (só leitura): desenho dos workflows e as últimas execuções. Nunca os parâmetros dos nós,
// onde moram URL, credencial e corpo de requisição: só nome, tipo, posição e ligações.
export async function n8n({ n8nUrl, n8nKey, fixture } = {}) {
  if (fixture) return fixture.n8n ?? null;
  if (!n8nUrl) return null;
  const get = async (path) => {
    const r = await fetch(`${n8nUrl}/api/v1/${path}`, { headers: n8nKey ? { "X-N8N-API-KEY": n8nKey } : {}, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`n8n ${path}: HTTP ${r.status}`);
    return r.json();
  };
  const wf = (await get("workflows?limit=100")).data;
  const runs = [];
  for (let cursor = "", i = 0; i < 3; i++) {
    const page = await get(`executions?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    runs.push(...page.data);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  const workflows = wf.map((w) => {
    const nodes = w.nodes.filter((n) => !n.type.endsWith("stickyNote"));
    const edges = [];
    for (const [from, out] of Object.entries(w.connections || {})) for (const list of out.main || []) for (const c of list || []) edges.push([from, c.node]);
    const mine = runs.filter((r) => r.workflowId === w.id);
    return {
      id: w.id, name: w.name, active: w.active, updated: w.updatedAt,
      nodes: nodes.map((n) => ({ name: n.name, type: n.type.split(".").pop(), x: n.position[0], y: n.position[1] })), edges,
      runs: mine.length, errors: mine.filter((r) => r.status === "error" || r.status === "crashed").length,
      last: mine[0] ? { status: mine[0].status, at: mine[0].startedAt } : null,
    };
  }).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
  const names = Object.fromEntries(wf.map((w) => [w.id, w.name]));
  return {
    workflows, read: runs.length,
    runs: runs.slice(0, 60).map((r) => ({ workflow: names[r.workflowId] ?? r.workflowId, status: r.status, mode: r.mode, at: r.startedAt, ms: r.stoppedAt ? t(r.stoppedAt) - t(r.startedAt) : null })),
  };
}

const pickOutcome = (o) => ({ conversations: o.attended, resolution: o.resolution, unresolved: o.unresolved, abandoned: o.abandoned });
const t = (s) => new Date(s).getTime();
const inWin = (ts, a, b) => ts >= a && ts < b;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !Number.isNaN(v)));

// Premissa indevida: a rodada do Hermes mais recente no intervalo que já grava a contagem (rodada antiga = sem número).
function premise(runs, a, b) {
  const r = runs.filter((x) => x.premise_conversations != null && +x.conversations_seen > 0 && inWin(t(x.created_at), a, b)).sort((x, y) => t(y.created_at) - t(x.created_at))[0];
  return r ? pct(+r.premise_conversations, +r.conversations_seen) : null;
}

// Anúncio no intervalo, a partir das linhas diárias da Meta. Sem Meta ligada, nada (o portal mostra "—").
function ads(D, a, b) {
  if (!D.meta?.daily) return {};
  const t = Object.values(adTotals(D.meta.daily, a, b)).reduce((x, y) => ({ spend: x.spend + y.spend, impressions: x.impressions + y.impressions, clicks: x.clicks + y.clicks, started: x.started + y.started }), { spend: 0, impressions: 0, clicks: 0, started: 0 });
  const r = rates(t);
  return { spend: t.spend, cpm: r.cpm, ctr: r.ctr, cpl: r.cpl };
}

// Lucro e margem só com o gasto de anúncio conhecido: sem ele a margem sairia inflada.
// Margem operacional = (soma do que cada pedido vale − anúncio com imposto − API) ÷ faturamento: a média ponderada de todos os pedidos.
function profit(contribution, revenue, api, spend) {
  if (spend == null) return { gross_profit: revenue ? contribution : null };
  const cost = spend * (1 + META_TAX) + api, net = contribution - cost;
  return { gross_profit: contribution, net_profit: net, op_margin: pct(net, revenue), roi: cost > 0 ? contribution / cost : null };
}

function windowMetrics(D, a, b) {
  const L = D.leads.filter((r) => inWin(t(r.created_at), a, b));
  const CV = D.conversations.filter((c) => inWin(t(c.created_at), a, b));
  const inbound = (D.inbound ??= D.messages.reduce((m, x) => { if (x.direction === "inbound") m[x.conversation_id] = (m[x.conversation_id] || 0) + 1; return m; }, {}));
  const OV = D.orders.filter((r) => inWin(t(r.created_at), a, b)).map((r) => ({ ...r, v: orderValue(r) }));
  const O = OV.filter((r) => r.v.kind === "sale");
  const dayOf = (r) => t(`${r.day}T12:00:00Z`);
  const TO = D.eval_turn_outcomes.filter((r) => inWin(dayOf(r), a, b));
  const GB = D.eval_gate_blocks.filter((r) => inWin(dayOf(r), a, b));
  const CC = D.eval_conversation_cost.filter((r) => inWin(dayOf(r), a, b));
  const turns = sum(TO.map((r) => +r.turns));
  const CT = (D.times ??= conversationTimes(D.messages)).filter((r) => inWin(r.start, a, b));
  const oc = outcomeCounts((D.status ??= conversationStatus(D, D.now)).filter((r) => inWin(r.start, a, b)));
  const revenue = sum(O.map((r) => r.v.revenue)), contribution = sum(OV.map((r) => r.v.contribution));
  const api = sum(TO.map((r) => +r.cost_brl)) + O.length * WA_PER_ORDER;
  const ad = ads(D, a, b), apiPerLead = CC.length ? sum(CC.map((r) => +r.cost_brl)) / CC.length : null;
  const delivered = O.filter((r) => DELIVERED.test(norm(r.status))).length;
  return clean({
    leads: L.length,
    orders: O.length,
    revenue,
    conversion: pct(O.length, L.length),
    handoff: oc.unresolved_rate,
    transfers: oc.attended ? oc.unresolved : null,
    resolution: oc.resolution,
    first_response: avg(CT.map((r) => r.first_response).filter((v) => v != null)),
    // Por lead (operador, 17/10): a duração do primeiro fluxo (leadSpans), média entre os leads que começaram no intervalo.
    handle_time: avg((D.leadSpan ??= leadSpans(D)).filter((r) => inWin(r.first, a, b)).map((r) => (r.last - r.first) / MIN)),
    optout: pct(L.filter((r) => r.opted_out_at).length, L.length),
    fallback: pct(sum(TO.map((r) => +r.fallbacks)), turns),
    rewrites: turns > 0 ? sum(TO.map((r) => (+r.avg_rewrites || 0) * +r.turns)) / turns : null,
    api_per_lead: apiPerLead,
    cpl_api: ad.cpl != null && apiPerLead != null ? ad.cpl + apiPerLead : null,
    reply_rate: pct(CV.filter((c) => (inbound[c.id] || 0) >= 2).length, CV.length), // ela respondeu à Malu ao menos uma vez
    link_reach: pct(CV.filter((c) => LINK_STAGES.has(c.stage)).length, CV.length),
    // Chegou ao preço (Ricos-com-AI, 14-experimentos-l3.md): alguma mensagem nossa com "R$".
    price_reach: pct(CV.filter((c) => (D.priced ??= new Set(D.messages.filter((m) => m.direction === "outbound" && /R\$/.test(m.body || "")).map((m) => m.conversation_id))).has(c.id)).length, CV.length),
    gate_blocks: pct(sum(GB.map((r) => +r.blocks)), sum(GB.map((r) => +r.checks))),
    api_cost: api,
    invalid_premise: premise(D.hermes_runs, a, b),
    leads_ad: L.filter((r) => r.ctwa).length,
    leads_organic: L.filter((r) => !r.ctwa).length,
    delivered_orders: delivered,
    delivered: pct(delivered, O.length),
    prepaid_share: pct(O.filter((r) => r.payment_method === "prepay").length, O.length),
    op_cost: O.length ? revenue - contribution : null, // tudo o que sai do faturamento antes de anúncio e API
    ...ad,
    // Recusa = recusados ÷ (recusados + entregues) na entrega; pedido ainda em rota não entra (igual à tela de Pedidos).
    refusal: pct(OV.filter((r) => r.v.kind === "refused").length, OV.filter((r) => r.payment_method !== "prepay" && (r.v.kind === "refused" || (r.v.kind === "sale" && DELIVERED.test(norm(r.status))))).length),
    ...profit(contribution, revenue, api, D.meta?.daily ? ad.spend : null),
  });
}

// Campanhas, conjuntos e anúncios com as métricas da janela. Leads e pedidos por anúncio vêm de eval_attribution
// (o id do anúncio que a cliente clicou, gravado no primeiro toque); não têm janela, são o total do anúncio.
function metaWindow(D, a, b) {
  const m = D.meta;
  if (!m || m.error) return m;
  const per = adTotals(m.daily, a, b), att = Object.fromEntries(D.eval_attribution.map((r) => [r.ad, r]));
  const zero = { spend: 0, impressions: 0, clicks: 0, started: 0 };
  const add = (x, y) => ({ spend: x.spend + y.spend, impressions: x.impressions + y.impressions, clicks: x.clicks + y.clicks, started: x.started + y.started });
  const ads = m.ads.map((ad) => ({ ...ad, ...rates(per[ad.id] || zero), leads: +att[ad.id]?.leads || 0, orders: +att[ad.id]?.leads_ordered || 0, delivered: +att[ad.id]?.leads_delivered || 0 }));
  const roll = (key) => (id) => rates(ads.filter((x) => x[key] === id).reduce(add, zero));
  const sums = (key) => (id) => { const xs = ads.filter((x) => x[key] === id); return { leads: sum(xs.map((x) => x.leads)), orders: sum(xs.map((x) => x.orders)), ads: xs.length }; };
  return {
    ...(m.stale ? { stale: m.stale } : {}),
    campaigns: m.campaigns.map((c) => ({ ...c, ...roll("campaign_id")(c.id), ...sums("campaign_id")(c.id) })),
    adsets: m.adsets.map((s) => ({ ...s, ...roll("adset_id")(s.id), ...sums("adset_id")(s.id) })),
    ads,
  };
}

// Conversão por estado (UF que a cobertura gravou no lead): leads e pedidos criados na janela. Lead sem CEP fica em "sem estado".
function byState(D, a, b) {
  const uf = Object.fromEntries(D.leads.map((l) => [l.id, l.state || "sem estado"])), out = {};
  for (const l of D.leads) if (inWin(t(l.created_at), a, b)) (out[uf[l.id]] ??= { state: uf[l.id], leads: 0, orders: 0 }).leads++;
  for (const o of D.orders) if (inWin(t(o.created_at), a, b) && orderValue(o).kind === "sale") (out[uf[o.lead_id] || "sem estado"] ??= { state: uf[o.lead_id] || "sem estado", leads: 0, orders: 0 }).orders++;
  return Object.values(out).map((x) => ({ ...x, conversion: pct(x.orders, x.leads) })).sort((x, y) => y.leads - x.leads);
}

// Critério de pausa: das últimas 100 conversas, % com mais de R$ 1,00 de modelo.
function apiOver(rows) {
  const last = [...rows].sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 100);
  return last.length ? pct(last.filter((r) => +r.cost_brl > 1).length, last.length) : null;
}

export function build(D, now) {
  for (const name of OPTIONAL) D[name] ??= [];
  D.now = now;
  const out = {};
  for (const [period, [n, days]] of Object.entries(BUCKETS)) {
    const span = n * days * DAY, step = days * DAY, start = now - span;
    const cur = windowMetrics(D, start, now), prev = windowMetrics(D, start - span, start);
    const series = Array.from({ length: n }, (_, i) => windowMetrics(D, start + i * step, start + (i + 1) * step));
    const metrics = {};
    for (const id of Object.keys(cur)) {
      if (id === "api_cost") continue;
      const s = series.map((m) => m[id] ?? null);
      metrics[id] = { value: cur[id], ...(prev[id] != null ? { previous: prev[id] } : {}), ...(s.filter((v) => v != null).length > 1 ? { series: s } : {}) };
    }
    const hourly = Array(24).fill(0);
    for (const m of D.messages) { const at = t(m.created_at); if (m.direction === "inbound" && inWin(at, start, now)) hourly[new Date(at + BRT).getUTCHours()]++; }
    const rows = D.status.filter((r) => inWin(r.start, start, now));
    const gaps = {};
    for (const r of rows) for (const g of r.reasons) { const x = (gaps[g.reason] ??= { reason: g.reason, count: 0, conversations: new Set(), last: 0, version: null }); x.count++; x.conversations.add(r.id); if (g.at > x.last) { x.last = g.at; x.version = g.version; } }
    const conversations = rows.sort((x, y) => y.start - x.start).slice(0, 200).map(({ reasons, ...r }) => ({ ...r, id: r.id.slice(0, 8), reason: reasons.at(-1)?.reason ?? null }));
    const perDay = cur.api_cost / (span / DAY);
    const metaOut = metaWindow(D, start, now);
    const states = byState(D, start, now);
    const inPeriod = D.orders.filter((o) => inWin(t(o.created_at), start, now)).map((o) => ({ ...o, v: orderValue(o) })).filter((o) => o.v.kind === "sale");
    const mix = { cod: inPeriod.filter((o) => o.payment_method !== "prepay").length, prepay: inPeriod.filter((o) => o.payment_method === "prepay").length,
      units: [1, 2, 3].map((n) => inPeriod.filter((o) => (Math.max(1, +o.units || 1) >= 3 ? 3 : Math.max(1, +o.units || 1)) === n).length),
      contribution: cur.gross_profit ?? null };
    out[period] = { metrics, hourly, outcomes: outcomeCounts(rows), conversations, meta: metaOut, states, mix,
      gaps: Object.values(gaps).map((x) => ({ ...x, conversations: x.conversations.size, last: new Date(x.last).toISOString() })).sort((x, y) => y.count - x.count),
      money: { revenue: cur.revenue, api_cost: cur.api_cost, api_per_day: perDay, api_30d: perDay * 30 } };
  }
  const all = windowMetrics(D, 0, now + DAY);
  const byVersion = {};
  for (const r of D.status) if (r.version != null) (byVersion[r.version] ??= []).push(r);
  // Toda versão publicada (agent_versions), da mais nova para a mais antiga; a que ainda não teve conversa aparece com "—".
  const evo = Object.fromEntries(D.eval_version_outcomes.map((r) => [r.agent_version, r]));
  const published = Object.fromEntries(D.agent_versions.map((v) => [v.version, v]));
  const versions = [...new Set([...Object.keys(published), ...Object.keys(evo)].map(Number))].sort((a, b) => b - a).map((n) => {
    const r = evo[n];
    return { version: `v${n}`, published: published[n]?.published_at ?? null, ...pickOutcome(outcomeCounts(byVersion[n] || [])),
      turns: r ? +r.turns : 0, handoff: r ? pct(+r.handoffs, +r.turns) : null, fallback: r ? pct(+r.fallbacks, +r.turns) : null, rewrites: r ? +r.avg_rewrites : null, cost: r ? +r.cost_brl : null };
  });
  const g = {};
  for (const r of D.eval_gate_blocks) { g[r.gate] ??= { gate: r.gate, checks: 0, blocks: 0 }; g[r.gate].checks += +r.checks; g[r.gate].blocks += +r.blocks; }
  const gates = Object.values(g).map((x) => ({ ...x, rate: pct(x.blocks, x.checks) ?? 0 })).sort((a, b) => b.blocks - a.blocks || b.checks - a.checks);
  const global = {
    updated: new Date(now).toISOString(),
    totals: { leads: all.leads, orders: all.orders, spend: all.spend ?? 0 },
    funnel: { first_msg: all.leads, reply: share(all.leads, all.reply_rate), price: share(all.leads, all.price_reach), link: share(all.leads, all.link_reach), order: all.orders, delivered: all.delivered_orders },
    channel: CHANNEL, versions, gates, api_over_pct: apiOver(D.eval_conversation_cost), ad_budget: adBudget(D.meta, now),
    chats: chats(D, now), orders: ordersList(D), health: health(D, now), hermes: hermes(D),
  };
  return { updated: global.updated, global, periods: out };
}

// Só o que a tela Conversas precisa, sem cache: a tela consulta a cada 15 s (api/chats.js).
const CHAT_TABLES = ["leads", "conversations", "messages", "turn_outcomes", "orders"];
export async function buildChats(opts, now = Date.now()) {
  const D = {};
  await Promise.all(CHAT_TABLES.map(async (name) => { D[name] = await getAll(name, opts); }));
  dropSynthetic(D);
  return { updated: new Date(now).toISOString(), chats: chats(D, now) };
}

// Conversas para a tela de chat: as 150 clientes com movimento mais recente, com mensagens, ficha e o que a Malu passou.
// Uma linha por cliente, como no WhatsApp: a resposta do operador (turn › humanReply) vai para a conversa mais nova do lead,
// então o id é o dela e as mensagens de todas as conversas do lead entram juntas. Antes, um lead com duas conversas abertas
// (duas mensagens dela no mesmo instante) mostrava duas linhas, e a resposta dada na mais antiga "sumia" para a outra.
export function chats(D, now) {
  const lead = Object.fromEntries(D.leads.map((l) => [l.id, l])), st = Object.fromEntries((D.status ??= conversationStatus(D, now)).map((r) => [r.id, r]));
  const msgs = {};
  for (const m of D.messages) (msgs[m.conversation_id] ??= []).push({ out: m.direction === "outbound", op: String(m.external_id || "").startsWith("human:") || undefined, text: m.body ?? "", at: m.created_at });
  const outs = {};
  for (const o of D.turn_outcomes) (outs[o.conversation_id] ??= []).push(o);
  const orders = {};
  for (const o of D.orders) (orders[o.lead_id] ??= []).push(o);
  const last = (c) => Math.max(t(c.last_inbound_at || 0), t(c.last_outbound_at || 0), t(c.created_at));
  const byLead = {};
  for (const c of D.conversations) (byLead[c.lead_id ?? c.id] ??= []).push(c);
  const rows = Object.values(byLead).map((cs) => cs.sort((a, b) => t(a.created_at) - t(b.created_at)));
  return rows.sort((a, b) => Math.max(...b.map(last)) - Math.max(...a.map(last))).slice(0, 150).map((cs) => {
    const c = cs.at(-1), l = lead[c.lead_id] || {}, s = st[c.id] || {}, os = cs.flatMap((x) => outs[x.id] || []);
    return {
      id: c.id, ids: cs.map((x) => x.id), short: c.id.slice(0, 8), name: l.name || null, phone: l.phone ? `…${String(l.phone).slice(-4)}` : null, state: l.state || null, size: l.size || null,
      origin: l.ctwa ? "anúncio" : "orgânico", stage: c.stage, status: s.status || null, version: s.version ?? null, cost: sum(cs.map((x) => +x.cost_brl || 0)), last: new Date(Math.max(...cs.map(last))).toISOString(),
      rewrites: sum(os.map((o) => +o.rewrites || 0)), fallbacks: os.filter((o) => o.outcome === "fallback").length,
      reasons: cs.flatMap((x) => st[x.id]?.reasons || []).map((r) => r.reason),
      flaggedAt: ((at) => (at ? new Date(at).toISOString() : null))(Math.max(0, ...cs.flatMap((x) => st[x.id]?.reasons || []).map((r) => r.at))), orders: (orders[c.lead_id] || []).map((o) => ({ status: o.status, method: o.payment_method, amount: +o.amount_brl || 0, units: +o.units || 1 })),
      messages: cs.flatMap((x) => msgs[x.id] || []).sort((a, b) => t(a.at) - t(b.at)),
      // Malu pausada nesta conversa (leads.handoff_at) e a janela de 24 h da Meta para texto livre, contada da última mensagem dela.
      paused: !!l.handoff_at, pausedAt: l.handoff_at || null, optedOut: !!l.opted_out_at,
      windowOpen: !!c.last_inbound_at && now - t(c.last_inbound_at) < DAY,
    };
  });
}

// Hermes (supervisor offline, Ricos-com-AI › hermes/): rodadas, propostas com motivo e evidência, e o que foi publicado.
const HERMES_EVERY = 50; // uma rodada a cada 50 leads novos (R6.2)
const USD_BRL = 5.4; // o mesmo câmbio fixo do Ricos-com-AI (supabase/functions/whatsapp)
function hermes(D) {
  const b = D.hermes_backlog[0] || null;
  // Cada proposta e cada rodada leva o nome da versão da Malu no ar quando nasceu: "Hermes V26".
  const versions = [...D.agent_versions].filter((v) => v.published_at).sort((a, b) => t(a.published_at) - t(b.published_at));
  // Antes da primeira versão numerada (v1, 05/10) a Malu não tinha número: V0.
  const versionAt = (at) => versions.filter((v) => t(v.published_at) <= t(at)).at(-1)?.version ?? (versions.length ? 0 : null);
  const byRun = {};
  for (const p of D.hermes_proposals) if (p.run_id) byRun[p.run_id] = (byRun[p.run_id] || 0) + 1;
  return {
    every: HERMES_EVERY, backlog: b ? { leads: +b.leads_since_last_run || 0, lastRun: b.last_run_at, due: !!b.due } : null,
    runs: [...D.hermes_runs].sort((a, b) => t(b.created_at) - t(a.created_at))
      .map(({ cost_usd, ...r }) => ({ ...r, cost_brl: cost_usd == null ? null : +cost_usd * USD_BRL, version: versionAt(r.created_at), proposals: byRun[r.id] || 0 })),
    proposals: [...D.hermes_proposals].sort((a, b) => t(b.created_at) - t(a.created_at)).map((p) => ({ ...p, version: versionAt(p.created_at) })),
  };
}

// Pedidos para o terminal e a agenda de entregas: os 200 mais recentes, com o que cada um vale hoje.
function ordersList(D) {
  const lead = Object.fromEntries(D.leads.map((l) => [l.id, l]));
  return [...D.orders].sort((a, b) => t(b.created_at) - t(a.created_at)).slice(0, 200).map((o) => {
    const v = orderValue(o), s = norm(o.status), l = lead[o.lead_id] || {};
    const step = v.kind === "returned" ? "returned" : v.kind === "refused" ? "refused" : v.kind === "void" ? "void" : v.kind === "unpaid" ? "unpaid"
      : DELIVERED.test(s) ? "delivered" : /rota|caminho|envi|transit|transporte|postado|saiu/.test(s) ? "en_route" : "created";
    return { id: String(o.external_id || o.id).slice(0, 12), lead: String(o.lead_id || "").slice(0, 8), name: l.name || null, state: l.state || null, status: o.status, step, method: o.payment_method, units: Math.max(1, +o.units || 1),
      size: o.size, amount: +o.amount_brl || 0, value: v.contribution, created: o.created_at, updated: o.updated_at, scheduled: o.scheduled_for };
  });
}

// Estado de cada fonte, para a tela de integrações e o selo do topo.
function health(D, now) {
  const lastOut = D.messages.filter((m) => m.direction === "outbound").map((m) => t(m.created_at)).sort((a, b) => b - a)[0];
  const v = [...D.agent_versions].sort((a, b) => b.version - a.version)[0];
  const h = [...D.hermes_runs].sort((a, b) => t(b.created_at) - t(a.created_at))[0];
  return {
    supabase: { ok: true, detail: `${D.leads.length} leads, ${D.conversations.length} conversas` },
    meta: D.meta ? (D.meta.error ? { ok: false, detail: D.meta.error } : { ok: true, detail: `${D.meta.campaigns.length} campanhas, ${D.meta.ads.length} anúncios` }) : { ok: null, detail: "não configurado" },
    whatsapp: lastOut ? { ok: now - lastOut < 3 * DAY, detail: `última mensagem da Malu ${new Date(lastOut).toISOString()}` } : { ok: null, detail: "nenhuma mensagem" },
    malu: v ? { ok: true, detail: `versão ${v.version}`, version: v.version, published: v.published_at, note: v.note } : { ok: null, detail: "sem versão registrada" },
    hermes: h ? { ok: true, detail: `ativo · última rodada ${h.created_at}`, at: h.created_at }
      : D.hermes_backlog[0] ? { ok: true, detail: `ativo · ${+D.hermes_backlog[0].leads_since_last_run || 0} de ${HERMES_EVERY} leads para a primeira rodada` } : { ok: null, detail: "nenhuma rodada ainda" },
  };
}

