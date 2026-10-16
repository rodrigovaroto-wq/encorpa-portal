// Busca rápida (⌘K / Ctrl+K): páginas, conversas, anúncios e workflows num lugar só.
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV } from "../lib/nav.js";
import { Icon } from "./icons.jsx";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Palette({ open, onClose, data, period }) {
  const [q, setQ] = useState(""), [sel, setSel] = useState(0), input = useRef(null);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  const items = useMemo(() => {
    const g = data?.global || {}, p = data?.periods?.[period] || {}, out = [];
    for (const s of NAV) for (const it of s.items) {
      out.push({ kind: "Página", label: it.label, href: `#/${it.id}`, icon: it.icon });
      for (const [k, l] of it.subs || []) out.push({ kind: it.label, label: l, href: `#/${it.id}/${k}`, icon: it.icon });
    }
    for (const c of g.chats || []) out.push({ kind: "Conversa", label: `${c.name || "Cliente"} ${c.phone || ""} · ${c.state || ""}`, extra: c.messages.map((m) => m.text).join(" "), href: `#/chat?c=${c.id}`, icon: "chat" });
    for (const a of p.meta?.ads || []) out.push({ kind: "Anúncio", label: a.name, href: "#/ads/ads", icon: "ads" });
    for (const w of g.automations?.workflows || []) out.push({ kind: "Workflow", label: w.name, href: "#/auto/workflows", icon: "flow" });
    for (const o of g.orders || []) out.push({ kind: "Pedido", label: `${o.id} ${o.name || ""} · ${o.status}`, href: "#/orders", icon: "box" });
    return out;
  }, [data, period]);
  const hits = useMemo(() => {
    const t = norm(q).trim();
    if (!t) return items.filter((x) => x.kind === "Página").slice(0, 12);
    return items.filter((x) => norm(`${x.kind} ${x.label} ${x.extra || ""}`).includes(t)).slice(0, 30);
  }, [q, items]);
  if (!open) return null;
  const go = (h) => { location.hash = h.href; onClose(); };
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass palette" role="dialog" aria-label="Busca">
        <div className="palette-input"><Icon name="search" /><input ref={input} value={q} placeholder="Busque por nome, texto da conversa, anúncio, pedido ou página" onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } if (e.key === "Enter" && hits[sel]) go(hits[sel]); }} /><kbd>Esc</kbd></div>
        <div className="palette-list">
          {hits.length ? hits.map((h, i) => <button key={i} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => go(h)}><Icon name={h.icon} /><span>{h.label}</span><small>{h.kind}</small></button>) : <p className="empty">Nada encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
