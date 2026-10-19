// Função do Vercel: lê o Supabase, a Meta e o n8n e guarda a resposta 60 s na memória da função.
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel.
import { buildAll } from "../lib/build.mjs";

import { N8N_URL, NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

// O Vercel não guarda em cache resposta "private" nem pedido com login (Authorization), então cada aba recalculava tudo.
// Quem guarda é a própria função: 60 s, e pedidos ao mesmo tempo esperam a mesma leitura.
const TTL = 60_000;
let memo = null;
export const reset = () => { memo = null; }; // para os testes

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  try {
    if (!memo || Date.now() - memo.at > TTL) {
      const promise = buildAll({ url: SUPABASE_URL, key, n8nUrl: process.env.N8N_API_KEY ? N8N_URL : null, n8nKey: process.env.N8N_API_KEY, metaToken: process.env.META_ACCESS_TOKEN, metaAccount: process.env.META_AD_ACCOUNT_ID });
      memo = { at: Date.now(), promise };
      promise.catch(() => { if (memo?.promise === promise) memo = null; }); // falha não fica guardada
    }
    const { data } = await memo.promise;
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
