// Score e perfil dos leads (api/leads.js › lead_profiles_v): o agregado da tela Leads. Faixas e objeções vêm da especificação
// do Ricos-com-AI (plano 16 §4.1–§4.3): quente ≥ 60, morna 30–59, fria < 30.
export const BANDS = [["quente", "Quente", "bad"], ["morna", "Morna", "warn"], ["fria", "Fria", ""]];
export const OBJECTION = { preco: "Preço", confianca: "Confiança", tamanho: "Tamanho", entrega: "Entrega", pagamento: "Pagamento", conforto: "Conforto", resultado: "Resultado", outra: "Outra" };
export const SENSITIVITY = [["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]];
const BOUGHT = new Set(["pedido_criado", "em_rota", "entregue_pago"]); // comprou: a conversa não "parou"

const count = (xs) => { const n = {}; for (const x of xs) n[x] = (n[x] || 0) + 1; return Object.entries(n).sort((a, b) => b[1] - a[1]); };
export const objectionsOf = (l) => (Array.isArray(l.objections) ? [...new Set(l.objections.filter((o) => typeof o === "string"))] : []);
export const audiosOf = (l) => Math.max(0, Math.floor(+l.audio_count || 0));

export function profileSummary(leads) {
  const audio = leads.map(audiosOf).filter((n) => n > 0);
  return {
    total: leads.length,
    bands: Object.fromEntries(BANDS.map(([k]) => [k, leads.filter((l) => l.score_band === k).length])),
    objections: count(leads.flatMap(objectionsOf)),
    sensitivity: Object.fromEntries(SENSITIVITY.map(([k]) => [k, leads.filter((l) => l.price_sensitivity === k).length])),
    // Áudio: quantas mandaram ao menos um e a média entre essas.
    audio: { leads: audio.length, share: leads.length ? (audio.length / leads.length) * 100 : null, avg: audio.length ? audio.reduce((a, b) => a + b, 0) / audio.length : null },
    occasions: count(leads.map((l) => String(l.occasion ?? "").trim().toLowerCase()).filter(Boolean)).slice(0, 8),
    stops: count(leads.filter((l) => l.stage && !BOUGHT.has(l.stage)).map((l) => l.stage)),
  };
}
