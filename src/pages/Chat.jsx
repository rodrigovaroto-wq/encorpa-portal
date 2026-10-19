// Conversas da Malu no layout do Chat App UI: lista com busca e filtro por desfecho, fileira de quem está conversando agora,
// a conversa em bolhas e a ficha da cliente. O operador responde por aqui (api/chat.js): a primeira mensagem pausa a Malu
// naquela conversa (leads.handoff_at), e "Devolver para a Malu" tira a pausa.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OUTCOME, OUTCOMES, STAGE } from "../lib/constants.js";
import { ago, dayKey, fmt, initials, timeOnly, when } from "../lib/format.js";
import { Chip, PageHead, Tabs } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// O que o operador fez nesta sessão (envio, pausa) vale na hora, até o servidor mostrar o mesmo.
// Fica fora do componente para sobreviver a sair da tela e voltar.
let LOCAL = {};
// Último retrato bom de api/chats: uma falha de rede mantém a lista na tela em vez de esvaziá-la.
let LIVE = { updated: null, chats: null, failedAt: null };
const POLL = 15_000;
const ms = (s) => new Date(s).getTime();

// Conversas ao vivo (api/chats.js, sem cache) a cada 15 s com a aba visível; /api/data chega a ter 5 min de atraso.
function useLiveChats(enabled) {
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
    const t = setInterval(tick, POLL);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, load]);
  return [live, load];
}

export function Chat({ data, route }) {
  const [local, setLocalState] = useState(LOCAL);
  const setLocal = (f) => setLocalState((x) => (LOCAL = f(x)));
  const [live, reload] = useLiveChats(!data.demo && location.protocol !== "file:");
  // O retrato mais novo entre o ao vivo e o de /api/data.
  const base = live.chats && (!data.global.updated || !live.updated || ms(live.updated) >= ms(data.global.updated)) ? live : { updated: data.global.updated, chats: data.global.chats || [] };
  const chats = useMemo(() => base.chats.map((c) => {
    const l = local[c.id];
    if (!l) return c;
    // A mensagem enviada fica até o servidor mostrar a mesma (texto igual, do operador); 10 min no máximo.
    const sent = (l.sent || []).filter((x) => Date.now() - ms(x.at) < 600_000 && !c.messages.some((m) => m.op && m.text.trim() === x.text && Math.abs(ms(m.at) - ms(x.at)) < 600_000));
    // A pausa vale até chegar um retrato lido depois dela; as duas horas são do servidor.
    const pause = l.pauseAt && (!base.updated || ms(base.updated) < ms(l.pauseAt)) ? { paused: l.paused, pausedAt: l.pausedAt } : {};
    return { ...c, ...pause, messages: [...c.messages, ...sent], last: sent.at(-1)?.at || c.last };
  }), [base, local]);
  const patch = (id, f) => setLocal((x) => ({ ...x, [id]: f(x[id] || {}) }));
  const [q, setQ] = useState(""), [filter, setFilter] = useState("all");
  // O link do e-mail traz o id de uma conversa; a lista tem uma linha por cliente, com todas as conversas dela.
  const selected = chats.find((c) => c.id === route.query.c || c.ids?.includes(route.query.c)) || null;
  const list = useMemo(() => chats.filter((c) => (filter === "all" || c.status === filter) && (!q || norm(`${c.name} ${c.phone} ${c.state} ${c.messages.map((m) => m.text).join(" ")}`).includes(norm(q)))), [chats, filter, q]);
  const counts = Object.fromEntries([["all", chats.length], ...OUTCOMES.map(([id]) => [id, chats.filter((c) => c.status === id).length])]);
  const open = chats.filter((c) => c.status === "open");
  const pick = (id) => { location.hash = `#/chat?c=${id}`; };
  // Sem ?c= abre a primeira; com um ?c= que não está na lista (fora das 150 mais recentes ou no retrato), avisa em vez de abrir outra cliente.
  const missing = !!route.query.c && !selected;
  useEffect(() => { if (!route.query.c && list[0] && window.innerWidth > 900) history.replaceState(null, "", `#/chat?c=${list[0].id}`); }, [route.query.c, list]);
  const current = selected || (!route.query.c && window.innerWidth > 900 ? list[0] : null);
  return (
    <div className="page chat-page">
      <PageHead crumb="Operação" title="Conversas" desc="Todas as conversas da Malu com as clientes, com a ficha de cada uma." />
      {live.failedAt && !data.demo && <p className="composer-error chat-stale">Sem atualização ao vivo{base.updated ? ` desde ${timeOnly(base.updated)}` : ""}. Tentando de novo a cada 15 s; o que está na tela pode estar atrasado.</p>}
      <div className={`chat-shell glass ${current ? "has-current" : ""}`}>
        <aside className="chat-list">
          <label className="chat-search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, estado ou texto" /></label>
          {open.length > 0 && (
            <div className="live-row">
              {open.slice(0, 8).map((c) => <button key={c.id} onClick={() => pick(c.id)} title={c.name || c.short}><span className="avatar live">{initials(c.name)}</span><small>{(c.name || "Cliente").split(" ")[0]}</small></button>)}
            </div>
          )}
          <ScrollRow>
            <Tabs items={[["all", "Todas"], ...OUTCOMES.map(([id, l]) => [id, l])]} value={filter} onChange={setFilter} counts={counts} />
          </ScrollRow>
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
        {current ? <Thread c={current} patch={patch} reload={reload} /> : <div className="chat-empty">{!base.chats.length && !live.chats && !live.failedAt && !data.demo ? "Carregando as conversas…" : missing ? "Essa conversa não está entre as 150 clientes com movimento mais recente. Escolha outra na lista." : "Escolha uma conversa."}</div>}
        {current && <Profile c={current} />}
      </div>
    </div>
  );
}

