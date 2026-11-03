import { SAMPLE_FLOOR } from "./constants.js";

// Teste A/B (operador, 02 e 03/11; Ricos-com-AI grafo §140): conjunto Site × conjunto WhatsApp, R$ 25/dia cada por 5 dias.
// O braço sai do destino do conjunto na Meta (WEBSITE ou WhatsApp); sem destino, do nome ("site" ou "whats").
export const armOf = (s) => (/WEBSITE/.test(s.destination || "") ? "site" : /WHATSAPP|MESSENGER|MESSAGING/.test(s.destination || "") ? "whatsapp"
  : /\bsite\b/i.test(s.name || "") ? "site" : /whats|zap/i.test(s.name || "") ? "whatsapp" : null);
// Metas e limites de pausa por conjunto. dir 1 = maior é melhor; pause = limite que pausa com R$ 50 gastos; o pedido conta quando é criado.
export const ARMS = {
  site: { label: "Site", goals: [
    { id: "ctr", label: "CTR do link", unit: "pct", ideal: 2, pause: 1, dir: 1 },
    { id: "cpc", label: "CPC (custo por clique)", unit: "brl", ideal: 0.6, pause: 1.2, dir: -1 },
    { id: "conv", label: "Visitas que viram pedido", unit: "pct", ideal: 3, dir: 1 },
    { id: "cpo", label: "Custo por pedido criado", unit: "brl", ideal: 20, pause: 27, dir: -1 }] },
  whatsapp: { label: "WhatsApp", goals: [
    { id: "ctr", label: "CTR do link", unit: "pct", ideal: 2, pause: 1, dir: 1 },
    { id: "cpc", label: "CPC (custo por clique)", unit: "brl", ideal: 1.5, pause: 3, dir: -1 },
    { id: "cpl", label: "Custo por conversa iniciada", unit: "brl", ideal: 2, pause: 4, dir: -1 },
    { id: "conv", label: "Conversas que viram pedido", unit: "pct", ideal: 9, dir: 1 },
    { id: "cpo", label: "Custo por pedido criado", unit: "brl", ideal: 22.22, pause: 27, dir: -1 }] },
};
const ZERO = { spend: 0, impressions: 0, clicks: 0, started: 0, leads: 0, orders: 0 };
// Soma dos conjuntos de cada braço, com as taxas. No WhatsApp o pedido é o do anúncio (lib/build.mjs › adAttribution); no Site, o de lead sem marca de
// anúncio desde o início do conjunto Site (`ab.site_orders`, lib/build.mjs › siteOrders); sem essa leitura, null.
export function armTotals(adsets = [], ab = null) {
  const out = {};
  for (const k of Object.keys(ARMS)) {
    const t = adsets.filter((s) => armOf(s) === k).reduce((a, s) => Object.fromEntries(Object.keys(ZERO).map((f) => [f, a[f] + (+s[f] || 0)])), { ...ZERO });
    const orders = k === "site" ? (ab?.site_orders ?? null) : t.orders;
    out[k] = { ...t, sets: adsets.filter((s) => armOf(s) === k).length, orders, ctr: t.impressions ? (t.clicks / t.impressions) * 100 : null, cpc: t.clicks ? t.spend / t.clicks : null,
      cpl: t.started ? t.spend / t.started : null, conv: orders == null ? null : k === "site" ? (t.clicks ? (orders / t.clicks) * 100 : null) : t.started ? (orders / t.started) * 100 : null,
      cpo: orders ? t.spend / orders : null };
  }
  return out;
}
// Situação de uma meta: ok (bate a meta), warn (entre a meta e o limite), bad (passou do limite com o gasto que o pede).
export function goalStatus(x, v, spend) {
  if (v == null) return "";
  const good = x.dir > 0 ? v >= x.ideal : v <= x.ideal;
  if (good) return "ok";
  const broke = x.pause != null && (x.dir > 0 ? v < x.pause : v > x.pause);
  return broke && spend >= (x.id === "cpo" ? 75 : 50) ? "bad" : "warn";
}
// Decisão do conjunto pela regra do teste: R$ 50 com limite estourado ou R$ 75 sem pedido → pausar.
export function armVerdict(k, t) {
  if (!t.sets) return ["Conjunto não encontrado na Meta", ""];
  if (!t.spend) return ["Não começou", ""];
  if (t.spend >= 50 && ARMS[k].goals.some((x) => x.id !== "cpo" && x.pause != null && goalStatus(x, t[x.id], t.spend) === "bad")) return ["PAUSAR: limite do dia 2 estourado", "bad"];
  if (t.orders != null && t.spend >= 75 && !t.orders) return ["PAUSAR: R$ 75 sem pedido", "bad"];
  if (t.spend >= SAMPLE_FLOOR.spend) return [t.cpo != null && t.cpo <= 27 ? "Terminou abaixo de R$ 27 por pedido" : "Terminou", t.cpo != null && t.cpo <= 27 ? "ok" : "warn"];
  return ["Rodando", "ok"];
}
