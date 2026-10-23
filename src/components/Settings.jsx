// Configurações (23/10): um bloco grande no meio da tela com o fundo desfocado, em abas (como as configurações da Octadesk).
// Tudo o que ficava no menu da engrenagem mais o acesso: quem está logado, o papel e, para o admin, os usuários do portal.
import { useEffect, useState } from "react";
import { ago } from "../lib/format.js";
import { Chip } from "./ui.jsx";
import { Icon } from "./icons.jsx";
import { ACCENTS } from "./Topbar.jsx";

const TABS = [["look", "Aparência", "sun"], ["data", "Dados", "live"], ["access", "Usuários e acesso", "users"], ["company", "Empresa", "plug"]];
export const ROLE_LABEL = { admin: "Administrador", operador: "Operador", leitura: "Só leitura" };
const ROLE_WHAT = { admin: "vê tudo, responde às clientes, testa a Malu e vê os usuários", operador: "vê tudo, responde às clientes, pausa e devolve a Malu e usa Malu › Teste", leitura: "só vê: não responde, não pausa a Malu e não usa Malu › Teste" };

export function Settings({ open, onClose, prefs, setPrefs, demo, setDemo, data, me }) {
  const [tab, setTab] = useState("look");
  useEffect(() => { if (!open) return; const esc = (e) => e.key === "Escape" && onClose(); document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc); }, [open, onClose]);
  if (!open) return null;
  const accent = ACCENTS.some(([k]) => k === prefs.accent) ? prefs.accent : "purple";
  return (
    <div className="overlay settings-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass settings" role="dialog" aria-modal="true" aria-label="Configurações">
        <nav className="settings-nav" aria-label="Seções das configurações">
          <p className="pop-title">Configurações</p>
          {TABS.map(([k, l, icon]) => <button key={k} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}><Icon name={icon} size={16} />{l}</button>)}
        </nav>
        <section className="settings-body">
          <header className="settings-head"><h2>{TABS.find(([k]) => k === tab)[1]}</h2><button className="round" aria-label="Fechar" onClick={onClose}><Icon name="x" size={14} /></button></header>
          {tab === "look" && (
            <div className="settings-rows">
              <Row label="Tema" what="Escuro ou claro, em todas as cores.">
                <span className="seg"><button className={prefs.theme === "dark" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "dark" })}><Icon name="moon" size={14} /> Escuro</button><button className={prefs.theme === "light" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "light" })}><Icon name="sun" size={14} /> Claro</button></span>
              </Row>
              <Row label="Cor" what={`Fundo e destaques: ${ACCENTS.find(([k]) => k === accent)[1].toLowerCase()}.`}>
                <span className="swatches" role="radiogroup" aria-label="Cor">{ACCENTS.map(([k, l, c]) => <button key={k} role="radio" aria-checked={accent === k} aria-label={l} title={l} className={accent === k ? "on" : ""} style={{ background: c }} onClick={() => setPrefs({ ...prefs, accent: k })} />)}</span>
              </Row>
              <Row label="Animações do fundo" what="Ondas e luzes em movimento. Desligue para economizar bateria.">
                <Toggle checked={prefs.motion !== "off"} onChange={(v) => setPrefs({ ...prefs, motion: v ? "on" : "off" })} />
              </Row>
            </div>
          )}
          {tab === "data" && (
            <div className="settings-rows">
              <Row label="Dados de exemplo" what="Um ano de operação simulada, com todos os números fechando entre as abas. Responder e testar a Malu ficam desligados.">
                <Toggle checked={demo} onChange={setDemo} />
              </Row>
              <Row label="Atualização" what="O portal busca os dados a cada 5 minutos; Conversas, a cada 15 segundos.">
                <span className="settings-value">{data?.demo ? "exemplo" : data?.updated ? `${data.source === "live" ? "ao vivo" : "retrato"} · ${ago(data.updated)}` : "sem dados"}</span>
              </Row>
              <Row label="Fuso e moeda" what="Datas no horário de Brasília e valores em reais."><span className="settings-value">Brasília · R$</span></Row>
            </div>
          )}
          {tab === "access" && <Access me={me} />}
          {tab === "company" && (
            <div className="settings-rows">
              <Row label="Empresa" what="O nome que o WhatsApp mostra para as clientes."><span className="settings-value">{data?.global?.number?.name || "Encorpa"}</span></Row>
              <Row label="Fontes de dados" what="Supabase, Meta Ads, n8n, WhatsApp, Malu e Hermes.">
                <a className="ghost" href="#/integrations" onClick={onClose}>{Object.values(data?.global?.health || {}).filter((h) => h.ok).length} respondendo · ver Integrações</a>
              </Row>
              <Row label="Número do WhatsApp" what="Estado, qualidade e limite na Meta.">
                <a className="ghost" href="#/malu/number" onClick={onClose}>{data?.global?.number?.ok ? `${data.global.number.status === "CONNECTED" ? "conectado" : data.global.number.status} · ver detalhes` : "ver detalhes"}</a>
              </Row>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Access({ me }) {
  if (!me) return <p className="note">Sem leitura do login aqui (portal aberto sem o servidor do Vercel).</p>;
  return (
    <div className="settings-rows">
      <Row label="Você" what={ROLE_WHAT[me.role]}><span className="settings-value">{me.email} · <Chip>{ROLE_LABEL[me.role] || me.role}</Chip></span></Row>
      {me.users && (
        <div className="settings-users">
          <p className="pop-title">Usuários do portal ({me.users.length})</p>
          {me.users.map((u) => <div key={u.email} className="settings-user"><span>{u.email}</span><Chip tone={u.role === "admin" ? "ok" : u.role === "leitura" ? "" : "warn"}>{ROLE_LABEL[u.role]}</Chip></div>)}
          <p className="note">Para incluir, tirar ou mudar o papel de alguém: no Vercel, variável PORTAL_USERS, no formato <code>email:senha:papel</code> separados por vírgula (papel: admin, operador ou leitura; sem papel = admin). Vale no próximo deploy.</p>
          <ul className="todo">{Object.entries(ROLE_WHAT).map(([k, w]) => <li key={k}><b>{ROLE_LABEL[k]}:</b> {w}.</li>)}</ul>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, what, children }) => <div className="settings-row"><div><b>{label}</b><p>{what}</p></div><div className="settings-ctl">{children}</div></div>;
const Toggle = ({ checked, onChange }) => <label className="pref toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
