// Rótulos dos gráficos presos à hora do servidor. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUCKETS } from "../src/lib/constants.js";
import { bucketLabels } from "../src/lib/format.js";

test("bucketLabels: o primeiro intervalo da semana começa 7 dias antes da hora do servidor, não do navegador", () => {
  const labels = bucketLabels("week", BUCKETS, 7, "2026-10-19T15:00:00Z");
  assert.equal(labels[0], "12/10");
  assert.equal(labels[6], "18/10");
});

test("parseBrl: milhar com ponto, decimal com vírgula ou ponto", async () => {
  const { parseBrl } = await import("../src/lib/format.js");
  assert.equal(parseBrl("1.500"), 1500);
  assert.equal(parseBrl("1.500,50"), 1500.5);
  assert.equal(parseBrl("R$ 100"), 100);
  assert.equal(parseBrl("100,5"), 100.5);
  assert.equal(parseBrl("1500.50"), 1500.5);
  assert.equal(parseBrl("2.000.000"), 2000000);
});
