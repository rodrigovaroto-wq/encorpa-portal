// Economia por pedido e premissas do teste, num lugar só: o servidor (lib/build.mjs) e as telas leem daqui.
// Margem se entregue (operador, 15/10). Na entrega (Logzz, ajuda.logzz.com.br "Taxas, prazos e condições"): a comissão é o que
// sobra do preço depois do produto (R$ 30/peça), da entrega concluída (R$ 19,99; Entrega Garantida desligada) e do manuseio
// (R$ 5,00), e a transação é 6,99% dessa comissão + R$ 2,49 de antifraude. Antecipado (Mercado Pago pela Coinzz): tabela do
// Ricos-com-AI, 06-modelo-economico.md (09/10), com a taxa estimada metade Pix, metade cartão.
export const PRODUCT = 30, DELIVERY = 19.99, HANDLING = 5;
const commission = (price, units) => price - PRODUCT * units - DELIVERY - HANDLING;
export const codMargin = (price, units) => { const c = commission(price, units); return c - (c * 0.0699 + 2.49); };
export const PREPAY_MARGIN = [77.92, 136.14, 169.15];
// Custo adiantado de um pedido na entrega: sai do saldo de expedição ao separar e volta no repasse.
export const codUpfront = (price, units) => { const c = commission(price, units); return PRODUCT * units + DELIVERY + HANDLING + c * 0.0699 + 2.49; };
export const RELEASE_DAYS = 14; // repasse padrão da Logzz, depois de "Completo"
export const REFUSAL_COST = 9.99; // valor único fixado pelo operador (15/10), só no pagamento na entrega
export const RETURN_COST = { cod: 30, prepay: 50 }; // estimativa do operador (15/10): o custo real é o frete de volta, varia por região
export const META_TAX = 0.1383; // imposto da Meta sobre o gasto de anúncio (operador, 15/10)
// WhatsApp: R$ 0 por lead dentro das janelas de 24 h e 72 h; só o template UTILITY do pós-venda fora da janela, ~R$ 0,04 por pedido
// (Ricos-com-AI, 06-modelo-economico.md, 02/10).
export const WA_PER_ORDER = 0.04;
export const CASH_LIMIT = 1075; // caixa utilizável do teste (R19.1): R$ 1.325 com R$ 250 de segurança

// Premissas ideais do teste (operador, 19/10): CPL R$ 1,25 e conversão de 10%; IA R$ 0,27 por lead e mix 70% na entrega com
// 1 peça de R$ 129,90 (Premissas, 15/10). DELIVERY_DAYS é premissa do portal: dias da criação do pedido até o "Completo".
export const IDEAL = { cpl: 1.25, conversion: 10, api_per_lead: 0.27, cod_share: 0.7, cod_price: 129.9 };
export const DELIVERY_DAYS = 7;

// Caixa para rodar o anúncio num período (operador, 19/10), a partir do orçamento diário e das premissas ideais.
// Sai do caixa: anúncio com imposto, IA e WhatsApp, e o custo adiantado dos pedidos na entrega. Nada volta antes de um ciclo
// (entrega + repasse); depois dele, o repasse dos pedidos antigos paga os novos. Por isso o caixa necessário é o de no máximo
// um ciclo. O que entra do antecipado na hora não é descontado (conta conservadora).
export function cashPlan(daily, days) {
  if (!(daily > 0) || !(days > 0)) return null;
  const spend = daily * days, leads = spend / IDEAL.cpl, orders = (leads * IDEAL.conversion) / 100, cod = orders * IDEAL.cod_share;
  const ad = spend * (1 + META_TAX), api = leads * IDEAL.api_per_lead + orders * WA_PER_ORDER, upfront = cod * codUpfront(IDEAL.cod_price, 1);
  const total = ad + api + upfront, cycle = DELIVERY_DAYS + RELEASE_DAYS;
  return { daily, days, spend, leads, orders, cod_orders: cod, ad, api, upfront, total, cycle, need: total * Math.min(1, cycle / days) };
}