// Linha que rola para o lado: setas nas pontas, arrastar com o mouse e a roda do mouse (vertical vira horizontal).
function ScrollRow({ children }) {
  const ref = useRef(null), drag = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => { const el = ref.current; if (el) setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 }); };
  useEffect(() => {
    const el = ref.current;
    measure();
    // Ouvinte nativo e não passivo: só assim a roda deixa de rolar a página enquanto rola os filtros.
    const wheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("wheel", wheel); window.removeEventListener("resize", measure); };
  }, []);
  const by = (dx) => ref.current?.scrollBy({ left: dx, behavior: "smooth" });
  return (
    <div className="scroll-row">
      {edge.left && <button className="scroll-arrow left" onClick={() => by(-180)} aria-label="Filtros anteriores"><Icon name="chevron" size={14} /></button>}
      <div ref={ref} className="chat-filters" onScroll={measure}
        onPointerDown={(e) => { if (e.pointerType === "mouse") drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 4) d.moved = true; if (d.moved) ref.current.scrollLeft = d.left - dx; }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }} onPointerLeave={() => { drag.current = null; }}
        onClickCapture={(e) => { if (drag.current?.moved) { e.stopPropagation(); e.preventDefault(); } }}>
        {children}
      </div>
      {edge.right && <button className="scroll-arrow right" onClick={() => by(180)} aria-label="Mais filtros"><Icon name="chevron" size={14} /></button>}
    </div>
  );
}

function Thread({ c, patch, reload }) {
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
      <Composer c={c} patch={patch} reload={reload} />
    </section>
  );
}

// Caixa de resposta do operador e a chave da Malu nesta conversa.
async function post(body) {
  const r = await fetch("api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  return { ok: r.ok, ...out };
}

function Composer({ c, patch, reload }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  useEffect(() => { setText(""); setError(null); }, [c.id]);
  const keep = (out) => out.paused !== undefined && patch(c.id, (x) => ({ ...x, paused: out.paused, pausedAt: out.pausedAt, pauseAt: out.at || new Date().toISOString() }));
  const toggle = async () => {
    setBusy(true); setError(null);
    const out = await post({ action: c.paused ? "resume" : "pause", conversationId: c.id }).catch(() => ({ error: "Sem conexão com o portal." }));
    if (out.ok) keep(out); else setError(out.error || "Não deu para mudar a Malu.");
    setBusy(false);
    reload();
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
    reload();
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
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
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
