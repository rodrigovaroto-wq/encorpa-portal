// Função do Vercel: a equipe de Configurações › Equipe (operador, 04/11). Login e papel vêm de PORTAL_USERS (lib/auth.mjs) ou, para quem
// foi convidado pelo portal, de portal_users; nome, cargo e telefone, de portal_users; o que mudou, de portal_activity (migração 0034 do
// Ricos-com-AI). Só o admin vê a lista e muda; os demais veem só a si mesmos. Toda mudança entra na atividade com quem fez.
//   POST { action: "save", email, name, title, phone, role? }  ·  { action: "invite", email, name, title, role }  ·  { action: "remove", email }
// O convite guarda só o SHA-256 de um token de uso único (72 h) e manda o link por e-mail pelo n8n ("Encorpa — Portal convite").
import { N8N_URL, NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";
import { ROLES, parseUsers, sha256Hex, whoIs } from "../lib/auth.mjs";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PORTAL = process.env.PORTAL_URL || "https://encorpa-portal.vercel.app";
const INVITE_HOURS = 72;
const text = (x, max) => (x == null ? null : String(x).trim().slice(0, max) || null);

// Lista da equipe: quem tem login no Vercel (o papel de lá vale), depois quem foi convidado pelo portal (login no banco ou convite pendente).
export function teamList(logins, profiles) {
  const by = Object.fromEntries(profiles.map((p) => [p.email.toLowerCase(), p]));
  const strip = ({ password_hash, invite_token_hash, ...p } = {}) => ({ ...p, login: !!password_hash });
  const rows = logins.map((u) => ({ ...strip(by[u.email.toLowerCase()]), email: u.email, role: u.role, login: true, vercel: true }));
  for (const p of profiles) if (!logins.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) rows.push(strip(p));
  return rows;
}

// O e-mail do convite: o link é a página pública convite.html, que cria a senha (api/invite.js).
export const inviteMail = (name, by, link) => ({
  subject: "Seu acesso ao Encorpa Portal",
  text: `Oi${name ? `, ${name}` : ""}!\n\n${by} convidou você para o Encorpa Portal.\n\nCrie sua senha por este link (vale por ${INVITE_HOURS} horas, uma vez só):\n${link}\n\nDepois é só entrar em ${PORTAL} com este e-mail e a senha que você criou.\n\nSe você não esperava este convite, ignore este e-mail.`,
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const me = await whoIs(req.headers.authorization, { url: SUPABASE_URL, key: serviceKey() });
  if (!me) return res.status(401).json({ error: "Login necessário" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const db = async (path, init = {}) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
    if (r.status === 404) throw Object.assign(new Error("missing"), { missing: true });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.status === 204 || init.headers?.Prefer?.includes("minimal") ? null : r.json();
  };
  try {
    const logins = parseUsers(process.env.PORTAL_USERS).map(({ email, role }) => ({ email, role }));
    if (req.method === "GET") {
      const [profiles, activity] = await Promise.all([db("portal_users?select=email,name,title,phone,role,invited_at,invite_expires_at,password_hash"), me.role === "admin" ? db("portal_activity?select=at,actor,action&order=at.desc&limit=30") : []]);
      const users = teamList(logins, profiles);
      return res.status(200).json({ available: true, me, users: me.role === "admin" ? users : users.filter((u) => u.email.toLowerCase() === me.email.toLowerCase()), activity });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "use GET ou POST" });
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" }); // CSRF
    if (me.role !== "admin") return res.status(403).json({ error: "Só o administrador muda a equipe." });
    const b = req.body || {}, email = text(b.email, 200)?.toLowerCase(), role = ROLES.includes(b.role) ? b.role : null;
    if (!["save", "invite", "remove"].includes(b.action) || !email || !EMAIL.test(email)) return res.status(400).json({ error: "pedido inválido" });
    const inVercel = logins.some((u) => u.email.toLowerCase() === email);
    const log = (action) => db("portal_activity", { method: "POST", body: JSON.stringify({ actor: me.email, action: action.slice(0, 300) }), headers: { Prefer: "return=minimal" } });
    if (b.action === "remove") {
      if (email === me.email.toLowerCase()) return res.status(409).json({ error: "Você não pode tirar a si mesmo." });
      await db(`portal_users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await log(`Tirou ${email} da equipe${inVercel ? " (o login do Vercel continua)" : ""}`);
      return res.status(200).json({ status: "ok" });
    }
    if (b.action === "invite" && inVercel) return res.status(409).json({ error: "Este e-mail já entra pelo Vercel (PORTAL_USERS)." });
    if (b.action === "invite" && !role) return res.status(400).json({ error: "Escolha o acesso." });
    const now = new Date();
    const token = b.action === "invite" ? Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("") : null;
    const row = { email, name: text(b.name, 120), title: text(b.title, 120), updated_at: now.toISOString(),
      ...(b.action === "save" ? { phone: text(b.phone, 40), ...(role && !inVercel ? { role } : {}) }
        : { role, invited_at: now.toISOString(), invite_token_hash: await sha256Hex(token), invite_expires_at: new Date(+now + INVITE_HOURS * 3600e3).toISOString(), password_hash: null }) };
    await db("portal_users?on_conflict=email", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    if (b.action === "save") { await log(`Atualizou o perfil de ${row.name || email}`); return res.status(200).json({ status: "ok" }); }
    // Manda o convite. Se o e-mail não sair, o admin recebe o link para mandar por fora (ele já pode criar o acesso de qualquer jeito).
    const link = `${PORTAL}/convite.html#${token}`, mail = inviteMail(row.name, me.email, link);
    const r = process.env.N8N_API_KEY ? await fetch(`${N8N_URL}/webhook/portal-convite`, { method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json", "X-N8N-API-KEY": process.env.N8N_API_KEY }, body: JSON.stringify({ to: email, ...mail }) }).catch(() => null) : null;
    const sent = (await r?.json().catch(() => ({})))?.status === "sent";
    await log(`Convidou ${row.name || email}${row.title ? ` (${row.title})` : ""} como ${role}${sent ? "" : " — o e-mail não saiu"}`);
    return res.status(200).json(sent ? { status: "sent" } : { status: "not_sent", link, error: process.env.N8N_API_KEY ? "O e-mail não saiu." : "Falta a variável N8N_API_KEY no Vercel." });
  } catch (e) {
    if (e.missing) return res.status(200).json({ available: false });
    return res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
