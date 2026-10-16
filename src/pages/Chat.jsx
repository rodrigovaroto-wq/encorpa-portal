// Conversas da Malu no layout do Chat App UI: lista com busca e filtro por desfecho, fileira de quem está conversando agora,
// a conversa em bolhas e a ficha da cliente. Só leitura: o portal não responde pelo número (R22.1).
import { useEffect, useMemo, useRef, useState } from "react";
import { OUTCOME, OUTCOMES, STAGE } from "../lib/constants.js";
import { ago, dayKey, fmt, initials, timeOnly, when } from "../lib/format.js";
import { Chip, PageHead, Tabs } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Chat({ data, route }) {
  const chats = data.global.chats || [];
  const [q, setQ] = useState(""), [filter, setFilter] = useState("all");
  const selected = chats.find((c) => c.id === route.query.c) || null;
  const list = useMemo(() => chats.filter((c) => (filter === "all" || c.status === filter) && (!q || norm(`${c.name} ${c.phone} ${c.state} ${c.messages.map((m) => m.text).join(" ")}`).includes(norm(q)))), [chats, filter, q]);
  const counts = Object.fromEntries([["all", chats.length], ...OUTCOMES.map(([id]) => [id, chats.filter((c) => c.status === id).length])]);
  const open = chats.filter((c) => c.status === "open");
  const pick = (id) => { location.hash = `#/chat?c=${id}`; };
  useEffect(() => { if (!selected && list[0] && window.innerWidth > 900) history.replaceState(null, "", `#/chat?c=${list[0].id}`); }, [selected, list]);
  const current = selected || (window.innerWidth > 900 ? list[0] : null);
  return (
    <div className="page chat-page">
      <PageHead crumb="Operação" title="Conversas" desc="Todas as conversas da Malu com as clientes, com a ficha de cada uma." />
      <div className={`chat-shell glass ${current ? "has-current" : ""}`}>
        <aside className="chat-list">
          <label className="chat-search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, estado ou texto" /></label>
          {open.length > 0 && (
            <div className="live-row">
              {open.slice(0, 8).map((c) => <button key={c.id} onClick={() => pick(c.id)} title={c.name || c.short}><span className="avatar live">{initials(c.name)}</span><small>{(c.name || "Cliente").split(" ")[0]}</small></button>)}
            </div>
          )}
          <Tabs items={[["all", "Todas"], ...OUTCOMES.map(([id, l]) => [id, l])]} value={filter} onChange={setFilter} counts={counts} />
          <div className="threads">
            {list.map((c) => {
              const last = c.messages.at(-1);
              return (
                <button key={c.id} className={`thread ${current?.id === c.id ? "on" : ""}`} onClick={() => pick(c.id)}>
                  <span className={`avatar ${c.status === "open" ? "live" : ""}`}>{initials(c.name)}</span>
                  <span className="thread-body">
                    <span className="thread-top"><b>{c.name || `Cliente ${c.short}`}</b><small>{ago(c.last)}</small></span>
                    <span className="thread-last">{last ? `${last.out ? "Malu: " : ""}${last.text}` : "sem mensagens"}</span>
                  </span>
                  <i className={`dot ${OUTCOME[c.status]?.c || ""}`} title={OUTCOME[c.status]?.l} />
                </button>
              );
            })}
            {!list.length && <p className="empty">Nenhuma conversa neste filtro.</p>}
          </div>
        </aside>
        {current ? <Thread c={current} /> : <div className="chat-empty">Escolha uma conversa.</div>}
        {current && <Profile c={current} />}
      </div>
    </div>
  );
}

function Thread({ c }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c.id]);
  let lastDay = "";
  return (
    <section className="chat-thread">
      <header className="thread-head">
        <a href="#/chat" className="round back" aria-label="Voltar"><Icon name="collapse" /></a>
        <span className="avatar">{initials(c.name)}</span>
        <div><b>{c.name || `Cliente ${c.short}`}</b><small>{c.phone || ""} · {STAGE[c.stage] || c.stage} · {ago(c.last)}</small></div>
      </header>
      <div className="bubbles">
        {c.messages.map((m, i) => {
          const d = dayKey(m.at), sep = d !== lastDay; lastDay = d;
          return (
            <div key={i}>
              {sep && <p className="day-sep"><span>{new Date(m.at).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}</span></p>}
              <div className={`bubble ${m.out ? "out" : "in"}`}><p>{m.text || <i>(mídia ou mensagem sem texto)</i>}</p><small>{m.out ? "Malu · " : ""}{timeOnly(m.at)}</small></div>
            </div>
          );
        })}
        {!c.messages.length && <p className="empty">Conversa sem mensagens registradas.</p>}
        <div ref={end} />
      </div>
      <footer className="thread-foot">Só leitura: ninguém responde pelo número da Malu (R22.1). O que ela não resolve chega por e-mail ao operador.</footer>
    </section>
  );
}

function Profile({ c }) {
  const o = OUTCOME[c.status];
  const rows = [["Telefone", c.phone], ["Estado", c.state], ["Tamanho", c.size], ["Origem", c.origin], ["Etapa", STAGE[c.stage] || c.stage], ["Versão da Malu", c.version != null ? `v${c.version}` : null],
    ["Custo da conversa", fmt(c.cost, "brl")], ["Reescritas", fmt(c.rewrites, "n")], ["Respostas prontas", fmt(c.fallbacks, "n")], ["Última atividade", when(c.last)]];
  return (
    <aside className="chat-profile">
      <span className="avatar xl">{initials(c.name)}</span>
      <h3>{c.name || `Cliente ${c.short}`}</h3>
      {o && <Chip tone={o.c}>{o.l}</Chip>}
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
      {c.reasons.length > 0 && <div className="reasons"><p className="pop-title">Por que avisou o operador</p>{c.reasons.map((r, i) => <p key={i}>• {r}</p>)}</div>}
      {c.orders.length > 0 && <div className="reasons"><p className="pop-title">Pedidos</p>{c.orders.map((x, i) => <p key={i}>{x.units} peça{x.units > 1 ? "s" : ""} · {x.method === "prepay" ? "antecipado" : "na entrega"} · {fmt(x.amount, "brl")} · {x.status}</p>)}</div>}
    </aside>
  );
}
