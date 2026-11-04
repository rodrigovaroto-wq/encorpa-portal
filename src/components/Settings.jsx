// Configurações (operador, 04/11): uma página em abas, no formato do vídeo de referência — título, abas com o traço que desliza,
// cartões que entram em sequência e um aviso embaixo a cada mudança. Empresa, Equipe, Aparência, Notificações e Dados.
// A equipe vem de api/team.js (login e papel em PORTAL_USERS; nome, cargo e telefone no banco). O resto fica neste aparelho.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ago, downloadJson, initials } from "../lib/format.js";
import { Chip } from "./ui.jsx";
import { Icon } from "./icons.jsx";

const TABS = [["company", "Empresa"], ["team", "Equipe"], ["look", "Aparência"], ["notify", "Notificações"], ["data", "Dados"]];
export const ROLE_LABEL = { admin: "Administrador", operador: "Operador", leitura: "Só leitura" };
const ROLE_WHAT = { admin: "tudo, inclusive a equipe", operador: "responde às clientes, pausa a Malu e usa Malu › Teste", leitura: "só vê" };
// Avisos do sino (Topbar › notifications): cada tipo liga e desliga aqui, neste aparelho.
export const NOTIFY = [["order", "Pedidos novos", "Um aviso para cada pedido criado"], ["chat", "Conversas para você", "Quando a Malu avisa que precisa de uma pessoa"],
  ["workflow", "Erros no n8n", "Quando um workflow ativo falha"], ["source", "Fontes fora do ar", "Quando o Supabase, a Meta ou o WhatsApp não respondem"]];
const DEMO_TEAM = [{ email: "rodrigo@encorpa.com.br", name: "Rodrigo", title: "Fundador", role: "admin", login: true }, { email: "atendimento@encorpa.com.br", name: "Ana Souza", title: "Atendimento", role: "operador", login: true },
  { email: "financeiro@encorpa.com.br", name: "Carla Lima", title: "Financeiro", role: "leitura", login: true }];

