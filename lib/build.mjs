import { meta, adTotals, rates } from "./meta.mjs";
import { whatsappNumber } from "./whatsapp.mjs";
import { BUCKETS, customPeriod } from "../src/lib/constants.js";
import { armOf } from "../src/lib/abtest.js";
import { DELIVERY, HANDLING, META_TAX, PREPAY_FREIGHT, PRODUCT, prepayMargin, REFUSAL_COST, RETURN_COST, USD_BRL, WA_PER_ORDER, codMargin, fixedDue, fixedPayments, pikapods, waNumber } from "../src/lib/economics.js";
// Lógica compartilhada: gera os dados do portal a partir do Supabase, do n8n e da Meta.
// Desde 16/10 (operador) o portal mostra as conversas com as clientes: nome, final do telefone, UF e o texto das mensagens.
// Nunca endereço completo, CPF ou telefone inteiro. O portal fica atrás do login (middleware.js).
const TIMEOUT = 20_000; // uma fonte travada não segura o portal inteiro
export const TABLES = {
  leads: "id,name,phone,size,created_at,handoff_at,opted_out_at,state:address->region->place->>state,ctwa:source->>ctwa_clid,ad:source->>source_id,cart_at:cart->>at", // UF, nunca o endereço; ad = o anúncio do clique; cart_at = largou o checkout da Coinzz (migração 0033)
  orders: "id,external_id,lead_id,created_at,updated_at,amount_brl,status,payment_method,units,size,scheduled_for",
  eval_turn_outcomes: "day,turns,sent,fallbacks,handoffs,avg_rewrites,cost_brl",
  eval_gate_blocks: "day,gate,checks,blocks",
  eval_conversation_cost: "day,cost_brl",
  llm_calls: "id,conversation_id,cost_brl,created_at", // toda chamada de modelo dos leads: resposta, reescrita, interpretação, áudio e imagem (sem conversa)
  eval_version_outcomes: "agent_version,turns,fallbacks,handoffs,avg_rewrites,cost_brl",
  // shortcut: lê todas as mensagens a cada 5 min; com milhares de conversas, filtrar pelas conversas recentes no servidor.
  messages: "id,conversation_id,direction,body,created_at,external_id,media", // external_id "human:…" = resposta do operador (turn › humanReply)
  // media (jsonb, desde a migração 0001): { kind: "image", id } com o id da mídia na Meta, quando a função whatsapp do Ricos-com-AI
  // gravar (hoje ela descreve a imagem com o modelo e descarta o id); { kind, url } para arquivo público. Lido por api/media.js.
  conversations: "id,lead_id,stage,cost_brl,last_inbound_at,last_outbound_at,created_at",
  // `reason` é texto interno do código (porta do aviso, gate que vetou), nunca mensagem dela; o portal guarda só o trecho antes de ":".
  turn_outcomes: "id,conversation_id,outcome,reason,rewrites,agent_version,created_at",
  // premissa indevida por rodada do Hermes (Ricos-com-AI, migração 0027, grafo §101)
  hermes_runs: "id,created_at,started_at,source,model,conversations_seen,leads_seen,proposals_ok,proposals_rejected,cost_usd,premise_conversations,commit_sha",
  // Histórico do Hermes para Malu › Hermes: propostas (motivo, evidência, decisão, o que mudou) e quantos leads faltam para a próxima rodada.
  hermes_proposals: "id,code,target,status,rationale,diff,evidence,leads_seen,run_id,created_at,decided_at,decision_reason,executed_at,result,execution_ref,published_at",
  hermes_backlog: "leads_since_last_run,last_run_at,due",
  agent_versions: "version,published_at,note",
  // Visitas ao site (coletor public/track.js › api/track.js, migração 0034 do Ricos-com-AI): uma linha por visita, sem dado pessoal.
  // shortcut: lê todas as visitas (~100 por dia, 400 dias); contar por dia numa view quando passar de ~100 mil linhas.
  site_sessions: "id,created_at,last_at,device,product_at,checkout_at",
  portal_settings: "key,value", // a meta do mês, editada na Home (api/team.js, ação "goal")
};
// Perfil e score por lead (Ricos-com-AI, migração 0029): a view mascarada, sem telefone, nome nem endereço. Fica fora de TABLES
// porque só api/leads.js lê; do perfil vão só os campos da tela (a dor e o gancho são texto livre, às vezes de saúde, e ficam no banco).
export const PROFILES = { lead_profiles_v: "id,created_at,stage,score,score_band,score_at,occasion:profile->>occasion,objections:profile->objections,price_sensitivity:profile->>price_sensitivity,audio_count:profile->audio_count" };
// O id desempata: duas linhas com o mesmo created_at (um POST com várias bolhas) poderiam se repetir ou sumir entre páginas.
const ORDER = { lead_profiles_v: "id", llm_calls: "created_at,id", leads: "id", orders: "id", conversations: "id", messages: "created_at,conversation_id,id", turn_outcomes: "created_at,conversation_id,id", site_sessions: "created_at,id" };
const OPTIONAL = new Set(["hermes_runs", "hermes_proposals", "hermes_backlog", "site_sessions", "portal_settings"]);
const CHANNEL = { number: "Ligado e testado (06/10)", cloud_api: "Operando", window: "—", templates: "Aprovados (09/10)" }; // manual: ajuste quando mudar
const DAY = 86400000;
const ADS_UNTIL_META = 77.38; // gasto da conta em 20/10, só para quando a Meta não estiver ligada
const LINK_STAGES = new Set(["link_enviado", "pedido_criado", "em_rota", "entregue_pago", "recusado"]);
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// O que um pedido vale hoje, pelo status que o webhook gravou (vocabulário Logzz/Coinzz do Ricos-com-AI, grafo §57).
// Na entrega: margem cheia ao criar; recusa ou frustração troca por − R$ 9,99; cancelado antes de sair não custa nada
// (operador, 19/10: no vocabulário da Logzz, a porta que falha é "Frustrado"). Antecipado: só conta depois de pago.
// Devolução ou reembolso: perde a margem e paga o frete de volta.
export function orderValue(o) {
  const s = norm(o.status), cod = o.payment_method !== "prepay", n = Math.max(1, +o.units || 1);
  const revenue = +o.amount_brl || 0;
  const margin = cod ? codMargin(revenue, n) : prepayMargin(revenue, n);
  if (/devolv|reembols|estorn|chargeback/.test(s)) return { kind: "returned", revenue: 0, contribution: -RETURN_COST[cod ? "cod" : "prepay"] };
  if (!cod && /nao (pag|aprovad|confirmad)|recusad|reprovad/.test(s)) return { kind: /recus|reprov/.test(s) ? "void" : "unpaid", revenue: 0, contribution: 0 };
  if (cod && /recus|frustrad|nao entreg|sem sucesso/.test(s)) return { kind: "refused", revenue: 0, contribution: -REFUSAL_COST };
  if (/cancel/.test(s) || (!cod && /recus|expirad/.test(s))) return { kind: "void", revenue: 0, contribution: 0 };
  if (!cod && !/aprovad|pago|paga\b|paid|approved|confirmad|envi|transit|transporte|postado|rota|caminho|entregue|separacao|coleta/.test(s)) return { kind: "unpaid", revenue: 0, contribution: 0 };
  return { kind: "sale", revenue, contribution: margin };
}
// De onde sai o custo de cada pedido (DRE, operador, 04/11): faturamento − margem = produto + frete + manuseio + taxas + recusa + devolução.
// Na entrega a taxa é a transação da Logzz (6,99% da comissão + R$ 2,49); no antecipado, o Mercado Pago (metade Pix, metade cartão).
export function orderCosts(o, v = orderValue(o)) {
  const z = { product: 0, freight: 0, handling: 0, fees: 0, refusals: 0, returns: 0 };
  if (v.kind === "refused") return { ...z, refusals: -v.contribution };
  if (v.kind === "returned") return { ...z, returns: -v.contribution };
  if (v.kind !== "sale") return z;
  const cod = o.payment_method !== "prepay", n = Math.max(1, +o.units || 1), product = PRODUCT * n;
  const freight = cod ? DELIVERY : PREPAY_FREIGHT, handling = HANDLING;
  return { ...z, product, freight, handling, fees: v.revenue - v.contribution - product - freight - handling };
}

