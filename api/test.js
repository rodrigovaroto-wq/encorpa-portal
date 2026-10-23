// Função do Vercel: conversas de teste com a Malu (Malu › Teste), atrás do login (middleware.js). Cada conversa nova ganha um
// telefone inventado 55000999 + 5 dígitos: o mesmo prefixo da rodada de personas do Ricos-com-AI (5500099…, "00" não é DDD, nenhum
// número real colide), que o portal já tira das métricas e não deixa responder. A mensagem vai direto para a função turn de
// produção (a "porta function" das personas): a turn devolve a resposta e NÃO manda nada pelo WhatsApp, quem manda é o n8n.
// Depois de cada mensagem os lembretes da régua dessa conversa são cancelados, para o n8n não tentar mandar para um número que
// não existe. Cada mensagem custa as chamadas de modelo daquela resposta (llm_calls), como numa conversa de verdade.
//   { action: "list" }                        as conversas de teste que existem, com etapa e custo
//   { action: "new" }                         um telefone novo (nada é gravado até a primeira mensagem)
//   { action: "history", phone }              as mensagens de uma conversa de teste
//   { action: "send", phone, text }           manda como se fosse a cliente; devolve o que a Malu respondeu
//   { action: "delete", phone }               apaga o lead de teste (em cascata: conversa, mensagens, custos, lembretes)
import { NO_KEY, SUPABASE_URL, serviceKey } from "../lib/env.mjs";

export const config = { maxDuration: 300 }; // a turn tem até 150 s por mensagem (o mesmo limite do n8n) e a recepção pede um segundo passo
export const TEST_PREFIX = "55000999";
const PHONE = new RegExp(`^${TEST_PREFIX}\\d{5}$`);
export const isTestPhone = (p) => PHONE.test(String(p ?? ""));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// O selo da mensagem (Ricos-com-AI › src/channel/inbound-signature.ts): com INBOUND_SIGNING_SECRET ligado na produção, a turn
// recusa mensagem sem selo. O mesmo HMAC-SHA256 sobre [externalId, from, body, sentAt].
export async function seal(secret, m) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify([m.externalId, m.from, m.body, m.sentAt ?? ""])));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// O que a Malu disse numa resposta da turn: o texto ou as bolhas (texto e mídia).
const said = (b) => (Array.isArray(b?.bubbles) ? b.bubbles.map((x) => (typeof x === "string" ? x : x?.text || (x?.media ? `[${x.media.kind === "image" ? "imagem" : x.media.kind === "audio" ? "áudio" : "vídeo"} da Malu]` : ""))).filter(Boolean) : typeof b?.reply === "string" && b.reply ? [b.reply] : []);
const facts = (b) => ({ status: b?.status ?? null, rewrites: typeof b?.rewrites === "number" ? b.rewrites : null, reason: typeof b?.reason === "string" ? b.reason : null, costBrl: typeof b?.costBrl === "number" ? b.costBrl : null });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return res.status(415).json({ error: "use JSON" }); // CSRF, como api/chat.js
  const key = serviceKey();
  if (!key) return res.status(500).json({ error: NO_KEY });
  const { action, phone, text } = req.body || {};
  if (!["list", "new", "history", "send", "delete"].includes(action)) return res.status(400).json({ error: "pedido inválido" });
  if (["history", "send", "delete"].includes(action) && !isTestPhone(phone)) return res.status(400).json({ error: "Telefone de teste inválido." });
  const body = String(text ?? "").trim();
  if (action === "send" && (!body || body.length > 4096)) return res.status(400).json({ error: "Mensagem vazia ou com mais de 4.096 caracteres." });

  const db = async (path, init = {}) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  };
  const conversationOf = async (p) => (await db(`leads?phone=eq.${p}&select=id,conversations(id,stage,cost_brl,created_at)`))[0]?.conversations?.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const cancelFollowups = async (id) => { if (UUID.test(id)) await db(`followups?conversation_id=eq.${id}&status=eq.scheduled`, { method: "PATCH", body: JSON.stringify({ status: "canceled" }) }).catch(() => undefined); };

  try {
    if (action === "new") {
      for (let i = 0; i < 5; i++) {
        const p = TEST_PREFIX + String(Math.floor(Math.random() * 1e5)).padStart(5, "0");
        if (!(await db(`leads?phone=eq.${p}&select=id`)).length) return res.status(200).json({ phone: p });
      }
      return res.status(503).json({ error: "Não achei um telefone de teste livre; apague conversas antigas." });
    }
    if (action === "list") {
      const rows = await db(`leads?phone=like.${TEST_PREFIX}*&select=phone,created_at,conversations(id,stage,cost_brl,last_inbound_at,last_outbound_at)&order=created_at.desc&limit=100`);
      return res.status(200).json({ tests: rows.filter((l) => isTestPhone(l.phone)).map((l) => {
        const c = (l.conversations || []).at(-1) || {};
        return { phone: l.phone, created: l.created_at, stage: c.stage ?? null, cost: (l.conversations || []).reduce((a, x) => a + (+x.cost_brl || 0), 0), last: c.last_outbound_at || c.last_inbound_at || l.created_at };
      }) });
    }
    if (action === "history") {
      const c = await conversationOf(phone);
      if (!c) return res.status(200).json({ messages: [], stage: null, cost: 0 });
      const messages = await db(`messages?conversation_id=eq.${c.id}&select=direction,body,created_at&order=created_at.asc`);
      return res.status(200).json({ messages: messages.map((m) => ({ out: m.direction === "outbound", text: m.body ?? "", at: m.created_at })), stage: c.stage, cost: +c.cost_brl || 0 });
    }
    if (action === "delete") {
      // O único DELETE possível: um telefone de teste exato (a mesma trava da rodada de personas).
      const gone = await db(`leads?phone=eq.${phone}`, { method: "DELETE" });
      return res.status(200).json({ deleted: gone.length });
    }

    // send: como a cliente; na recepção ("welcomed") a turn pede o segundo passo, que o n8n faz com o nó Wait: aqui, na hora.
    const secret = process.env.INBOUND_SIGNING_SECRET || "";
    const turn = async (extra = {}) => {
      const m = { externalId: `portal-test-${phone}-${Date.now()}`, from: phone, body, ...extra.keep };
      const signature = secret ? await seal(secret, m) : undefined;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/turn`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ ...m, ...(signature ? { signature } : {}), ...extra.flags }), signal: AbortSignal.timeout(150_000),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(out.error || out.message || `turn HTTP ${r.status}`), { status: r.status });
      return { out, m };
    };
    const first = await turn();
    const replies = [{ text: said(first.out), ...facts(first.out) }];
    if (first.out.status === "welcomed") {
      const resumed = await turn({ keep: { externalId: first.m.externalId }, flags: { resume: true } });
      replies.push({ text: said(resumed.out), ...facts(resumed.out) });
    }
    const c = await conversationOf(phone);
    if (c) await cancelFollowups(c.id);
    return res.status(200).json({ replies, stage: c?.stage ?? null, cost: +c?.cost_brl || 0 });
  } catch (e) {
    return res.status(502).json({ error: /signature|selo|seal/i.test(String(e.message)) ? "A turn recusou a mensagem sem selo: crie INBOUND_SIGNING_SECRET no Vercel (o mesmo do Supabase)." : String(e.message || e).slice(0, 300) });
  }
}
