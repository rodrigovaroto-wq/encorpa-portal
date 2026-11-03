// Anúncios do Meta Ads (só leitura, a cada 5 min): campanhas, conjuntos, anúncios com comparação, testes de criativos, metas e premissas.
import { AD_STATUS, COMPARE, GENDER, PAUSE, PHASES, REF, SAMPLE_FLOOR } from "../lib/constants.js";
import { computePause } from "../lib/data.js";
import { ARMS, armTotals, armVerdict, goalStatus } from "../lib/abtest.js";
import { fmt, when } from "../lib/format.js";
import { HBars } from "../components/charts.jsx";
import { Card, Chip, Note, PageHead, Table } from "../components/ui.jsx";

// O teste A/B é o teste inteiro: lê a janela de 12 meses, seja qual for o período na tela.
const whole = (data) => data.periods["12m"]?.meta;
const stat = (s) => { const [l, c] = AD_STATUS[s] || [s, ""]; return <Chip tone={c}>{l}</Chip>; };
const budget = (x) => (x.daily_budget ? `${fmt(x.daily_budget, "brl")}/dia` : x.lifetime_budget ? `${fmt(x.lifetime_budget, "brl")} no total` : "—");
const PERF = ["Gasto", "Impressões", "CTR", "CPC", "CPM", "Conversas", "CPL", "Leads", "Pedidos"];
const perf = (x) => [fmt(x.spend, "brl"), fmt(x.impressions, "n"), fmt(x.ctr, "pct"), fmt(x.cpc, "brl"), fmt(x.cpm, "brl"), fmt(x.started, "n"), fmt(x.cpl, "brl"), fmt(x.leads, "n"), fmt(x.orders, "n")];
const perfCsv = (x) => [x.spend, x.impressions, x.ctr, x.cpc, x.cpm, x.started, x.cpl, x.leads, x.orders];

export function Ads({ data, period, route, tabs }) {
  const p = data.periods[period] || {}, g = data.global, m = p.meta, sub = route.sub[0];
  const needMeta = ["campaigns", "adsets", "ads"].includes(sub);
  return (
    <div className="page">
      <PageHead crumb="Análise › Anúncios" title={route.sub[1]} desc={route.sub[2]} tabs={tabs} tab={sub} onTab={(k) => (location.hash = `#/ads/${k}`)} />
      {needMeta && !m && <Note>Meta Ads ainda não ligado: faltam as variáveis META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no Vercel.</Note>}
      {needMeta && m?.error && <Note>Não consegui ler a Meta: {m.error}</Note>}
      {m?.stale && <Note>A Meta não respondeu agora ({m.stale.error}). Mostrando a última leitura boa, de {when(m.stale.at)}.</Note>}
      {sub === "campaigns" && m?.campaigns && <Campaigns m={m} />}
      {sub === "adsets" && m?.adsets && <Adsets m={m} />}
      {sub === "ads" && m?.ads && <AdsView m={m} p={p} />}
      {sub === "tests" && <Tests m={whole(data)} p={p} g={g} />}
      {sub === "goals" && <Goals m={whole(data)} />}
      {sub === "ref" && <Ref />}
    </div>
  );
}

function Campaigns({ m }) {
  return <Table name="campanhas" head={["Campanha", "Estado", "Objetivo", "Orçamento", "Anúncios", ...PERF]}
    rows={m.campaigns.map((c) => [c.name, stat(c.status), c.objective || "—", budget(c), fmt(c.ads, "n"), ...perf(c)])}
    csv={m.campaigns.map((c) => [c.name, c.status, c.objective, budget(c), c.ads, ...perfCsv(c)])} />;
}

function Adsets({ m }) {
  const camp = Object.fromEntries(m.campaigns.map((c) => [c.id, c.name]));
  const aud = (s) => [s.audience?.age, (s.audience?.genders || []).map((x) => GENDER[x]).join(" e ") || "todos", s.audience?.places].filter(Boolean).join(" · ");
  return <Table name="conjuntos" head={["Conjunto", "Campanha", "Estado", "Orçamento", "Otimização", "Público", ...PERF]}
    rows={m.adsets.map((s) => [s.name, camp[s.campaign_id] || "—", stat(s.status), budget(s), s.optimization || "—", aud(s), ...perf(s)])}
    csv={m.adsets.map((s) => [s.name, camp[s.campaign_id], s.status, budget(s), s.optimization, aud(s), ...perfCsv(s)])} />;
}