// Pedido feito: venda, recusa na porta ou devolução. É o "pedido" da conversão e da premissa de R$ 51,70 por pedido, que já desconta
// recusa e devolução, e o mesmo que a atribuição por anúncio conta. Antecipado não pago ou recusado e pedido cancelado antes de sair
// não são pedido. Faturamento continua só das vendas.
const PLACED = new Set(["sale", "refused", "returned"]);
export const placed = (v) => PLACED.has(v.kind);
const MIN = 60000;
const DELIVERED = /\bcomplet|(?<!nao )entregue/; // "Completo", nunca "Incompleto"
const share = (n, p) => (n == null || p == null ? null : Math.round((n * p) / 100));
const BRT = -3 * 3600000; // Brasil sem horário de verão desde 2019

// Uma linha por conversa, com as métricas de atendimento da Octadesk:
// 1ª resposta = 1ª mensagem dela → 1ª nossa depois dela (a saudação automática conta, como lá);
// atendimento = 1ª mensagem dela → nossa resposta à última mensagem dela (lembrete sem resposta não estica o tempo).
export function conversationTimes(messages) {
  const by = {};
  for (const m of messages) (by[m.conversation_id] ??= []).push({ out: m.direction === "outbound", at: at(m) });
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
  for (const m of D.messages) (by[leadOf[m.conversation_id] ?? m.conversation_id] ??= []).push({ out: m.direction === "outbound", at: at(m) });
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
    const os = (outs[c.id] || []).sort((a, b) => at(a) - at(b));
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
  // Critério comum do mercado (Octadesk, Woz Analytics): abandono e intervenção humana contam como resolvida, sobre todas as atendidas.
  // Aqui só para comparar na tela: a taxa do portal continua sendo a honesta (23/10).
  return { ...n, solved, resolution: pct(solved, closed), unresolved_rate: pct(n.unresolved, closed), market_resolution: pct(solved + n.abandoned + n.unresolved, n.attended) };
}
// Fixos do intervalo: só as cobranças que vencem nele (recarga da PikaPods, mensalidade do número), nunca rateio por dia (operador, 20/10).
function fixedCost(D, a, b) {
  return fixedDue(a, Math.min(b, D.now));
}
// Investido até agora, pelo que já saiu do cartão, recalculado a cada leitura: anúncio da Meta, IA e WhatsApp do banco, e os fixos
// pelas regras de cobrança de cada um. Resultado acumulado = soma do que cada pedido vale hoje − tudo o que foi investido.
function invested(D, all, now) {
  const pk = pikapods(now), wn = waNumber(now), live = !!D.meta?.daily, date = (s) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const rows = [
    { id: "pikapods", label: "PikaPods (n8n)", kind: "fixo", total: pk.paid, how: `${1 + pk.topUps} recarga(s) de US$ 10 × R$ 5,40 · saldo ~US$ ${pk.balance.toFixed(2).replace(".", ",")} · próxima recarga ~${date(pk.nextTopUp)}` },
    { id: "wa_number", label: "Número do WhatsApp", kind: "fixo", total: wn.paid, how: `R$ 55 no início + ${wn.payments} mensalidade(s) de R$ 35 · próxima ${date(wn.next)}` },
    { id: "ads", label: "Anúncios na Meta (imposto incluído)", kind: "variável", total: live ? all.spend ?? 0 : ADS_UNTIL_META, how: live ? "gasto da conta, ao vivo" : "Meta desligada: gasto de 20/10" },
    { id: "ai", label: "Modelo de IA (leads)", kind: "variável", total: all.ai_cost ?? 0, how: "toda chamada de modelo dos leads, ao vivo" },
    { id: "whatsapp", label: "API do WhatsApp", kind: "variável", total: all.wa_cost ?? 0, how: "R$ 0,04 por pedido (template de pós-venda)" },
  ];
  const total = sum(rows.map((r) => r.total)), contribution = sum(D.orders.map((o) => orderValue(o).contribution));
  return { rows, total, contribution, result: contribution - total };
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function getAll(table, { url, key, fixture } = {}) {
  if (fixture) return fixture[table] ?? [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    // Ordem fixa: sem ela, o Postgres pode repetir ou pular linhas entre páginas de 1000.
    const r = await fetch(`${url}/rest/v1/${table}?select=${TABLES[table] ?? PROFILES[table]}${ORDER[table] ? `&order=${ORDER[table]}` : ""}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw Object.assign(new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`), { status: r.status });
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// Rodada de personas do Ricos-com-AI (src/dev/persona-run-core.ts): passa pela turn de produção com telefones 5500099…
// e apaga o lead no fim. Sem este filtro a conversa aparecia no portal, recebia resposta do operador e sumia.
export const isSynthetic = (phone) => /^5500099/.test(String(phone ?? ""));
export function dropSynthetic(D) {
  const leads = new Set(D.leads.filter((l) => isSynthetic(l.phone)).map((l) => l.id));
  if (!leads.size) return D;
  const convs = new Set(D.conversations.filter((c) => leads.has(c.lead_id)).map((c) => c.id));
  D.leads = D.leads.filter((l) => !leads.has(l.id));
  D.conversations = D.conversations.filter((c) => !convs.has(c.id));
  for (const name of ["messages", "turn_outcomes", "llm_calls"]) if (D[name]) D[name] = D[name].filter((r) => !convs.has(r.conversation_id));
  if (D.orders) D.orders = D.orders.filter((o) => !leads.has(o.lead_id));
  return D;
}

export async function buildAll(opts, now = Date.now(), custom = null) {
  const D = {};
  // Em paralelo: em série, a soma das leituras deixava a função lenta e, quando ela falha, a tela de conversas fica sem dados.
  // As tabelas do Hermes são extras: se uma falhar, o portal segue sem a aba Hermes, como segue sem a Meta ou o n8n.
  await Promise.all(Object.keys(TABLES).map(async (name) => { D[name] = OPTIONAL.has(name) ? await getAll(name, opts).catch(() => []) : await getAll(name, opts); }));
  dropSynthetic(D);
  D.meta = await meta(opts, now).catch((e) => ({ error: String(e.message || e).slice(0, 200) }));
  const data = build(D, now, custom);
  data.global.goal = monthGoal(D.portal_settings.find((s) => s.key === "month_goal")?.value?.brl);
  const [automations, number] = await Promise.all([
    n8n(opts).catch((e) => ({ error: String(e.message || e).slice(0, 200) })),
    whatsappNumber(opts).catch((e) => ({ ok: false, error: String(e.message || e).slice(0, 200) })),
  ]);
  data.global.automations = automations;
  data.global.number = number;
  data.global.channel = channel(data.global.health.whatsapp, automations, number);
  data.global.health.number = !number ? { ok: null, detail: "não configurado" } : number.ok ? { ok: !/BANNED|RESTRICTED|FLAGGED|DISCONNECTED/.test(number.status || "") && number.quality !== "RED", detail: `${number.status || "—"} · qualidade ${number.quality || "—"}` } : { ok: false, detail: number.error };
  data.global.health.n8n = !automations ? { ok: null, detail: "não configurado" } : automations.error ? { ok: false, detail: automations.error } : { ok: true, detail: `${automations.workflows.filter((w) => w.active).length} workflows ativos` };
  return { data, D };
}

// Estado do número a partir do que se vê (antes era texto fixo e o critério de pausa ficava sempre verde): erro no workflow
// "WhatsApp envio" entre as últimas execuções ou nenhuma mensagem da Malu em 3 dias. Erro pode ser um número só (atenção, não pausa).
// Desde 23/10, com a leitura da Meta (lib/whatsapp.mjs): número restrito, banido ou com qualidade baixa pausa; qualidade média é atenção.
export function channel(whatsapp, automations, number) {
  const bad = number?.ok && (/BANNED|RESTRICTED|FLAGGED|DISCONNECTED|RATE_LIMITED/.test(number.status || "") || number.quality === "RED");
  if (bad) return { ...CHANNEL, number: `Meta: ${number.status === "CONNECTED" || !number.status ? "qualidade baixa" : number.status.toLowerCase()}`, status: "bad", ...numberFacts(number) };
  const facts = number?.ok ? numberFacts(number) : {};
  if (number?.ok && number.quality === "YELLOW") return { ...CHANNEL, number: "Meta: qualidade média, atenção ao que está sendo enviado", status: "warn", ...facts };
  const envio = automations?.workflows?.find((w) => /whatsapp envio/i.test(w.name));
  if (envio?.errors) return { ...CHANNEL, number: `Envio com erro: ${envio.errors} entre as últimas execuções do n8n`, status: "warn", ...facts };
  if (whatsapp?.ok === false) return { ...CHANNEL, number: "Nenhuma mensagem da Malu há mais de 3 dias", status: "warn", ...facts };
  if (whatsapp?.ok) return { ...CHANNEL, number: "Enviando, sem erro nas últimas execuções", status: "ok", ...facts };
  return { ...CHANNEL, status: null, ...facts };
}
// Cloud API e templates pelo que a Meta devolveu, no lugar do texto manual.
const numberFacts = (n) => ({ cloud_api: n.status === "CONNECTED" ? "Operando" : n.status, ...(n.templates ? { templates: `${n.templates.filter((x) => x.status === "APPROVED").length} aprovados` } : {}) });

// Orçamento diário dos anúncios ativos (Meta): o da campanha (orçamento na campanha) ou a soma dos conjuntos ativos.
// Orçamento total de conjunto com início e fim entra dividido pelos dias; orçamento total de campanha não tem data e fica fora.
export function adBudget(m, now) {
  if (!m || m.error) return null;
  // Conjunto ativo e ainda no prazo: a Meta mantém ACTIVE depois do fim, mas ele não gasta mais.
  const on = (x) => x.status === "ACTIVE", sets = m.adsets.filter((s) => on(s) && !(s.end && t(s.end) <= now));
  let daily = 0;
  for (const c of m.campaigns.filter(on)) {
    const mine = sets.filter((x) => x.campaign_id === c.id);
    if (!mine.length) continue; // campanha sem conjunto rodando não gasta, nem com orçamento na campanha
    if (c.daily_budget) { daily += c.daily_budget; continue; }
    for (const s of mine) {
      if (s.daily_budget) daily += s.daily_budget;
      else if (s.lifetime_budget && s.start && s.end) daily += s.lifetime_budget / Math.max(1, (t(s.end) - t(s.start)) / DAY);
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
  // As 300 mais recentes (última execução de cada workflow) e, se a última hora tiver mais que isso, até cobrir a hora (teto de 2000).
  const runs = [], hourAgo = Date.now() - 3_600_000;
  for (let cursor = "", i = 0; i < 20; i++) {
    const page = await get(`executions?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    runs.push(...page.data);
    if (!page.nextCursor || (i >= 2 && t(runs.at(-1).startedAt) < hourAgo)) break;
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
    workflows, read: runs.length, hour: runs.filter((r) => t(r.startedAt) >= hourAgo).length,
    runs: runs.slice(0, 60).map((r) => ({ workflow: names[r.workflowId] ?? r.workflowId, status: r.status, mode: r.mode, at: r.startedAt, ms: r.stoppedAt ? t(r.stoppedAt) - t(r.startedAt) : null })),
  };
}

// Venda por versão (23/10): quantas conversas da versão terminaram em pedido.
const pickOutcome = (o) => ({ conversations: o.attended, resolution: o.resolution, unresolved: o.unresolved, abandoned: o.abandoned, bought: o.bought, conversion: pct(o.bought, o.attended) });
const t = (s) => new Date(s).getTime();
// Carimbo de criação já convertido, guardado na própria linha (Symbol: não vai para o JSON). Cada período soma dezenas de janelas
// e cada janela filtra leads, conversas, pedidos e chamadas de modelo: converter a mesma data de novo em cada uma era o grosso do tempo.
const AT = Symbol("at");
const at = (r) => r[AT] ??= t(r.created_at);
const START = (r) => r.start;
// As linhas de [a, b) pelo carimbo, numa cópia ordenada guardada por tabela: busca binária em vez de varrer a tabela em cada janela.
const SORTED = new WeakMap();
function win(rows, a, b, key = at) {
  let s = SORTED.get(rows);
  if (!s) { s = { rows: [...rows].sort((x, y) => key(x) - key(y)), key }; s.ts = s.rows.map(key); SORTED.set(rows, s); }
  const lo = (v) => { let i = 0, j = s.ts.length; while (i < j) { const m = (i + j) >> 1; if (s.ts[m] < v) i = m + 1; else j = m; } return i; };
  return s.rows.slice(lo(a), lo(b));
}
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
// Margem operacional = (soma do que cada pedido vale − anúncio − API − fixos) ÷ faturamento: a média ponderada de todos os pedidos.
// ROI = margem dos pedidos ÷ (anúncio + API), sem os fixos (operador, 20/10).
function profit(contribution, revenue, api, fixed, spend) {
  if (spend == null) return { gross_profit: revenue || contribution ? contribution : null }; // recusa sem venda também aparece
  const variable = spend + api, net = contribution - variable - fixed;
  return { gross_profit: contribution, net_profit: net, op_margin: pct(net, revenue), roi: variable > 0 ? contribution / variable : null };
}

const carts = (D, a, b) => (D.cartLeads ??= D.leads.filter((l) => l.cart_at && Number.isFinite(t(l.cart_at)))).filter((l) => inWin(t(l.cart_at), a, b));

// Quando as clientes compram (operador, 04/11): pedidos feitos por dia da semana (0 = domingo) e faixa de 3 h, no horário de Brasília.
export function buyHeat(orders) {
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 8 }, () => ({ n: 0, revenue: 0 })));
  for (const o of orders) { const d = new Date(at(o) + BRT), c = heat[d.getUTCDay()][Math.floor(d.getUTCHours() / 3)]; c.n++; c.revenue += +o.amount_brl || 0; }
  return heat;
}

// Funil do site (operador, 04/11): visitas que começaram na janela, quantas viram o produto e quantas abriram o checkout, por aparelho;
// o pedido é o pedido feito de origem Site na janela (a Coinzz não liga o pedido à visita, então só existe no total).
function siteFunnel(D, a, b, orders) {
  const S = win(D.site_sessions, a, b), of = (xs) => ({ visits: xs.length, product: xs.filter((s) => s.product_at).length, checkout: xs.filter((s) => s.checkout_at).length });
  return { all: { ...of(S), orders }, phone: of(S.filter((s) => s.device === "phone")), desktop: of(S.filter((s) => s.device !== "phone")) };
}

function windowMetrics(D, a, b) {
  const L = win(D.leads, a, b);
  const CV = win(D.conversations, a, b);
  const inbound = (D.inbound ??= D.messages.reduce((m, x) => { if (x.direction === "inbound") m[x.conversation_id] = (m[x.conversation_id] || 0) + 1; return m; }, {}));
  const OV = win(D.orders, a, b).map((r) => ({ ...r, v: orderValue(r) }));
  const O = OV.filter((r) => r.v.kind === "sale"), OP = OV.filter((r) => placed(r.v));
  const dayOf = (r) => t(`${r.day}T12:00:00Z`);
  const TO = D.eval_turn_outcomes.filter((r) => inWin(dayOf(r), a, b));
  const GB = D.eval_gate_blocks.filter((r) => inWin(dayOf(r), a, b));
  const turns = sum(TO.map((r) => +r.turns));
  const CT = win(D.times ??= conversationTimes(D.messages), a, b, START);
  const oc = outcomeCounts(win(D.status ??= conversationStatus(D, D.now), a, b, START));
  const revenue = sum(O.map((r) => r.v.revenue)), contribution = sum(OV.map((r) => r.v.contribution));
  // IA = toda chamada de modelo dos leads (llm_calls, já em reais), sem personas nem Hermes (operador, 20/10); WhatsApp = template de pós-venda por pedido.
  const ai = sum(win(D.llm_calls, a, b).map((r) => +r.cost_brl || 0));
  const wa = OP.length * WA_PER_ORDER, api = ai + wa, fixed = fixedCost(D, a, b);
  // Por lead = toda a IA do intervalo (inclusive áudio e imagem, que não têm conversa) ÷ leads que chegaram nele.
  const ad = ads(D, a, b), apiPerLead = L.length ? ai / L.length : null;
  const delivered = O.filter((r) => DELIVERED.test(norm(r.status))).length;
  return clean({
    leads: L.length,
    orders: OP.length,
    revenue,
    conversion: pct(OP.length, L.length),
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
    ai_cost: ai,
    wa_cost: wa,
    fixed_cost: fixed,
    invalid_premise: premise(D.hermes_runs, a, b),
    // Checkout abandonado (operador, 04/11): lead que largou o checkout da Coinzz no intervalo; recuperado = fez pedido depois.
    carts_abandoned: carts(D, a, b).length,
    carts_recovered: carts(D, a, b).filter((l) => (D.ordersByLead[l.id] || []).some((o) => at(o) >= t(l.cart_at))).length,
    leads_ad: L.filter((r) => D.origin[r.id] !== "organic").length,
    leads_whatsapp: L.filter((r) => D.origin[r.id] === "whatsapp").length,
    leads_site: L.filter((r) => D.origin[r.id] === "site").length,
    leads_organic: L.filter((r) => D.origin[r.id] === "organic").length,
    delivered_orders: delivered,
    delivered: pct(delivered, OP.length),
    prepaid_share: pct(OP.filter((r) => r.payment_method === "prepay").length, OP.length),
    op_cost: OP.length ? revenue - contribution : null, // tudo o que sai do faturamento antes de anúncio e API
    // Quanto custa trazer um pedido (23/10): anúncio + IA + WhatsApp ÷ pedidos feitos; e só a IA ÷ pedidos.
    cost_per_order: OP.length && ad.spend != null ? (ad.spend + api) / OP.length : null,
    ai_per_order: OP.length ? ai / OP.length : null,
    ...ad,
    // Recusa = recusados ÷ (recusados + entregues) na entrega; pedido ainda em rota não entra (igual à tela de Pedidos).
    refusal: pct(OV.filter((r) => r.v.kind === "refused").length, OV.filter((r) => r.payment_method !== "prepay" && (r.v.kind === "refused" || (r.v.kind === "sale" && DELIVERED.test(norm(r.status))))).length),
    ...profit(contribution, revenue, api, fixed, D.meta?.daily ? ad.spend : null),
  });
}

// Campanhas, conjuntos e anúncios com as métricas da janela. Leads e pedidos por anúncio: os leads que entraram na janela pelo anúncio
// (source_id do clique, gravado no primeiro toque), quantos deles têm pedido e quantos foram entregues e pagos — a mesma conta da view
// eval_attribution do Ricos-com-AI, mas com janela, para o gasto e o pedido falarem do mesmo intervalo (03/11).
export function adAttribution(D, a, b) {
  const ordered = new Set(D.orders.map((o) => o.lead_id)), delivered = new Set(D.conversations.filter((c) => c.stage === "entregue_pago").map((c) => c.lead_id));
  const att = {};
  for (const l of D.leads) {
    if (!l.ad || !inWin(at(l), a, b)) continue;
    const x = (att[l.ad] ??= { leads: 0, leads_ordered: 0, leads_delivered: 0 });
    x.leads++; if (ordered.has(l.id)) x.leads_ordered++; if (delivered.has(l.id)) x.leads_delivered++;
  }
  return att;
}
function metaWindow(D, a, b) {
  const m = D.meta;
  if (!m || m.error) return m;
  const per = adTotals(m.daily, a, b), att = adAttribution(D, a, b);
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
    ab: { site_orders: siteOrders(D, a, b, m.adsets) },
  };
}

// Pedidos do conjunto Site no teste A/B (03/11). O webhook de venda da Coinzz não traz UTM (exemplo real de 09/10), então o braço sai
// do lead do pedido: com a marca do clique no anúncio de WhatsApp (ctwa_clid) é do WhatsApp; sem ela, veio pelo site. Conta só os pedidos
// feitos desde que o primeiro conjunto Site começou; sem conjunto Site com início, null ("sem leitura").
// shortcut: venda orgânica do site no mesmo intervalo também conta como Site; gravar a UTM no pedido se a Coinzz passar a mandá-la.
export function siteOrders(D, a, b, adsets = []) {
  const starts = adsets.filter((s) => armOf(s) === "site" && s.start).map((s) => t(s.start));
  if (!starts.length) return null;
  const from = Math.max(a, Math.min(...starts)), ctwa = new Set(D.leads.filter((l) => l.ctwa).map((l) => l.id));
  return D.orders.filter((o) => inWin(at(o), from, b) && placed(orderValue(o)) && !ctwa.has(o.lead_id)).length;
}

// Conversão por estado (UF que a cobertura gravou no lead): leads e pedidos criados na janela. Lead sem CEP fica em "sem estado".
function byState(D, a, b) {
  const uf = Object.fromEntries(D.leads.map((l) => [l.id, l.state || "sem estado"])), out = {};
  for (const l of D.leads) if (inWin(at(l), a, b)) (out[uf[l.id]] ??= { state: uf[l.id], leads: 0, orders: 0 }).leads++;
  for (const o of D.orders) if (inWin(at(o), a, b) && placed(orderValue(o))) (out[uf[o.lead_id] || "sem estado"] ??= { state: uf[o.lead_id] || "sem estado", leads: 0, orders: 0 }).orders++;
  return Object.values(out).map((x) => ({ ...x, conversion: pct(x.orders, x.leads) })).sort((x, y) => y.leads - x.leads);
}

// Critério de pausa: das últimas 100 conversas, % com mais de R$ 1,00 de modelo.
function apiOver(rows) {
  const last = [...rows].sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 100);
  return last.length ? pct(last.filter((r) => +r.cost_brl > 1).length, last.length) : null;
}

// Origem do lead (operador, 04/11): WhatsApp = clique num anúncio de WhatsApp (ctwa_clid, ou anúncio de conjunto que não é Site);
// Site = anúncio de um conjunto Site (destino WEBSITE na Meta); Orgânico = todo lead que não veio de anúncio.
export function leadOrigins(D) {
  const siteSets = new Set((D.meta?.adsets || []).filter((x) => armOf(x) === "site").map((x) => x.id));
  const siteAds = new Set((D.meta?.ads || []).filter((a) => siteSets.has(a.adset_id)).map((a) => a.id));
  return Object.fromEntries(D.leads.map((l) => [l.id, l.ad && siteAds.has(l.ad) ? "site" : l.ctwa || l.ad ? "whatsapp" : "organic"]));
}
// Origem do pedido: a do lead. Pedido sem lead (comprou no site sem conversar) é Site.
const orderOrigin = (D, o) => (o.lead_id && D.origin[o.lead_id]) || "site";

export function build(D, now, custom = null) {
  for (const name of OPTIONAL) D[name] ??= [];
  D.now = now;
  D.origin = leadOrigins(D);
  D.ordersByLead = {};
  for (const o of D.orders) (D.ordersByLead[o.lead_id] ??= []).push(o);
  const out = {};
  const ranges = Object.entries(BUCKETS).map(([id, [n, days]]) => ({ id, n, days, start: now - n * days * DAY, end: now }));
  if (custom) ranges.push({ id: custom.id, n: custom.n, days: custom.days, start: custom.from, end: custom.to });
  for (const { id: period, n, days, start, end } of ranges) {
    const span = end - start, step = days * DAY;
    // Linha tracejada dos gráficos (operador, 04/11): de 6 meses para cima, o mesmo período do ano anterior; abaixo, o período anterior.
    const shift = span >= 180 * DAY ? 365 * DAY : span;
    const cur = windowMetrics(D, start, end), prev = windowMetrics(D, start - span, start);
    const bucket = (i, k = 0) => windowMetrics(D, start + i * step - k, Math.min(end, start + (i + 1) * step) - k);
    const series = Array.from({ length: n }, (_, i) => bucket(i)), before = Array.from({ length: n }, (_, i) => bucket(i, shift));
    const metrics = {};
    for (const id of Object.keys(cur)) {
      if (["api_cost", "ai_cost", "wa_cost"].includes(id)) continue;
      const s = series.map((m) => m[id] ?? null), c = before.map((m) => m[id] ?? null);
      metrics[id] = { value: cur[id], ...(prev[id] != null ? { previous: prev[id] } : {}), ...(s.filter((v) => v != null).length > 1 ? { series: s } : {}), ...(c.filter((v) => v != null).length > 1 ? { compare: c } : {}) };
    }
    const hourly = Array(24).fill(0);
    for (const m of win(D.messages, start, end)) if (m.direction === "inbound") hourly[new Date(at(m) + BRT).getUTCHours()]++;
    const rows = win(D.status, start, end, START);
    const gaps = {};
    for (const r of rows) for (const g of r.reasons) { const x = (gaps[g.reason] ??= { reason: g.reason, count: 0, conversations: new Set(), last: 0, version: null }); x.count++; x.conversations.add(r.id); if (g.at > x.last) { x.last = g.at; x.version = g.version; } }
    const conversations = rows.sort((x, y) => y.start - x.start).slice(0, 200).map(({ reasons, ...r }) => ({ ...r, id: r.id.slice(0, 8), reason: reasons.at(-1)?.reason ?? null }));
    const perDay = cur.api_cost / (span / DAY);
    const metaOut = metaWindow(D, start, end);
    const states = byState(D, start, end);
    const inPeriod = D.orders.filter((o) => inWin(at(o), start, end)).map((o) => ({ ...o, v: orderValue(o) })).filter((o) => placed(o.v));
    const mix = { cod: inPeriod.filter((o) => o.payment_method !== "prepay").length, prepay: inPeriod.filter((o) => o.payment_method === "prepay").length,
      units: [1, 2, 3].map((n) => inPeriod.filter((o) => (Math.max(1, +o.units || 1) >= 3 ? 3 : Math.max(1, +o.units || 1)) === n).length),
      contribution: cur.gross_profit ?? null,
      channel: Object.fromEntries(["whatsapp", "site", "organic"].map((k) => [k, inPeriod.filter((o) => orderOrigin(D, o) === k).length])) };
    const costs = inPeriod.reduce((x, o) => { const c = orderCosts(o, o.v); for (const k in c) x[k] = (x[k] || 0) + c[k]; return x; }, {});
    const fixed = fixedPayments(start, Math.min(end, now)).reduce((x, f) => ({ ...x, [f.id]: (x[f.id] || 0) + f.brl }), { pikapods: 0, wa_number: 0 });
    const site = siteFunnel(D, start, end, inPeriod.filter((o) => orderOrigin(D, o) === "site").length);
    out[period] = { compare: shift === span ? "previous" : "year", heat: buyHeat(inPeriod), site, metrics, hourly, outcomes: outcomeCounts(rows), conversations, meta: metaOut, states, mix,
      gaps: Object.values(gaps).map((x) => ({ ...x, conversations: x.conversations.size, last: new Date(x.last).toISOString() })).sort((x, y) => y.count - x.count),
      money: { costs, fixed_parts: fixed, ads_tax: cur.spend == null ? null : cur.spend - cur.spend / (1 + META_TAX), revenue: cur.revenue, ads: cur.spend ?? null, ai: cur.ai_cost, whatsapp: cur.wa_cost, fixed: cur.fixed_cost, api_cost: cur.api_cost, api_per_day: perDay, api_30d: perDay * 30 } };
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
    // Gasto médio por dia com anúncios nos últimos 7 dias (Meta): a base do critério de pausa do caixa (operador, 20/10).
    ad_spend_day: D.meta?.daily ? (out.week.metrics.spend?.value ?? 0) / 7 : null,
    months: salesByMonth(D, now), month_days_left: Math.max(1, Math.ceil((monthStart(now, 1) - now) / DAY)),
    sales60: ((c, p) => ({ revenue: c.revenue ?? 0, orders: c.orders ?? 0, prev_revenue: p.revenue ?? 0, prev_orders: p.orders ?? 0 }))(windowMetrics(D, now - 60 * DAY, now), windowMetrics(D, now - 120 * DAY, now - 60 * DAY)),
    chats: chats(D, now), orders: ordersList(D), health: health(D, now), hermes: hermes(D), invested: invested(D, all, now),
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
const RANK = ["bought", "unresolved", "declined", "open", "abandoned"]; // a mesma precedência de conversationStatus
export function chats(D, now) {
  const lead = Object.fromEntries(D.leads.map((l) => [l.id, l])), st = Object.fromEntries((D.status ??= conversationStatus(D, now)).map((r) => [r.id, r]));
  const msgs = {};
  for (const m of D.messages) (msgs[m.conversation_id] ??= []).push({ out: m.direction === "outbound", op: String(m.external_id || "").startsWith("human:") || undefined, text: m.body ?? "", at: m.created_at, ...mediaOf(m) });
  const outs = {};
  for (const o of D.turn_outcomes) (outs[o.conversation_id] ??= []).push(o);
  const orders = {};
  for (const o of D.orders) (orders[o.lead_id] ??= []).push(o);
  const last = (c) => Math.max(t(c.last_inbound_at || 0), t(c.last_outbound_at || 0), t(c.created_at));
  const byLead = {};
  for (const c of D.conversations) (byLead[c.lead_id ?? c.id] ??= []).push(c);
  const rows = Object.values(byLead).map((cs) => { cs.sort((a, b) => at(a) - at(b)); cs.last = Math.max(...cs.map(last)); return cs; });
  return rows.sort((a, b) => b.last - a.last).slice(0, 150).map((cs) => {
    const c = cs.at(-1), l = lead[c.lead_id] || {}, s = st[c.id] || {}, os = cs.flatMap((x) => outs[x.id] || []);
    return {
      id: c.id, ids: cs.map((x) => x.id), short: c.id.slice(0, 8), name: l.name || null, phone: l.phone ? `…${String(l.phone).slice(-4)}` : null, state: l.state || null, size: l.size || null,
      origin: l.ctwa ? "anúncio" : "orgânico", stage: c.stage, status: cs.map((x) => st[x.id]?.status).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] || null, version: s.version ?? null, cost: sum(cs.map((x) => +x.cost_brl || 0)), last: new Date(cs.last).toISOString(),
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

// Mídia da mensagem para a tela: só o tipo e o id da linha; a imagem vem por api/media.js (login), nunca o id da Meta no navegador.
const MEDIA_KINDS = new Set(["image", "audio", "video", "document", "sticker"]);
function mediaOf(m) {
  const x = m.media;
  if (!x || typeof x !== "object" || !MEDIA_KINDS.has(x.kind) || !(x.id || /^https:\/\//.test(x.url || ""))) return {};
  return { media: { kind: x.kind, mid: m.id } };
}

// Hermes (supervisor offline, Ricos-com-AI › hermes/): rodadas, propostas com motivo e evidência, e o que foi publicado.
const HERMES_EVERY = 50; // uma rodada a cada 50 leads novos (R6.2)
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

// Painel do protótipo (04/11, dashboard-portal-references/): vendas por mês, meta do mês e clientes com segmento, contados aqui no servidor.
// Mês de Brasília: o início do mês k meses depois do mês de ts.
export const monthStart = (ts, k = 0) => { const d = new Date(ts + BRT); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) - BRT; };

// Meta de faturamento do mês (operador, 04/11): portal_settings.month_goal, editada na Home. Só número positivo vira meta; sem ela, null.
export const monthGoal = (raw) => { const n = Number(String(raw ?? "").trim()); return raw != null && String(raw).trim() !== "" && Number.isFinite(n) && n > 0 ? n : null; };

// Os últimos n meses de calendário: faturamento (só venda) e pedidos feitos, para a tabela mês a mês contra o ano anterior e a meta do mês.
export function salesByMonth(D, now, n = 24) {
  const OV = D.orders.map((o) => ({ ts: at(o), v: orderValue(o) }));
  return Array.from({ length: n }, (_, i) => {
    const a = monthStart(now, i - n + 1), b = monthStart(now, i - n + 2), xs = OV.filter((x) => inWin(x.ts, a, b));
    return { month: new Date(a - BRT).toISOString().slice(0, 7), revenue: sum(xs.filter((x) => x.v.kind === "sale").map((x) => x.v.revenue)), orders: xs.filter((x) => placed(x.v)).length };
  });
}

// Pedidos para o terminal e a agenda de entregas: todos (operador, 04/11), do mais novo ao mais antigo, com o que cada um vale hoje.
function ordersList(D) {
  const lead = Object.fromEntries(D.leads.map((l) => [l.id, l]));
  return [...D.orders].sort((a, b) => t(b.created_at) - t(a.created_at)).map((o) => {
    const v = orderValue(o), s = norm(o.status), l = lead[o.lead_id] || {};
    const step = v.kind === "returned" ? "returned" : v.kind === "refused" ? "refused" : v.kind === "void" ? "void" : v.kind === "unpaid" ? "unpaid"
      : DELIVERED.test(s) ? "delivered" : /rota|caminho|envi|transit|transporte|postado|saiu/.test(s) ? "en_route" : "created";
    return { id: String(o.external_id || o.id).slice(0, 12), lead: String(o.lead_id || "").slice(0, 8), name: l.name || null, state: l.state || null, status: o.status, step, channel: orderOrigin(D, o), method: o.payment_method, units: Math.max(1, +o.units || 1),
      size: o.size, amount: +o.amount_brl || 0, value: v.contribution, created: o.created_at, updated: o.updated_at, scheduled: o.scheduled_for };
  });
}

// Estado de cada fonte, para a tela de integrações e o selo do topo.
function health(D, now) {
  const lastOut = D.messages.filter((m) => m.direction === "outbound").map(at).sort((a, b) => b - a)[0];
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

