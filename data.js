// Snapshot real (somente agregados, sem dado de cliente). Troque por um job que gere este arquivo.
window.PORTAL_DATA = {
 "updated": "2026-10-09T19:40:00Z",
 "note": "Dados reais de TESTE: 4 conversas do operador e de amigos (06 a 08/10/2026). O anúncio ainda não rodou, então tudo de tráfego e dinheiro está vazio. Fonte: Supabase (views eval_*), consultado em 09/10.",
 "metrics": {
  "leads": {
   "value": 4,
   "series": [
    1,
    1,
    2
   ]
  },
  "orders": {
   "value": 0,
   "series": [
    0,
    0,
    0
   ]
  },
  "revenue": {
   "value": 0
  },
  "conversion": {
   "value": 0
  },
  "handoff": {
   "value": 25,
   "series": [
    0,
    0,
    3.57
   ]
  },
  "fallback": {
   "value": 0,
   "series": [
    0,
    0,
    0
   ]
  },
  "optout": {
   "value": 0,
   "series": [
    0,
    0,
    0
   ]
  },
  "rewrites": {
   "value": 0.04,
   "series": [
    0,
    0,
    0.04
   ]
  },
  "api_per_lead": {
   "value": 0.051
  },
  "gate_blocks": {
   "value": 0.07
  }
 },
 "totals": {
  "leads": 4,
  "orders": 0
 },
 "funnel": {
  "first_msg": 4,
  "order": 0
 },
 "money": {
  "revenue": 0,
  "api_cost": 0.21
 },
 "channel": {
  "number": "Ligado e testado (06/10)",
  "cloud_api": "Operando",
  "window": "—",
  "templates": "Aprovados (09/10)"
 },
 "versions": [
  {
   "version": "v9",
   "turns": 7,
   "handoff": 0,
   "fallback": 0,
   "rewrites": 0,
   "cost": 0.0318
  },
  {
   "version": "v10",
   "turns": 3,
   "handoff": 0,
   "fallback": 0,
   "rewrites": 0,
   "cost": 0.0111
  },
  {
   "version": "v11",
   "turns": 12,
   "handoff": 0,
   "fallback": 0,
   "rewrites": 0,
   "cost": 0.0402
  },
  {
   "version": "v14",
   "turns": 28,
   "handoff": 3.57,
   "fallback": 0,
   "rewrites": 0.04,
   "cost": 0.1223
  }
 ],
 "gates": [
  {
   "gate": "shipping_promise",
   "checks": 61,
   "blocks": 1,
   "rate": 1.64
  },
  {
   "gate": "size_insist",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "coverage_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "coupon_exists",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "unverified_size",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "unattributed_window",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "health_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "internal_note",
   "checks": 52,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "pacing",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "hook_repeat",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "charge_promise",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "installment_promise",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "opt_out",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "delivery_promise",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "unavailable_offer",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "cep_insist",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "noted_claim",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "order_action_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "identical_template",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "invented_testimonial",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "humanity_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "price_promise",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "warranty_promise",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "scarcity_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "size_claim",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "weight_loss_claim",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "pending_promise",
   "checks": 30,
   "blocks": 0,
   "rate": 0.0
  },
  {
   "gate": "business_hours",
   "checks": 61,
   "blocks": 0,
   "rate": 0.0
  }
 ]
};
