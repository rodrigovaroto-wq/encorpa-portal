// Caixa necessário (operador, 19/10): orçamento dos anúncios × premissas ideais (CPL R$ 1,25, conversão 10%). Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cashPlan, codUpfront, fixedDue, fixedPayments, pikapods, waNumber } from "../src/lib/economics.js";

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("adiantado de um pedido na entrega de 1 peça: produto, entrega, manuseio e taxa", () => {
  near(codUpfront(129.9, 1), 62.72);
});

test("R$ 100 por semana: 80 leads, 8 pedidos, 5,6 na entrega", () => {
  const p = cashPlan(100 / 7, 7);
  near(p.spend, 100); near(p.leads, 80); near(p.orders, 8); near(p.cod_orders, 5.6);
  near(p.ad, 100);                    // o imposto da Meta já está dentro do gasto (operador, 20/10)
  assert.equal(p.fixed, undefined);   // os fixos ficam fora do caixa da operação (operador, 20/10)
  near(p.api, 80 * 0.05 + 8 * 0.04);  // IA por lead + WhatsApp por pedido
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
  assert.equal(a.p_cash.status, "info", "sem limite fixo para comparar (operador, 20/10)");
});

test("fixos só quando vencem (operador, 20/10): nada de rateio por dia", () => {
  near(fixedDue(Date.parse("2026-10-21T00:00:00Z"), Date.parse("2026-11-04T12:00:00Z")), 0, 1e-9);
  near(fixedDue(Date.parse("2026-11-04T12:00:00Z"), Date.parse("2026-11-06T00:00:00Z")), 35, 1e-9); // número no dia 5
  const dec = fixedPayments(Date.parse("2026-12-01T00:00:00Z"), Date.parse("2027-01-01T00:00:00Z"));
  assert.deepEqual(dec.map((p) => [p.id, p.brl]).sort(), [["pikapods", 54], ["wa_number", 35]]); // recarga ~28/12 + dia 5
  // Partição: somar os meses dá o mesmo que o ano inteiro, sem cobrar duas vezes na fronteira.
  const t0 = Date.parse("2026-10-21T00:00:00Z"), m = 30 * 864e5;
  near(Array.from({ length: 12 }, (_, i) => fixedDue(t0 + i * m, t0 + (i + 1) * m)).reduce((a, b) => a + b, 0), fixedDue(t0, t0 + 12 * m), 1e-9);
});


test("PikaPods: US$ 10 pagos; recarga de US$ 10 só quando o consumo leva o saldo de US$ 9,46 para baixo de US$ 1", () => {
  const before = pikapods(Date.parse("2026-12-27T12:00:00Z")), after = pikapods(Date.parse("2026-12-29T12:00:00Z"));
  assert.equal(before.topUps, 0); near(before.paid, 54);
  assert.equal(after.topUps, 1); near(after.paid, 108);
  assert.ok(after.balance > 9 && after.balance < 11);
  assert.equal(pikapods(Date.parse("2026-10-01T00:00:00Z")).topUps, 0, "antes da leitura do saldo não consome");
});

test("número do WhatsApp: R$ 55 no início e + R$ 35 a cada dia 5 de Brasília", () => {
  assert.equal(waNumber(Date.parse("2026-11-05T02:59:00Z")).paid, 55, "ainda 4/11 em Brasília");
  assert.equal(waNumber(Date.parse("2026-11-05T03:00:00Z")).paid, 90);
  assert.equal(waNumber(Date.parse("2027-01-05T12:00:00Z")).paid, 55 + 3 * 35);
});

test("caixa com CPL e conversão digitados: R$ 100 com CPL de R$ 2 e 5% = 50 leads e 2,5 pedidos", () => {
  const p = cashPlan(100 / 7, 7, { cpl: 2, conversion: 5 });
  near(p.leads, 50); near(p.orders, 2.5); near(p.api, 50 * 0.05 + 2.5 * 0.04);
  assert.equal(cashPlan(100 / 7, 7, { cpl: 0 }), null, "CPL zero não tem conta");
  near(cashPlan(100 / 7, 7, {}).leads, 80, 1e-9); // vazio = premissa ideal
});
