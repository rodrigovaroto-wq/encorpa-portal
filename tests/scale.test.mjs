// Escala do gráfico do Painel (operador, 03/11). Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { yScale } from "../src/lib/format.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
test("lucro de R$ 500 a R$ 1.500: 0 a R$ 1.650", () => { const s = yScale([500, 900, 1500]); near(s.min, 0); near(s.max, 1650); });
test("de −R$ 500 a R$ 1.500: −R$ 550 a R$ 1.650", () => { const s = yScale([-500, 200, 1500]); near(s.min, -550); near(s.max, 1650); });
test("só negativo: o topo é zero", () => { const s = yScale([-300, -100]); near(s.min, -330); near(s.max, 0); });
test("sem dado ou tudo zero: 0 a 1, nunca uma escala vazia", () => { assert.deepEqual(yScale([]), { min: 0, max: 1 }); assert.deepEqual(yScale([0, null, 0]), { min: 0, max: 1 }); });
