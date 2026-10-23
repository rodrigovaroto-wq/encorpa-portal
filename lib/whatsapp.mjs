// Número do WhatsApp na Meta (só leitura, Graph API): estado, qualidade, limite de envio, nome exibido e templates.
// Leitura de gestão, sem custo de mensagem. Precisa de um token com whatsapp_business_management (WHATSAPP_TOKEN), do id do número
// (WHATSAPP_PHONE_NUMBER_ID) e, para os templates e a conta, do id da conta do WhatsApp Business (WHATSAPP_WABA_ID).
const GRAPH = "https://graph.facebook.com/v21.0";
const FRESH = 15 * 60000; // a qualidade muda em horas, não em minutos: lê no máximo a cada 15 min
let last = null;

// Cada grupo de campos vai numa chamada própria: um campo que a Meta tirou ou que o token não lê não derruba os outros.
const CORE = "display_phone_number,verified_name,quality_rating,status,name_status";
const EXTRA = ["messaging_limit_tier", "throughput", "code_verification_status", "account_mode"];

async function get(path, token) {
  const r = await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15_000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Meta: ${body.error?.message || `HTTP ${r.status}`}`.slice(0, 200));
  return body;
}

export async function whatsappNumber({ waToken, waPhoneId, waWabaId, fixture } = {}) {
  if (fixture) return fixture.number ?? null;
  if (!waToken || !waPhoneId) return null;
  const key = `${waPhoneId}|${waWabaId || ""}`;
  if (last?.key === key && Date.now() - last.at < FRESH) return last.value;
  const core = await get(`${waPhoneId}?fields=${CORE}`, waToken);
  const extras = await Promise.allSettled(EXTRA.map((f) => get(`${waPhoneId}?fields=${f}`, waToken)));
  const x = Object.assign({}, ...extras.filter((e) => e.status === "fulfilled").map((e) => e.value));
  const [account, templates] = waWabaId ? await Promise.allSettled([
    get(`${waWabaId}?fields=name,account_review_status,business_verification_status`, waToken),
    get(`${waWabaId}/message_templates?fields=name,status,category,language,quality_score&limit=100`, waToken),
  ]) : [];
  const value = {
    ok: true, phone: core.display_phone_number, name: core.verified_name, status: core.status, quality: core.quality_rating, name_status: core.name_status,
    tier: x.messaging_limit_tier ?? null, throughput: x.throughput?.level ?? null, verification: x.code_verification_status ?? null, mode: x.account_mode ?? null,
    account: account?.status === "fulfilled" ? { name: account.value.name, review: account.value.account_review_status, verification: account.value.business_verification_status } : null,
    templates: templates?.status === "fulfilled" ? templates.value.data.map((t) => ({ name: t.name, status: t.status, category: t.category, language: t.language, quality: t.quality_score?.score ?? null })) : null,
    at: new Date().toISOString(),
  };
  last = { key, at: Date.now(), value };
  return value;
}
