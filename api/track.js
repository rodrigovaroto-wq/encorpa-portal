// Coletor público das visitas do site (operador, 04/11): o script public/track.js, no encorpa-fashion.com.br, manda um evento a
// cada passo da visita. Fica fora do login (middleware.js), aceita só o site da Encorpa e só o formato de uma visita, e grava em
// site_sessions (migração 0034 do Ricos-com-AI). Nenhum dado pessoal: id aleatório da visita, aparelho, caminho e carimbos.
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

export const SITE = /^https:\/\/(www\.)?encorpa-fashion\.com\.br$/;
const STAMP = { view: null, ping: null, product: "product_at", checkout: "checkout_at" };

// A linha da visita para o upsert, ou null se o evento não é de uma visita (nada é gravado).
export function visitRow(b, now = new Date().toISOString()) {
  if (!b || typeof b !== "object" || !/^[a-z0-9]{16,40}$/.test(b.id || "") || !Object.hasOwn(STAMP, b.kind) || !["phone", "desktop"].includes(b.device)) return null;
  const path = typeof b.path === "string" && b.path.startsWith("/") ? b.path.slice(0, 200) : "/";
  return { id: b.id, last_at: now, device: b.device, ...(b.kind === "view" ? { path, from_ad: b.ad === true } : {}), ...(STAMP[b.kind] ? { [STAMP[b.kind]]: now } : {}) };
}

export default async function handler(req, res) {
  const origin = String(req.headers.origin || "");
  if (SITE.test(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  if (!SITE.test(origin)) return res.status(403).json({ error: "origem não permitida" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } } // o script manda text/plain (sem preflight)
  const row = visitRow(body);
  if (!row) return res.status(400).json({ error: "evento inválido" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_sessions?on_conflict=id`, {
    method: "POST", body: JSON.stringify(row), signal: AbortSignal.timeout(8000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
  }).catch(() => null);
  return r?.ok ? res.status(204).end() : res.status(502).json({ error: `Supabase HTTP ${r?.status ?? "sem resposta"}` });
}
