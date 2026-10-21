// Função do Vercel: score e perfil por lead (tela Leads), lidos da view mascarada lead_profiles_v do Ricos-com-AI (migração 0029).
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel. A view não tem telefone, nome nem endereço.
// Sem a view (migração ainda não aplicada) responde 200 com available: false, para a tela explicar em vez de quebrar.
import { getAll } from "../lib/build.mjs";
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "use GET" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const updated = new Date().toISOString();
  try {
    res.status(200).json({ updated, available: true, leads: await getAll("lead_profiles_v", { url: SUPABASE_URL, key }) });
  } catch (e) {
    // PostgREST devolve 404 para tabela ou view que não existe.
    if (e.status === 404) return res.status(200).json({ updated, available: false, leads: [] });
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
