// Topo (Glassy CRM): data de hoje, período em menu, busca (⌘K), notificações e o botão das Configurações (components/Settings.jsx).
import { useEffect, useRef, useState } from "react";
import { PERIODS, customPeriod, periodLabel } from "../lib/constants.js";
import { usePeriod } from "../lib/data.js";
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
  for (const c of g.chats || []) if (c.status === "unresolved") out.push({ at: c.flaggedAt || c.last, text: `${c.name || "Cliente"}: a Malu avisou o operador (${c.reasons.at(-1) || "sem motivo"})`, href: `#/chat?c=${c.id}`, tone: "bad" });
  for (const w of g.automations?.workflows || []) if (w.active && w.errors) out.push({ at: w.last?.at, text: `${w.name.replace(/^Encorpa — /, "")}: ${w.errors} execução com erro`, href: "#/auto/runs", tone: "bad" });
  for (const [k, h] of Object.entries(g.health || {})) if (h.ok === false) out.push({ at: g.updated, text: `${k}: ${h.detail}`, href: "#/integrations", tone: "bad" });
  return out.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 12);
}

// Escolha do período (operador, 04/11): os fixos ou um período livre de/até, no topo e no topo de cada gráfico.
// inherit: o gráfico segue o período do topo até alguém escolher outro (value null).
const dayIso = (ts) => new Date(ts - 3 * 3600000).toISOString().slice(0, 10);
export function PeriodPicker({ value, onChange, inherit = false, small = false }) {
  const pop = usePopover(), c = customPeriod(value), today = dayIso(Date.now());
  const [from, setFrom] = useState(c ? dayIso(c.from) : dayIso(Date.now() - 6 * 864e5)), [to, setTo] = useState(c ? dayIso(c.to - 864e5) : today);
  const ok = customPeriod(`c:${from}:${to}`), pick = (v) => { onChange(v); pop.setOpen(false); };
  return (
    <div className="pop" ref={pop.ref}>
      <button className={`glass pill ${small ? "small" : ""}`} aria-haspopup="true" aria-expanded={pop.open} onClick={() => pop.setOpen(!pop.open)}>{inherit && !value ? "Período do topo" : periodLabel(value)}<Icon name="chevron" size={14} /></button>
      {pop.open && (
        <div className="glass popover period-pop">
          {inherit && <button className={!value ? "on" : ""} onClick={() => pick(null)}>Período do topo</button>}
          {PERIODS.map((p) => <button key={p.id} className={p.id === value ? "on" : ""} onClick={() => pick(p.id)}>{p.label}</button>)}
          <form className="period-custom" onSubmit={(e) => { e.preventDefault(); if (ok) pick(ok.id); }}>
            <p className="pop-title">Período livre</p>
            <label>De <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} aria-label="Começo do período" /></label>
            <label>Até <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} aria-label="Fim do período" /></label>
            <button className="glass pill small" disabled={!ok}>{ok ? "Aplicar" : "Datas inválidas"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

// Período próprio de um gráfico: começa no do topo; o escolhido no gráfico vale só para ele.
export function useChartPeriod(data, period) {
  const [own, setOwn] = useState(null), id = own || period, p = usePeriod(data, id);
  return { id, p, picker: <PeriodPicker value={own} onChange={setOwn} inherit small /> };
}

export function Topbar({ route, period, setPeriod, data, onSearch, onSettings, prefs, setPrefs }) {
  const bell = usePopover();
  const dark = prefs?.theme !== "light";
  const list = notifications(data);
  const seen = Number(store.get("seen:notif") || 0);
  const unseen = list.filter((n) => new Date(n.at || 0).getTime() > seen).length;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  const live = data?.source === "live";
  return (
    <header className="topbar">
      <a href="#/home" className="m-brand" aria-label="Home"><img src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="" className="wordmark" /></a>
      <button className="glass search" onClick={onSearch} aria-label="Buscar"><Icon name="search" /><span>Buscar conversas, anúncios, páginas…</span><kbd>⌘K</kbd></button>
      <span className="today"><Icon name="calendar" size={15} /> Hoje, {today}</span>
      <span className={`status-dot ${live ? "live" : ""}`} title={data?.updated ? `Atualizado ${ago(data.updated)}` : ""}>
        <i />{data?.demo ? "Exemplo" : live ? `Ao vivo · ${ago(data.updated)}` : data ? `Retrato · ${ago(data.updated)}` : "Sem dados"}
      </span>
      <div className="top-right">
        <button className="glass round big" aria-label={dark ? "Mudar para o tema claro" : "Mudar para o tema escuro"} title={dark ? "Tema claro" : "Tema escuro"} onClick={() => setPrefs({ ...prefs, theme: dark ? "light" : "dark" })}><Icon name={dark ? "sun" : "moon"} /></button>
        {route.page.id !== "auto" && route.page.id !== "integrations" && route.page.id !== "notes" && <PeriodPicker value={period} onChange={setPeriod} />}
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
        <button className="glass round big" aria-label="Configurações" title="Configurações" onClick={onSettings}><Icon name="gear" /></button>
      </div>
    </header>
  );
}
