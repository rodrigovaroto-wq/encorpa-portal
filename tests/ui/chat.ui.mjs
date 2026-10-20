// Tela Conversas no navegador (Chromium), contra o servidor de teste. Rode depois do build: npm run build && npm run test:ui
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

const POLL = 16_000; // a tela consulta /api/chats a cada 15 s

test("Conversas: abrir, responder, ver a resposta ficar e sobreviver a uma falha de rede", { timeout: 120_000 }, async () => {
  const { server, state, url } = await start();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    // O link do e-mail traz o id da conversa antiga do lead com duas conversas: abre a cliente, com as mensagens das duas.
    await page.goto(`${url}/#/chat?c=33333333-3333-4333-8333-333333333333`);
    await page.waitForSelector(".thread");
    assert.equal(await page.locator(".thread").count(), 3, "3 clientes, sem a persona");
    assert.equal(await page.locator(".chat-thread .bubble").count(), 3);

    await page.goto(`${url}/#/chat?c=11111111-1111-4111-8111-111111111111`);
    await page.waitForSelector(".composer-row textarea");
    const before = await page.locator(".chat-thread .bubble").count();
    await page.fill(".composer-row textarea", "Mensagem do operador");
    await page.keyboard.press("Enter");
    await page.waitForFunction((n) => document.querySelectorAll(".chat-thread .bubble").length === n, before + 1);
    assert.deepEqual(state.sent, ["Mensagem do operador"]);
    assert.equal(await page.locator(".agent-switch.off").count(), 1, "Malu pausada na hora");

    await page.waitForTimeout(POLL);
    assert.equal(await page.locator(".chat-thread .bubble").count(), before + 1, "a mensagem aparece uma vez só depois do retrato do servidor");
    assert.equal(await page.locator(".agent-switch.off").count(), 1, "pausa confirmada pelo servidor");

    state.failChats = true;
    await page.waitForTimeout(POLL);
    assert.equal(await page.locator(".thread").count(), 3, "a lista fica na tela");
    assert.equal(await page.locator(".chat-stale").count(), 1, "e o aviso aparece");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test("Conversas: lendo o histórico, mensagem nova não puxa a tela; o menu conta as mesmas conversas", { timeout: 60_000 }, async () => {
  const { server, state, url } = await start();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1400, height: 500 } });
  try {
    const conv = "11111111-1111-4111-8111-111111111111";
    // Histórico comprido para haver o que rolar.
    for (let i = 0; i < 30; i++) state.fx.messages.push({ id: `h${i}`, conversation_id: conv, direction: i % 2 ? "outbound" : "inbound", body: `linha ${i}`, created_at: new Date(Date.now() - (60 - i) * 60000).toISOString(), external_id: null });
    await page.goto(`${url}/#/chat?c=${conv}`);
    await page.waitForSelector(".chat-thread .bubble");
    await page.waitForTimeout(500);
    await page.locator(".bubbles").evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
    state.fx.messages.push({ id: "nova", conversation_id: conv, direction: "inbound", body: "chegou agora", created_at: new Date().toISOString(), external_id: "wamid.nova" });
    await page.locator(".new-msgs").waitFor({ timeout: 20_000 });
    assert.equal(await page.locator(".bubbles").evaluate((el) => el.scrollTop), 0, "a leitura ficou onde estava");
    await page.click(".new-msgs");
    await page.waitForTimeout(300);
    assert.ok(await page.locator(".bubbles").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 80), "o botão leva ao fim");
    // A conversa não resolvida (Bia) aparece no contador do menu, vindo do mesmo retrato ao vivo.
    assert.equal(await page.locator('.side-item[href="#/chat"] em').textContent(), "1");
  } finally {
    await browser.close();
    server.close();
  }
});
