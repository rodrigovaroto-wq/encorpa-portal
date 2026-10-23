// Funções do Vercel com o Supabase e o n8n simulados (fetch trocado). Rode: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import chat from "../api/chat.js";

const CONV = "22222222-2222-4222-8222-222222222222";
let calls, lead, n8nReply;
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.N8N_API_KEY = "n8n-key";
  process.env.PORTAL_USERS = "op@encorpa.com:segredo:operador,ver@encorpa.com:x:leitura";
  calls = [];
  lead = { id: "lead-bia", phone: "5511900000002", handoff_at: null };
  n8nReply = { status: "sent" };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (String(url).includes("/rest/v1/conversations")) return ok([{ lead_id: lead.id, leads: { ...lead } }]); // cópia, como o JSON da rede
    if (String(url).includes("/rest/v1/leads")) { lead.handoff_at = JSON.parse(init.body).handoff_at; return ok([lead]); }
    if (String(url).includes("/webhook/portal-responder")) return ok(n8nReply);
    throw new Error(`fetch inesperado: ${url}`);
  };
});

const AUTH = `Basic ${btoa("op@encorpa.com:segredo")}`;
function call(body, headers = { "content-type": "application/json", authorization: AUTH }) {
  return new Promise((done) => {
    const res = { code: 0, status(c) { this.code = c; return this; }, setHeader() {}, json(b) { done({ code: this.code, body: b }); } };
    chat({ method: "POST", headers, body }, res);
  });
}

test("recusa pedido que não é JSON, ação desconhecida ou id inválido", async () => {
  assert.equal((await call({ action: "send", conversationId: CONV, text: "oi" }, { "content-type": "text/plain" })).code, 415);
  assert.equal((await call({ action: "apagar", conversationId: CONV })).code, 400);
  assert.equal((await call({ action: "pause", conversationId: "1 or 1=1" })).code, 400);
  assert.equal((await call({ action: "send", conversationId: CONV, text: "  " })).code, 400);
});

test("enviar pausa a Malu antes de chamar o n8n", async () => {
  const out = await call({ action: "send", conversationId: CONV, text: "Segue o link" });
  assert.equal(out.code, 200);
  assert.equal(out.body.paused, true);
  const patch = calls.findIndex((c) => c.method === "PATCH"), hook = calls.findIndex((c) => c.url.includes("portal-responder"));
  assert.ok(patch >= 0 && patch < hook, "PATCH handoff_at antes do webhook");
  assert.deepEqual(calls[hook].body, { phone: "5511900000002", text: "Segue o link" });
});

test("recusa certa do n8n (nada saiu) devolve a Malu que o próprio envio pausou", async () => {
  n8nReply = { status: "refused", reason: "window_closed", message: "Janela fechada" };
  const out = await call({ action: "send", conversationId: CONV, text: "oi" });
  assert.equal(out.code, 409);
  assert.equal(out.body.paused, false);
  assert.equal(lead.handoff_at, null);
});

test("recusa do n8n numa conversa já pausada mantém a pausa", async () => {
  lead.handoff_at = "2026-10-19T12:00:00.000Z";
  n8nReply = { status: "refused", reason: "duplicate" };
  const out = await call({ action: "send", conversationId: CONV, text: "oi" });
  assert.equal(out.body.paused, true);
  assert.equal(lead.handoff_at, "2026-10-19T12:00:00.000Z");
});

test("erro do n8n (pode ter saído) mantém a pausa", async () => {
  n8nReply = { status: "error", message: "timeout" };
  const out = await call({ action: "send", conversationId: CONV, text: "oi" });
  assert.equal(out.code, 502);
  assert.equal(out.body.paused, true);
});

test("conversa de teste (persona) nunca recebe envio nem pausa", async () => {
  lead.phone = "5500099133877";
  const out = await call({ action: "send", conversationId: CONV, text: "oi" });
  assert.equal(out.code, 409);
  assert.ok(!calls.some((c) => c.method === "PATCH" || c.url.includes("portal-responder")));
});

test("devolver para a Malu limpa handoff_at", async () => {
  lead.handoff_at = "2026-10-19T12:00:00.000Z";
  const out = await call({ action: "resume", conversationId: CONV });
  assert.equal(out.body.paused, false);
  assert.equal(lead.handoff_at, null);
});

test("desfazer a pausa só apaga a pausa deste envio (PATCH condicional)", async () => {
  n8nReply = { status: "refused", reason: "window_closed" };
  await call({ action: "send", conversationId: CONV, text: "oi" });
  const patches = calls.filter((c) => c.method === "PATCH");
  assert.equal(patches.length, 2);
  assert.match(patches[1].url, /&handoff_at=eq\./);
});
