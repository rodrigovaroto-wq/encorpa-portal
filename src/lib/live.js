// Conversas ao vivo (api/chats.js, sem cache): a cada 15 s na tela Conversas e a cada 60 s nas outras, só com a aba visível.
// Fica no App para o menu, o sininho e a busca contarem as mesmas conversas que a tela mostra.
import { useCallback, useEffect, useState } from "react";

// Último retrato bom: uma falha de rede mantém a lista em vez de esvaziá-la. Fora do componente, sobrevive a trocar de tela.
let LIVE = { updated: null, chats: null, failedAt: null };

export function useLiveChats(enabled, every) {
  const [live, setLive] = useState(LIVE);
  const load = useCallback(async () => {
    try {
      const r = await fetch("api/chats", { cache: "no-store", credentials: "same-origin" });
      const out = r.ok ? await r.json() : null;
      if (!Array.isArray(out?.chats)) throw new Error("sem conversas");
      LIVE = { updated: out.updated, chats: out.chats, failedAt: null };
    } catch {
      LIVE = { ...LIVE, failedAt: new Date().toISOString() };
    }
    setLive(LIVE);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const t = setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, every, load]);
  return [live, load];
}

// Os dados do portal com as conversas ao vivo, quando elas são mais novas que as de /api/data.
export function withLive(data, live) {
  if (!data || data.demo || !live.chats) return data;
  if (data.global.updated && live.updated && Date.parse(live.updated) < Date.parse(data.global.updated)) return data;
  return { ...data, global: { ...data.global, chats: live.chats }, chatsUpdated: live.updated };
}
