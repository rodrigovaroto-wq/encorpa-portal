// Conversas da Malu no layout do Chat App UI: lista com busca e filtro por desfecho, fileira de quem está conversando agora,
// a conversa em bolhas e a ficha da cliente. O operador responde por aqui (api/chat.js): a primeira mensagem pausa a Malu
// naquela conversa (leads.handoff_at), e "Devolver para a Malu" tira a pausa.
import { useEffect, useMemo, useRef, useState } from "react";
import { OUTCOME, OUTCOMES, STAGE } from "../lib/constants.js";
import { ago, dayKey, fmt, initials, timeOnly, when } from "../lib/format.js";
import { Chip, PageHead, Tabs } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Chat({ data, route }) {
  // O que o operador fez nesta sessão (envio, pausa) vale na hora; os dados do servidor chegam a cada 5 min.
  const [local, setLocal] = useState({});
  const chats = useMemo(() => (data.global.chats || []).map((c) => {
    const l = local[c.id];
    if (!l) return c;
    const sent = (l.sent || []).filter((x) => !c.messages.some((m) => m.out && m.text === x.text && Math.abs(new Date(m.at) - new Date(x.at)) < 600000));
    return { ...c, paused: l.paused ?? c.paused, pausedAt: l.pausedAt ?? c.pausedAt, messages: [...c.messages, ...sent], last: sent.at(-1)?.at || c.last };
  }), [data, local]);
  const patch = (id, f) => setLocal((x) => ({ ...x, [id]: f(x[id] || {}) }));
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
                    <span className="thread-last">{last ? `${last.op ? "Você: " : last.out ? "Malu: " : ""}${last.text}` : "sem mensagens"}</span>
                  </span>
                  <i className={`dot ${OUTCOME[c.status]?.c || ""}`} title={OUTCOME[c.status]?.l} />
                </button>
              );
            })}
            {!list.length && <p className="empty">Nenhuma conversa neste filtro.</p>}
          </div>
        </aside>
        {current ? <Thread c={current} patch={patch} /> : <div className="chat-empty">Escolha uma conversa.</div>}
        {current && <Profile c={current} />}
      </div>
    </div>
  );
}

function Thread({ c, patch }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c.id, c.messages.length]);
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
              <div className={`bubble ${m.out ? "out" : "in"}`}><p>{m.text || <i>(mídia ou mensagem sem texto)</i>}</p><small>{m.op ? "Você · " : m.out ? "Malu · " : ""}{timeOnly(m.at)}</small></div>
            </div>
          );
        })}
        {!c.messages.length && <p className="empty">Conversa sem mensagens registradas.</p>}
        <div ref={end} />
      </div>
      <Composer c={c} patch={patch} />
    </section>
  );
}

// Caixa de resposta do operador e a chave da Malu nesta conversa.
async function post(body) {
  const r = await fetch("api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  return { ok: r.ok, ...out };
}

function Composer({ c, patch }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  useEffect(() => { setText(""); setError(null); }, [c.id]);
  const keep = (out) => out.paused !== undefined && patch(c.id, (x) => ({ ...x, paused: out.paused, pausedAt: out.pausedAt }));
  const toggle = async () => {
    setBusy(true); setError(null);
    const out = await post({ action: c.paused ? "resume" : "pause", conversationId: c.id }).catch(() => ({ error: "Sem conexão com o portal." }));
    if (out.ok) keep(out); else setError(out.error || "Não deu para mudar a Malu.");
    setBusy(false);
  };
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setError(null);
    const out = await post({ action: "send", conversationId: c.id, text: body }).catch(() => ({ error: "Sem conexão com o portal." }));
    keep(out);
    if (out.ok) { patch(c.id, (x) => ({ ...x, sent: [...(x.sent || []), { out: true, op: true, text: body, at: new Date().toISOString() }] })); setText(""); }
    else setError(out.error || "A mensagem não saiu.");
    setBusy(false);
  };
  const blocked = c.optedOut ? "Ela pediu para não receber mais mensagens." : !c.windowOpen ? "Janela de 24 h fechada: o WhatsApp só aceita texto livre até 24 h depois da última mensagem dela." : null;
  return (
    <footer className="composer">
      <div className={`agent-switch ${c.paused ? "off" : "on"}`}>
        <i />
        <span>{c.paused ? <>Malu pausada nesta conversa{c.pausedAt ? ` desde ${when(c.pausedAt)}` : ""}: você está respondendo.</> : <>Malu ativa nesta conversa. Ao enviar uma mensagem, ela pausa aqui.</>}</span>
        <button className="ghost" onClick={toggle} disabled={busy}>{c.paused ? "Devolver para a Malu" : "Pausar a Malu"}</button>
      </div>
      {error && <p className="composer-error">{error}</p>}
      {blocked ? <p className="composer-note">{blocked}</p> : (
        <div className="composer-row">
          <textarea value={text} rows={1} maxLength={4096} placeholder="Escreva para a cliente…" title="Enter envia · Shift+Enter quebra a linha" disabled={busy}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="send" onClick={send} disabled={busy || !text.trim()} aria-label="Enviar"><Icon name="send" /></button>
        </div>
      )}
    </footer>
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
      {c.paused && <Chip tone="warn">Malu pausada</Chip>}
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
      {c.reasons.length > 0 && <div className="reasons"><p className="pop-title">Por que avisou o operador</p>{c.reasons.map((r, i) => <p key={i}>• {r}</p>)}</div>}
      {c.orders.length > 0 && <div className="reasons"><p className="pop-title">Pedidos</p>{c.orders.map((x, i) => <p key={i}>{x.units} peça{x.units > 1 ? "s" : ""} · {x.method === "prepay" ? "antecipado" : "na entrega"} · {fmt(x.amount, "brl")} · {x.status}</p>)}</div>}
    </aside>
  );
}
