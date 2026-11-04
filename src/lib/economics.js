// Economia por pedido e premissas do teste, num lugar só: o servidor (lib/build.mjs) e as telas leem daqui.
// Margem se entregue (operador, 15/10). Na entrega (Logzz, ajuda.logzz.com.br "Taxas, prazos e condições"): a comissão é o que
// sobra do preço depois do produto (R$ 30/peça), da entrega concluída (R$ 19,99; Entrega Garantida desligada) e do manuseio
// (R$ 5,00), e a transação é 6,99% dessa comissão + R$ 2,49 de antifraude. Antecipado (Mercado Pago pela Coinzz): tabela do
// Ricos-com-AI, taxas-antecipadas-cod.md §4, com a taxa estimada metade Pix, metade cartão.
// Oferta de 27/10 (Ricos-com-AI, grafo §133): a venda passa pelos checkouts da Coinzz; a entrega é da OmniCash, que é a Logzz (mesmas
// taxas), e o frete é grátis para a cliente nos dois caminhos. Na entrega, o "frete" de R$ 24,98 da OmniCash é a entrega concluída
// (R$ 19,99) + o manuseio (R$ 4,99), que a conta já desconta. No antecipado a operação paga o frete: R$ 26,36 é a média do frete do
// antecipado de 1 peça nas 22 cidades do teste (varredura da Coinzz de 02/11, cobertura-coinzz-2026-11-02.txt; premissa para os kits).
export const PRODUCT = 30, DELIVERY = 19.99, HANDLING = 5, PREPAY_FREIGHT = 26.36;
const commission = (price, units) => price - PRODUCT * units - DELIVERY - HANDLING;
export const codMargin = (price, units) => { const c = commission(price, units); return c - (c * 0.0699 + 2.49); };
// Antecipado: preço − produto − manuseio − Mercado Pago (50% Pix 0,99% + R$ 1,00; 50% cartão 4,98%) − frete. O preço é o pago (com cupom).
export const prepayMargin = (price, units) => price - PRODUCT * units - HANDLING - (0.5 * (0.0099 * price + 1) + 0.5 * 0.0498 * price) - PREPAY_FREIGHT;
// Custo adiantado de um pedido na entrega: sai do saldo de expedição ao separar e volta no repasse.
export const codUpfront = (price, units) => { const c = commission(price, units); return PRODUCT * units + DELIVERY + HANDLING + c * 0.0699 + 2.49; };
export const RELEASE_DAYS = 14; // repasse padrão da Logzz, depois de "Completo"
export const REFUSAL_COST = 9.99; // valor único fixado pelo operador (15/10), só no pagamento na entrega
export const RETURN_COST = { cod: 30, prepay: 50 }; // estimativa do operador (15/10): o custo real é o frete de volta, varia por região
// O imposto da Meta (13,83%) é pago junto com o anúncio e já está dentro do gasto que a Meta mostra e a API devolve (operador, 20/10:
// a conta mostra R$ 77,38 gastos, imposto incluído). O anúncio entra pelo valor da Meta, sem acréscimo.
// WhatsApp: R$ 0 por lead dentro das janelas de 24 h e 72 h; só o template UTILITY do pós-venda fora da janela, ~R$ 0,04 por pedido
// (Ricos-com-AI, 06-modelo-economico.md, 02/10).
export const WA_PER_ORDER = 0.04;
// Custos fixos (operador, 20/10), no cartão: PikaPods (n8n) cobra por hora, US$ 3,73 por mês, de um saldo que recarrega US$ 10 sozinho
// abaixo de US$ 1; número do WhatsApp R$ 35 por mês, vence dia 5. Entram no resultado só quando vencem e são pagos de novo
// (operador, 20/10): nada de rateio por dia. O que já estava pago em 20/10 (US$ 10 e R$ 55) fica só no "Investido até agora".
export const USD_BRL = 5.4; // o mesmo câmbio fixo do Ricos-com-AI (supabase/functions/turn e whatsapp), para tudo o que é cobrado em dólar
const MONTH = (365.25 / 12) * 86400000;
const PIKAPODS = { usdMonth: 3.73, balance: 9.46, at: Date.parse("2026-10-20T15:00:00Z"), floor: 1, topUp: 10, paid: 10 }; // saldo lido em 20/10
const WA_NUMBER = { first: 55, monthly: 35, dueDay: 5, since: Date.parse("2026-10-21T03:00:00Z") }; // R$ 55 já pagos; depois R$ 35 a cada dia 5
// k-ésima recarga da PikaPods (k ≥ 1): quando o consumo leva o saldo de 20/10 para baixo de US$ 1 pela k-ésima vez.
const topUpAt = (k) => PIKAPODS.at + ((PIKAPODS.balance - PIKAPODS.floor + (k - 1) * PIKAPODS.topUp) / PIKAPODS.usdMonth) * MONTH;
// k-ésima mensalidade do número (k ≥ 1): dia 5 de Brasília (03:00 UTC), a partir do mês seguinte a 20/10.
const dueAt = (k) => { const d = new Date(WA_NUMBER.since); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k - (d.getUTCDate() < WA_NUMBER.dueDay ? 1 : 0), WA_NUMBER.dueDay, 3); };
// Cobranças fixas que vencem em (a, b]: cada recarga de US$ 10 da PikaPods e cada mensalidade de R$ 35 do número.
export function fixedPayments(a, b) {
  const out = [];
  for (let k = 1; topUpAt(k) <= b; k++) if (topUpAt(k) > a) out.push({ id: "pikapods", at: topUpAt(k), brl: PIKAPODS.topUp * USD_BRL });
  for (let k = 1; dueAt(k) <= b; k++) if (dueAt(k) > a) out.push({ id: "wa_number", at: dueAt(k), brl: WA_NUMBER.monthly });
  return out;
}
export const fixedDue = (a, b) => fixedPayments(a, b).reduce((x, p) => x + p.brl, 0);
// PikaPods pelo que já saiu do cartão: a recarga de US$ 10 feita antes de 20/10 + as que venceram depois; saldo e próxima recarga.
export function pikapods(now) {
  const topUps = fixedPayments(0, now).filter((p) => p.id === "pikapods").length;
  const balance = PIKAPODS.balance - (Math.max(0, now - PIKAPODS.at) / MONTH) * PIKAPODS.usdMonth + topUps * PIKAPODS.topUp;
  return { topUps, balance, paid: (PIKAPODS.paid + topUps * PIKAPODS.topUp) * USD_BRL, nextTopUp: new Date(topUpAt(topUps + 1)).toISOString() };
}
// Número do WhatsApp pelo que já saiu do cartão: R$ 55 e mais R$ 35 a cada dia 5 vencido depois de 20/10.
export function waNumber(now) {
  const n = fixedPayments(0, now).filter((p) => p.id === "wa_number").length;
  return { paid: WA_NUMBER.first + n * WA_NUMBER.monthly, payments: n, next: new Date(dueAt(n + 1)).toISOString() };
}

