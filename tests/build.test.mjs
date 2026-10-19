// Contas do portal (lib/build.mjs) contra dados sintéticos. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { adBudget, buildAll, buildChats, channel, conversationStatus, dropSynthetic, orderValue, outcomeCounts } from "../lib/build.mjs";
import { NOW, fixture } from "./fixture.mjs";

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("orderValue: na entrega, margem cheia ao criar e − R$ 9,99 se frustrado", () => {
  near(orderValue({ status: "Agendado", payment_method: "cod", amount_brl: 129.9, units: 1 }).contribution, 67.18);
  assert.deepEqual(orderValue({ status: "Frustrado", payment_method: "cod", amount_brl: 129.9, units: 1 }), { kind: "refused", revenue: 0, contribution: -9.99 });
});

test("orderValue: antecipado só conta depois de pago; devolução paga o frete de volta", () => {
  assert.equal(orderValue({ status: "Aguardando pagamento", payment_method: "prepay", amount_brl: 116.91, units: 1 }).kind, "unpaid");
  assert.equal(orderValue({ status: "não pago", payment_method: "prepay", amount_brl: 116.91, units: 1 }).kind, "unpaid");
  assert.equal(orderValue({ status: "Pagamento aprovado", payment_method: "prepay", amount_brl: 116.91, units: 1 }).contribution, 77.92);
  assert.deepEqual(orderValue({ status: "Reembolsado", payment_method: "prepay", amount_brl: 116.91, units: 1 }), { kind: "returned", revenue: 0, contribution: -50 });
});

test("dropSynthetic: a rodada de personas sai de leads, conversas, mensagens e desfechos", () => {
  const D = dropSynthetic(fixture());
  assert.ok(!D.leads.some((l) => l.phone.startsWith("5500099")));
  assert.ok(!D.conversations.some((c) => c.lead_id === "lead-persona"));
  assert.ok(!D.messages.some((m) => m.conversation_id.startsWith("5555")));
});

test("conversationStatus: comprou > não resolvida > recusou > em andamento > abandonada", () => {
  const D = dropSynthetic(fixture());
  const st = Object.fromEntries(conversationStatus(D, NOW).map((r) => [r.id.slice(0, 1), r.status]));
  assert.equal(st["1"], "bought");
  assert.equal(st["2"], "unresolved");
  assert.equal(st["4"], "open");
  const n = outcomeCounts(conversationStatus(D, NOW));
  assert.equal(n.bought + n.unresolved + n.open + n.declined + n.abandoned, n.attended);
});

test("chats: uma linha por cliente, id = conversa mais nova, mensagens de todas as conversas", async () => {
  const { chats: rows } = await buildChats({ fixture: fixture() }, NOW);
  assert.equal(rows.length, 3, "3 clientes reais, sem a persona");
  const dup = rows.find((c) => c.ids.includes("33333333-3333-4333-8333-333333333333"));
  assert.equal(dup.id, "44444444-4444-4444-8444-444444444444");
  assert.deepEqual(dup.messages.map((m) => m.text), ["Oi", "Qual o preço?", "Oi! Me conta sua cintura."]);
  const bia = rows.find((c) => c.name === "Bia Teste");
  assert.equal(bia.paused, true);
  assert.equal(bia.messages.at(-1).op, true, "external_id human: = resposta do operador");
  assert.equal(bia.windowOpen, false, "48 h desde a última mensagem dela");
  assert.equal(bia.phone, "…0002", "nunca o telefone inteiro");
  assert.ok(rows.every((c, i) => !i || Date.parse(rows[i - 1].last) >= Date.parse(c.last)), "do movimento mais recente ao mais antigo");
});

test("buildAll: as métricas não contam a persona e a lista de conversas é a mesma de buildChats", async () => {
  const { data, D } = await buildAll({ fixture: fixture() }, NOW);
  assert.equal(D.leads.length, 3);
  assert.equal(data.periods.week.metrics.leads.value, 3);
  assert.equal(data.periods.week.metrics.orders.value, 1);
  assert.deepEqual(data.global.chats.map((c) => c.id), (await buildChats({ fixture: fixture() }, NOW)).chats.map((c) => c.id));
});

test("price_reach e funil: conversa com alguma mensagem nossa com R$ chegou ao preço", async () => {
  const { data } = await buildAll({ fixture: fixture() }, NOW);
  // 4 conversas reais na semana; só a da Ana recebeu "R$".
  near(data.periods.week.metrics.price_reach.value, 25);
  assert.equal(data.global.funnel.price, 1);
});

test("séries: intervalo sem base fica nulo (lacuna), contagem fica zero", async () => {
  const { data } = await buildAll({ fixture: fixture() }, NOW);
  const conv = data.periods.week.metrics.conversion.series, leads = data.periods.week.metrics.leads.series;
  assert.ok(conv.includes(null), "dias sem lead não viram 0% de conversão");
  assert.ok(!leads.includes(null) && leads.includes(0), "dias sem lead têm 0 leads");
});

