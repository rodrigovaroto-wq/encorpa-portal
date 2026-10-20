// Meta Ads (só leitura, token com `ads_read`): campanhas, conjuntos, anúncios e as métricas diárias por anúncio.
// Uma chamada de insights por atualização (365 dias, um dia por linha); os períodos do portal somam essas linhas.
const GRAPH = "https://graph.facebook.com/v21.0";
const DEFAULT_AD_NAME = /^(novo anúncio|new .*ad\b|anúncio de )/i;
const STARTED = "onsite_conversion.messaging_conversation_started_7d"; // conversa iniciada no WhatsApp (CTWA)

const PAGES = 100; // 50.000 linhas; acima disso a leitura falha em vez de mostrar um gasto menor que o real
const FRESH = 15 * 60000, STALE = 6 * 3600000; // a Meta limita chamadas por conta: lê no máximo a cada 15 min
let last = null; // última leitura boa desta instância da função
let failedAt = 0; // depois de uma falha, espera 15 min antes de tentar de novo (limite de chamadas da Meta)

async function all(path, token) {
  const rows = [];
  let url = `${GRAPH}/${path}${path.includes("?") ? "&" : "?"}limit=500&access_token=${encodeURIComponent(token)}`;
  for (let i = 0; url && i < PAGES; i++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(body.data)) throw new Error(`Meta: ${body.error?.message || `HTTP ${r.status}`}`.slice(0, 200));
    rows.push(...body.data);
    url = body.paging?.next;
  }
  if (url) throw new Error(`Meta: mais de ${PAGES * 500} linhas em ${path.split("?")[0]}; leitura interrompida para não mostrar números incompletos`);
  return rows;
}

export async function meta({ metaToken, metaAccount, fixture } = {}, now = Date.now()) {
  if (fixture) return fixture.meta ?? null;
  if (!metaToken || !metaAccount) return null;
  const key = `${metaAccount}`, at = Date.now();
  if (last?.key === key && at - last.at < FRESH) return last.value;
  const stale = (error) => ({ ...last.value, stale: { error, at: new Date(last.at).toISOString() } });
  if (last?.key === key && at - failedAt < FRESH && at - last.at < STALE) return stale("a última tentativa falhou; nova tentativa em até 15 min");
  try {
    const value = await read(metaToken, metaAccount, now);
    last = { key, at, value };
    failedAt = 0;
    return value;
  } catch (e) {
    failedAt = at;
    // Meta fora ou limitando: segue com a última leitura boa (até 6 h), avisando na tela.
    if (last?.key === key && at - last.at < STALE) return stale(String(e.message || e).slice(0, 200));
    throw e;
  }
}

async function read(metaToken, metaAccount, now) {
  const act = `act_${String(metaAccount).replace(/^act_/, "")}`;
  const day = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10); // dia de Brasília
  const range = encodeURIComponent(JSON.stringify({ since: day(now - 364 * 86400000), until: day(now) }));
  const [campaigns, adsets, ads, daily] = await Promise.all([
    all(`${act}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time`, metaToken),
    all(`${act}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,targeting{age_min,age_max,genders,geo_locations},start_time,end_time`, metaToken),
    all(`${act}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,created_time,creative{id,name,title,body,thumbnail_url,object_type}`, metaToken),
    all(`${act}/insights?level=ad&time_increment=1&time_range=${range}&fields=ad_id,spend,impressions,inline_link_clicks,actions`, metaToken),
  ]);
  const setName = Object.fromEntries(adsets.map((s) => [s.id, s.name]));
  const money = (c) => (c == null ? null : +c / 100); // orçamento vem em centavos
  const geo = (g) => [...(g?.countries || []), ...(g?.regions || []).map((r) => r.name), ...(g?.cities || []).map((c) => c.name)].join(", ");
  return {
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, objective: c.objective, status: c.effective_status || c.status, daily_budget: money(c.daily_budget), lifetime_budget: money(c.lifetime_budget) })),
    adsets: adsets.map((s) => ({ id: s.id, name: s.name, campaign_id: s.campaign_id, status: s.effective_status || s.status, daily_budget: money(s.daily_budget), lifetime_budget: money(s.lifetime_budget), optimization: s.optimization_goal,
      audience: { age: s.targeting ? `${s.targeting.age_min ?? 18}–${s.targeting.age_max ?? 65}` : null, genders: s.targeting?.genders, places: geo(s.targeting?.geo_locations) }, start: s.start_time, end: s.end_time })),
    // Anúncio com o nome padrão do Meta ("Novo anúncio de Engajamento", "New Engagement Ad"…) leva o nome do conjunto, que é o que os diferencia.
    ads: ads.map((a) => ({ id: a.id, name: DEFAULT_AD_NAME.test(a.name || "") ? setName[a.adset_id] || a.name : a.name, adset_id: a.adset_id, campaign_id: a.campaign_id, status: a.effective_status || a.status, created: a.created_time,
      creative: a.creative ? { title: a.creative.title, body: a.creative.body, thumb: a.creative.thumbnail_url, type: a.creative.object_type } : null })),
    daily: daily.map((r) => ({ ad_id: r.ad_id, day: r.date_start, spend: +r.spend || 0, impressions: +r.impressions || 0, clicks: +r.inline_link_clicks || 0,
      started: +(r.actions || []).find((x) => x.action_type === STARTED)?.value || 0 })),
  };
}

// Soma das linhas diárias dentro de [a, b), por anúncio. Dia em Brasília, como o resto do portal.
export function adTotals(daily, a, b) {
  const by = {};
  for (const r of daily) {
    const t = new Date(`${r.day}T03:00:00Z`).getTime(); // início do dia em Brasília
    if (t < a || t >= b) continue;
    const x = (by[r.ad_id] ??= { spend: 0, impressions: 0, clicks: 0, started: 0 });
    x.spend += r.spend; x.impressions += r.impressions; x.clicks += r.clicks; x.started += r.started;
  }
  return by;
}

// CTR, CPM e CPL de um total. CPL = gasto ÷ conversas iniciadas no WhatsApp.
export function rates(x) {
  return { ...x, ctr: x.impressions ? (x.clicks / x.impressions) * 100 : null, cpm: x.impressions ? (x.spend / x.impressions) * 1000 : null, cpl: x.started ? x.spend / x.started : null };
}
