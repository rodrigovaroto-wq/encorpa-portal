// Função do Vercel: o "Site ao vivo" (operador, 04/11). As visitas dos últimos 30 min de site_sessions, contadas aqui, para a tela
// consultar a cada 5 s. Protegida pelo middleware (login). Sem a tabela (migração 0034 não aplicada), responde available: false.
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

const LIVE = 2 * 60000, WINDOW = 30 * 60000;

// Agora no site = visita com evento nos últimos 2 min (o script manda um sinal a cada 30 s com a aba aberta).
export function liveStats(rows, now = Date.now()) {
  const t = (s) => (s ? Date.parse(s) : 0), on = rows.filter((r) => now - t(r.last_at) < LIVE);
  const arrivals = Array(30).fill(0);
  for (const r of rows) { const k = Math.floor((now - t(r.created_at)) / 60000); if (k >= 0 && k < 30) arrivals[29 - k]++; }
  return { available: true, now: on.length, phone: on.filter((r) => r.device === "phone").length, desktop: on.filter((r) => r.device !== "phone").length,
    product: on.filter((r) => r.product_at).length, checkout: rows.filter((r) => now - t(r.checkout_at) < WINDOW).length, arrivals,
    last: rows.reduce((m, r) => Math.max(m, t(r.last_at)), 0) || null, updated: new Date(now).toISOString() };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const since = new Date(Date.now() - WINDOW).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_sessions?select=created_at,last_at,device,product_at,checkout_at&last_at=gte.${encodeURIComponent(since)}&limit=5000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (r?.status === 404) return res.status(200).json({ available: false });
  if (!r?.ok) return res.status(502).json({ error: `Supabase HTTP ${r?.status ?? "sem resposta"}` });
  res.status(200).json(liveStats(await r.json()));
}
