// Função do Vercel: configurações editadas no próprio portal (04/11), em portal_settings. Hoje só a meta do mês (`month_goal`, em reais),
// que o admin e o operador mudam na Home; quem é só leitura vê. Toda mudança entra na atividade.
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";
import { canWrite, whoIs } from "../lib/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" }); // CSRF
  const me = await whoIs(req.headers.authorization, { url: SUPABASE_URL, key: serviceKey() });
  if (!canWrite(me?.role)) return res.status(403).json({ error: "Seu usuário é só de leitura: a meta fica com operador ou admin." });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const brl = Number(req.body?.month_goal);
  if (!Number.isFinite(brl) || brl < 0 || brl > 100_000_000) return res.status(400).json({ error: "Meta inválida." });
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/portal_settings?on_conflict=key`, { method: "POST", signal: AbortSignal.timeout(8000), headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "month_goal", value: { brl: Math.round(brl * 100) / 100 }, updated_at: new Date().toISOString(), updated_by: me.email }) }).catch(() => null);
  if (!r?.ok) return res.status(502).json({ error: `Supabase HTTP ${r?.status ?? "sem resposta"}` });
  await fetch(`${SUPABASE_URL}/rest/v1/portal_activity`, { method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ actor: me.email, action: `Mudou a meta do mês para R$ ${brl.toLocaleString("pt-BR")}` }) }).catch(() => null);
  return res.status(200).json({ status: "ok", month_goal: brl });
}
