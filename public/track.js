// Coletor de visitas do encorpa-fashion.com.br para o Encorpa Portal (04/11). Instale no <head> do site:
//   <script src="https://SEU-PORTAL.vercel.app/track.js" defer></script>
// Conta a visita, quem viu o produto e quem abriu o checkout. Nada pessoal: um id aleatório por visita (30 min), o aparelho e o caminho.
// "Viu o produto": um elemento com data-encorpa="produto" apareceu na tela; sem ele, rolou 35% da página.
// "Abriu o checkout": window.encorpaTrack("checkout"), ou um clique num link da Coinzz/Logzz ou em data-encorpa="checkout".
(() => {
  const api = new URL("/api/track", document.currentScript.src).href, KEY = "encorpa:visit", TTL = 30 * 60000;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* sem armazenamento: uma visita por página */ }
  if (!v || Date.now() - v.at > TTL) v = { id: Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24), at: 0, sent: {} };
  const save = () => { v.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* idem */ } };
  const device = matchMedia("(max-width: 820px)").matches ? "phone" : "desktop", ad = /[?&](fbclid|utm_source=(facebook|instagram|meta|fb|ig))/i.test(location.search);
  const send = (kind) => { save(); fetch(api, { method: "POST", keepalive: true, headers: { "content-type": "text/plain" }, body: JSON.stringify({ id: v.id, kind, device, path: location.pathname, ad }) }).catch(() => {}); };
  const once = (kind) => { if (!v.sent[kind]) { v.sent[kind] = 1; send(kind); } };
  send("view");
  setInterval(() => document.visibilityState === "visible" && send("ping"), 30000);
  // A página é React: a oferta aparece depois deste script, então a conta é feita a cada rolagem, não uma vez só.
  const look = () => { const el = document.querySelector('[data-encorpa="produto"]'); if (el ? el.getBoundingClientRect().top < innerHeight * 0.8 : scrollY + innerHeight >= document.documentElement.scrollHeight * 0.35) { once("product"); removeEventListener("scroll", look); } };
  addEventListener("scroll", look, { passive: true }); setTimeout(look, 2000);
  addEventListener("click", (e) => { if (e.target.closest?.('a[href*="coinzz"], a[href*="logzz"], [data-encorpa="checkout"]')) { once("product"); once("checkout"); } }, true);
  // O site chama window.encorpaTrack("checkout") antes de ir para o checkout (o botão de compra não é um link).
  window.encorpaTrack = (kind) => { if (kind === "checkout") { once("product"); once("checkout"); } };
})();
