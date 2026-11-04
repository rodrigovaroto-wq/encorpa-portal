// Site e vendas (operador, 04/11): quem está no site agora, o funil do checkout, o checkout abandonado e quando os leads compram.
// As visitas vêm do coletor public/track.js (api/track.js → site_sessions); o checkout abandonado, do webhook da Coinzz (leads.cart).
import { useEffect, useState } from "react";
import { BUCKETS, periodLabel } from "../lib/constants.js";
import { bucketLabels, fmt } from "../lib/format.js";
import { GroupBars, Heatmap } from "../components/charts.jsx";
import { Card, Note, PageHead } from "../components/ui.jsx";
import { useChartPeriod } from "../components/Topbar.jsx";

export function Site({ data, period }) {
  const p = data.periods[period] || {};
  return (
    <div className="page">
      <PageHead crumb="Análise" title="Site e vendas" desc="Quem está no site agora, onde as visitas param, o checkout que ficou para trás e a hora em que as clientes compram." />
      <div className="row r-1-1">
        <SiteLive data={data} />
        <Funnel site={p.site} label={periodLabel(period)} />
      </div>
      <div className="row r-1-1">
        <Carts data={data} period={period} />
        <BuyTimes p={p} label={periodLabel(period)} />
      </div>
      <Note>As visitas contam quando o script do portal está no site (public/track.js; ver o README). Viu o produto = a oferta apareceu na tela; abriu o checkout = clicou para comprar. O pedido é o da Coinzz/Logzz de origem Site, e a Coinzz não liga o pedido à visita, então ele só aparece em "Todos".</Note>
    </div>
  );
}

// Site ao vivo: consulta a cada 5 s com a aba visível. Nos dados de exemplo, uma simulação que anda sozinha.
export function SiteLive({ data, compact = false }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let on = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = data.demo || location.protocol === "file:" ? demoLive() : await fetch("api/site", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json()).catch(() => ({ error: true }));
      if (on) setS(next);
    };
    tick();
    const t = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => { on = false; clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [data.demo]);
  const max = Math.max(1, ...(s?.arrivals || [1]));
  const month = data.periods.month?.site?.all;
  return (
    <Card title={<><i className="live-dot" />Site ao vivo</>} sub="visitas agora, atualizado a cada 5 s" action={<a className="ghost" href="#/site">Detalhes</a>} className={compact ? "site-live compact" : "site-live"}>
      {!s ? <div className="loading"><span className="spinner" /> Lendo as visitas…</div>
        : s.available === false ? <p className="empty">As visitas ainda não chegam: aplique a migração 0034 no Supabase e instale o script do portal no site.</p>
        : s.error ? <p className="empty">Não consegui ler as visitas agora. Tento de novo em 5 s.</p>
        : <>
          <div className="live-now"><b className="kpi-value">{fmt(s.now, "n")}</b><span>no site agora · {s.phone} no celular, {s.desktop} no computador</span></div>
          <div className="live-bars" aria-label="Chegadas por minuto, últimos 30 min">{s.arrivals.map((n, i) => <i key={i} style={{ height: `${(n / max) * 100}%` }} title={`${n} chegada(s)`} />)}</div>
          <ul className="kv">
            <li><span>Vendo o produto agora</span><b>{fmt(s.product, "n")}</b></li>
            <li><span>Abriram o checkout (30 min)</span><b>{fmt(s.checkout, "n")}</b></li>
            <li><span>Conversão do site, 30 dias</span><b>{month?.visits ? fmt((month.orders / month.visits) * 100, "pct") : "—"}</b></li>
          </ul>
        </>}
    </Card>
  );
}
function demoLive(now = Date.now()) {
  const wave = (k) => Math.max(0, Math.round(18 + 9 * Math.sin(now / 90000 + k) + 4 * Math.sin(now / 17000 + k * 3)));
  const arrivals = Array.from({ length: 30 }, (_, i) => Math.round(wave(i / 4) / 3)), n = wave(0);
  return { available: true, now: n, phone: Math.round(n * 0.7), desktop: n - Math.round(n * 0.7), product: Math.round(n * 0.55), checkout: Math.round(n / 4), arrivals };
}

