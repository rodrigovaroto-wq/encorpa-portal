// Dados sintéticos para os testes (nenhum dado real de cliente). Tudo relativo a NOW, para os períodos do portal caírem certos.
export const NOW = Date.parse("2026-10-19T15:00:00Z");
const at = (h) => new Date(NOW - h * 3600000).toISOString(); // h horas atrás

export function fixture() {
  return {
    leads: [
      { id: "lead-ana", name: "Ana Teste", phone: "5511900000001", size: "M", created_at: at(5), handoff_at: null, opted_out_at: null, state: "SP", ctwa: "clid-1" },
      { id: "lead-bia", name: "Bia Teste", phone: "5511900000002", size: null, created_at: at(50), handoff_at: at(1), opted_out_at: null, state: "MG", ctwa: null },
      { id: "lead-dup", name: "Duda Teste", phone: "5511900000003", size: null, created_at: at(3), handoff_at: null, opted_out_at: null, state: null, ctwa: "clid-2" },
      { id: "lead-persona", name: null, phone: "5500099133877", size: null, created_at: at(2), handoff_at: null, opted_out_at: null, state: null, ctwa: null },
    ],
    conversations: [
      { id: "11111111-1111-4111-8111-111111111111", lead_id: "lead-ana", stage: "pedido_criado", cost_brl: 0.3, last_inbound_at: at(4), last_outbound_at: at(3.9), created_at: at(5) },
      { id: "22222222-2222-4222-8222-222222222222", lead_id: "lead-bia", stage: "conversando", cost_brl: 0.1, last_inbound_at: at(48), last_outbound_at: at(1), created_at: at(50) },
      // Duas conversas abertas do mesmo lead, criadas no mesmo instante (corrida da turn).
      { id: "33333333-3333-4333-8333-333333333333", lead_id: "lead-dup", stage: "novo", cost_brl: 0, last_inbound_at: at(3), last_outbound_at: null, created_at: at(3) },
      { id: "44444444-4444-4444-8444-444444444444", lead_id: "lead-dup", stage: "conversando", cost_brl: 0.05, last_inbound_at: at(2.9), last_outbound_at: at(2.8), created_at: at(2.99) },
      { id: "55555555-5555-4555-8555-555555555555", lead_id: "lead-persona", stage: "novo", cost_brl: 0, last_inbound_at: at(2), last_outbound_at: null, created_at: at(2) },
    ],
    messages: [
      { id: "m1", conversation_id: "11111111-1111-4111-8111-111111111111", direction: "inbound", body: "Oi, quanto custa?", created_at: at(5), external_id: "wamid.1" },
      { id: "m2", conversation_id: "11111111-1111-4111-8111-111111111111", direction: "outbound", body: "Sai por R$ 129,90 na entrega.", created_at: at(4.99), external_id: null },
      { id: "m3", conversation_id: "11111111-1111-4111-8111-111111111111", direction: "inbound", body: "Quero o M", created_at: at(4), external_id: "wamid.2" },
      { id: "m4", conversation_id: "11111111-1111-4111-8111-111111111111", direction: "outbound", body: "Feito!", created_at: at(3.9), external_id: null },
      { id: "m5", conversation_id: "22222222-2222-4222-8222-222222222222", direction: "inbound", body: "Tem loja física?", created_at: at(48), external_id: "wamid.3" },
      { id: "m6", conversation_id: "22222222-2222-4222-8222-222222222222", direction: "outbound", body: "Só online.", created_at: at(47.9), external_id: null },
      { id: "m7", conversation_id: "22222222-2222-4222-8222-222222222222", direction: "outbound", body: "Segue o link", created_at: at(1), external_id: "human:2222:abc:1" },
      { id: "m8", conversation_id: "33333333-3333-4333-8333-333333333333", direction: "inbound", body: "Oi", created_at: at(3), external_id: "wamid.4" },
      { id: "m9", conversation_id: "44444444-4444-4444-8444-444444444444", direction: "inbound", body: "Qual o preço?", created_at: at(2.9), external_id: "wamid.5" },
      { id: "m10", conversation_id: "44444444-4444-4444-8444-444444444444", direction: "outbound", body: "Oi! Me conta sua cintura.", created_at: at(2.8), external_id: null },
      { id: "m11", conversation_id: "55555555-5555-4555-8555-555555555555", direction: "inbound", body: "frete incluso?", created_at: at(2), external_id: "wamid.6" },
    ],
    turn_outcomes: [
      { id: "t1", conversation_id: "11111111-1111-4111-8111-111111111111", outcome: "send", reason: null, rewrites: 1, agent_version: 27, created_at: at(4.99) },
      { id: "t2", conversation_id: "22222222-2222-4222-8222-222222222222", outcome: "handoff", reason: "a cliente pediu para falar com uma pessoa: texto", rewrites: 0, agent_version: 27, created_at: at(47.9) },
      { id: "t3", conversation_id: "44444444-4444-4444-8444-444444444444", outcome: "send", reason: null, rewrites: 0, agent_version: 27, created_at: at(2.8) },
    ],
    orders: [
      { id: "o1", external_id: "LZ1", lead_id: "lead-ana", created_at: at(3.8), updated_at: at(3.8), amount_brl: 129.9, status: "Agendado", payment_method: "cod", units: 1, size: "M", scheduled_for: "2026-10-21" },
    ],
    eval_turn_outcomes: [], eval_gate_blocks: [], eval_conversation_cost: [], eval_version_outcomes: [], eval_attribution: [],
    hermes_runs: [], hermes_proposals: [], hermes_backlog: [], agent_versions: [{ version: 27, published_at: at(100), note: null }],
    meta: null, n8n: null,
  };
}
