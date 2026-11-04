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

// Coletor do site, "Site ao vivo" e equipe (04/11).
test("visitRow: aceita só o formato de uma visita e grava o carimbo do passo", async () => {
  const { visitRow } = await import("../api/track.js");
  const ok = { id: "abcdefghij0123456789", kind: "checkout", device: "phone", path: "/" };
  assert.deepEqual(Object.keys(visitRow(ok, "T")).sort(), ["checkout_at", "device", "id", "last_at"]);
  assert.equal(visitRow({ ...ok, kind: "view", ad: true }, "T").from_ad, true);
  for (const bad of [null, { ...ok, id: "curto" }, { ...ok, id: "ABCDEFGHIJ0123456789" }, { ...ok, kind: "order" }, { ...ok, device: "tv" }, { ...ok, kind: "__proto__" }]) assert.equal(visitRow(bad), null);
  assert.equal(visitRow({ ...ok, kind: "view", path: "javascript:x" }).path, "/");
});

test("api/track: recusa outra origem e só grava a visita do site da Encorpa", async () => {
  const { default: track } = await import("../api/track.js");
  const run = (headers, body) => new Promise((done) => { const res = { code: 0, status(c) { this.code = c; return this; }, setHeader() {}, end() { done({ code: this.code }); }, json(b) { done({ code: this.code, body: b }); } }; track({ method: "POST", headers, body }, res); });
  const body = JSON.stringify({ id: "abcdefghij0123456789", kind: "view", device: "desktop", path: "/" });
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) }); return { ok: true, status: 201 }; };
  assert.equal((await run({ origin: "https://golpe.com" }, body)).code, 403);
  assert.equal((await run({ origin: "https://encorpa-fashion.com.br" }, "{quebrado")).code, 400);
  assert.equal((await run({ origin: "https://www.encorpa-fashion.com.br" }, body)).code, 204);
  assert.ok(calls.at(-1).url.includes("site_sessions?on_conflict=id"));
});

test("middleware: só o coletor fica fora do login", async () => {
  process.env.PORTAL_USERS = "a@b.com:x";
  const { default: mw } = await import("../middleware.js");
  const at = (p) => mw(new Request(`https://portal.test${p}`)).status;
  assert.equal(at("/api/data"), 401); assert.equal(at("/"), 401); assert.equal(at("/track.js/../api/data"), 401);
  assert.notEqual(at("/api/track"), 401); assert.notEqual(at("/track.js"), 401);
});

test("liveStats: agora = sinal nos últimos 2 min; chegadas por minuto", async () => {
  const { liveStats } = await import("../api/site.js");
  const now = Date.parse("2026-11-04T20:00:00Z"), ago = (m) => new Date(now - m * 60000).toISOString();
  const s = liveStats([{ created_at: ago(5), last_at: ago(0.5), device: "phone", product_at: ago(4) }, { created_at: ago(20), last_at: ago(10), device: "desktop", checkout_at: ago(12) }], now);
  assert.equal(s.now, 1); assert.equal(s.phone, 1); assert.equal(s.checkout, 1); assert.equal(s.arrivals[29 - 5], 1);
});

test("teamList: login com perfil, e convidado sem login no fim", async () => {
  const { teamList } = await import("../api/team.js");
  const t = teamList([{ email: "Op@Encorpa.com", role: "operador" }], [{ email: "op@encorpa.com", name: "Ana", title: "Atendimento" }, { email: "novo@encorpa.com", name: "Bia" }]);
  assert.deepEqual(t.map((u) => [u.email, u.name, u.role, u.login]), [["Op@Encorpa.com", "Ana", "operador", true], ["novo@encorpa.com", "Bia", null, false]]);
});