// Funil do checkout: cada passo em % das visitas e do passo anterior, por aparelho; o maior vazamento ganha o destaque.
const DEVICES = [["all", "Todos"], ["phone", "Celular"], ["desktop", "Computador"]];
function Funnel({ site, label }) {
  const [dev, setDev] = useState("all");
  const f = site?.[dev];
  const steps = f ? [["Visitou o site", f.visits], ["Viu o produto", f.product], ["Abriu o checkout", f.checkout], ...(dev === "all" ? [["Fez o pedido", f.orders]] : [])] : [];
  const drop = steps.map(([, n], i) => (i && steps[i - 1][1] ? 1 - n / steps[i - 1][1] : -1)), leak = drop.indexOf(Math.max(...drop));
  return (
    <Card title="Funil do checkout" sub={f?.visits ? `${label} · ${fmt(f.orders != null ? (f.orders / f.visits) * 100 : (f.checkout / f.visits) * 100, "pct")} das visitas ${dev === "all" ? "viram pedido" : "abriram o checkout"}` : label}
      action={<span className="seg small" role="group" aria-label="Aparelho">{DEVICES.map(([k, l]) => <button key={k} className={dev === k ? "on" : ""} aria-pressed={dev === k} onClick={() => setDev(k)}>{l}</button>)}</span>}>
      {!f?.visits ? <p className="empty">Nenhuma visita registrada no período.</p> : (
        <div className="funnel">
          {steps.map(([name, n], i) => (
            <div key={name} className={`funnel-step ${i === leak && drop[i] > 0 ? "leak" : ""}`}>
              <em>{i + 1}</em>
              <div><b>{name}</b><small>{fmt(n, "n")} {i ? `· ${fmt(steps[i - 1][1] ? (n / steps[i - 1][1]) * 100 : 0, "pct")} do passo anterior` : "visitas"}</small></div>
              <b>{fmt((n / f.visits) * 100, "pct")}</b>
              <div className="bar"><i style={{ width: `${Math.max(1, (n / f.visits) * 100)}%` }} /></div>
            </div>
          ))}
          {leak > 0 && drop[leak] > 0 && <p className="note">Maior vazamento: de "{steps[leak - 1][0].toLowerCase()}" para "{steps[leak][0].toLowerCase()}", {fmt(drop[leak] * 100, "pct")} param ali.</p>}
        </div>
      )}
    </Card>
  );
}

// Checkout abandonado: quem largou o checkout da Coinzz em cada intervalo e quantas voltaram e compraram (a régua da Malu chama).
function Carts({ data, period }) {
  const cp = useChartPeriod(data, period), m = cp.p?.metrics || {};
  const ab = m.carts_abandoned?.series || [], rec = m.carts_recovered?.series || [], labels = bucketLabels(cp.id, BUCKETS, ab.length, data.updated);
  const total = m.carts_abandoned?.value, back = m.carts_recovered?.value;
  return (
    <Card title="Checkout abandonado" sub={`${periodLabel(cp.id)} · ${total ? `${fmt(back, "n")} de ${fmt(total, "n")} voltaram e compraram (${fmt((back / total) * 100, "pct")})` : "recuperado pela mensagem da Malu"}`} action={cp.picker}>
      <GroupBars ghost items={ab.map((v, i) => ({ label: labels[i], abandoned: v || 0, recovered: rec[i] || 0 }))}
        series={[{ key: "abandoned", name: "Abandonaram", color: "var(--muted)" }, { key: "recovered", name: "Recuperados", color: "var(--neon-blue)" }]} />
    </Card>
  );
}

// Quando os leads compram: pedidos feitos por dia da semana e faixa de 3 h (Brasília), com o valor ao passar o mouse ou tocar.
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], ORDER = [1, 2, 3, 4, 5, 6, 0], SLOTS = ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"];
function BuyTimes({ p, label }) {
  const heat = p.heat;
  if (!heat) return <Card title="Quando os leads compram"><p className="empty">Sem pedidos no período.</p></Card>;
  const cells = ORDER.map((d) => heat[d]);
  let best = null;
  cells.forEach((r, i) => r.forEach((c, j) => { if (c.n && (!best || c.n > best.n)) best = { n: c.n, i, j }; }));
  return (
    <Card title="Quando os leads compram" sub={`${label} · pedidos por dia e hora${best ? ` · mais movimento: ${DAYS[ORDER[best.i]].toLowerCase()} por volta das ${SLOTS[best.j]}` : ""}`}>
      <Heatmap rows={ORDER.map((d) => DAYS[d])} cols={SLOTS} cells={cells} />
    </Card>
  );
}