export function Settings({ prefs, setPrefs, demo, setDemo, data, me, collapsed, setCollapsed }) {
  const [tab, setTab] = useState(() => (TABS.some(([k]) => k === location.hash.split("?tab=")[1]) ? location.hash.split("?tab=")[1] : "company"));
  const [toast, setToast] = useState(null);
  const say = (text) => { setToast({ text, at: Date.now() }); };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  const bar = useRef(null), [line, setLine] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => { const b = bar.current?.querySelector(`[data-k="${tab}"]`); if (b) { setLine({ left: b.offsetLeft, width: b.offsetWidth }); b.scrollIntoView?.({ block: "nearest", inline: "nearest" }); } }, [tab]);
  return (
    <div className="page settings-page">
      <div className="page-head"><div className="page-title"><p className="crumb">Sistema</p><h1>Configurações</h1><p className="desc">Encorpa · empresa, equipe e preferências.</p></div></div>
      <div className="set-tabs" role="tablist" ref={bar}>
        {TABS.map(([k, l]) => <button key={k} data-k={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        <i className="set-line" style={{ transform: `translateX(${line.left}px)`, width: line.width }} />
      </div>
      <div className="set-body" key={tab}>
        {tab === "company" && <Company data={data} />}
        {tab === "team" && <Team me={me} demo={demo || data?.demo} say={say} />}
        {tab === "look" && <Look prefs={prefs} setPrefs={setPrefs} collapsed={collapsed} setCollapsed={setCollapsed} say={say} />}
        {tab === "notify" && <Notify prefs={prefs} setPrefs={setPrefs} me={me} say={say} />}
        {tab === "data" && <Data data={data} demo={demo} setDemo={setDemo} me={me} say={say} />}
      </div>
      {toast && <div className="toast" role="status" key={toast.at}><Icon name="check" size={16} />{toast.text}</div>}
    </div>
  );
}

const Box = ({ title, sub, children }) => <section className="glass set-card"><header><h3>{title}</h3>{sub && <p>{sub}</p>}</header>{children}</section>;
const Row = ({ label, what, children }) => <div className="set-row"><div><b>{label}</b>{what && <p>{what}</p>}</div><div className="set-ctl">{children}</div></div>;
const Switch = ({ checked, onChange, label }) => <button role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>;

function Company({ data }) {
  const n = data?.global?.number || {};
  return (
    <Box title="Empresa" sub="O que as clientes veem da Encorpa">
      <Row label="Nome no WhatsApp" what="O nome que o WhatsApp mostra para as clientes"><span className="set-value">{n.name || "Encorpa"}</span></Row>
      <Row label="Site"><a className="ghost" href="https://encorpa-fashion.com.br" target="_blank" rel="noreferrer">encorpa-fashion.com.br</a></Row>
      <Row label="E-mail de contato"><span className="set-value">contato@encorpa-fashion.com.br</span></Row>
      <Row label="Número do WhatsApp" what="Estado, qualidade e limite na Meta"><a className="ghost" href="#/malu/number">{n.ok ? (n.status === "CONNECTED" ? "conectado" : n.status) : "ver"} · detalhes</a></Row>
      <Row label="Fuso e moeda" what="Datas no horário de Brasília e valores em reais"><span className="set-value">Brasília · R$</span></Row>
    </Box>
  );
}

function Team({ me, demo, say }) {
  const [st, setSt] = useState(null), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false);
  const load = () => (demo || location.protocol === "file:" ? Promise.resolve({ available: true, demo: true, me: { email: DEMO_TEAM[0].email, role: "admin" }, users: DEMO_TEAM }) : fetch("api/team", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json())).then(setSt).catch(() => setSt({ error: true }));
  useEffect(() => { load(); }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const admin = st?.me?.role === "admin";
  const post = async (body, ok) => {
    if (st?.demo) { setSt({ ...st, users: body.action === "remove" ? st.users.filter((u) => u.email !== body.email) : [...st.users.filter((u) => u.email !== body.email), { ...st.users.find((u) => u.email === body.email), ...body, login: st.users.find((u) => u.email === body.email)?.login ?? false }] }); setEdit(null); return say(`${ok} (exemplo: nada foi salvo)`); }
    setBusy(true);
    const r = await fetch("api/team", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({ error: "sem conexão" }));
    setBusy(false);
    if (r.error) return say(`Não salvou: ${r.error}`);
    setEdit(null); say(ok); load();
  };
  if (!st) return <div className="loading"><span className="spinner" /> Carregando a equipe…</div>;
  if (st.error) return <p className="note">Não consegui ler a equipe agora.</p>;
  if (st.available === false) return <p className="note">A equipe ainda não tem onde morar: aplique a migração 0034 do Ricos-com-AI no Supabase.</p>;
  return (
    <>
      <Box title="Equipe" sub={`${st.users.filter((u) => u.login).length} pessoas entram no portal${st.demo ? " · exemplo" : ""}`}>
        <ul className="team">
          {st.users.map((u) => (
            <li key={u.email}>
              <span className="avatar">{initials(u.name || u.email)}</span>
              <div className="who"><b>{u.name || u.email.split("@")[0]}</b><small>{[u.title, u.email].filter(Boolean).join(" · ")}</small>
                {u.email.toLowerCase() === st.me.email.toLowerCase() && <Chip tone="ok">Você</Chip>}</div>
              <span className="team-ctl">
                {u.login ? <Chip tone={u.role === "admin" ? "ok" : u.role === "leitura" ? "" : "warn"} title={ROLE_WHAT[u.role]}>{ROLE_LABEL[u.role]}</Chip> : <Chip title="Falta o login em PORTAL_USERS">Convite pendente</Chip>}
                {admin && <button className="round" aria-label={`Editar ${u.name || u.email}`} onClick={() => setEdit(edit === u.email ? null : u.email)}><Icon name="note" size={14} /></button>}
                {admin && u.email.toLowerCase() !== st.me.email.toLowerCase() && <button className="round" aria-label={`Tirar ${u.name || u.email}`} onClick={() => post({ action: "remove", email: u.email }, `Perfil de ${u.name || u.email} tirado`)}><Icon name="trash" size={14} /></button>}
              </span>
              {edit === u.email && <Person u={u} busy={busy} onSave={(x) => post({ action: "save", email: u.email, ...x }, "Perfil salvo")} />}
            </li>
          ))}
        </ul>
        <p className="note">O acesso (Administrador, Operador ou Só leitura) e a senha ficam na variável PORTAL_USERS do Vercel; aqui ficam nome, cargo e telefone.</p>
      </Box>
      {admin && <Invite busy={busy} onInvite={(x) => post({ action: "invite", ...x }, `Convite de ${x.name || x.email} salvo`)} />}
    </>
  );
}
function Person({ u, busy, onSave }) {
  return (
    <form className="set-form" onSubmit={(e) => { e.preventDefault(); onSave(Object.fromEntries(new FormData(e.currentTarget))); }}>
      <label>Nome<input name="name" defaultValue={u.name || ""} maxLength={120} /></label>
      <label>Cargo<input name="title" defaultValue={u.title || ""} maxLength={120} /></label>
      <label>Telefone<input name="phone" defaultValue={u.phone || ""} maxLength={40} inputMode="tel" /></label>
      <button className="primary" disabled={busy}><Icon name="check" size={14} /> Salvar</button>
    </form>
  );
}
function Invite({ busy, onInvite }) {
  const [last, setLast] = useState(null);
  return (
    <Box title="Convidar alguém" sub="O perfil fica salvo aqui; o login entra pela variável PORTAL_USERS do Vercel">
      <form className="set-form" onSubmit={(e) => { e.preventDefault(); const x = Object.fromEntries(new FormData(e.currentTarget)); setLast(x); onInvite(x); e.currentTarget.reset(); }}>
        <label>Nome<input name="name" required maxLength={120} /></label>
        <label>E-mail<input name="email" type="email" required maxLength={200} /></label>
        <label>Cargo<input name="title" maxLength={120} placeholder="ex.: Atendimento" /></label>
        <label>Acesso<select name="role" defaultValue="operador">{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l} — {ROLE_WHAT[k]}</option>)}</select></label>
        <button className="primary" disabled={busy}><Icon name="send" size={14} /> Convidar</button>
      </form>
      {last && <p className="note">Para liberar a entrada, inclua <code>{last.email}:SENHA:{last.role}</code> em PORTAL_USERS no Vercel (troque SENHA) e faça o Redeploy. Mande a senha para a pessoa por fora do portal.</p>}
    </Box>
  );
}

