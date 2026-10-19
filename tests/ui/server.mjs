// Servidor de teste: serve dist/ e simula /api/data, /api/chats e /api/chat com os dados sintéticos de tests/fixture.mjs.
// O relógio é o de verdade: a fixture é recalculada para terminar agora.
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll, buildChats } from "../../lib/build.mjs";
import { NOW, fixture } from "../fixture.mjs";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml" };

export function start(port = 0) {
  const shift = Date.now() - NOW, fx = fixture();
  // Desloca todas as datas da fixture para "agora".
  for (const rows of Object.values(fx)) if (Array.isArray(rows)) for (const r of rows) for (const k of Object.keys(r)) if (/_at$/.test(k) && r[k]) r[k] = new Date(Date.parse(r[k]) + shift).toISOString();
  const state = { fx, failChats: false, sent: [] };
  const json = (res, code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/api/data") return json(res, 200, (await buildAll({ fixture: state.fx })).data);
    if (u.pathname === "/api/chats") return state.failChats ? json(res, 502, { error: "falha simulada" }) : json(res, 200, await buildChats({ fixture: state.fx }));
    if (u.pathname === "/api/chat") {
      let b = ""; for await (const c of req) b += c;
      const { action, conversationId, text } = JSON.parse(b), at = new Date().toISOString();
      const conv = state.fx.conversations.find((c) => c.id === conversationId), lead = state.fx.leads.find((l) => l.id === conv.lead_id);
      lead.handoff_at = action === "resume" ? null : lead.handoff_at || at;
      if (action === "send") {
        state.sent.push(text);
        state.fx.messages.push({ id: `op${state.sent.length}`, conversation_id: conversationId, direction: "outbound", body: text, created_at: at, external_id: `human:${conversationId}:x:1` });
        conv.last_outbound_at = at;
        return json(res, 200, { status: "sent", paused: true, pausedAt: lead.handoff_at, at });
      }
      return json(res, 200, { status: "ok", paused: !!lead.handoff_at, pausedAt: lead.handoff_at, at });
    }
    const f = join(dist, u.pathname === "/" ? "index.html" : u.pathname);
    if (!f.startsWith(dist) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done({ server, state, url: `http://127.0.0.1:${server.address().port}` })));
}
