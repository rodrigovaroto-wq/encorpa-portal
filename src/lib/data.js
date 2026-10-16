// Dados do portal. Ordem: /api/data ao vivo (Vercel) → último retrato bom guardado neste navegador → data.js (cópia estática).
// Formato: { updated, global: {...}, periods: { day, week, month, 3m, 6m, 9m, 12m } } (lib/build.mjs › build).
import { ALL, BUCKETS, RANGE, SUMMED, OUTCOMES, PAUSE, DECISION } from "./constants.js";
import { fmt, store } from "./format.js";

const CACHE = "last:portal";

export async function loadData() {
  if (location.protocol !== "file:") {
    try {
      const r = await fetch("/api/data", { cache: "no-store", credentials: "same-origin" });
      if (r.ok) {
        const data = await r.json();
        if (data?.periods) { store.set(CACHE, JSON.stringify(data)); return { ...data, source: "live" }; }
      }
    } catch { /* sem função: cai no retrato */ }
  }
  try {
    const cached = JSON.parse(store.get(CACHE) || "null");
    if (cached?.periods) return { ...cached, source: "cache" };
  } catch { /* retrato corrompido: segue para o data.js */ }
  await loadScript(`data.js?t=${Date.now()}`);
  return window.PORTAL_DATA?.periods ? { ...window.PORTAL_DATA, source: "file" } : null;
}

function loadScript(src) {
  return new Promise((done) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = s.onerror = () => { s.remove(); done(); };
    document.head.appendChild(s);
  });
}

// Critérios de pausa do teste, calculados das métricas.
export function computePause(p, g) {
  const v = (id) => p.metrics?.[id]?.value;
  const lvl = (x, warn, bad) => (x == null ? "" : x > bad ? "bad" : x > warn ? "warn" : "ok");
  const row = (x, s, u) => (x == null ? undefined : { value: fmt(x, u), status: s });
  return {
    p_premise: row(v("invalid_premise"), lvl(v("invalid_premise"), 4, 5), "pct"),
    p_handoff: row(v("handoff"), lvl(v("handoff"), 8, 10), "pct"),
    p_optout: row(v("optout"), lvl(v("optout"), 2, 2.5), "pct"),
    p_api: row(g.api_over_pct, lvl(g.api_over_pct, 4, 5), "pct"),
    p_cash: row(g.cash_need, lvl(g.cash_need, 800, 1075), "brl"),
    p_channel: g.channel ? { value: g.channel.number, status: /restrit|banid|fora|erro|desconect/i.test(g.channel.number) ? "bad" : "ok" } : undefined,
  };
}
export const PAUSE_IDS = PAUSE.map((c) => c.id);
export { DECISION };