function AdCards({ m }) {
  const camp = Object.fromEntries(m.campaigns.map((c) => [c.id, c.name])), sets = Object.fromEntries(m.adsets.map((s) => [s.id, s.name]));
  return (
    <div className="ad-grid">
      {m.ads.map((a) => (
        <article key={a.id} className="glass ad-card">
          <div className="thumb">{a.creative?.thumb ? <img src={a.creative.thumb} alt="" loading="lazy" /> : <span>sem prévia</span>}</div>
          <h3>{a.name}</h3><p className="sub">{camp[a.campaign_id]} › {sets[a.adset_id]}</p>{stat(a.status)}
          <dl>{[["Gasto", a.spend, "brl"], ["CTR", a.ctr, "pct"], ["CPM", a.cpm, "brl"], ["Conversas", a.started, "n"], ["CPL", a.cpl, "brl"], ["Leads", a.leads, "n"], ["Pedidos", a.orders, "n"]].map(([l, v, u]) => <div key={l}><dt>{l}</dt><dd>{fmt(v, u)}</dd></div>)}</dl>
          {a.creative?.body && <p className="sub">{a.creative.body.slice(0, 140)}{a.creative.body.length > 140 ? "…" : ""}</p>}
        </article>
      ))}
    </div>
  );
}

// Comparação lado a lado; a melhor célula de cada métrica fica verde (dir 1 = maior vence, -1 = menor vence, 0 = sem vencedor).
function Compare({ items, label }) {
  if (items.length < 2) return <Note>A comparação aparece quando houver mais de um {label}.</Note>;
  const rows = items.map((x) => ({ ...x, conv: x.leads ? (x.orders / x.leads) * 100 : null, cpo: x.orders ? x.spend / x.orders : null }));
  return (
    <>
      <Table className="cmp" name={`comparacao-${label}`} head={["Métrica", ...rows.map((x) => x.name)]}
        rows={COMPARE.map(([id, l, u, dir]) => {
          const vals = rows.map((x) => x[id]), ok = vals.filter((v) => v != null && (dir < 0 ? v > 0 : true));
          const best = dir && ok.length > 1 ? (dir > 0 ? Math.max(...ok) : Math.min(...ok)) : null;
          return [l, ...vals.map((v, i) => (best != null && v === best && (dir > 0 ? v > 0 : true) ? <span key={i} data-win="1">{fmt(v, u)}</span> : fmt(v, u)))];
        })}
        csv={COMPARE.map(([id, l]) => [l, ...rows.map((x) => x[id])])} />
      <Note>Verde = melhor {label} em cada métrica até agora, no período escolhido. Com poucos leads a diferença ainda é ruído.</Note>
    </>
  );
}

function States({ p }) {
  const st = p.states || [];
  if (!st.length) return <Note>Nenhum lead no período.</Note>;
  const ok = st.filter((x) => x.state !== "sem estado" && x.conversion != null && x.leads > 0), best = ok.length > 1 ? Math.max(...ok.map((x) => x.conversion)) : null;
  return (
    <>
      <Card title="Conversão por estado"><HBars items={st.filter((x) => x.state !== "sem estado").map((x) => ({ label: `${x.state} · ${x.orders}/${x.leads}`, value: x.conversion || 0, tone: best && x.conversion === best ? "ok" : "" }))} /></Card>
      <Note>Estado do CEP que a cliente informou na conversa (não o público do anúncio). Sem estado: {st.find((x) => x.state === "sem estado")?.leads || 0} leads que ainda não passaram o CEP.</Note>
    </>
  );
}

function AdsView({ m, p }) {
  return (
    <>
      <AdCards m={m} />
      <h2 className="section-title">Comparação entre os anúncios</h2>
      <Compare items={m.ads} label="anúncio" />
      <h2 className="section-title">Conversão por estado</h2>
      <States p={p} />
    </>
  );
}

export function PauseList({ p, g }) {
  const pz = computePause(p, g), SIT = { ok: "dentro do limite", warn: "perto do limite", bad: "PAUSAR", info: "informativo, sem limite" };
  return (
    <ul className="pause glass">
      {PAUSE.map((c) => { const x = pz[c.id]; return (
        <li key={c.id} className={x?.status || ""}>
          <span>{c.label}<small>{c.what}. {c.limit[0].toUpperCase() + c.limit.slice(1)}.</small></span>
          {x ? <b>{x.value}<small>{SIT[x.status]}</small></b> : <b className="na">sem número<small>{c.missing}</small></b>}
        </li>
      ); })}
    </ul>
  );
}

