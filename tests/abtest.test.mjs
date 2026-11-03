// Teste A/B Site × WhatsApp (grafo §140 do Ricos-com-AI): braço pelo destino, metas, pausa com R$ 50 e R$ 75. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { armOf, armTotals, armVerdict, goalStatus, ARMS } from "../src/lib/abtest.js";

const set = (o) => ({ spend: 0, impressions: 0, clicks: 0, started: 0, leads: 0, orders: 0, ...o });
const goal = (k, id) => ARMS[k].goals.find((x) => x.id === id);

test("armOf: destino da Meta primeiro, nome depois", () => {
  assert.equal(armOf({ destination: "WEBSITE", name: "WhatsApp" }), "site");
  assert.equal(armOf({ destination: "WHATSAPP" }), "whatsapp");
  assert.equal(armOf({ name: "Conjunto Site — 22 cidades" }), "site");
  assert.equal(armOf({ name: "Conjunto B — Sudeste" }), null);
});

test("armTotals: taxas do WhatsApp; no Site o pedido fica na Coinzz", () => {
  const t = armTotals([set({ destination: "WHATSAPP", spend: 50, impressions: 2000, clicks: 50, started: 25, orders: 2 }), set({ destination: "WEBSITE", spend: 30, impressions: 1000, clicks: 40 })]);
  assert.equal(t.whatsapp.ctr, 2.5); assert.equal(t.whatsapp.cpc, 1); assert.equal(t.whatsapp.cpl, 2); assert.equal(t.whatsapp.conv, 8); assert.equal(t.whatsapp.cpo, 25);
  assert.equal(t.site.cpc, 0.75); assert.equal(t.site.orders, null); assert.equal(t.site.cpo, null);
});

test("goalStatus: meta batida, entre a meta e o limite, limite estourado só com o gasto que pede", () => {
  assert.equal(goalStatus(goal("whatsapp", "cpl"), 1.8, 10), "ok");
  assert.equal(goalStatus(goal("whatsapp", "cpl"), 3, 60), "warn");
  assert.equal(goalStatus(goal("whatsapp", "cpl"), 4.5, 40), "warn", "com menos de R$ 50 não pausa");
  assert.equal(goalStatus(goal("whatsapp", "cpl"), 4.5, 50), "bad");
  assert.equal(goalStatus(goal("site", "ctr"), 0.8, 55), "bad");
  assert.equal(goalStatus(goal("site", "ctr"), null, 55), "");
});

test("armVerdict: não começou, pausa do dia 2, pausa do dia 3 sem pedido, rodando", () => {
  const v = (k, o) => armVerdict(k, armTotals([set(o)])[k])[0];
  assert.equal(v("whatsapp", { destination: "WHATSAPP" }), "Não começou");
  assert.match(v("whatsapp", { destination: "WHATSAPP", spend: 55, impressions: 1000, clicks: 30, started: 10 }), /dia 2/); // conversa R$ 5,50
  assert.match(v("whatsapp", { destination: "WHATSAPP", spend: 80, impressions: 4000, clicks: 100, started: 50 }), /R\$ 75 sem pedido/);
  assert.equal(v("whatsapp", { destination: "WHATSAPP", spend: 80, impressions: 4000, clicks: 100, started: 50, orders: 3 }), "Rodando");
  assert.equal(armVerdict("site", armTotals([])["site"])[0], "Conjunto não encontrado na Meta");
});
