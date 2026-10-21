// api/leads.js lê a view mascarada lead_profiles_v; src/lib/profiles.js monta o agregado da tela Leads. Rode: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import leads from "../api/leads.js";
import { profileSummary } from "../src/lib/profiles.js";

const ROWS = [
  { id: "aaaaaaaa-1111-4111-8111-111111111111", created_at: "2026-10-20T10:00:00Z", stage: "pedido_criado", score: 100, score_band: "quente", score_at: "2026-10-20T11:00:00Z", occasion: "Casamento", objections: ["preco", "entrega"], price_sensitivity: "alta", audio_count: 2 },
  { id: "bbbbbbbb-2222-4222-8222-222222222222", created_at: "2026-10-20T12:00:00Z", stage: "tamanho_definido", score: 45, score_band: "morna", score_at: "2026-10-20T12:30:00Z", occasion: " casamento", objections: ["preco", "preco"], price_sensitivity: "media", audio_count: 0 },
  { id: "cccccccc-3333-4333-8333-333333333333", created_at: "2026-10-20T13:00:00Z", stage: "conversando", score: 10, score_band: "fria", score_at: null, occasion: null, objections: null, price_sensitivity: null, audio_count: null },
];
let calls, reply;
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  calls = [];
  reply = { ok: true, status: 200, json: async () => ROWS, text: async () => "" };
  globalThis.fetch = async (url) => { calls.push(String(url)); return reply; };
});
const call = (method = "GET") => new Promise((done) => {
  const res = { code: 0, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { done({ code: this.code, body: b, h: this.h }); } };
  leads({ method, headers: {} }, res);
});

test("api/leads lê a view só com as colunas da tela, nunca telefone, nome ou a dor", async () => {
  const out = await call();
  assert.equal(out.code, 200);
  assert.equal(out.body.available, true);
  assert.equal(out.body.leads.length, 3);
  assert.equal(out.h["Cache-Control"], "no-store");
  assert.match(calls[0], /\/rest\/v1\/lead_profiles_v\?select=/);
  assert.doesNotMatch(calls[0], /phone|name|address|pain|hook|\*/);
});

test("api/leads sem a view (migração não aplicada) responde vazio com aviso, não 500", async () => {
  reply = { ok: false, status: 404, json: async () => ({}), text: async () => '{"code":"PGRST205"}' };
  const out = await call();
  assert.equal(out.code, 200);
  assert.deepEqual(out.body.leads, []);
  assert.equal(out.body.available, false);
});

test("api/leads: outra falha do banco é 502; sem chave é 500; só GET", async () => {
  reply = { ok: false, status: 500, json: async () => ({}), text: async () => "erro" };
  assert.equal((await call()).code, 502);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await call()).code, 500);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  assert.equal((await call("POST")).code, 405);
});

test("agregado: faixas, objeções sem repetir por lead, preço, áudio, ocasião e onde a conversa para", () => {
  const s = profileSummary(ROWS);
  assert.deepEqual(s.bands, { quente: 1, morna: 1, fria: 1 });
  assert.deepEqual(s.objections, [["preco", 2], ["entrega", 1]]);
  assert.deepEqual(s.sensitivity, { alta: 1, media: 1, baixa: 0 });
  assert.equal(s.audio.leads, 1);
  assert.ok(Math.abs(s.audio.share - 100 / 3) < 1e-9);
  assert.equal(s.audio.avg, 2);
  assert.deepEqual(s.occasions, [["casamento", 2]]);
  assert.deepEqual(s.stops, [["tamanho_definido", 1], ["conversando", 1]]); // quem comprou não "parou"
});

test("agregado vazio não divide por zero", () => {
  const s = profileSummary([]);
  assert.equal(s.total, 0);
  assert.equal(s.audio.share, null);
  assert.equal(s.audio.avg, null);
});
