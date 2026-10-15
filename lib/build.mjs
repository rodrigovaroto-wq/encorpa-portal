// Lógica compartilhada: gera os dados do portal a partir do Supabase.
// Lê só views agregadas (eval_*) e carimbos de data de leads/pedidos/mensagens: nenhum nome, telefone, endereço, CPF ou texto de conversa.
export const TABLES = {
  leads: "created_at,handoff_at,opted_out_at",
  orders: "created_at,amount_brl,status",
  eval_turn_outcomes: "day,turns,sent,fallbacks,handoffs,avg_rewrites,cost_brl",
  eval_gate_blocks: "day,gate,checks,blocks",
  eval_conversation_cost: "day,cost_brl",
  eval_version_outcomes: "agent_version,turns,fallbacks,handoffs,avg_rewrites,cost_brl",
  // shortcut: lê os carimbos de todas as mensagens a cada 30 min; com milhares de conversas, trocar por uma view eval_* agregada.
  messages: "conversation_id,direction,created_at",
  conversations: "id,stage,last_inbound_at,last_outbound_at,created_at",
  // `reason` é texto interno do código (porta do aviso, gate que vetou), nunca mensagem dela; o portal guarda só o trecho antes de ":".
  turn_outcomes: "conversation_id,outcome,reason,agent_version,created_at",
};
const NOT_SALE = new Set(["cancelled", "canceled", "cancelado", "expired", "expirado", "refused", "recusado"]);
const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };
const CHANNEL = { number: "Ligado e testado (06/10)", cloud_api: "Operando", window: "—", templates: "Aprovados (09/10)" }; // manual: ajuste quando mudar
const DAY = 86400000;
const MIN = 60000;
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
// Desfecho de cada conversa. Melhor que o "resolvida" da Octadesk, que soma abandono e intervenção humana:
// aqui abandono fica à parte, e conversa em que a Malu avisou o operador (R22.1) é "não resolvida".
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
    const last = Math.max(t(c.last_inbound_at || 0), t(c.last_outbound_at || 0), t(c.created_at));
    const status = BOUGHT.has(c.stage) ? "bought" : fails.length ? "unresolved" : DECLINED.has(c.stage) || os.some((o) => o.outcome === "opted_out") ? "declined" : now - last < DAY ? "open" : "abandoned";
    const version = [...os].reverse().find((o) => o.agent_version != null)?.agent_version ?? null;
    return { id: c.id, start: t(c.created_at), stage: c.stage, status, version, messages: msgs[c.id] || 0, first_response: times[c.id]?.first_response ?? null, reasons: fails.map((o) => ({ reason: gist(o.reason), at: t(o.created_at), version: o.agent_version })) };
  });
}
// Contagem por desfecho e as duas taxas: a nossa (resolvidas ÷ encerradas) e a da Octadesk (resolvidas + abandonadas ÷ atendidas), para comparar com o mercado.
export function outcomeCounts(rows) {
  const n = { attended: rows.length, bought: 0, declined: 0, unresolved: 0, abandoned: 0, open: 0 };
  for (const r of rows) n[r.status]++;
  const solved = n.bought + n.declined, closed = n.attended - n.open;
  return { ...n, solved, resolution: pct(solved, closed), market_rate: pct(solved + n.abandoned, n.attended), unresolved_rate: pct(n.unresolved, closed) };
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function getAll(table, { url, key, fixture } = {}) {
  if (fixture) return fixture[table] ?? [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${TABLES[table]}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function buildAll(opts, now = Date.now()) {
  const D = {};
  for (const name of Object.keys(TABLES)) D[name] = await getAll(name, opts);
  return { data: build(D, now), D };
}

const pickOutcome = (o) => ({ conversations: o.attended, resolution: o.resolution, unresolved: o.unresolved, abandoned: o.abandoned });
const t = (s) => new Date(s).getTime();
const inWin = (ts, a, b) => ts >= a && ts < b;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !Number.isNaN(v)));

function windowMetrics(D, a, b) {
  const L = D.leads.filter((r) => inWin(t(r.created_at), a, b));
  const O = D.orders.filter((r) => inWin(t(r.created_at), a, b) && !NOT_SALE.has(String(r.status).toLowerCase()));
  const dayOf = (r) => t(`${r.day}T12:00:00Z`);
  const TO = D.eval_turn_outcomes.filter((r) => inWin(dayOf(r), a, b));
  const GB = D.eval_gate_blocks.filter((r) => inWin(dayOf(r), a, b));
  const CC = D.eval_conversation_cost.filter((r) => inWin(dayOf(r), a, b));
  const turns = sum(TO.map((r) => +r.turns));
  const CT = (D.times ??= conversationTimes(D.messages)).filter((r) => inWin(r.start, a, b));
  const oc = outcomeCounts((D.status ??= conversationStatus(D, D.now)).filter((r) => inWin(r.start, a, b)));
  return clean({
    leads: L.length,
    orders: O.length,
    revenue: sum(O.map((r) => +r.amount_brl || 0)),
    conversion: pct(O.length, L.length),
    handoff: oc.unresolved_rate,
    transfers: oc.attended ? oc.unresolved : null,
    resolution: oc.resolution,
    market_rate: oc.market_rate,
    first_response: avg(CT.map((r) => r.first_response).filter((v) => v != null)),
    handle_time: avg(CT.map((r) => r.handle_time)),
    optout: pct(L.filter((r) => r.opted_out_at).length, L.length),
    fallback: pct(sum(TO.map((r) => +r.fallbacks)), turns),
    rewrites: turns > 0 ? sum(TO.map((r) => (+r.avg_rewrites || 0) * +r.turns)) / turns : null,
    api_per_lead: CC.length ? sum(CC.map((r) => +r.cost_brl)) / CC.length : null,
    gate_blocks: pct(sum(GB.map((r) => +r.blocks)), sum(GB.map((r) => +r.checks))),
    api_cost: sum(TO.map((r) => +r.cost_brl)),
  });
}

export function build(D, now) {
  D.now = now;
  const out = {};
  for (const [period, [n, days]] of Object.entries(BUCKETS)) {
    const span = n * days * DAY, step = days * DAY, start = now - span;
    const cur = windowMetrics(D, start, now), prev = windowMetrics(D, start - span, start);
    const series = Array.from({ length: n }, (_, i) => windowMetrics(D, start + i * step, start + (i + 1) * step));
    const metrics = {};
    for (const id of Object.keys(cur)) {
      if (id === "api_cost") continue;
      const s = series.map((m) => m[id]);
      metrics[id] = { value: cur[id], ...(prev[id] != null ? { previous: prev[id] } : {}), ...(s.filter((v) => v != null).length > 1 ? { series: s.map((v) => v ?? 0) } : {}) };
    }
    const hourly = Array(24).fill(0);
    for (const m of D.messages) { const at = t(m.created_at); if (m.direction === "inbound" && inWin(at, start, now)) hourly[new Date(at + BRT).getUTCHours()]++; }
    const rows = D.status.filter((r) => inWin(r.start, start, now));
    const gaps = {};
    for (const r of rows) for (const g of r.reasons) { const x = (gaps[g.reason] ??= { reason: g.reason, count: 0, conversations: new Set(), last: 0, version: null }); x.count++; x.conversations.add(r.id); if (g.at > x.last) { x.last = g.at; x.version = g.version; } }
    const conversations = rows.sort((x, y) => y.start - x.start).slice(0, 200).map(({ reasons, ...r }) => ({ ...r, id: r.id.slice(0, 8), reason: reasons.at(-1)?.reason ?? null }));
    const perDay = cur.api_cost / (span / DAY);
    out[period] = { metrics, hourly, outcomes: outcomeCounts(rows), conversations,
      gaps: Object.values(gaps).map((x) => ({ ...x, conversations: x.conversations.size, last: new Date(x.last).toISOString() })).sort((x, y) => y.count - x.count),
      money: { revenue: cur.revenue, api_cost: cur.api_cost, api_per_day: perDay, api_30d: perDay * 30 } };
  }
  const all = windowMetrics(D, 0, now + DAY);
  const byVersion = {};
  for (const r of D.status) if (r.version != null) (byVersion[r.version] ??= []).push(r);
  const versions = D.eval_version_outcomes.map((r) => ({ version: `v${r.agent_version}`, ...pickOutcome(outcomeCounts(byVersion[r.agent_version] || [])), turns: +r.turns, handoff: pct(+r.handoffs, +r.turns), fallback: pct(+r.fallbacks, +r.turns), rewrites: +r.avg_rewrites, cost: +r.cost_brl })).sort((a, b) => parseInt(a.version.slice(1)) - parseInt(b.version.slice(1)));
  const g = {};
  for (const r of D.eval_gate_blocks) { g[r.gate] ??= { gate: r.gate, checks: 0, blocks: 0 }; g[r.gate].checks += +r.checks; g[r.gate].blocks += +r.blocks; }
  const gates = Object.values(g).map((x) => ({ ...x, rate: pct(x.blocks, x.checks) ?? 0 })).sort((a, b) => b.blocks - a.blocks || b.checks - a.checks);
  for (const p of Object.values(out)) {
    Object.assign(p, {
      updated: new Date(now).toISOString(),
      note: "Dados do Supabase (views eval_*, leads e pedidos). Incluem as conversas de teste do operador e de amigos até a primeira venda real. Anúncio (gasto, CPL, ROI) ainda não está ligado.",
      totals: { leads: all.leads, orders: all.orders },
      funnel: { first_msg: all.leads, order: all.orders },
      channel: CHANNEL, versions, gates,
    });
  }
  return out;
}