const THEMES = [["light", "Claro"], ["dark", "Escuro"], ["system", "Igual ao aparelho"]];
function Look({ prefs, setPrefs, collapsed, setCollapsed, say }) {
  return (
    <>
      <Box title="Tema" sub="Salvo neste aparelho">
        <div className="theme-cards">
          {THEMES.map(([k, l]) => <button key={k} className={`theme-card ${prefs.theme === k ? "on" : ""}`} aria-pressed={prefs.theme === k} onClick={() => { setPrefs({ ...prefs, theme: k }); say(`Tema: ${l.toLowerCase()}`); }}><span className={`theme-prev ${k}`}><i /></span>{l}</button>)}
        </div>
      </Box>
      <Box title="Layout">
        <Row label="Menu compacto" what="Só os ícones; o nome aparece ao passar o mouse"><Switch label="Menu compacto" checked={collapsed} onChange={(v) => { setCollapsed(v); say(v ? "Menu compacto" : "Menu completo"); }} /></Row>
        <Row label="Reduzir animação" what="Sem as entradas e transições; o sistema do aparelho também liga isto"><Switch label="Reduzir animação" checked={prefs.motion === "off"} onChange={(v) => { setPrefs({ ...prefs, motion: v ? "off" : "on" }); say(v ? "Animações reduzidas" : "Animações ligadas"); }} /></Row>
      </Box>
    </>
  );
}

