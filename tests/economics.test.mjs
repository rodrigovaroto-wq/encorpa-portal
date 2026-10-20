// Caixa necessário (operador, 19/10): orçamento dos anúncios × premissas ideais (CPL R$ 1,25, conversão 10%). Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cashPlan, codUpfront } from "../src/lib/economics.js";

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("adiantado de um pedido na entrega de 1 peça: produto, entrega, manuseio e taxa", () => {
  near(codUpfront(129.9, 1), 62.72);
});

test("R$ 100 por semana: 80 leads, 8 pedidos, 5,6 na entrega", () => {
  const p = cashPlan(100 / 7, 7);
  near(p.spend, 100); near(p.leads, 80); near(p.orders, 8); near(p.cod_orders, 5.6);
  near(p.ad, 113.83);                 // anúncio + 13,83%
  near(p.api, 80 * 0.27 + 8 * 0.04);  // IA por lead + WhatsApp por pedido
  near(p.upfront, 5.6 * 62.72, 0.05);
  near(p.need, p.total, 1e-9);        // uma semana cabe antes do primeiro repasse
});

test("período maior que o ciclo de 21 dias: o caixa necessário é o de um ciclo", () => {
  const month = cashPlan(10, 30), cycle = cashPlan(10, 21);
  near(month.need, cycle.total, 1e-6);
  assert.ok(month.total > month.need);
});

test("sem orçamento não há conta", () => {
  assert.equal(cashPlan(0, 7), null);
  assert.equal(cashPlan(null, 7), null);
});

test("pausa pelo caixa: um ciclo inteiro de 21 dias, seja qual for o período na tela", async () => {
  const { computePause } = await import("../src/lib/data.js");
  const g = { ad_budget: 50 };
  const a = computePause({ metrics: {} }, g, "day"), b = computePause({ metrics: {} }, g, "12m");
  assert.deepEqual(a.p_cash, b.p_cash);
  assert.equal(a.p_cash.status, "bad", "R$ 50/dia pede mais que R$ 1.075 em 21 dias");
});
