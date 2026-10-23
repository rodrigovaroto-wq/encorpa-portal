// Função do Vercel: a mídia de uma mensagem (imagem que a cliente mandou, ou arquivo da Malu), atrás do login (middleware.js).
// GET /api/media?m=<id da mensagem>. Lê messages.media: com o id da Meta, baixa da Graph API com WHATSAPP_TOKEN (baixar mídia
// não é cobrado e não passa pelo modelo); com url pública (https), redireciona. A Meta guarda a mídia por cerca de 30 dias.
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "use GET" });
  const m = String(req.query?.m ?? new URL(req.url, "http://x").searchParams.get("m") ?? "");
  if (!UUID.test(m)) return res.status(400).json({ error: "pedido inválido" });
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${m}&select=media`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    const media = (await r.json())[0]?.media;
    if (!media || typeof media !== "object") return res.status(404).json({ error: "Mensagem sem mídia." });
    if (!media.id && /^https:\/\//.test(media.url || "")) { res.setHeader("Cache-Control", "private, max-age=3600"); return res.redirect(302, media.url); }
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta a variável WHATSAPP_TOKEN no Vercel." });
    if (!/^\d{5,30}$/.test(String(media.id))) return res.status(404).json({ error: "Id de mídia inválido." });
    // Dois passos da Graph API: o id dá uma url temporária (5 min), que só abre com o mesmo token.
    const info = await fetch(`${GRAPH}/${media.id}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    const meta = await info.json().catch(() => ({}));
    if (!info.ok || !meta.url) return res.status(404).json({ error: info.status === 404 || meta.error?.code === 100 ? "A Meta não guarda mais esta mídia (cerca de 30 dias)." : `Meta: ${meta.error?.message || `HTTP ${info.status}`}`.slice(0, 200) });
    const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!file.ok) return res.status(502).json({ error: `Meta: HTTP ${file.status} ao baixar a mídia` });
    res.setHeader("Content-Type", meta.mime_type || file.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400"); // a mesma imagem não precisa ir à Meta de novo hoje
    res.status(200).send(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
