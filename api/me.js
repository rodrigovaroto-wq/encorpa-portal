// Função do Vercel: quem está logado e com que papel (lib/auth.mjs); para o admin, a lista de usuários (só e-mail e papel).
import { parseUsers, userOf } from "../lib/auth.mjs";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const me = userOf(req.headers.authorization);
  if (!me) return res.status(401).json({ error: "Login necessário" });
  res.status(200).json({ ...me, ...(me.role === "admin" ? { users: parseUsers(process.env.PORTAL_USERS).map(({ email, role }) => ({ email, role })) } : {}) });
}
