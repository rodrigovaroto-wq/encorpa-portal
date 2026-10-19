// Função do Vercel: o operador fala com a cliente pelo portal e liga ou desliga a Malu numa conversa.
// Protegida pelo middleware (login). O telefone inteiro nunca vai ao navegador: chega aqui só o id da conversa.
//   { action: "send", conversationId, text } pausa a Malu nesta conversa e envia pelo n8n "Encorpa — Portal responder",
//     que passa pela mesma regra do formulário "Responder cliente" (turn › humanReply: janela de 24 h, texto, duplicata).
//   { action: "pause" | "resume", conversationId } liga ou desliga leads.handoff_at, a chave que o turno já respeita
//     (a Malu não responde e a régua não manda nada enquanto houver handoff_at).
const URL_DEFAULT = "https://hbmkgakzrqmdlsvszjeo.supabase.co";
const N8N_DEFAULT = "https://encorpa-fashion.pikapod.net";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  // Só JSON: um formulário de outro site não consegue mandar este tipo sem a checagem do navegador (CSRF).
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) return res.status(500).json({ error: "Falta a variável SUPABASE_SERVICE_ROLE_KEY no Vercel." });
  const { action, conversationId, text } = req.body || {};
  if (!["send", "pause", "resume"].includes(action) || !UUID.test(String(conversationId))) return res.status(400).json({ error: "pedido inválido" });
  const body = String(text ?? "").trim();
  if (action === "send" && (!body || body.length > 4096)) return res.status(400).json({ error: "Mensagem vazia ou com mais de 4.096 caracteres." });

  const base = process.env.SUPABASE_URL || URL_DEFAULT;
  const db = async (path, init = {}) => {
    const r = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.json();
  };
  try {
    const conv = (await db(`conversations?id=eq.${conversationId}&select=lead_id,leads(id,phone,handoff_at)`))[0];
    const lead = conv?.leads;
    if (!lead) return res.status(404).json({ error: "Conversa não encontrada." });
    // Rodada de personas (Ricos-com-AI): o número não existe e o lead é apagado no fim da rodada.
    if (/^5500099/.test(String(lead.phone))) return res.status(409).json({ error: "Conversa de teste (rodada de personas): o número não existe e a conversa é apagada no fim da rodada." });
    // Pausa antes de enviar: se ela responder no meio do envio, a Malu já não fala por cima.
    const pausedAt = action === "resume" ? null : lead.handoff_at || new Date().toISOString();
    const setLead = (handoff_at) => db(`leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify({ handoff_at }) });
    if (pausedAt !== lead.handoff_at) await setLead(pausedAt);
    // Hora do servidor: a tela compara com a hora do retrato (também do servidor), nunca com o relógio do navegador.
    const at = new Date().toISOString();
    if (action !== "send") return res.status(200).json({ status: "ok", paused: !!pausedAt, pausedAt, at });
    // Recusa certa (nada saiu): devolve a Malu se foi este envio que a pausou, para a cliente não ficar sem ninguém.
    const undo = async () => {
      if (lead.handoff_at) return { paused: true, pausedAt, at };
      await setLead(null).catch(() => undefined);
      return { paused: false, pausedAt: null, at };
    };

    if (!process.env.N8N_API_KEY) return res.status(500).json({ error: "Falta a variável N8N_API_KEY no Vercel.", ...(await undo()) });
    const r = await fetch(`${process.env.N8N_URL || N8N_DEFAULT}/webhook/portal-responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-N8N-API-KEY": process.env.N8N_API_KEY },
      body: JSON.stringify({ phone: lead.phone, text: body }),
      signal: AbortSignal.timeout(40_000),
    });
    const out = await r.json().catch(() => ({}));
    if (out.status === "sent") return res.status(200).json({ status: "sent", paused: true, pausedAt, at });
    // "refused" e chave recusada (401) são certeza de que nada saiu. Erro ou tempo esgotado podem ter enviado: fica pausada.
    const nothingSent = out.status === "refused" || r.status === 401;
    return res.status(out.status === "refused" ? 409 : 502).json({ error: out.message || `n8n HTTP ${r.status}`, reason: out.reason ?? null, ...(nothingSent ? await undo() : { paused: true, pausedAt, at }) });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
