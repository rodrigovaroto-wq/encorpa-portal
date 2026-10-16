// Menu lateral flutuante de vidro (Sidebar UI): recolhe para só ícones, mostra o nome ao passar o mouse,
// seções com título e contadores. No celular vira uma barra no rodapé.
import { NAV } from "../lib/nav.js";
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
