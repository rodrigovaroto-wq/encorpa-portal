// Função do Vercel: a equipe de Configurações › Equipe (operador, 04/11). O login e o papel vêm de PORTAL_USERS (lib/auth.mjs);
// nome, cargo e telefone, de portal_users, e o que mudou, de portal_activity (migração 0034 do Ricos-com-AI). Só o admin vê a lista
// e muda; os demais veem só a si mesmos. Toda mudança entra na atividade com quem fez.
//   POST { action: "save", email, name, title, phone }  ·  { action: "invite", email, name, title }  ·  { action: "remove", email }
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";
import { parseUsers, userOf } from "../lib/auth.mjs";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const text = (x, max) => (x == null ? null : String(x).trim().slice(0, max) || null);

// Lista da equipe: quem tem login (PORTAL_USERS) com o perfil do banco, mais quem foi convidado e ainda não tem login.
export function teamList(logins, profiles) {
  const by = Object.fromEntries(profiles.map((p) => [p.email.toLowerCase(), p]));
  const rows = logins.map((u) => ({ ...by[u.email.toLowerCase()], email: u.email, role: u.role, login: true }));
  for (const p of profiles) if (!logins.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) rows.push({ ...p, role: null, login: false });
  return rows;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const me = userOf(req.headers.authorization);
  if (!me) return res.status(401).json({ error: "Login necessário" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const db = async (path, init = {}) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
    if (r.status === 404) throw Object.assign(new Error("missing"), { missing: true });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  };
  try {
    if (req.method === "GET") {
      const [profiles, activity] = await Promise.all([db("portal_users?select=email,name,title,phone,invited_at"), me.role === "admin" ? db("portal_activity?select=at,actor,action&order=at.desc&limit=30") : []]);
      const logins = parseUsers(process.env.PORTAL_USERS).map(({ email, role }) => ({ email, role }));
      const users = teamList(logins, profiles);
      return res.status(200).json({ available: true, me, users: me.role === "admin" ? users : users.filter((u) => u.email.toLowerCase() === me.email.toLowerCase()), activity });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "use GET ou POST" });
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" }); // CSRF
    if (me.role !== "admin") return res.status(403).json({ error: "Só o administrador muda a equipe." });
    const b = req.body || {}, email = text(b.email, 200)?.toLowerCase();
    if (!["save", "invite", "remove"].includes(b.action) || !email || !EMAIL.test(email)) return res.status(400).json({ error: "pedido inválido" });
    const log = (action) => db("portal_activity", { method: "POST", body: JSON.stringify({ actor: me.email, action: action.slice(0, 300) }), headers: { Prefer: "return=minimal" } });
    if (b.action === "remove") {
      await db(`portal_users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await log(`Tirou ${email} da equipe`);
      return res.status(200).json({ status: "ok" });
    }
    const row = { email, name: text(b.name, 120), title: text(b.title, 120), ...(b.action === "save" ? { phone: text(b.phone, 40) } : { invited_at: new Date().toISOString() }), updated_at: new Date().toISOString() };
    const [saved] = await db("portal_users?on_conflict=email", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
    await log(b.action === "invite" ? `Convidou ${row.name || email}${row.title ? ` (${row.title})` : ""}` : `Atualizou o perfil de ${row.name || email}`);
    return res.status(200).json({ status: "ok", user: saved });
  } catch (e) {
    if (e.missing) return res.status(200).json({ available: false });
    return res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
