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

test("armVerdict: não começou, pausa com R$ 50, pausa com R$ 75 sem pedido, rodando", () => {
  const v = (k, o) => armVerdict(k, armTotals([set(o)])[k])[0];
  assert.equal(v("whatsapp", { destination: "WHATSAPP" }), "Não começou");
  assert.match(v("whatsapp", { destination: "WHATSAPP", spend: 55, impressions: 1000, clicks: 30, started: 10 }), /R\$ 50/); // conversa R$ 5,50
  assert.match(v("whatsapp", { destination: "WHATSAPP", spend: 80, impressions: 4000, clicks: 100, started: 50 }), /R\$ 75 sem pedido/);
  assert.equal(v("whatsapp", { destination: "WHATSAPP", spend: 80, impressions: 4000, clicks: 100, started: 50, orders: 3 }), "Rodando");
  assert.equal(armVerdict("site", armTotals([])["site"])[0], "Conjunto não encontrado na Meta");
});

test("siteOrders: pedido de lead sem marca de anúncio, desde o início do conjunto Site", async () => {
  const { siteOrders } = await import("../lib/build.mjs");
  const iso = (d) => `2026-11-${String(d).padStart(2, "0")}T12:00:00Z`, ms = (d) => Date.parse(iso(d));
  const D = {
    leads: [{ id: "zap", ctwa: "Afh2…" }, { id: "site" }, { id: "site2" }],
    orders: [
      { lead_id: "site", created_at: iso(6), status: "Agendado", payment_method: "cod", amount_brl: 109.9, units: 1 },
      { lead_id: "site2", created_at: iso(3), status: "Agendado", payment_method: "cod", amount_brl: 109.9, units: 1 }, // antes do início
      { lead_id: "zap", created_at: iso(6), status: "Agendado", payment_method: "cod", amount_brl: 109.9, units: 1 },
      { lead_id: "site", created_at: iso(7), status: "Cancelado", payment_method: "cod", amount_brl: 109.9, units: 1 }, // não é pedido feito
    ],
  };
  const sets = [{ destination: "WEBSITE", start: iso(5) }, { destination: "WHATSAPP", start: iso(1) }];
  assert.equal(siteOrders(D, ms(1), ms(10), sets), 1);
  assert.equal(siteOrders(D, ms(1), ms(10), [{ destination: "WHATSAPP", start: iso(1) }]), null, "sem conjunto Site: sem leitura");
});

test("armTotals: o pedido do Site lido entra na conversão e no custo, e R$ 75 sem pedido pausa", () => {
  const t = armTotals([set({ destination: "WEBSITE", spend: 60, impressions: 3000, clicks: 100 })], { site_orders: 3 });
  assert.equal(t.site.orders, 3); assert.equal(t.site.conv, 3); assert.equal(t.site.cpo, 20);
  const z = armTotals([set({ destination: "WEBSITE", spend: 80, impressions: 4000, clicks: 150 })], { site_orders: 0 });
  assert.match(armVerdict("site", z.site)[0], /R\$ 75 sem pedido/);
});

test("adAttribution: leads e pedidos por anúncio só da janela, como a view eval_attribution", async () => {
  const { adAttribution } = await import("../lib/build.mjs");
  const iso = (d) => `2026-11-${String(d).padStart(2, "0")}T12:00:00Z`, ms = (d) => Date.parse(iso(d));
  const D = {
    leads: [{ id: "a", ad: "ad1", created_at: iso(5) }, { id: "b", ad: "ad1", created_at: iso(6) }, { id: "c", ad: "ad1", created_at: iso(1) }, { id: "d", created_at: iso(5) }],
    orders: [{ lead_id: "a" }, { lead_id: "c" }],
    conversations: [{ lead_id: "a", stage: "entregue_pago" }],
  };
  assert.deepEqual(adAttribution(D, ms(4), ms(10)), { ad1: { leads: 2, leads_ordered: 1, leads_delivered: 1 } }, "o lead de antes da janela e o orgânico ficam fora");
  assert.deepEqual(adAttribution(D, ms(1), ms(10)).ad1, { leads: 3, leads_ordered: 2, leads_delivered: 1 });
});
