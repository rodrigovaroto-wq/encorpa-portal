// Malu › Teste: conversas simuladas com a Malu de produção, sem cliente real (api/test.js). Cada "Nova conversa" ganha um telefone
// inventado, então dá para abrir quantas quiser, voltar a qualquer uma e apagar quando terminar. A Malu responde pela mesma função
// turn das clientes, mas nada sai pelo WhatsApp; cada resposta custa só as chamadas de modelo dela (fora das métricas do portal).
import { useEffect, useRef, useState } from "react";
import { STAGE } from "../lib/constants.js";
import { ago, fmt, timeOnly } from "../lib/format.js";
import { Chip, Note } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

async function call(body) {
  const r = await fetch("api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `HTTP ${r.status}`);
  return out;
}
const label = (phone) => `Teste ${phone.slice(-5)}`;
const STATUS = { sent: ["respondeu", "ok"], welcomed: ["recepção", ""], resumed: ["respondeu", "ok"], handoff: ["avisou o operador", "bad"], fallback: ["resposta pronta", "warn"], opted_out: ["opt-out", "warn"] };

export function MaluTest({ demo, readOnly }) {
  const [tests, setTests] = useState(null), [phone, setPhone] = useState(null), [error, setError] = useState(null);
  const load = () => call({ action: "list" }).then((x) => setTests(x.tests)).catch((e) => setError(e.message));
  useEffect(() => { if (!demo && !readOnly) load(); }, [demo, readOnly]);
  if (readOnly) return <Note>Seu usuário é só de leitura: Malu › Teste fica com operador ou admin.</Note>;
  if (demo) return <Note>Com os dados de exemplo o teste fica desligado: ele fala com a Malu de verdade. Desligue "Dados de exemplo" em Configurações › Dados.</Note>;

  const create = async () => {
    setError(null);
    try { const { phone: p } = await call({ action: "new" }); setTests((t) => [{ phone: p, created: new Date().toISOString(), stage: null, cost: 0, last: new Date().toISOString(), fresh: true }, ...(t || [])]); setPhone(p); }
    catch (e) { setError(e.message); }
  };
  const remove = async (p) => {
    if (!confirm(`Apagar a conversa "${label(p)}"? Some do banco com mensagens e custos.`)) return;
    try { await call({ action: "delete", phone: p }); setTests((t) => t.filter((x) => x.phone !== p)); if (phone === p) setPhone(null); }
    catch (e) { setError(e.message); }
  };
  const total = (tests || []).reduce((a, x) => a + (x.cost || 0), 0);
  return (
    <>
      <Note>Você escreve como se fosse a cliente e a Malu de produção responde, com os mesmos gates e reescritas. Nada vai para o WhatsApp, os lembretes da régua são cancelados e essas conversas ficam fora das métricas do portal. Cada resposta custa as chamadas de modelo dela.</Note>
      {error && <p className="composer-error">{error}</p>}
      <div className="chat-shell glass test-shell">
        <aside className="chat-list">
          <button className="primary" onClick={create}><Icon name="plus" size={15} /> Nova conversa</button>
          <p className="sub">{tests ? `${tests.length} conversa${tests.length === 1 ? "" : "s"} de teste · ${fmt(total, "brl")} de modelo` : "Carregando…"}</p>
          <div className="threads">
            {(tests || []).map((t) => (
              <div key={t.phone} className={`thread ${phone === t.phone ? "on" : ""}`}>
                <button className="thread-body" onClick={() => setPhone(t.phone)}>
                  <span className="thread-top"><b>{label(t.phone)}</b><small>{ago(t.last)}</small></span>
                  <span className="thread-last">{t.fresh ? "nova, sem mensagens" : `${STAGE[t.stage] || t.stage || "—"} · ${fmt(t.cost, "brl")}`}</span>
                </button>
                <button className="round" aria-label={`Apagar ${label(t.phone)}`} title="Apagar" onClick={() => remove(t.phone)}><Icon name="trash" size={14} /></button>
              </div>
            ))}
            {tests && !tests.length && <p className="empty">Nenhuma conversa de teste. Comece uma nova.</p>}
          </div>
        </aside>
        {phone ? <TestThread key={phone} phone={phone} onChange={(x) => setTests((t) => t.map((y) => (y.phone === phone ? { ...y, ...x, fresh: false, last: new Date().toISOString() } : y)))} /> : <div className="chat-empty">Escolha uma conversa de teste ou comece uma nova.</div>}
      </div>
    </>
  );
}

function TestThread({ phone, onChange }) {
  const [msgs, setMsgs] = useState(null), [info, setInfo] = useState({ stage: null, cost: 0 }), [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const end = useRef(null);
  useEffect(() => { call({ action: "history", phone }).then((h) => { setMsgs(h.messages); setInfo({ stage: h.stage, cost: h.cost }); }).catch((e) => { setMsgs([]); setError(e.message); }); }, [phone]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs?.length, busy]);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setError(null); setText("");
    setMsgs((m) => [...(m || []), { out: false, text: body, at: new Date().toISOString() }]);
    try {
      const out = await call({ action: "send", phone, text: body });
      const now = new Date().toISOString();
      setMsgs((m) => [...m, ...out.replies.flatMap((r) => (r.text.length ? r.text : [""]).map((t, i) => ({ out: true, text: t, at: now, meta: i === r.text.length - 1 || !r.text.length ? r : null })))]);
      setInfo({ stage: out.stage, cost: out.cost });
      onChange({ stage: out.stage, cost: out.cost });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <section className="chat-thread">
      <header className="thread-head">
        <span className="avatar">T</span>
        <div><b>{label(phone)}</b><small>{STAGE[info.stage] || info.stage || "sem etapa ainda"} · {fmt(info.cost, "brl")} de modelo</small></div>
      </header>
      <div className="bubbles">
        {msgs == null && <p className="empty">Carregando…</p>}
        {msgs?.length === 0 && <p className="empty">Escreva a primeira mensagem como a cliente escreveria, por exemplo "Oi, vi o anúncio do colete".</p>}
        {(msgs || []).map((m, i) => (
          <div key={i} className={`bubble ${m.out ? "out" : "in"}`}>
            <p>{m.text || <i>(sem texto)</i>}</p>
            <small>{m.out ? "Malu · " : "Você (cliente) · "}{timeOnly(m.at)}</small>
            {m.meta && <span className="test-meta">{m.meta.status && <Chip tone={STATUS[m.meta.status]?.[1]}>{STATUS[m.meta.status]?.[0] || m.meta.status}</Chip>}{m.meta.rewrites ? <Chip>{m.meta.rewrites} reescrita{m.meta.rewrites > 1 ? "s" : ""}</Chip> : null}{m.meta.costBrl != null && <Chip>{fmt(m.meta.costBrl, "brl")}</Chip>}{m.meta.reason && <Chip tone="warn">{String(m.meta.reason).split(":")[0]}</Chip>}</span>}
          </div>
        ))}
        {busy && <p className="empty">A Malu está escrevendo… (pode levar até um minuto com reescritas)</p>}
        <div ref={end} />
      </div>
      <footer className="composer">
        {error && <p className="composer-error">{error}</p>}
        <div className="composer-row">
          <textarea value={text} rows={1} maxLength={4096} placeholder="Escreva como a cliente…" disabled={busy} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button className="send" onClick={send} disabled={busy || !text.trim()} aria-label="Enviar"><Icon name="send" /></button>
        </div>
      </footer>
    </section>
  );
}