function Notify({ prefs, setPrefs, me, say }) {
  const n = { order: true, chat: true, workflow: true, source: true, sound: false, ...prefs.notify };
  const set = (k, v, l) => { setPrefs({ ...prefs, notify: { ...n, [k]: v } }); say(`${l}: ${v ? "ligado" : "desligado"}`); };
  return (
    <Box title="Notificações" sub={`O sino do topo${me?.email ? ` · ${me.email}` : ""} · salvo neste aparelho`}>
      {NOTIFY.map(([k, l, w]) => <Row key={k} label={l} what={w}><Switch label={l} checked={n[k]} onChange={(v) => set(k, v, l)} /></Row>)}
      <Row label="Som" what="Um toque suave quando chega um aviso novo"><Switch label="Som" checked={n.sound} onChange={(v) => set("sound", v, "Som")} /></Row>
    </Box>
  );
}

function Data({ data, demo, setDemo, me, say }) {
  const [act, setAct] = useState(null);
  useEffect(() => { if (demo || location.protocol === "file:") return setAct([]); fetch("api/team", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json()).then((x) => setAct(x.activity || [])).catch(() => setAct([])); }, [demo]);
  const exportAll = () => {
    // Sem as conversas (texto das clientes) e sem telefone: pedidos, métricas do período e quando foi lido.
    downloadJson(`encorpa-portal-${new Date().toISOString().slice(0, 10)}`, { updated: data?.updated, demo: !!data?.demo, orders: data?.global?.orders || [], months: data?.global?.months || [], periods: Object.fromEntries(Object.entries(data?.periods || {}).map(([k, p]) => [k, { metrics: Object.fromEntries(Object.entries(p.metrics || {}).map(([id, x]) => [id, x.value])), money: p.money }])) });
    say("Exportação baixada");
  };
  return (
    <>
      <Box title="Seus dados" sub={data?.demo ? "Dados de exemplo, simulados neste navegador" : `Lidos do Supabase, da Meta e do n8n · ${data?.updated ? ago(data.updated) : "sem leitura"}`}>
        <Row label="Exportar" what="Todos os pedidos e as métricas de cada período, em JSON (sem conversas nem telefone)"><button className="glass pill small" onClick={exportAll}><Icon name="download" size={14} /> Exportar</button></Row>
        <Row label="Dados de exemplo" what="Um ano de operação simulada; responder e testar a Malu ficam desligados"><Switch label="Dados de exemplo" checked={demo} onChange={(v) => { setDemo(v); say(v ? "Dados de exemplo ligados" : "Dados ao vivo"); }} /></Row>
        <Row label="Atualização" what="Os dados a cada 5 minutos; Conversas a cada 15 s; o site ao vivo a cada 5 s"><span className="set-value">{data?.demo ? "exemplo" : data?.source === "live" ? "ao vivo" : "retrato"}</span></Row>
      </Box>
      <Box title="Atividade" sub="As últimas mudanças da equipe nas configurações">
        {!act ? <div className="loading"><span className="spinner" /></div> : act.length ? (
          <ul className="activity">{act.map((a, i) => <li key={i}><span className="round"><Icon name="users" size={14} /></span><div><b>{a.action}</b><small>{a.actor} · {ago(a.at)}</small></div></li>)}</ul>
        ) : <p className="empty">{me?.role === "admin" || demo ? "Nenhuma mudança registrada ainda." : "Só o administrador vê a atividade."}</p>}
      </Box>
    </>
  );
}
