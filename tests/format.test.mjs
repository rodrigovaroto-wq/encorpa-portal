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
