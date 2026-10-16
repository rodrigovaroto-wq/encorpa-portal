// Desenho de um workflow do n8n: posição real dos nós, sem sobreposição; gatilhos em verde. Os nós podem ser arrastados
// (só mover: ligação e nó não se apagam). A posição fica neste navegador; "Voltar ao desenho original" desfaz.
import { useRef, useState } from "react";
import { NODE } from "../lib/constants.js";
import { store } from "../lib/format.js";

const NW = 168, NH = 46;
const hits = (pos, name, p, gap) => Object.entries(pos).some(([k, q]) => k !== name && Math.abs(q.x - p.x) < NW + gap && Math.abs(q.y - p.y) < NH + gap);

function layout(w) {
  let saved = {};
  try { saved = JSON.parse(store.get(`flow:${w.id || w.name}`) || "{}"); } catch { saved = {}; }
  const minX = Math.min(...w.nodes.map((n) => n.x)), minY = Math.min(...w.nodes.map((n) => n.y)), pos = {};
  for (const n of [...w.nodes].sort((a, b) => a.x - b.x || a.y - b.y)) {
    if (saved[n.name]) { pos[n.name] = saved[n.name]; continue; }
    const p = { x: (n.x - minX) * 0.85 + 10, y: (n.y - minY) * 0.85 + 10 };
    while (hits(pos, n.name, p, 14)) p.y += NH + 16; // empurra para baixo enquanto encostar em outro nó
    pos[n.name] = p;
  }
  return pos;
}
const edge = (p, q) => { const x1 = p.x + NW, y1 = p.y + NH / 2, x2 = q.x, y2 = q.y + NH / 2, c = Math.max(40, Math.abs(x2 - x1) / 2); return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`; };

export function FlowSvg({ w }) {
  const [pos, setPos] = useState(() => layout(w));
  const drag = useRef(null), svg = useRef(null);
  if (!w.nodes.length) return null;
  const types = Object.fromEntries(w.nodes.map((n) => [n.name, n.type]));
  const vw = Math.max(...Object.values(pos).map((p) => p.x)) + NW + 200, vh = Math.max(...Object.values(pos).map((p) => p.y)) + NH + 120;
  const toSvg = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM().inverse());
  const down = (name) => (e) => { const pt = toSvg(e); drag.current = { name, dx: pt.x - pos[name].x, dy: pt.y - pos[name].y }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); };
  const move = (e) => { if (!drag.current) return; const pt = toSvg(e), { name, dx, dy } = drag.current; setPos((s) => ({ ...s, [name]: { x: Math.max(0, pt.x - dx), y: Math.max(0, pt.y - dy) } })); };
  const up = () => {
    if (!drag.current) return;
    const { name } = drag.current; drag.current = null;
    setPos((s) => { const p = { ...s[name] }; while (hits(s, name, p, 8)) p.y += NH + 16; const next = { ...s, [name]: p }; store.set(`flow:${w.id || w.name}`, JSON.stringify(next)); return next; });
  };
  const reset = () => { try { localStorage.removeItem(`flow:${w.id || w.name}`); } catch { /* nada */ } setPos(layout(w)); };
  return (
    <div className="flow-wrap">
      <svg ref={svg} className="wf" viewBox={`0 0 ${vw} ${vh}`} style={{ width: vw }} onPointerMove={move} onPointerUp={up} role="img" aria-label={`Fluxo do workflow ${w.name}`}>
        {w.edges.filter(([a, b]) => pos[a] && pos[b]).map(([a, b], i) => <path key={i} d={edge(pos[a], pos[b])} />)}
        {Object.entries(pos).map(([name, p]) => (
          <g key={name} className={`nd ${/Trigger$|^webhook$/.test(types[name]) ? "trig" : ""}`} transform={`translate(${p.x},${p.y})`} onPointerDown={down(name)}>
            <rect width={NW} height={NH} rx="9" /><text x="10" y="19">{name.length > 23 ? `${name.slice(0, 22)}…` : name}</text><text className="t" x="10" y="35">{NODE[types[name]] || types[name]}</text><title>{name}</title>
          </g>
        ))}
      </svg>
      <button className="ghost" onClick={reset}>Voltar ao desenho original</button>
    </div>
  );
}