// Premissas ideais do teste (operador, 19/10): CPL R$ 1,25 e conversão de 10%; IA R$ 0,05 por lead (operador, 20/10) e mix 70% na entrega com
// 1 peça de R$ 109,90 (oferta de 27/10). DELIVERY_DAYS é premissa do portal: dias da criação do pedido até o "Completo".
export const IDEAL = { cpl: 1.25, conversion: 10, api_per_lead: 0.05, cod_share: 0.7, cod_price: 109.9 };
export const DELIVERY_DAYS = 7;

// Caixa para rodar o anúncio num período (operador, 19/10), a partir do orçamento diário e das premissas ideais.
// Sai do caixa: anúncio (imposto incluído), IA, WhatsApp e o custo adiantado dos pedidos na entrega. Os custos fixos ficam fora: este
// caixa é só para rodar a operação (operador, 20/10). Nada volta antes de um ciclo (entrega + repasse); depois dele, o repasse dos pedidos
// antigos paga os novos. Por isso o caixa necessário é o de no máximo um ciclo. O que entra do antecipado na hora não é descontado.
// CPL e conversão vêm das premissas ideais, ou do que o operador digitar para simular (Financeiro › Caixa).
export function cashPlan(daily, days, { cpl = IDEAL.cpl, conversion = IDEAL.conversion } = {}) {
  if (!(daily > 0) || !(days > 0) || !(cpl > 0) || !(conversion >= 0)) return null;
  const spend = daily * days, leads = spend / cpl, orders = (leads * conversion) / 100, cod = orders * IDEAL.cod_share;
  const ad = spend, api = leads * IDEAL.api_per_lead + orders * WA_PER_ORDER, upfront = cod * codUpfront(IDEAL.cod_price, 1);
  const total = ad + api + upfront, cycle = DELIVERY_DAYS + RELEASE_DAYS;
  return { daily, days, cpl, conversion, spend, leads, orders, cod_orders: cod, ad, api, upfront, total, cycle, need: total * Math.min(1, cycle / days) };
}

// Meta do mês (protótipo do painel, 04/11): ritmo diário necessário = (meta − realizado no mês) ÷ dias restantes; meta batida = 0.
export const goalPace = (goal, done, daysLeft) => (goal > 0 ? Math.max(0, (goal - done) / Math.max(1, daysLeft)) : null);