test("adBudget: orçamento da campanha, ou soma dos conjuntos ativos; pausado fica fora", () => {
  const m = {
    campaigns: [{ id: "c1", status: "ACTIVE", daily_budget: 50 }, { id: "c2", status: "ACTIVE" }, { id: "c3", status: "PAUSED", daily_budget: 999 }],
    adsets: [
      { id: "s1", campaign_id: "c1", status: "ACTIVE", daily_budget: 25 }, // orçamento na campanha: não soma de novo
      { id: "s2", campaign_id: "c2", status: "ACTIVE", daily_budget: 10 },
      { id: "s3", campaign_id: "c2", status: "PAUSED", daily_budget: 70 },
      { id: "s4", campaign_id: "c2", status: "ACTIVE", lifetime_budget: 70, start: "2026-10-15T00:00:00Z", end: "2026-10-22T00:00:00Z" },
    ],
  };
  assert.equal(adBudget(m, NOW), 50 + 10 + 10);
  assert.equal(adBudget(null, NOW), null);
  assert.equal(adBudget({ error: "x" }, NOW), null);
});

test("channel: erro no envio ou silêncio de 3 dias pede atenção; sem leitura fica sem número", () => {
  const wf = (errors) => ({ workflows: [{ name: "Encorpa — WhatsApp envio", errors }] });
  assert.equal(channel({ ok: true }, wf(0)).status, "ok");
  assert.equal(channel({ ok: true }, wf(2)).status, "warn");
  assert.equal(channel({ ok: false }, wf(0)).status, "warn");
  assert.equal(channel({ ok: null }, null).status, null);
});

test("orderValue: na entrega, cancelado antes de sair não custa nada nem conta como recusa (operador, 19/10)", async () => {
  assert.deepEqual(orderValue({ status: "Cancelado", payment_method: "cod", amount_brl: 129.9, units: 1 }), { kind: "void", revenue: 0, contribution: 0 });
  assert.equal(orderValue({ status: "Frustrado", payment_method: "cod", amount_brl: 129.9, units: 1 }).kind, "refused");
  const fx = fixture();
  fx.orders.push({ id: "o2", external_id: "LZ2", lead_id: "lead-bia", created_at: fx.orders[0].created_at, updated_at: fx.orders[0].created_at, amount_brl: 129.9, status: "Cancelado", payment_method: "cod", units: 1, size: "M", scheduled_for: null });
  const { data } = await buildAll({ fixture: fx }, NOW);
  assert.equal(data.periods.week.metrics.orders.value, 1, "cancelado não é venda");
  assert.equal(data.global.orders.find((o) => o.id === "LZ2").step, "void");
});

test("entregue: \"Completo\" sim, \"Incompleto\" não", async () => {
  const fx = fixture();
  fx.orders.push({ ...fx.orders[0], id: "o3", external_id: "LZ3", status: "Completo" }, { ...fx.orders[0], id: "o4", external_id: "LZ4", status: "Incompleto" });
  const { data } = await buildAll({ fixture: fx }, NOW);
  const step = (id) => data.global.orders.find((o) => o.id === id).step;
  assert.equal(step("LZ3"), "delivered");
  assert.notEqual(step("LZ4"), "delivered");
});

test("chats: flaggedAt é a hora em que a Malu avisou o operador, não a última mensagem", async () => {
  const { chats: rows } = await buildChats({ fixture: fixture() }, NOW);
  const bia = rows.find((c) => c.name === "Bia Teste");
  assert.equal(bia.flaggedAt, new Date(NOW - 47.9 * 3600000).toISOString());
  assert.equal(rows.find((c) => c.name === "Ana Teste").flaggedAt, null);
});

test("chats: desfecho da cliente pela mesma precedência entre as conversas dela; motivo mais recente por último", async () => {
  const fx = fixture();
  // A conversa antiga da Duda teve aviso ao operador; a nova está em andamento.
  fx.turn_outcomes.push({ id: "t4", conversation_id: "33333333-3333-4333-8333-333333333333", outcome: "fallback", reason: "nenhuma reescrita passou", rewrites: 5, agent_version: 27, created_at: fx.messages[7].created_at });
  const { chats: rows } = await buildChats({ fixture: fx }, NOW);
  const duda = rows.find((c) => c.name === "Duda Teste");
  assert.equal(duda.status, "unresolved");
  assert.equal(duda.reasons.at(-1), "nenhuma reescrita passou");
});

test("adBudget: conjunto já encerrado e campanha sem conjunto rodando não contam", () => {
  const m = {
    campaigns: [{ id: "c1", status: "ACTIVE", daily_budget: 50 }, { id: "c2", status: "ACTIVE" }],
    adsets: [
      { id: "s1", campaign_id: "c1", status: "PAUSED", daily_budget: 25 },
      { id: "s2", campaign_id: "c2", status: "ACTIVE", daily_budget: 10, end: "2026-10-18T00:00:00Z" },
      { id: "s3", campaign_id: "c2", status: "ACTIVE", daily_budget: 20 },
    ],
  };
  assert.equal(adBudget(m, NOW), 20);
});
