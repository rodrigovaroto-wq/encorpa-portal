// Função do Vercel: só as conversas, para a tela Conversas acompanhar a cliente ao vivo (a tela consulta a cada 15 s).
// Guarda 5 s na memória da função: várias abas no mesmo instante fazem uma leitura só, e a resposta nunca passa de 5 s.
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel.
import { buildChats } from "../lib/build.mjs";
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

const TTL = 5_000;
let memo = null;
export const reset = () => { memo = null; }; // para os testes

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "use GET" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  try {
    if (!memo || Date.now() - memo.at > TTL) {
      const promise = buildChats({ url: SUPABASE_URL, key });
      memo = { at: Date.now(), promise };
      promise.catch(() => { if (memo?.promise === promise) memo = null; });
    }
    res.status(200).json(await memo.promise);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
