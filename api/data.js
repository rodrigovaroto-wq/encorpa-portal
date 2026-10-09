// Função do Vercel: lê o Supabase na hora e guarda a resposta 30 min no cache da borda.
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel.
import { buildAll } from "../lib/build.mjs";

const URL_DEFAULT = "https://hbmkgakzrqmdlsvszjeo.supabase.co";

export default async function handler(req, res) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) return res.status(500).json({ error: "Falta a variável SUPABASE_SERVICE_ROLE_KEY no Vercel." });
  try {
    const { data } = await buildAll({ url: process.env.SUPABASE_URL || URL_DEFAULT, key });
    res.setHeader("Cache-Control", "private, max-age=0, s-maxage=1800, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
