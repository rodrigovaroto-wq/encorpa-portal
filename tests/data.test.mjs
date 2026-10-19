// api/data.js guarda a leitura 60 s; lib/meta.mjs não mostra números incompletos e segura a última leitura boa. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import data, { reset } from "../api/data.js";
import { meta } from "../lib/meta.mjs";

const call = (handler) => new Promise((done) => { const r = { code: 0, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { done({ code: this.code, body: b, h: this.h }); } }; handler({ method: "GET", headers: {} }, r); });

test("api/data: duas abas no mesmo minuto fazem uma leitura só; falha não fica guardada", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; delete process.env.N8N_API_KEY; delete process.env.META_ACCESS_TOKEN;
  let reads = 0, fail = true;
  globalThis.fetch = async () => { reads++; if (fail) throw new Error("rede"); return { ok: true, status: 200, json: async () => [] }; };
  reset();
  assert.equal((await call(data)).code, 502);
  fail = false; reads = 0;
  const a = await call(data), first = reads, b = await call(data);
  assert.equal(a.code, 200); assert.equal(b.code, 200);
  assert.equal(reads, first, "a segunda aba usou a leitura guardada");
  assert.equal(a.h["Cache-Control"], "no-store");
});

test("meta: mais linhas que o limite falha em vez de somar um gasto menor", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [], paging: { next: "https://graph.facebook.com/next" } }) });
  await assert.rejects(meta({ metaToken: "t", metaAccount: "act_truncado" }), /leitura interrompida/);
});

test("meta: Meta fora segue com a última leitura boa, avisando", async () => {
  let up = true;
  globalThis.fetch = async () => { if (!up) throw new Error("limite de chamadas"); return { ok: true, status: 200, json: async () => ({ data: [] }) }; };
  const good = await meta({ metaToken: "t", metaAccount: "act_cache" });
  assert.deepEqual(good.campaigns, []);
  up = false;
  const again = await meta({ metaToken: "t", metaAccount: "act_cache" });
  assert.equal(again, good, "dentro de 15 min, a mesma leitura sem chamar a Meta");
});
