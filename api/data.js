// Função do Vercel: lê o Supabase, a Meta e o n8n e guarda a resposta 60 s na memória da função.
// Protegida pelo middleware (login). A chave service_role fica só no ambiente do Vercel.
import { buildAll } from "../lib/build.mjs";
import { customPeriod } from "../src/lib/constants.js";

import { N8N_URL, NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

// O Vercel não guarda em cache resposta "private" nem pedido com login (Authorization), então cada aba recalculava tudo.
// Quem guarda é a própria função: 60 s, e pedidos ao mesmo tempo esperam a mesma leitura.
const TTL = 60_000;
// Uma leitura guardada por período livre (?period=c:AAAA-MM-DD:AAAA-MM-DD); "" é a leitura sem período livre.
const memo = new Map();
export const reset = () => memo.clear(); // para os testes

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const raw = req.query?.period ?? new URL(req.url || "/", "http://x").searchParams.get("period"), custom = raw ? customPeriod(String(raw)) : null;
  if (raw && !custom) return res.status(400).json({ error: "Período inválido: use c:AAAA-MM-DD:AAAA-MM-DD, até 3 anos." });
  const id = custom?.id || "";
  try {
    for (const [k, v] of memo) if (Date.now() - v.at > TTL) memo.delete(k);
    if (!memo.has(id)) {
      const promise = buildAll({ url: SUPABASE_URL, key, n8nUrl: process.env.N8N_API_KEY ? N8N_URL : null, n8nKey: process.env.N8N_API_KEY, metaToken: process.env.META_ACCESS_TOKEN, metaAccount: process.env.META_AD_ACCOUNT_ID,
        waToken: process.env.WHATSAPP_TOKEN, waPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID, waWabaId: process.env.WHATSAPP_WABA_ID}, Date.now(), custom);
      memo.set(id, { at: Date.now(), promise });
      promise.catch(() => { if (memo.get(id)?.promise === promise) memo.delete(id); }); // falha não fica guardada
    }
    const { data } = await memo.get(id).promise;
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
