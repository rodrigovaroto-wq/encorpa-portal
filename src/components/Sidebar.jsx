// Menu lateral flutuante de vidro (Sidebar UI): recolhe para só ícones, mostra o nome ao passar o mouse,
// seções com título e contadores. No celular vira uma barra no rodapé.
import { useEffect, useState } from "react";
import { NAV, PAGES } from "../lib/nav.js";
import { Icon } from "./icons.jsx";

export function Sidebar({ route, collapsed, onToggle, data, period }) {
  const g = data?.global || {}, p = data?.periods?.[period];
  return (
    <nav className={`side glass ${collapsed ? "collapsed" : ""}`} aria-label="Seções">
      <div className="side-top">
        <a href="#/home" className="brand" aria-label="Painel">
          <img src="/logo.svg" alt="" width="34" height="34" />
          <img src="/wordmark.svg" alt="Encorpa" className="wordmark" />
        </a>
        <button className="round collapse-btn" onClick={onToggle} aria-label={collapsed ? "Abrir menu" : "Recolher menu"}><Icon name={collapsed ? "expand" : "collapse"} size={16} /></button>
      </div>
      {NAV.map((s) => (
        <div key={s.sec} className="side-sec">
          <p className="side-title">{s.sec}</p>
          {s.items.map((it) => {
            const n = it.badge?.(g, p), on = route.page.id === it.id;
            return (
              <a key={it.id} href={`#/${it.id}`} className={`side-item ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} data-tip={it.label}>
                <Icon name={it.icon} /><span className="label">{it.label}</span>{n ? <em>{n}</em> : null}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Celular (até 900 px): barra no rodapé com as 4 páginas mais usadas e "Menu", que abre uma folha com todas as seções e sub-abas.
const DOCK = ["home", "chat", "orders", "ads"];
const SHORT = { home: "Painel", chat: "Conversas", orders: "Pedidos", ads: "Anúncios" };

export function MobileNav({ route, data, period }) {
  const [open, setOpen] = useState(false);
  const g = data?.global || {}, p = data?.periods?.[period];
  useEffect(() => { setOpen(false); }, [route.page.id, route.sub?.[0]]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  const others = NAV.flatMap((s) => s.items).filter((it) => !DOCK.includes(it.id)), onOther = others.some((it) => it.id === route.page.id);
  const othersBadge = others.reduce((a, it) => a + (it.badge?.(g, p) || 0), 0);
  return (
    <>
      <nav className="m-dock glass" aria-label="Seções">
        {DOCK.map((id) => { const it = PAGES.find((x) => x.id === id), n = it.badge?.(g, p), on = route.page.id === id; return (
          <a key={id} href={`#/${id}`} className={on ? "on" : ""} aria-current={on ? "page" : undefined}><span className="m-ico"><Icon name={it.icon} />{n ? <em>{n}</em> : null}</span><small>{SHORT[id]}</small></a>
        ); })}
        <button className={onOther || open ? "on" : ""} onClick={() => setOpen(!open)} aria-expanded={open}><span className="m-ico"><Icon name="menu" />{othersBadge ? <em>{othersBadge}</em> : null}</span><small>Menu</small></button>
      </nav>
      {open && (
        <div className="m-sheet-bg" onClick={() => setOpen(false)}>
          <div className="m-sheet glass" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-grip" />
            {NAV.map((s) => (
              <div key={s.sec} className="m-sec">
                <p className="side-title">{s.sec}</p>
                {s.items.map((it) => { const n = it.badge?.(g, p), on = route.page.id === it.id; return (
                  <div key={it.id} className={`m-item ${on ? "on" : ""}`}>
                    <a href={`#/${it.id}`}><Icon name={it.icon} /><span>{it.label}</span>{n ? <em>{n}</em> : null}</a>
                    {it.subs && <div className="m-subs">{it.subs.map(([k, l]) => <a key={k} href={`#/${it.id}/${k}`} className={on && route.sub?.[0] === k ? "on" : ""}>{l}</a>)}</div>}
                  </div>
                ); })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
