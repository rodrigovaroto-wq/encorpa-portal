// Clientes › Score e Perfil (era a aba Leads até 23/10): score de prontidão e perfil de cada lead (api/leads.js › lead_profiles_v),
// sem telefone e sem nome: só o começo do id. Uma tela só, sem sub-abas por faixa: o agregado e a tabela seguem o período do topo
// (pela criação do lead). Com os dados de exemplo, os perfis vêm do mesmo ano simulado das outras telas (data.global.profiles).
import { useEffect, useMemo, useState } from "react";
import { STAGE } from "../lib/constants.js";
import { periodRange } from "../lib/data.js";
import { fmt, when } from "../lib/format.js";
import { BANDS, OBJECTION, SENSITIVITY, audiosOf, objectionsOf, profileSummary } from "../lib/profiles.js";
import { Donut, HBars } from "../components/charts.jsx";
import { Card, Chip, Note, Pager, Table } from "../components/ui.jsx";

const BAND = Object.fromEntries(BANDS.map(([k, l, tone]) => [k, { l, tone }]));
const SENS = Object.fromEntries(SENSITIVITY);
const BAND_COLOR = { quente: "var(--bad)", morna: "var(--warn)", fria: "var(--neon-blue)" };

export function Score({ data, period }) {
  const [state, setState] = useState(null), [band, setBand] = useState(""), [page, setPage] = useState(1);
  useEffect(() => {
    if (data.demo) return setState({ available: true, updated: data.updated, leads: data.global.profiles || [] });
    if (location.protocol === "file:") return setState({ error: "Esta tela lê só o banco ao vivo." });
    fetch("api/leads", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => { const out = await r.json().catch(() => ({})); setState(r.ok ? out : { error: out.error || `HTTP ${r.status}` }); })
      .catch(() => setState({ error: "Não consegui ler os leads agora." }));
  }, [data.demo, data.updated, data.global.profiles]);

  const [from, to] = periodRange(period, state?.updated || data.global.updated);
  const leads = useMemo(() => (state?.leads || []).filter((l) => Date.parse(l.created_at) >= from && Date.parse(l.created_at) < to), [state, from, to]);
  const s = profileSummary(leads);
  // Filtro por faixa (operador, 04/11): todas, quente, morna ou fria; a tabela vai do maior score ao menor, 25 por página.
  const all = useMemo(() => leads.filter((l) => !band || l.score_band === band).sort((a, b) => (a.score == null) - (b.score == null) || (b.score - a.score) || 0), [leads, band]);
  const rows = all.slice((page - 1) * 25, page * 25), pick = (k) => { setBand(k); setPage(1); };

  return (
    <>
      {!state && <div className="loading"><span className="spinner" /> Carregando os leads…</div>}
      {state?.error && <Note>{state.error}</Note>}
      {state?.available === false && <Note>O score e o perfil ainda não existem no banco (migração 0029 do Ricos-com-AI não aplicada). A tela enche sozinha quando ela for aplicada.</Note>}
      {state?.available && (
        <>
          <div className="kpis">
            {BANDS.map(([k, l]) => <div key={k} className={`glass kpi band-${k}`}><div className="kpi-top"><h3>{l}</h3></div><div className="kpi-value">{fmt(s.bands[k], "n")}</div><div className="kpi-foot"><span className="delta none">{k === "quente" ? "score ≥ 60" : k === "morna" ? "score 30–59" : "score < 30"}</span></div></div>)}
            <div className="glass kpi"><div className="kpi-top"><h3>Mandaram áudio</h3></div><div className="kpi-value">{fmt(s.audio.share, "pct")}</div><div className="kpi-foot"><span className="delta none">{s.audio.leads} de {s.total} · média de {fmt(s.audio.avg, "n")} áudio(s) entre elas</span></div></div>
          </div>
          <div className="row r-1-1-1">
            <Card title="Faixas" sub={`${s.total} leads`}><Donut items={BANDS.map(([k, l]) => ({ label: l, value: s.bands[k], color: BAND_COLOR[k] }))} /></Card>
            <Card title="Objeções mais frequentes" sub="leads que disseram cada uma"><HBars unit="n" items={s.objections.map(([k, n]) => ({ label: OBJECTION[k] || k, value: n }))} /></Card>
            <Card title="Sensibilidade a preço" sub="o nível mais alto da conversa"><HBars unit="n" items={SENSITIVITY.map(([k, l]) => ({ label: l, value: s.sensitivity[k] }))} /></Card>
          </div>
          <div className="row r-1-1">
            <Card title="Ocasiões" sub="pra que ela quer o colete"><HBars unit="n" items={s.occasions.map(([k, n]) => ({ label: k, value: n }))} /></Card>
            <Card title="Onde a conversa para" sub="etapa da conversa mais nova, sem as que compraram"><HBars unit="n" items={s.stops.map(([k, n]) => ({ label: STAGE[k] || k, value: n }))} /></Card>
          </div>
          <div className="filters"><span className="seg" role="group" aria-label="Faixa do score">{[["", "Todas"], ...BANDS].map(([k, l]) => <button key={k} className={band === k ? "on" : ""} aria-pressed={band === k} onClick={() => pick(k)}>{l} {fmt(k ? s.bands[k] : s.total, "n")}</button>)}</span></div>
          <Table name="leads-score" head={["Lead", "Score", "Faixa", "Etapa", "Objeções", "Preço", "Áudios", "Ocasião", "Score em"]}
            rows={rows.map((l) => [l.id.slice(0, 8), fmt(l.score, "n"), l.score_band ? <Chip tone={BAND[l.score_band]?.tone}>{BAND[l.score_band]?.l || l.score_band}</Chip> : "—", STAGE[l.stage] || l.stage || "—",
              objectionsOf(l).map((o) => OBJECTION[o] || o).join(", ") || "—", SENS[l.price_sensitivity] || "—", audiosOf(l), l.occasion || "—", when(l.score_at)])}
            csv={all.map((l) => [l.id.slice(0, 8), l.score, l.score_band, l.stage, objectionsOf(l).join(","), l.price_sensitivity, audiosOf(l), l.occasion, l.score_at])} />
          <Pager page={page} per={25} total={all.length} onPage={setPage} numbered />
          <Note>Período pela criação do lead. Score de 0 a 100 somado pelo código a partir dos sinais da conversa (pesos são hipótese até ~200 leads reais). Pedido criado = 100.</Note>
        </>
      )}
    </>
  );
}
