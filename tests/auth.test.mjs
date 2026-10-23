// Usuários e papéis (lib/auth.mjs): o login, o papel de cada um e quem pode escrever. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { canWrite, parseUsers, userOf } from "../lib/auth.mjs";
import chat from "../api/chat.js";
import me from "../api/me.js";

const RAW = "dono@encorpa.com:a:b:c,op@encorpa.com:x:operador,ver@encorpa.com:y:leitura";
const basic = (s) => `Basic ${btoa(s)}`;

test("usuários: papel no fim é opcional (sem ele, admin); senha pode ter dois-pontos", () => {
  assert.deepEqual(parseUsers(RAW).map((u) => [u.email, u.cred, u.role]), [["dono@encorpa.com", "dono@encorpa.com:a:b:c", "admin"], ["op@encorpa.com", "op@encorpa.com:x", "operador"], ["ver@encorpa.com", "ver@encorpa.com:y", "leitura"]]);
  assert.deepEqual(userOf(basic("op@encorpa.com:x"), RAW), { email: "op@encorpa.com", role: "operador" });
  assert.equal(userOf(basic("op@encorpa.com:x:operador"), RAW), null, "o papel não é parte da senha");
  assert.equal(userOf(basic("op@encorpa.com:errada"), RAW), null);
  assert.equal(userOf("", RAW), null);
  assert.ok(canWrite("admin") && canWrite("operador") && !canWrite("leitura") && !canWrite(undefined));
});

const run = (h, req) => new Promise((done) => { const res = { code: 0, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { done({ code: this.code, body: b }); } }; h(req, res); });

test("usuários: só leitura não responde nem pausa a Malu; o admin vê a lista sem senhas", async () => {
  process.env.PORTAL_USERS = RAW; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  const r = await run(chat, { method: "POST", headers: { "content-type": "application/json", authorization: basic("ver@encorpa.com:y") }, body: { action: "pause", conversationId: "22222222-2222-4222-8222-222222222222" } });
  assert.equal(r.code, 403);
  const admin = await run(me, { headers: { authorization: basic("dono@encorpa.com:a:b:c") } });
  assert.deepEqual(admin.body.users.map((u) => u.role), ["admin", "operador", "leitura"]);
  assert.ok(!JSON.stringify(admin.body).includes(":a:b:c"), "sem senha");
  const op = await run(me, { headers: { authorization: basic("op@encorpa.com:x") } });
  assert.equal(op.body.role, "operador"); assert.equal(op.body.users, undefined);
});
