// Função do Vercel: só as conversas, lidas na hora e sem cache, para a tela Conversas acompanhar a cliente ao vivo
// (a tela consulta a cada 15 s). /api/data continua com tudo, mas chega a ter 5 min de atraso.
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel.
import { buildChats } from "../lib/build.mjs";

const URL_DEFAULT = "https://hbmkgakzrqmdlsvszjeo.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "use GET" });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) return res.status(500).json({ error: "Falta a variável SUPABASE_SERVICE_ROLE_KEY no Vercel." });
  try {
    res.status(200).json(await buildChats({ url: process.env.SUPABASE_URL || URL_DEFAULT, key }));
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
