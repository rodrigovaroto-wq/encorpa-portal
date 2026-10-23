// Número do WhatsApp na Meta (lib/whatsapp.mjs) e o critério de pausa do canal (lib/build.mjs › channel). Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappNumber } from "../lib/whatsapp.mjs";
import { channel } from "../lib/build.mjs";

test("número: um campo que a Meta recusa não derruba a leitura; templates vêm da conta", async () => {
  globalThis.fetch = async (url) => {
    const u = String(url), ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("fields=messaging_limit_tier")) return { ok: false, status: 400, json: async () => ({ error: { message: "(#100) nonexisting field" } }) };
    if (u.includes("message_templates")) return ok({ data: [{ name: "pos_venda", status: "APPROVED", category: "UTILITY", language: "pt_BR", quality_score: { score: "GREEN" } }] });
    if (u.includes("account_review_status")) return ok({ name: "Encorpa", account_review_status: "APPROVED" });
    if (u.includes("fields=throughput")) return ok({ throughput: { level: "STANDARD" } });
    if (u.includes("display_phone_number")) return ok({ display_phone_number: "+55 11 90000-0000", verified_name: "Encorpa", quality_rating: "GREEN", status: "CONNECTED", name_status: "APPROVED" });
    return ok({});
  };
  const n = await whatsappNumber({ waToken: "t", waPhoneId: "1", waWabaId: "2" });
  assert.equal(n.status, "CONNECTED"); assert.equal(n.quality, "GREEN"); assert.equal(n.tier, null); assert.equal(n.throughput, "STANDARD");
  assert.equal(n.templates[0].quality, "GREEN");
  assert.equal(await whatsappNumber({}), null, "sem token não chama a Meta");
});

test("canal: número restrito ou com qualidade baixa pausa; qualidade média é atenção", () => {
  assert.equal(channel({ ok: true }, null, { ok: true, status: "RESTRICTED", quality: "GREEN" }).status, "bad");
  assert.equal(channel({ ok: true }, null, { ok: true, status: "CONNECTED", quality: "RED" }).status, "bad");
  assert.equal(channel({ ok: true }, null, { ok: true, status: "CONNECTED", quality: "YELLOW" }).status, "warn");
  const fine = channel({ ok: true }, null, { ok: true, status: "CONNECTED", quality: "GREEN", templates: [{ status: "APPROVED" }, { status: "PENDING" }] });
  assert.equal(fine.status, "ok"); assert.equal(fine.templates, "1 aprovados");
});
