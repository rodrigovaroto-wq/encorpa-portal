// Topo (Glassy CRM): saudação na página inicial, data de hoje, período em menu, busca (⌘K), notificações e preferências.
import { useEffect, useRef, useState } from "react";
import { PERIODS } from "../lib/constants.js";
import { ago, store } from "../lib/format.js";
import { Icon } from "./icons.jsx";

export function usePopover() {
  const [open, setOpen] = useState(false), ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return { open, setOpen, ref };
}

// Avisos a partir do que os dados já dizem: pedido novo, conversa não resolvida, workflow com erro, fonte fora.
export function notifications(data) {
  const g = data?.global || {}, out = [], day = Date.now() - 86400000;
  for (const o of g.orders || []) if (new Date(o.created).getTime() > day) out.push({ at: o.created, text: `Pedido novo ${o.id}${o.name ? ` — ${o.name}` : ""}`, href: "#/orders", tone: "ok" });
  for (const c of g.chats || []) if (c.status === "unresolved") out.push({ at: c.flaggedAt || c.last, text: `${c.name || "Cliente"}: a Malu avisou o operador (${c.reasons[0] || "sem motivo"})`, href: `#/chat?c=${c.id}`, tone: "bad" });
  for (const w of g.automations?.workflows || []) if (w.active && w.errors) out.push({ at: w.last?.at, text: `${w.name.replace(/^Encorpa — /, "")}: ${w.errors} execução com erro`, href: "#/auto/runs", tone: "bad" });
  for (const [k, h] of Object.entries(g.health || {})) if (h.ok === false) out.push({ at: g.updated, text: `${k}: ${h.detail}`, href: "#/integrations", tone: "bad" });
  return out.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 12);
}

export function Topbar({ route, period, setPeriod, data, onSearch, prefs, setPrefs, demo, setDemo }) {
  const per = usePopover(), bell = usePopover(), gear = usePopover();
  const list = notifications(data);
  const seen = Number(store.get("seen:notif") || 0);
  const unseen = list.filter((n) => new Date(n.at || 0).getTime() > seen).length;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  const live = data?.source === "live";
  return (
    <header className="topbar">
      <a href="#/home" className="m-brand" aria-label="Painel"><img src="/logo.svg" alt="" width="32" height="32" /></a>
      <button className="glass search" onClick={onSearch} aria-label="Buscar"><Icon name="search" /><span>Buscar conversas, anúncios, páginas…</span><kbd>⌘K</kbd></button>
      <span className="today"><Icon name="calendar" size={15} /> Hoje, {today}</span>
      <span className={`status-dot ${live ? "live" : ""}`} title={data?.updated ? `Atualizado ${ago(data.updated)}` : ""}>
        <i />{data?.demo ? "Exemplo" : live ? `Ao vivo · ${ago(data.updated)}` : data ? `Retrato · ${ago(data.updated)}` : "Sem dados"}
      </span>
      <div className="top-right">
        {route.page.id !== "auto" && route.page.id !== "integrations" && route.page.id !== "notes" && (
          <div className="pop" ref={per.ref}>
            <button className="glass pill" onClick={() => per.setOpen(!per.open)}>{PERIODS.find((p) => p.id === period)?.label}<Icon name="chevron" size={14} /></button>
            {per.open && <div className="glass popover">{PERIODS.map((p) => <button key={p.id} className={p.id === period ? "on" : ""} onClick={() => { setPeriod(p.id); per.setOpen(false); }}>{p.label}</button>)}</div>}
          </div>
        )}
        <div className="pop" ref={bell.ref}>
          <button className="glass round big" aria-label="Notificações" onClick={() => { bell.setOpen(!bell.open); store.set("seen:notif", String(Date.now())); }}>
            <Icon name="bell" />{unseen > 0 && <em className="ping">{unseen}</em>}
          </button>
          {bell.open && (
            <div className="glass popover wide">
              <p className="pop-title">Notificações ({list.length})</p>
              {list.length ? list.map((n, i) => <a key={i} href={n.href} className={`notif ${n.tone}`} onClick={() => bell.setOpen(false)}><span>{n.text}</span><small>{ago(n.at)}</small></a>) : <p className="empty">Nada novo.</p>}
            </div>
          )}
        </div>
        <div className="pop" ref={gear.ref}>
          <button className="glass round big" aria-label="Preferências" onClick={() => gear.setOpen(!gear.open)}><Icon name="gear" /></button>
          {gear.open && (
            <div className="glass popover wide">
              <p className="pop-title">Preferências</p>
              <label className="pref"><span>Tema</span>
                <span className="seg"><button className={prefs.theme === "dark" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "dark" })}><Icon name="moon" size={14} /> Escuro</button><button className={prefs.theme === "light" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "light" })}><Icon name="sun" size={14} /> Claro</button></span>
              </label>
              <label className="pref"><span>Animações do fundo</span><input type="checkbox" checked={prefs.motion !== "off"} onChange={(e) => setPrefs({ ...prefs, motion: e.target.checked ? "on" : "off" })} /></label>
              <label className="pref"><span>Dados de exemplo</span><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /></label>
              <p className="note">Fuso de Brasília · valores em reais · atualiza a cada 5 minutos.</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
