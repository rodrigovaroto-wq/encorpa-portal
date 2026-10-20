// As conversas ao vivo só substituem as de /api/data quando são mais novas, e nunca nos dados de exemplo. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { withLive } from "../src/lib/live.js";

const data = { global: { updated: "2026-10-19T12:00:00Z", chats: [{ id: "velha" }] } };

test("retrato ao vivo mais novo substitui as conversas e guarda a hora dele", () => {
  const out = withLive(data, { updated: "2026-10-19T12:00:15Z", chats: [{ id: "nova" }] });
  assert.deepEqual(out.global.chats, [{ id: "nova" }]);
  assert.equal(out.chatsUpdated, "2026-10-19T12:00:15Z");
});

test("retrato ao vivo mais velho, ausente ou em dados de exemplo não muda nada", () => {
  assert.equal(withLive(data, { updated: "2026-10-19T11:59:00Z", chats: [{ id: "nova" }] }), data);
  assert.equal(withLive(data, { chats: null }), data);
  const demo = { ...data, demo: true };
  assert.equal(withLive(demo, { updated: "2026-10-19T13:00:00Z", chats: [] }), demo);
  assert.equal(withLive(null, { chats: [] }), null);
});