function ArmCard({ k, t }) {
  const [verdict, tone] = armVerdict(k, t);
  return (
    <div className="glass arm">
      <div className="goal-head"><b>Conjunto {ARMS[k].label}</b><Chip tone={tone}>{verdict}</Chip></div>
      <HBars unit="n" items={[{ label: "Verba gasta", value: Math.min(100, (t.spend / SAMPLE_FLOOR.spend) * 100), right: `${fmt(t.spend, "brl")} / ${fmt(SAMPLE_FLOOR.spend, "brl")}` }]} />
      <Table head={["Métrica", "Agora", "Meta", "Pausa com R$ 50"]} rows={ARMS[k].goals.map((x) => {
        const v = t[x.id], st = goalStatus(x, v, t.spend);
        return [x.label, <span key="v" className={st}>{v == null ? (k === "site" && ["conv", "cpo"].includes(x.id) && arms[k].orders == null ? "sem leitura" : "—") : fmt(v, x.unit)}</span>,
          `${x.dir > 0 ? "≥" : "≤"} ${fmt(x.ideal, x.unit)}`, x.id === "cpo" ? "sem pedido com R$ 75" : x.pause != null ? `${x.dir > 0 ? "<" : ">"} ${fmt(x.pause, x.unit)}` : "—"];
      })} />
    </div>
  );
}

function Tests({ m, p, g }) {
  const arms = armTotals(m?.adsets, m?.ab);
  return (
    <>
      <h2 className="section-title">Teste A/B: Site × WhatsApp (o teste inteiro, independe do período)</h2>
      {m?.adsets ? <div className="row r-1-1">{Object.keys(ARMS).map((k) => <ArmCard key={k} k={k} t={arms[k]} />)}</div> : <Note>Meta Ads não ligado.</Note>}
      <Note>Vence o conjunto com custo de anúncio por pedido criado ≤ R$ 27. Pedidos do WhatsApp: leads com a marca do anúncio. Pedidos do Site: clientes sem a marca do anúncio de WhatsApp, desde o início do conjunto Site (a Coinzz não manda UTM no pedido; venda orgânica do site no mesmo período também entra).</Note>
      <h2 className="section-title">Regras do teste</h2>
      <Table head={["Quando", "O quê", "Depois"]} rows={PHASES.map(([f, a, b]) => [f, a, b])} />
      <h2 className="section-title">Criativos</h2>
      {m?.ads ? <><AdCards m={{ ...m, ads: m.ads.filter((a) => !["DELETED", "ARCHIVED"].includes(a.status)) }} /><h2 className="section-title">Comparação entre os criativos</h2><Compare items={m.ads.filter((a) => !["DELETED", "ARCHIVED"].includes(a.status))} label="criativo" /></> : <Note>Meta Ads não ligado.</Note>}
      <h2 className="section-title">Saúde da Malu durante o teste</h2>
      <PauseList p={p} g={g} />
    </>
  );
}

// Metas × realizado (a "matriz de cápsulas"): cada meta de cada conjunto com a faixa entre o limite de pausa e a meta, e o valor de agora.
function Goals({ m }) {
  const arms = armTotals(m?.adsets, m?.ab);
  return (
    <>
      {Object.keys(ARMS).map((k) => (
        <div key={k}>
          <h2 className="section-title">Conjunto {ARMS[k].label}</h2>
          <div className="goals">
            {ARMS[k].goals.map((x) => {
              const v = arms[k][x.id], lo = Math.min(x.ideal, x.pause ?? x.ideal), hi = Math.max(x.ideal, x.pause ?? x.ideal, v ?? 0) * 1.3 || 1;
              const pos = (val) => `${Math.min(100, Math.max(0, (val / hi) * 100))}%`, st = goalStatus(x, v, arms[k].spend);
              return (
                <div key={x.id} className="glass goal">
                  <div className="goal-head"><b>{x.label}</b><span className={st}>{v == null ? (k === "site" && ["conv", "cpo"].includes(x.id) && arms[k].orders == null ? "sem leitura" : "—") : fmt(v, x.unit)}</span></div>
                  <div className="capsule">
                    <i className={`band ${x.dir < 0 ? "rev" : ""}`} style={{ left: pos(lo), width: `calc(${pos(Math.max(x.ideal, x.pause ?? x.ideal))} - ${pos(lo)})` }} />
                    {v != null && <i className={`now ${st}`} style={{ left: pos(v) }} />}
                  </div>
                  <div className="goal-foot"><span>meta {x.dir > 0 ? "≥" : "≤"} {fmt(x.ideal, x.unit)}</span><span>{x.pause != null ? `pausa ${x.dir > 0 ? "<" : ">"} ${fmt(x.pause, x.unit)}` : "sem limite de pausa"}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <h2 className="section-title">Regras do teste</h2>
      <Table head={["Quando", "O quê", "Depois"]} rows={PHASES.map(([f, a, b]) => [f, a, b])} />
    </>
  );
}

function Ref() {
  return REF.map(([t, rows]) => (
    <div key={t}><h2 className="section-title">{t}</h2><Table head={["Item", "Valor"]} rows={rows.map(([a, b]) => [a, b])} /></div>
  ));
}
