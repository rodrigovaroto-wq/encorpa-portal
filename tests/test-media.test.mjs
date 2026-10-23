// Malu › Teste (api/test.js) e a imagem da conversa (api/media.js), com o Supabase, a turn e a Meta simulados. Rode: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import testApi, { isTestPhone, seal } from "../api/test.js";
import media from "../api/media.js";

const CONV = "33333333-3333-4333-8333-333333333333";
let calls, turnReplies;
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.WHATSAPP_TOKEN = "wa"; process.env.INBOUND_SIGNING_SECRET = "segredo"; process.env.PORTAL_USERS = "op@encorpa.com:s:operador";
  calls = [];
  turnReplies = [{ status: "welcomed", bubbles: [{ text: "Oi! Sou a Malu 💜" }] }, { status: "sent", reply: "Qual a sua cintura?", rewrites: 1, costBrl: 0.012 }];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, method: init.method || "GET", body });
    const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    if (u.includes("/functions/v1/turn")) return ok(turnReplies.shift());
    if (u.includes("/rest/v1/leads?phone=eq.") && u.includes("conversations")) return ok([{ id: "l", conversations: [{ id: CONV, stage: "conversando", cost_brl: 0.03, created_at: "2026-10-23T10:00:00Z" }] }]);
    if (u.includes("/rest/v1/followups")) return ok([{ id: "f" }]);
    if (u.includes("/rest/v1/leads?phone=eq.") && init.method === "DELETE") return ok([{ id: "l" }]);
    if (u.includes("/rest/v1/messages?id=eq.")) return ok([{ media: { kind: "image", id: "1234567890" } }]);
    if (u === "https://graph.facebook.com/v21.0/1234567890") return ok({ url: "https://lookaside.fbsbx.com/x", mime_type: "image/jpeg" });
    if (u === "https://lookaside.fbsbx.com/x") return { ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    throw new Error(`fetch inesperado: ${u}`);
  };
});
const run = (handler, req) => new Promise((done) => {
  const res = { code: 0, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { done({ code: this.code, body: b, h: this.h }); }, send(b) { done({ code: this.code, body: b, h: this.h }); }, redirect(c, u) { done({ code: c, location: u }); } };
  handler(req, res);
});
const post = (body) => run(testApi, { method: "POST", headers: { "content-type": "application/json", authorization: `Basic ${btoa("op@encorpa.com:s")}` }, body });

test("teste: o selo é o mesmo HMAC do Ricos-com-AI (inbound-signature.ts)", async () => {
  const m = { externalId: "x", from: "5500099912345", body: "oi" };
  assert.equal(await seal("s", m), createHmac("sha256", "s").update(JSON.stringify(["x", "5500099912345", "oi", ""])).digest("hex"));
});

test("teste: só telefones de teste 55000999 + 5 dígitos; nunca apaga um número real", async () => {
  assert.ok(isTestPhone("5500099912345")); assert.ok(!isTestPhone("5511999999999")); assert.ok(!isTestPhone("550009991234"));
  const r = await post({ action: "delete", phone: "5511999999999" });
  assert.equal(r.code, 400);
  assert.equal(calls.length, 0, "nenhuma chamada ao banco");
});

test("teste: a recepção pede o segundo passo; devolve as duas respostas e cancela os lembretes da régua", async () => {
  const r = await post({ action: "send", phone: "5500099912345", text: "Oi, vi o anúncio" });
  assert.equal(r.code, 200);
  const turns = calls.filter((c) => c.url.includes("/functions/v1/turn"));
  assert.equal(turns.length, 2);
  assert.equal(turns[1].body.resume, true); assert.equal(turns[1].body.externalId, turns[0].body.externalId, "o mesmo id no resume");
  assert.ok(turns[0].body.signature, "com selo");
  assert.deepEqual(r.body.replies.map((x) => x.text), [["Oi! Sou a Malu 💜"], ["Qual a sua cintura?"]]);
  assert.equal(r.body.replies[1].rewrites, 1);
  assert.ok(calls.some((c) => c.url.includes(`followups?conversation_id=eq.${CONV}&status=eq.scheduled`) && c.body.status === "canceled"));
});

test("imagem: baixa da Meta com o token e devolve o arquivo; nunca manda o id da Meta para o navegador", async () => {
  const r = await run(media, { method: "GET", query: { m: CONV }, url: `/api/media?m=${CONV}`, headers: {} });
  assert.equal(r.code, 200);
  assert.equal(r.h["Content-Type"], "image/jpeg");
  assert.deepEqual([...r.body], [1, 2, 3]);
  assert.equal((await run(media, { method: "GET", query: { m: "nao-uuid" }, url: "/api/media?m=nao-uuid", headers: {} })).code, 400);
});

test("conversa: a mensagem com imagem leva só o tipo e o id da linha", async () => {
  const { chats } = await import("../lib/build.mjs");
  const D = { leads: [{ id: "l1", phone: "5511900000001", created_at: "2026-10-23T10:00:00Z" }], conversations: [{ id: CONV, lead_id: "l1", stage: "conversando", created_at: "2026-10-23T10:00:00Z", last_inbound_at: "2026-10-23T10:00:00Z" }],
    messages: [{ id: "44444444-4444-4444-8444-444444444444", conversation_id: CONV, direction: "inbound", body: "[a cliente mandou uma imagem: colete preto]", created_at: "2026-10-23T10:00:00Z", media: { kind: "image", id: "999999" } }, { id: "m2", conversation_id: CONV, direction: "outbound", body: "Lindo!", created_at: "2026-10-23T10:01:00Z", media: null }],
    turn_outcomes: [], orders: [] };
  const [c] = chats(D, Date.parse("2026-10-23T11:00:00Z"));
  assert.deepEqual(c.messages[0].media, { kind: "image", mid: "44444444-4444-4444-8444-444444444444" });
  assert.equal(c.messages[1].media, undefined);
  assert.ok(!JSON.stringify(c).includes("999999"), "o id da Meta não vai para o navegador");
});
