// Notas do operador (o "Quick Note Composer" do Glassy Dashboard), guardadas neste navegador.
import { useState } from "react";
import { ago, store } from "../lib/format.js";
import { Card, PageHead } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const TAGS = ["Malu", "Anúncios", "Pedidos", "Financeiro", "Ideia"];
const load = () => { try { return JSON.parse(store.get("notes") || "[]"); } catch { return []; } };

export function Notes() {
  const [notes, setNotes] = useState(load), [title, setTitle] = useState(""), [text, setText] = useState(""), [tag, setTag] = useState(TAGS[0]), [filter, setFilter] = useState("Todas");
  const save = (next) => { setNotes(next); store.set("notes", JSON.stringify(next)); };
  const add = () => { if (!title.trim() && !text.trim()) return; save([{ id: Date.now(), title: title.trim() || "Sem título", text: text.trim(), tag, at: new Date().toISOString() }, ...notes]); setTitle(""); setText(""); };
  const shown = notes.filter((n) => filter === "Todas" || n.tag === filter);
  return (
    <div className="page">
      <PageHead crumb="Sistema" title="Notas" desc="Anotações do operador, com etiqueta. Ficam guardadas neste navegador." />
      <div className="row r-1-2">
        <Card title="Nova nota">
          <div className="composer">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
            <div className="tag-row">{TAGS.map((t) => <button key={t} className={t === tag ? "on" : ""} onClick={() => setTag(t)}>{t}</button>)}</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva a nota" rows={6} />
            <button className="primary" onClick={add}><Icon name="plus" size={15} /> Salvar nota</button>
          </div>
        </Card>
        <Card title={`Notas (${notes.length})`} action={<div className="tag-row">{["Todas", ...TAGS].map((t) => <button key={t} className={t === filter ? "on" : ""} onClick={() => setFilter(t)}>{t}</button>)}</div>}>
          <div className="notes">
            {shown.map((n) => (
              <article key={n.id} className="glass note-card">
                <div className="note-head"><span className="tag">{n.tag}</span><small>{ago(n.at)}</small><button className="round" aria-label="Apagar nota" onClick={() => save(notes.filter((x) => x.id !== n.id))}><Icon name="trash" size={14} /></button></div>
                <h3>{n.title}</h3>{n.text && <p>{n.text}</p>}
              </article>
            ))}
            {!shown.length && <p className="empty">Nenhuma nota{filter !== "Todas" ? ` com a etiqueta ${filter}` : ""}.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
