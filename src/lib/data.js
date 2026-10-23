// Dados do portal. Ordem: /api/data ao vivo (Vercel) → último retrato bom guardado neste navegador → data.js (cópia estática).
// Formato: { updated, global: {...}, periods: { day, week, month, 3m, 6m, 9m, 12m } } (lib/build.mjs › build).
import { BUCKETS, PAUSE, DECISION } from "./constants.js";
import { fmt, store } from "./format.js";
import { DELIVERY_DAYS, RELEASE_DAYS, cashPlan } from "./economics.js";

const CACHE = "last:portal";

export async function loadData() {
  if (location.protocol !== "file:") {
    try {
      const r = await fetch("/api/data", { cache: "no-store", credentials: "same-origin" });
      if (r.ok) {
        const data = await r.json();
        if (data?.periods) { store.set(CACHE, JSON.stringify({ ...data, global: { ...data.global, chats: [] } })); return { ...data, source: "live" }; } // o retrato do navegador não guarda conversas
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

// Dias de cada período (BUCKETS: intervalos × dias por intervalo).
export const periodDays = (period) => { const [n, d] = BUCKETS[period] || BUCKETS.week; return n * d; };

// Critérios de pausa do teste, calculados das métricas.
// O caixa da pausa é o de um ciclo inteiro (entrega + repasse), o pico de quem roda sem parar, seja qual for o período na tela,
// com o gasto médio diário com anúncios dos últimos 7 dias (operador, 20/10: gasto, não orçamento).
export function computePause(p, g) {
  const plan = cashPlan(g.ad_spend_day, DELIVERY_DAYS + RELEASE_DAYS);
  const v = (id) => p.metrics?.[id]?.value;
  const lvl = (x, warn, bad) => (x == null ? "" : x > bad ? "bad" : x > warn ? "warn" : "ok");
  const row = (x, s, u) => (x == null ? undefined : { value: fmt(x, u), status: s });
  return {
    p_premise: row(v("invalid_premise"), lvl(v("invalid_premise"), 4, 5), "pct"),
    p_handoff: row(v("handoff"), lvl(v("handoff"), 8, 10), "pct"),
    p_optout: row(v("optout"), lvl(v("optout"), 2, 2.5), "pct"),
    p_api: row(g.api_over_pct, lvl(g.api_over_pct, 4, 5), "pct"),
    p_cash: row(plan?.need, "info", "brl"), // sem limite fixo para comparar (operador, 20/10): só mostra o valor
    p_channel: g.channel?.status ? { value: g.channel.number, status: g.channel.status } : undefined,
  };
}
export const PAUSE_IDS = PAUSE.map((c) => c.id);
export { DECISION };

// Dados de exemplo (NÃO são reais): src/lib/demo.js simula um ano de operação e passa pela mesma conta do servidor.
// Os workflows são os do n8n de verdade, da última leitura guardada neste navegador (o operador pediu para manter os dele).
// A conta roda num worker (src/lib/demo.worker.js); sem worker, roda aqui mesmo.
export async function demoData() {
  let automations = null;
  try { automations = JSON.parse(store.get(CACHE) || "null")?.global?.automations ?? null; } catch { /* sem retrato: workflows de exemplo */ }
  try {
    const w = new Worker(new URL("./demo.worker.js", import.meta.url), { type: "module" });
    return await new Promise((done, fail) => { w.onmessage = (e) => { w.terminate(); done(e.data); }; w.onerror = (e) => { w.terminate(); fail(e); }; w.postMessage({ automations }); });
  } catch {
    const { demoData: make } = await import("./demo.js");
    return make(automations);
  }
}
