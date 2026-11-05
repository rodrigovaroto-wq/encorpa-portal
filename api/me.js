// Função do Vercel: quem está logado e com que papel (lib/auth.mjs); para o admin, a lista de usuários (só e-mail e papel).
import { parseUsers, whoIs } from "../lib/auth.mjs";
import { SUPABASE_URL, serviceKey } from "../lib/env.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const me = await whoIs(req.headers.authorization, { url: SUPABASE_URL, key: serviceKey() });
  if (!me) return res.status(401).json({ error: "Login necessário" });
  res.status(200).json({ ...me, ...(me.role === "admin" ? { users: parseUsers(process.env.PORTAL_USERS).map(({ email, role }) => ({ email, role })) } : {}) });
}