// ---- dados de exemplo (NÃO são reais) ----
function rng(seed) { let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const NAMES = ["Ana Paula", "Bruna Lima", "Carla Souza", "Daniela Rocha", "Elaine Costa", "Fernanda Alves", "Gabriela Nunes", "Helena Dias", "Isabela Ramos", "Juliana Melo", "Karina Lopes", "Larissa Pinto"];
const UFS = ["SP", "SP", "RJ", "MG", "PE", "BA", "PR", "RS", "RN", "GO"];
const WHY = ["a cliente quer 6 peças, mais que o maior kit (3)", "a cliente pergunta sobre um pedido existente", "nenhuma reescrita passou", "sem tempo para reescrever"];

export function demoData() {
  const now = Date.now(), periods = {};
  for (const [period, [n, days]] of Object.entries(BUCKETS)) {
    const metrics = {};
    for (const x of ALL) {
      const [lo, hi] = RANGE[x.id] || [1, 10], r = rng(period + x.id), k = SUMMED.has(x.id) ? days : 1;
      const gen = () => Array.from({ length: n }, (_, i) => (lo + (hi - lo) * (0.25 + 0.5 * r() + 0.25 * Math.sin(i / 3))) * k);
      const cur = gen(), prev = gen(), sum = (s) => s.reduce((a, b) => a + b, 0);
      const agg = (s) => (SUMMED.has(x.id) ? sum(s) : sum(s) / s.length);
      const rd = ["leads", "orders"].includes(x.id) ? Math.round : (v) => v;
      metrics[x.id] = { id: x.id, value: rd(agg(cur)), previous: rd(agg(prev)), series: cur.map(rd) };
    }
    for (const id of ["leads_ad", "leads_organic", "delivered_orders"]) {
      const r = rng(period + id), [lo, hi] = RANGE[id];
      const s = Array.from({ length: n }, (_, i) => Math.round((lo + (hi - lo) * (0.4 + 0.4 * r() + 0.2 * Math.sin(i / 2))) * Math.max(days, 0.3)));
      metrics[id] = { id, value: s.reduce((a, b) => a + b, 0), previous: Math.round(s.reduce((a, b) => a + b, 0) * 0.9), series: s };
    }
    const api = coherent(metrics);
    const r = rng("o" + period), stat = ["bought", "declined", "declined", "unresolved", "abandoned", "abandoned", "open"];
    const outcomes = Object.fromEntries(OUTCOMES.map(([id]) => [id, 0]));
    for (let i = 0; i < 40; i++) outcomes[stat[Math.floor(r() * stat.length)]]++;
    outcomes.attended = 40; outcomes.solved = outcomes.bought + outcomes.declined; outcomes.resolution = (outcomes.solved / (40 - outcomes.open)) * 100;
    periods[period] = {
      metrics, outcomes,
      hourly: Array.from({ length: 24 }, (_, h) => Math.round((h < 6 ? 1 : 6) * (1 + Math.sin(h / 4)) * Math.max(days, 1))),
      money: { api_cost: api, api_per_day: api / (n * days), api_30d: (api / (n * days)) * 30 },
      mix: { cod: Math.round(metrics.orders.value * 0.7), prepay: Math.round(metrics.orders.value * 0.3), units: [0.72, 0.2, 0.08].map((f) => Math.round(metrics.orders.value * f)), contribution: metrics.gross_profit.value },
      states: UFS.slice(0, 7).map((s, i) => ({ state: s, leads: 40 - i * 5, orders: Math.max(0, 6 - i), conversion: (Math.max(0, 6 - i) / (40 - i * 5)) * 100 })),
      gaps: WHY.map((w, i) => ({ reason: w, count: 6 - i, conversations: 5 - i, last: new Date(now - i * 864e5).toISOString(), version: 26 })),
      meta: demoMeta(),
    };
  }
  const chats = NAMES.map((name, i) => {
    const st = ["bought", "declined", "unresolved", "abandoned", "open"][i % 5];
    const base = now - i * 3.6e6 * 5;
    return {
      id: `demo-${i}`, short: `d3m0${i}abc`.slice(0, 8), name, phone: `…${1000 + i * 37}`, state: UFS[i % UFS.length], size: ["P", "M", "G", "GG"][i % 4], origin: i % 3 ? "anúncio" : "orgânico",
      stage: { bought: "pedido_criado", declined: "perdido", unresolved: "conversando", abandoned: "link_enviado", open: "tamanho_definido" }[st], status: st, version: 26, cost: 0.05 + i * 0.01,
      last: new Date(base).toISOString(), rewrites: i % 4, fallbacks: st === "unresolved" ? 1 : 0, reasons: st === "unresolved" ? [WHY[i % 4]] : [], orders: st === "bought" ? [{ status: "Agendado", method: "cod", amount: 129.9, units: 1 }] : [],
      messages: [
        { out: false, text: "Oi, vi o anúncio do colete. Quanto custa?", at: new Date(base - 9e5).toISOString() },
        { out: true, text: "Oi! Tudo bem? 💜 O colete sai por R$ 129,90 com pagamento na entrega e frete grátis. Qual a sua cintura em cm?", at: new Date(base - 8.4e5).toISOString() },
        { out: false, text: "uns 82", at: new Date(base - 6e5).toISOString() },
        { out: true, text: "Perfeito, pra 82 cm o tamanho ideal é o M. Me passa o seu CEP que eu vejo se chega pagando na entrega?", at: new Date(base - 5.4e5).toISOString() },
      ],
    };
  });
  const steps = ["created", "en_route", "delivered", "delivered", "refused", "unpaid"];
  const orders = Array.from({ length: 16 }, (_, i) => ({
    id: `LZ${48210 + i}`, name: NAMES[i % NAMES.length], state: UFS[i % UFS.length], status: ["Agendado", "Em rota", "Completo", "Completo", "Frustrado", "Pedido criado"][i % 6], step: steps[i % 6],
    method: i % 6 === 5 ? "prepay" : "cod", units: 1 + (i % 3 === 2 ? 1 : 0), size: "M", amount: i % 3 === 2 ? 233.82 : 129.9, value: steps[i % 6] === "refused" ? -9.99 : 67.18,
    created: new Date(now - i * 864e5 * 0.7).toISOString(), updated: new Date(now - i * 864e5 * 0.5).toISOString(), scheduled: new Date(now + (i - 5) * 864e5).toISOString().slice(0, 10),
  }));
  return {
    demo: true, source: "demo", updated: new Date(now).toISOString(), periods,
    global: {
      updated: new Date(now).toISOString(), totals: { leads: 210, orders: 18, spend: 240 }, funnel: { first_msg: 210, reply: 160, price: 110, link: 70, order: 18, delivered: 12 },
      channel: { number: "Saudável", cloud_api: "Operando", window: "72 h ativa", templates: "3 aprovados" }, api_over_pct: 2.1, cash_need: 540,
      versions: [24, 25, 26].map((v, i) => ({ version: `v${v}`, conversations: 60 + i * 20, resolution: 70 + i * 6, unresolved: 9 - i * 3, abandoned: 12 - i * 2, turns: 400 + i * 120, handoff: 12 - i * 2, fallback: 5 - i, rewrites: 1.1 - i * 0.2, cost: 0.8 - i * 0.08 })),
      gates: ["tamanho", "endereço", "identidade", "cobertura", "checkout"].map((g, i) => ({ gate: g, checks: 300 - i * 30, blocks: 20 - i * 3, rate: ((20 - i * 3) / (300 - i * 30)) * 100 })),
      chats, orders,
      health: { supabase: { ok: true, detail: "dados de exemplo" }, n8n: { ok: true, detail: "7 workflows ativos" }, meta: { ok: true, detail: "1 campanha, 3 anúncios" }, whatsapp: { ok: true, detail: `última mensagem da Malu ${new Date(now - 6e5).toISOString()}` }, malu: { ok: true, detail: "versão 26", version: 26 }, hermes: { ok: true, detail: "última rodada ontem" } },
      automations: {
        read: 300,
        workflows: [
          { id: "w1", name: "Encorpa — Turno da agente", active: true, runs: 140, errors: 0, last: { status: "success", at: new Date(now).toISOString() }, nodes: [["Mensagem chega", "webhook", 0, 0], ["Chama a função turn", "httpRequest", 220, 0], ["Deu certo?", "if", 440, 0], ["Responde", "respondToWebhook", 660, -80], ["Avisa o operador", "emailSend", 660, 80]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["Mensagem chega", "Chama a função turn"], ["Chama a função turn", "Deu certo?"], ["Deu certo?", "Responde"], ["Deu certo?", "Avisa o operador"]] },
          { id: "w2", name: "Encorpa — Relógio da régua", active: true, runs: 96, errors: 1, last: { status: "error", at: new Date(now).toISOString() }, nodes: [["A cada 10 min", "scheduleTrigger", 0, 0], ["Varre follow-ups", "httpRequest", 220, 0], ["Avisa o operador", "emailSend", 440, 0]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["A cada 10 min", "Varre follow-ups"], ["Varre follow-ups", "Avisa o operador"]] },
          { id: "w3", name: "TEMP — teste", active: false, runs: 0, errors: 0, last: null, nodes: [{ name: "Manual", type: "manualTrigger", x: 0, y: 0 }], edges: [] },
        ],
        runs: Array.from({ length: 12 }, (_, i) => ({ workflow: i % 3 ? "Encorpa — Turno da agente" : "Encorpa — Relógio da régua", status: i === 4 ? "error" : "success", mode: i % 3 ? "webhook" : "trigger", at: new Date(now - i * 6e5).toISOString(), ms: 400 + i * 90 })),
      },
    },
  };
}

// Os números de exemplo saem uns dos outros com as mesmas regras do cálculo real (lib/build.mjs), para fecharem entre si:
// ticket médio com mix 70% na entrega / 30% antecipado e alguns kits; margem por pedido já descontando recusa (17%) e devolução;
// anúncio = leads × CPL com imposto da Meta; API = leads × custo por lead + R$ 0,04 por pedido.
const TICKET = 132, MARGIN_PER_ORDER = 61, META_TAX = 0.1383;
function derive(leads, orders, cpl, apl) {
  const revenue = orders * TICKET, gross = orders * MARGIN_PER_ORDER, spend = leads * cpl, api = leads * apl + orders * 0.04;
  const cost = spend * (1 + META_TAX) + api, net = gross - cost;
  return { api, revenue, gross_profit: gross, op_cost: revenue - gross, spend, net_profit: net, op_margin: revenue ? (net / revenue) * 100 : null, roi: cost ? gross / cost : null, conversion: leads ? (orders / leads) * 100 : null, cpl_api: cpl + apl };
}
function coherent(m) {
  const n = m.leads.series.length, keys = ["revenue", "gross_profit", "op_cost", "spend", "net_profit", "op_margin", "roi", "conversion", "cpl_api"];
  const per = Array.from({ length: n }, (_, i) => derive(m.leads.series[i], m.orders.series[i], m.cpl.series[i], m.api_per_lead.series[i]));
  const cur = derive(m.leads.value, m.orders.value, m.cpl.value, m.api_per_lead.value), prev = derive(m.leads.previous, m.orders.previous, m.cpl.previous, m.api_per_lead.previous);
  for (const k of keys) m[k] = { id: k, value: cur[k], previous: prev[k], series: per.map((x) => x[k]) };
  return cur.api;
}

function demoMeta() {
  const ad = (id, name, spend, imp, clicks, started, leads, orders, status = "ACTIVE") => ({ id, name, adset_id: "s1", campaign_id: "c1", status, spend, impressions: imp, clicks, started, leads, orders,
    ctr: imp ? (clicks / imp) * 100 : null, cpm: imp ? (spend / imp) * 1000 : null, cpl: started ? spend / started : null, creative: { body: "Cintura marcada na hora, sem apertar.", thumb: "" } });
  const ads = [ad("a1", "Vídeo 1 — gancho dor nas costas", 80, 6400, 120, 52, 40, 5), ad("a2", "Vídeo 2 — antes e depois", 70, 5900, 95, 41, 33, 3), ad("a3", "Vídeo 3 — prova social", 60, 5100, 70, 25, 20, 1, "PAUSED")];
  const roll = (xs) => { const t = xs.reduce((a, b) => ({ spend: a.spend + b.spend, impressions: a.impressions + b.impressions, clicks: a.clicks + b.clicks, started: a.started + b.started, leads: a.leads + b.leads, orders: a.orders + b.orders }), { spend: 0, impressions: 0, clicks: 0, started: 0, leads: 0, orders: 0 });
    return { ...t, ctr: (t.clicks / t.impressions) * 100, cpm: (t.spend / t.impressions) * 1000, cpl: t.spend / t.started, ads: xs.length }; };
  return {
    campaigns: [{ id: "c1", name: "Encorpa — CTWA — Teste", objective: "OUTCOME_ENGAGEMENT", status: "ACTIVE", daily_budget: 50, ...roll(ads) }],
    adsets: [{ id: "s1", name: "Conjunto A — estados com mais de 5 cidades", campaign_id: "c1", status: "ACTIVE", daily_budget: 25, optimization: "CONVERSATIONS", audience: { age: "18–55", genders: [2], places: "BR" }, ...roll(ads.slice(0, 2)) },
      { id: "s2", name: "Conjunto B — Sudeste, Centro-Oeste e Sul", campaign_id: "c1", status: "ACTIVE", daily_budget: 25, optimization: "CONVERSATIONS", audience: { age: "18–55", genders: [2], places: "SP, RJ, MG, PR" }, ...roll(ads.slice(2)) }],
    ads,
  };
}
