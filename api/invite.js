// Função pública do convite (04/11): a página convite.html troca o token do e-mail por uma senha. Fica fora do login (middleware.js):
// quem foi convidado ainda não tem como entrar. O token tem 256 bits e vale uma vez, por 72 h; o banco guarda só o SHA-256 dele.
//   GET ?t=<token>  → { email, name } se o convite vale   ·   POST { token, password } → cria a senha e apaga o token
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";
import { hashPassword, sha256Hex } from "../lib/auth.mjs";

const TOKEN = /^[0-9a-f]{64}$/;
export const passwordProblem = (p) => (typeof p !== "string" || p.length < 10 ? "A senha precisa de pelo menos 10 caracteres." : p.length > 200 ? "Senha longa demais." : p.includes(":") ? "A senha não pode ter dois-pontos (:)." : null);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const token = String(req.method === "GET" ? req.query?.t ?? new URL(req.url || "/", "http://x").searchParams.get("t") ?? "" : req.body?.token ?? "");
  if (!TOKEN.test(token)) return res.status(400).json({ error: "Link de convite inválido." });
  if (req.method === "POST" && !String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" });
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const sel = `portal_users?invite_token_hash=eq.${await sha256Hex(token)}&invite_expires_at=gt.${encodeURIComponent(new Date().toISOString())}`;
  const found = await fetch(`${SUPABASE_URL}/rest/v1/${sel}&select=email,name`, { headers: h, signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!found) return res.status(502).json({ error: "Não consegui conferir o convite agora. Tente de novo em instantes." });
  if (!found.length) return res.status(410).json({ error: "Este convite já foi usado ou venceu. Peça um novo ao administrador." });
  if (req.method === "GET") return res.status(200).json(found[0]);
  if (req.method !== "POST") return res.status(405).json({ error: "use GET ou POST" });
  const bad = passwordProblem(req.body?.password);
  if (bad) return res.status(400).json({ error: bad });
  // O mesmo filtro no PATCH: dois envios do mesmo link não criam duas senhas (o segundo não acha mais o token).
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${sel}`, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ password_hash: await hashPassword(req.body.password), invite_token_hash: null, invite_expires_at: null, updated_at: new Date().toISOString() }) }).catch(() => null);
  const done = r?.ok ? await r.json() : null;
  if (!done?.length) return res.status(r?.ok ? 410 : 502).json({ error: r?.ok ? "Este convite acabou de ser usado." : "Não consegui salvar a senha agora." });
  await fetch(`${SUPABASE_URL}/rest/v1/portal_activity`, { method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ actor: done[0].email, action: "Criou a senha pelo convite" }) }).catch(() => null);
  return res.status(200).json({ status: "ok", email: done[0].email });
}
