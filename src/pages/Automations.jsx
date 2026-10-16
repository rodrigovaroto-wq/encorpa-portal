// Automações: workflows do n8n em cartões com estado (o "Automated Workflows" do Glassy Dashboard), o desenho de cada um,
// o fluxo da Malu e as execuções. Só leitura: o portal não liga, desliga nem executa nada.
import { useState } from "react";
import { MODE, STATUS_RUN } from "../lib/constants.js";
import { ago, fmt, nf, when } from "../lib/format.js";
import { FlowSvg } from "../components/FlowSvg.jsx";
import { Card, Chip, Note, PageHead, Table } from "../components/ui.jsx";

export function Automations({ data, route, tabs }) {
  const a = data.global.automations, sub = route.sub[0];
  return (
    <div className="page">
      <PageHead crumb="Sistema › Automações" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/auto/${k}`)} />
      {!a && <Note>Automações ainda não ligadas: no Vercel, crie a variável N8N_API_KEY. O portal nunca lê os parâmetros dos nós, onde ficam URLs e credenciais.</Note>}
      {a?.error && <Note>Não consegui ler o n8n: {a.error}</Note>}
      {a?.workflows && sub === "workflows" && <Workflows a={a} />}
      {sub === "flow" && <MaluFlow data={data} />}
      {a?.runs && sub === "runs" && <Table name="execucoes" head={["Workflow", "Estado", "Início", "Duração", "Disparo"]}
        rows={a.runs.map((x) => [x.workflow, <Chip key="s" tone={x.status === "success" ? "ok" : ["error", "crashed"].includes(x.status) ? "bad" : "warn"}>{STATUS_RUN[x.status] || x.status}</Chip>, when(x.at), x.ms == null ? "—" : x.ms < 1000 ? `${x.ms} ms` : `${nf.format(x.ms / 1000)} s`, MODE[x.mode] || x.mode])}
        csv={a.runs.map((x) => [x.workflow, x.status, x.at, x.ms, x.mode])} />}
    </div>
  );
}

function Workflows({ a }) {
  const [open, setOpen] = useState(null);
  const on = a.workflows.filter((w) => w.active);
  return (
    <>
      <div className="kpis">
        {[["Ativos", on.length], ["Desligados", a.workflows.length - on.length], ["Execuções lidas", a.read ?? a.runs.length], ["Ativos com erro recente", on.filter((w) => w.errors).length]].map(([l, v]) => <div key={l} className="glass kpi"><div className="kpi-top"><h3>{l}</h3></div><div className="kpi-value">{fmt(v, "n")}</div></div>)}
      </div>
      <div className="wf-grid">
        {a.workflows.map((w) => (
          <article key={w.id || w.name} className={`glass wf-card ${open === w.name ? "open" : ""} ${w.active ? "" : "off"}`}>
            <div className="wf-head"><Chip tone={w.active ? (w.errors ? "bad" : "ok") : ""}>{w.active ? (w.errors ? `${w.errors} com erro` : "Ativo") : "Desligado"}</Chip><small>{w.nodes.length} etapas</small></div>
            <h3>{w.name.replace(/^Encorpa — /, "")}</h3>
            <p className="sub">{w.last ? `Última: ${STATUS_RUN[w.last.status] || w.last.status} ${ago(w.last.at)}` : "Sem execução entre as últimas lidas"} · {w.runs} execuç{w.runs === 1 ? "ão" : "ões"}</p>
            <button className="ghost" onClick={() => setOpen(open === w.name ? null : w.name)}>{open === w.name ? "Fechar desenho" : "Ver desenho"}</button>
          </article>
        ))}
      </div>
      {open && <Card title={open} sub="arraste os nós para organizar; nada é alterado no n8n"><FlowSvg w={a.workflows.find((w) => w.name === open)} key={open} /></Card>}
    </>
  );
}

function MaluFlow({ data }) {
  const o = data.periods?.week?.outcomes || {}, wf = (k) => data.global.automations?.workflows?.find((w) => w.name.includes(k));
  const step = (t, s, k) => { const w = k && wf(k); return <div className="glass node"><b>{t}</b><span>{s}</span>{w && <Chip tone={w.active ? "ok" : ""}>n8n: {w.name.replace(/^Encorpa — /, "")}</Chip>}</div>; };
  return (
    <>
      <div className="pipe">
        {step("Mensagem dela", "WhatsApp Cloud API (texto ou áudio transcrito)")}<i>→</i>{step("Entrada", "webhook recebe e enfileira", "Turno")}<i>→</i>
        {step("Turno", "Edge Function turn: estado, fatos da lead, régua")}<i>→</i>{step("Modelo escreve", "o modelo só escreve texto")}<i>→</i>{step("Gates verificam", "tamanho, endereço, preço, cobertura, checkout; até 5 reescritas")}
      </div>
      <h2 className="section-title">Onde cada desfecho nasce (últimos 7 dias)</h2>
      <div className="kpis">
        {[["Gate aprovou", o.solved, "Resposta enviada: compraram ou encerraram sem compra."], ["Vetou 5 vezes ou faltou contorno", o.unresolved, "Resposta segura para ela e e-mail ao operador (R22.1). Vira linha em Lacunas."],
          ["Silêncio dela", o.abandoned, `A régua de follow-up assume${wf("Relógio") ? " (n8n: Relógio da régua)" : ""}.`], ["Venda", o.bought, `Pedido criado; confirmação da Coinzz${wf("Venda") ? " (n8n: Venda confirmada)" : ""}.`]]
          .map(([l, v, s]) => <div key={l} className="glass kpi"><div className="kpi-top"><h3>{l}</h3></div><div className="kpi-value">{fmt(v, "n")}</div><span className="delta none">{s}</span></div>)}
      </div>
      <Note>O fluxo da conversa é código com teste, não editor de arrastar e soltar (decisão R11.1): esta tela mostra, não altera.</Note>
    </>
  );
}
