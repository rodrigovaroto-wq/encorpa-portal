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
  const at = async (p) => (await mw(new Request(`https://portal.test${p}`)))?.status;
  assert.equal(await at("/api/data"), 401); assert.equal(await at("/"), 401); assert.equal(await at("/track.js/../api/data"), 401);
  for (const p of ["/api/track", "/track.js", "/convite.html", "/api/invite"]) assert.notEqual(await at(p), 401, p);
});

test("liveStats: agora = sinal nos últimos 2 min; chegadas por minuto", async () => {
  const { liveStats } = await import("../api/site.js");
  const now = Date.parse("2026-11-04T20:00:00Z"), ago = (m) => new Date(now - m * 60000).toISOString();
  const s = liveStats([{ created_at: ago(5), last_at: ago(0.5), device: "phone", product_at: ago(4) }, { created_at: ago(20), last_at: ago(10), device: "desktop", checkout_at: ago(12) }], now);
  assert.equal(s.now, 1); assert.equal(s.phone, 1); assert.equal(s.checkout, 1); assert.equal(s.arrivals[29 - 5], 1);
});

test("teamList: login com perfil, e convidado sem login no fim", async () => {
  const { teamList } = await import("../api/team.js");
  const t = teamList([{ email: "Op@Encorpa.com", role: "operador" }], [{ email: "op@encorpa.com", name: "Ana", title: "Atendimento" }, { email: "novo@encorpa.com", name: "Bia", role: "leitura", invite_token_hash: "h" }, { email: "ja@encorpa.com", role: "admin", password_hash: "pbkdf2$x" }]);
  assert.deepEqual(t.map((u) => [u.email, u.name, u.role, u.login]), [["Op@Encorpa.com", "Ana", "operador", true], ["novo@encorpa.com", "Bia", "leitura", false], ["ja@encorpa.com", undefined, "admin", true]]);
  assert.ok(t.every((u) => !("password_hash" in u) && !("invite_token_hash" in u)), "hash nunca vai ao navegador");
});

test("senha: hash PBKDF2 confere a certa e recusa a errada; whoIs entra pelo banco só com a senha certa", async () => {
  const { hashPassword, verifyPassword, whoIs } = await import("../lib/auth.mjs");
  const h = await hashPassword("senha-forte-123");
  assert.ok(h.startsWith("pbkdf2$") && !h.includes("senha-forte"));
  assert.equal(await verifyPassword("senha-forte-123", h), true); assert.equal(await verifyPassword("senha-forte-124", h), false); assert.equal(await verifyPassword("x", "lixo"), false);
  const db = async () => ({ ok: true, json: async () => [{ email: "bia@encorpa.com", role: "leitura", password_hash: h }] });
  const basic = (e, p) => `Basic ${btoa(`${e}:${p}`)}`;
  assert.deepEqual(await whoIs(basic("Bia@Encorpa.com", "senha-forte-123"), { raw: "", url: "u", key: "k", fetchImpl: db }), { email: "bia@encorpa.com", role: "leitura" });
  assert.equal(await whoIs(basic("bia@encorpa.com", "errada-errada"), { raw: "", url: "u", key: "k", fetchImpl: db }), null);
  assert.deepEqual(await whoIs(basic("op@encorpa.com", "segredo"), { raw: "op@encorpa.com:segredo:operador", url: "u", key: "k", fetchImpl: () => { throw new Error("não devia ir ao banco"); } }), { email: "op@encorpa.com", role: "operador" });
});

test("convite: o token vale uma vez, a senha fraca é recusada e o banco recebe só o hash", async () => {
  const { default: invite, passwordProblem } = await import("../api/invite.js");
  assert.ok(passwordProblem("curta")); assert.ok(passwordProblem("tem:dois-pontos")); assert.equal(passwordProblem("uma senha boa"), null);
  const token = "a".repeat(64);
  let row = { email: "bia@encorpa.com", name: "Bia" }, patched = null;
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === "PATCH") { patched = JSON.parse(init.body); const out = row ? [row] : []; row = null; return { ok: true, json: async () => out }; }
    if (init.method === "POST") return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => (row ? [row] : []) };
  };
  const run = (method, body, q) => new Promise((done) => { const res = { code: 0, status(c) { this.code = c; return this; }, setHeader() {}, json(b) { done({ code: this.code, body: b }); } };
    invite({ method, headers: { "content-type": "application/json" }, body, query: q, url: "/api/invite" }, res); });
  assert.equal((await run("GET", null, { t: "nao-e-token" })).code, 400);
  assert.equal((await run("GET", null, { t: token })).body.email, "bia@encorpa.com");
  assert.equal((await run("POST", { token, password: "curta" })).code, 400);
  const ok = await run("POST", { token, password: "uma senha boa" });
  assert.equal(ok.code, 200); assert.ok(patched.password_hash.startsWith("pbkdf2$")); assert.equal(patched.invite_token_hash, null);
  assert.equal((await run("POST", { token, password: "uma senha boa" })).code, 410, "segunda vez: o convite já foi usado");
});

test("api/team: convidar grava só o hash do token e manda o link pelo n8n", async () => {
  process.env.PORTAL_USERS = "adm@encorpa.com:x:admin";
  const { default: team } = await import("../api/team.js");
  const sent = [];
  globalThis.fetch = async (url, init = {}) => { sent.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null }); return { ok: true, status: 201, json: async () => (String(url).includes("portal-convite") ? { status: "sent" } : []) }; };
  const out = await new Promise((done) => { const res = { code: 0, status(c) { this.code = c; return this; }, setHeader() {}, json(b) { done({ code: this.code, body: b }); } };
    team({ method: "POST", headers: { "content-type": "application/json", authorization: `Basic ${btoa("adm@encorpa.com:x")}` }, body: { action: "invite", email: "Nova@Encorpa.com", name: "Nova", role: "operador" } }, res); });
  assert.deepEqual(out.body, { status: "sent" });
  const row = sent.find((c) => c.url.includes("portal_users?on_conflict")).body, mail = sent.find((c) => c.url.includes("portal-convite")).body;
  assert.equal(row.email, "nova@encorpa.com"); assert.match(row.invite_token_hash, /^[0-9a-f]{64}$/);
  const token = mail.text.match(/convite\.html#([0-9a-f]{64})/)[1];
  assert.notEqual(token, row.invite_token_hash, "o banco guarda o hash, não o token");
  assert.equal(mail.to, "nova@encorpa.com");
});
