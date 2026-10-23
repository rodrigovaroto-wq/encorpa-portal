// Caixa de entrada do Painel e de Conversas (src/lib/inbox.js). Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxCounts, waitingSince } from "../src/lib/inbox.js";

const NOW = Date.parse("2026-10-23T15:00:00Z"), ago = (min) => new Date(NOW - min * 60000).toISOString();
const chat = (x) => ({ windowOpen: true, optedOut: false, paused: false, status: "open", flaggedAt: null, messages: [], ...x });

test("caixa de entrada: última mensagem dela espera resposta; passa do tempo depois de 15 min", () => {
  const a = chat({ messages: [{ out: false, at: ago(3) }] }), b = chat({ messages: [{ out: false, at: ago(40) }] });
  assert.deepEqual(inboxCounts([a, b], NOW), { unanswered: 2, person: 0, overdue: 1 });
});

test("caixa de entrada: a Malu passou para o operador e ninguém respondeu conta; com resposta do operador, não", () => {
  const flagged = chat({ status: "unresolved", flaggedAt: ago(30), paused: true, messages: [{ out: false, at: ago(31) }, { out: true, at: ago(30) }] });
  assert.equal(waitingSince(flagged), Date.parse(ago(30)));
  const answered = { ...flagged, messages: [...flagged.messages, { out: true, op: true, at: ago(10) }] };
  assert.equal(waitingSince(answered), null);
  assert.deepEqual(inboxCounts([flagged, answered], NOW), { unanswered: 1, person: 2, overdue: 1 });
});

test("caixa de entrada: janela fechada ou opt-out não pedem resposta", () => {
  assert.equal(waitingSince(chat({ windowOpen: false, messages: [{ out: false, at: ago(5) }] })), null);
  assert.equal(waitingSince(chat({ optedOut: true, messages: [{ out: false, at: ago(5) }] })), null);
});
