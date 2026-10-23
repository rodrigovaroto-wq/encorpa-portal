// Dados de exemplo (NÃO são reais): um ano de operação simulada, tabela por tabela no formato do Supabase e da Meta, passado pela
// mesma conta do servidor (lib/build.mjs › build). Todo número sai dos mesmos leads, conversas, mensagens e pedidos, então fecha
// entre as abas: conversão = pedidos ÷ leads, CPL = gasto ÷ conversas iniciadas, lucro = margem − anúncio − IA − WhatsApp − fixos.
// A operação segue o que a Encorpa faz de verdade: anúncio de clique para o WhatsApp de R$ 30 a R$ 50 por dia, a Malu respondendo
// das 06:00 à 00:00, régua de lembretes até 71 h, 70% na entrega, entrega em ~6 dias, recusa na porta perto de 15%.
// Cada dia sai de uma semente fixa: recarregar a página não muda o passado, só o que aconteceu desde a última leitura.
import { build, channel } from "../../lib/build.mjs";

const DAY = 86400000, MIN = 60000, HOUR = 3600000, BRT = 3 * HOUR;
const DAYS = 365;
const COD = [129.9, 233.82, 311.76], PRE = [116.91, 207.84, 272.79];

function rng(seed) { let s = 2166136261; for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const weighted = (r, pairs) => { const total = pairs.reduce((a, [, w]) => a + w, 0); let x = r() * total; for (const [v, w] of pairs) if ((x -= w) < 0) return v; return pairs.at(-1)[0]; };
const between = (r, a, b) => a + (b - a) * r();
const iso = (ms) => new Date(ms).toISOString();
// Ids no formato do Supabase (uuid): o portal mostra os 8 primeiros caracteres, então eles precisam variar.
const uuid = (r) => { const h = () => Math.floor(r() * 0x10000).toString(16).padStart(4, "0"); return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`; };
const hourBRT = (ms) => new Date(ms - BRT).getUTCHours();
const dayBRT = (ms) => new Date(ms - BRT).toISOString().slice(0, 10);

// A cliente escreve mais no almoço e à noite; a Malu só responde das 06:00 à 00:00 (fora disso, às 6h).
const HOURS = [1, .5, .3, .2, .2, .4, 1, 2, 3, 4, 4.5, 5, 5.5, 5, 4.5, 4.5, 4.5, 5, 5.5, 6.5, 7, 6.5, 5, 3].map((w, h) => [h, w]);
const maluAt = (r, at) => { const h = hourBRT(at); if (h >= 6) return at + between(r, 18, 70) * 1000; const six = at - (((h * 60 + new Date(at).getUTCMinutes()) * MIN) % DAY) + 6 * HOUR; return six + between(r, 5, 90) * 1000; };

const FIRST = ["Ana", "Bruna", "Carla", "Daniela", "Elaine", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana", "Karina", "Larissa", "Mariana", "Natália", "Patrícia", "Renata", "Sabrina", "Tatiane", "Vanessa", "Aline", "Camila", "Débora", "Eduarda", "Flávia", "Giovana", "Jéssica", "Letícia", "Luana", "Márcia", "Priscila", "Raquel", "Simone", "Thaís", "Viviane", "Adriana", "Cláudia", "Cristiane", "Sandra", "Rosana", "Kelly"];
const LAST = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Gomes", "Martins", "Araújo", "Ribeiro", "Barbosa", "Rocha", "Dias", "Moreira", "Cardoso", "Teixeira", "Mendes", "Freitas", "Nunes"];
// UF, peso nos leads, DDDs, cidade de exemplo e quanto converte (cobertura da entrega e prazo).
const UFS = [["SP", 32, [11, 19, 15, 16, 12, 13], "São Paulo", 1.15], ["RJ", 12, [21, 22, 24], "Rio de Janeiro", 1], ["MG", 11, [31, 32, 34, 35], "Belo Horizonte", 1.05], ["BA", 6, [71, 73, 75], "Salvador", .8], ["PR", 6, [41, 43, 44], "Curitiba", 1.1],
  ["RS", 5, [51, 54], "Porto Alegre", 1.05], ["PE", 5, [81, 87], "Recife", .85], ["CE", 4, [85, 88], "Fortaleza", .8], ["GO", 4, [62, 64], "Goiânia", 1], ["SC", 3, [47, 48], "Florianópolis", 1.1], ["DF", 3, [61], "Brasília", 1.05],
  ["ES", 2, [27], "Vitória", .95], ["PA", 2, [91, 93], "Belém", .6], ["RN", 2, [84], "Natal", .75], ["PB", 1.5, [83], "João Pessoa", .75], ["MT", 1.5, [65, 66], "Cuiabá", .8], ["AL", 1, [82], "Maceió", .7], ["MS", 1, [67], "Campo Grande", .9]];
const SIZES = [["P", 12, 64], ["M", 30, 72], ["G", 28, 80], ["GG", 18, 88], ["XG", 8, 94], ["XGG", 4, 99]];

const OPENERS = ["Oi, vi o anúncio do colete. Quanto custa?", "Oi! Quero saber mais sobre o colete", "Boa tarde, ainda tem o colete modelador?", "Olá, quanto tá o colete?", "Oi, esse colete afina mesmo a cintura?", "Oie, vi no Instagram, como funciona?", "Quero o colete!", "Bom dia, qual o valor?", "Oi, tem tamanho grande?", "Olá! Vocês entregam na minha cidade?"];
const GREET = (name) => [`Oi${name ? `, ${name}` : ""}! Tudo bem? 💜 Eu sou a Malu, da Encorpa. Pra eu te indicar o tamanho certo, qual a medida da sua cintura em cm?`, `Oi${name ? ` ${name}` : ""}! Que bom que você chamou 💜 Me conta a medida da sua cintura (em cm) que eu já te digo o tamanho ideal.`];
const WAIST = (w) => [`uns ${w}`, `${w} cm`, `acho que ${w}`, `${w}`, `medi aqui, deu ${w}`];
const SPECIAL = [
  ["handoff", "a cliente quer 6 peças, mais que o maior kit (3): pediu atacado", "Vocês vendem no atacado? queria umas 6 pra revender"],
  ["handoff", "a cliente pergunta sobre um pedido existente: rastreio", "Fiz um pedido semana passada e não chegou ainda, cadê?"],
  ["handoff", "a cliente pediu para falar com uma pessoa: texto", "Prefiro falar com uma atendente, pode ser?"],
  ["fallback", "nenhuma reescrita passou: tamanho", "Tenho 104 de cintura, serve?"],
  ["fallback", "sem tempo para reescrever: fila", "E se não servir eu troco como?"],
  ["handoff", "troca de tamanho depois de entregue: pedido entregue", "Recebi mas ficou apertado, consigo trocar pelo G?"],
  ["fallback", "pergunta de saúde fora do escopo: pós-operatório", "Posso usar 20 dias depois da lipo?"],
];
const OPTOUT = ["Não tenho interesse, pode parar de mandar", "Para de me mandar mensagem por favor", "Não quero mais, obrigada"];

// Versões da Malu: v1 há um ano, v26 há 6 dias. Cada versão converte um pouco mais e passa menos para o operador.
const VERSIONS = 26;
const versionAt = (vs, at) => { let v = vs[0]; for (const x of vs) if (x.at <= at) v = x; return v; };

// Anúncios (Meta): o mesmo conjunto que a conta tem hoje. cpl e conv: quanto cada criativo custa e converte em relação à média.
const ADS = [
  { id: "a1", name: "Vídeo 1 — gancho dor nas costas", adset: "s1", from: 365, to: 150, cpl: 1.15, conv: .9 },
  { id: "a2", name: "Vídeo 2 — antes e depois", adset: "s1", from: 330, to: 0, cpl: .95, conv: 1.1 },
  { id: "a3", name: "Vídeo 3 — prova social", adset: "s2", from: 200, to: 0, cpl: 1.05, conv: 1.05 },
  { id: "a4", name: "Vídeo 4 — cintura na hora", adset: "s1", from: 90, to: 0, cpl: .9, conv: 1.15 },
  { id: "a5", name: "Vídeo 5 — por baixo da roupa", adset: "s2", from: 30, to: 0, cpl: 1, conv: 1 },
  { id: "a6", name: "Estático — oferta na entrega", adset: "s2", from: 240, to: 60, cpl: 1.25, conv: .8 },
];

const PROPOSALS = [
  { target: "prompt", rationale: "Clientes perguntaram se o colete marca na roupa e a Malu não respondeu a pergunta.", diff: "+ Quando ela perguntar se marca na roupa, responder que o tecido é fino e não aparece por baixo de blusa justa.", classe: "venda_perdida", severidade: "media", quote: "marca na roupa?" },
  { target: "gate", rationale: "A Malu prometeu prazo de entrega antes de consultar a cobertura do CEP.", diff: "+ Prazo só depois da cobertura conhecida.", classe: "mentira", severidade: "alta", quote: "chega em 3 dias né?" },
  { target: "prompt", rationale: "Quem pergunta do pós-parto recebe a resposta genérica e some.", diff: "+ No pós-parto, perguntar quantas semanas e indicar liberação médica antes de usar.", classe: "venda_perdida", severidade: "media", quote: "tive bebê faz 2 meses, posso usar?" },
  { target: "prompt", rationale: "A Malu repete o preço três vezes na mesma conversa.", diff: "- Repetir o preço a cada mensagem\n+ Citar o preço uma vez e depois só se ela perguntar.", classe: "tom", severidade: "baixa", quote: "já entendi o preço kkk" },
  { target: "regua", rationale: "O segundo lembrete às 9h chega para quem já disse que só compra no dia do pagamento.", diff: "+ Se ela disse o dia do pagamento, o lembrete vai nesse dia.", classe: "venda_perdida", severidade: "media", quote: "só recebo dia 5" },
  { target: "prompt", rationale: "Na dúvida entre dois tamanhos a Malu indicou o menor, contra a regra da oferta.", diff: "+ Na dúvida entre dois tamanhos, o maior.", classe: "mentira", severidade: "alta", quote: "fico entre o M e o G" },
  { target: "gate", rationale: "Endereço sem número passou para o checkout e a entrega voltou.", diff: "+ Gate de endereço exige número ou 's/n' explícito.", classe: "venda_perdida", severidade: "alta", quote: "rua das flores, centro" },
  { target: "prompt", rationale: "A Malu respondeu com resposta pronta quando a cliente mandou só um emoji.", diff: "+ Emoji sozinho: seguir de onde parou, sem resposta pronta.", classe: "resposta_pronta", severidade: "baixa", quote: "👍" },
];

export function demoRaw(now = Date.now()) {
  const today0 = now - ((now - BRT) % DAY); // meia-noite de hoje em Brasília
  const start = today0 - DAYS * DAY;
  const versions = Array.from({ length: VERSIONS }, (_, i) => ({ version: i + 1, at: start + 3 * DAY + (i / (VERSIONS - 1)) * (DAYS - 9) * DAY + (14 * 60 + 17 * (i % 3)) * MIN }));
  const D = { leads: [], conversations: [], messages: [], turn_outcomes: [], orders: [], llm_calls: [], eval_attribution: [], eval_turn_outcomes: [], eval_gate_blocks: [], eval_conversation_cost: [], eval_version_outcomes: [], hermes_runs: [], hermes_proposals: [], hermes_backlog: [], profiles: [] };
  D.agent_versions = versions.map((v) => ({ version: v.version, published_at: iso(v.at), note: null }));
  const daily = [], perAd = Object.fromEntries(ADS.map((a) => [a.id, { leads: 0, ordered: 0, delivered: 0, opted: 0 }]));
  const turnsByDay = {}, gatesByDay = {}, byVersion = {};
  let seq = 0, orderSeq = 48000;

  for (let d = DAYS; d >= 0; d--) {
    const day0 = today0 - d * DAY, dayKey = new Date(day0 + BRT).toISOString().slice(0, 10), r = rng(`dia ${dayKey}`);
    if (day0 > now) break;
    // Anúncio do dia: orçamento de R$ 30 no começo, R$ 40 depois e R$ 50 nos últimos 4 meses; a Meta gasta um pouco menos que o orçamento.
    const budget = d > 240 ? 30 : d > 120 ? 40 : 50, weekend = [0, 6].includes(new Date(day0 + BRT).getUTCDay());
    const elapsed = Math.min(1, (now - day0) / DAY), spendDay = budget * between(r, .86, 1.02) * elapsed;
    const cplBase = (1.48 - 0.22 * ((DAYS - d) / DAYS)) * (weekend ? .93 : 1) * between(r, .9, 1.12);
    const live = ADS.filter((a) => d <= a.from && d >= a.to);
    const weights = live.map((a) => 1 / a.cpl), wsum = weights.reduce((a, b) => a + b, 0);
    const dayLeads = [];
    live.forEach((a, i) => {
      const spend = Math.round(spendDay * (weights[i] / wsum) * 100) / 100, cpl = cplBase * a.cpl, started = Math.round(spend / cpl);
      const impressions = Math.round((spend / between(r, 15, 22)) * 1000), clicks = Math.round(impressions * between(r, .013, .021));
      daily.push({ ad_id: a.id, day: dayKey, spend, impressions, clicks, started });
      for (let k = 0; k < started; k++) dayLeads.push({ ad: a });
    });
    // Orgânicas: cerca de 30% das que vêm de anúncio (indicação, perfil, quem salvou o número).
    const organic = Math.round(dayLeads.length * between(r, .22, .36));
    for (let k = 0; k < organic; k++) dayLeads.push({ ad: null });

    for (const L of dayLeads) {
      const lr = rng(`lead ${dayKey} ${seq}`);
      const t0 = day0 + weighted(lr, HOURS) * HOUR + lr() * HOUR;
      if (t0 > now) { seq++; continue; }
      lead(D, lr, `${dayKey.replaceAll("-", "")}${String(seq++).padStart(5, "0")}`, t0, L.ad, versionAt(versions, t0), now, { perAd, turnsByDay, gatesByDay, byVersion, order: () => orderSeq++ });
    }
  }

  // Tabelas de avaliação (as views eval_* do Ricos-com-AI), somadas das mesmas respostas.
  for (const [day, x] of Object.entries(turnsByDay)) D.eval_turn_outcomes.push({ day, turns: x.turns, sent: x.sent, fallbacks: x.fallbacks, handoffs: x.handoffs, avg_rewrites: x.turns ? x.rewrites / x.turns : 0, cost_brl: Math.round(x.cost * 100) / 100 });
  for (const [k, x] of Object.entries(gatesByDay)) { const [day, gate] = k.split("|"); D.eval_gate_blocks.push({ day, gate, checks: x.checks, blocks: x.blocks }); }
  for (const [v, x] of Object.entries(byVersion)) D.eval_version_outcomes.push({ agent_version: +v, turns: x.turns, fallbacks: x.fallbacks, handoffs: x.handoffs, avg_rewrites: x.turns ? x.rewrites / x.turns : 0, cost_brl: x.convs ? x.cost / x.convs : 0 });
  D.eval_attribution = ADS.map((a) => ({ ad: a.id, headline: a.name, leads: perAd[a.id].leads, leads_ordered: perAd[a.id].ordered, leads_delivered: perAd[a.id].delivered, leads_opted_out: perAd[a.id].opted }));
  hermes(D, versions, now);
  D.meta = metaRaw(daily);
  return D;
}

// Uma cliente do primeiro "oi" ao desfecho: mensagens, respostas da Malu (com reescritas e custo), lembretes, pedido e perfil.
function lead(D, r, n, t0, ad, ver, now, acc) {
  const q = (ver.version - 1) / (VERSIONS - 1); // 0 na v1, 1 na v26
  const [uf, , ddds, city, ufConv] = weighted(r, UFS.map((u) => [u, u[1]]));
  const [size, , waist0] = weighted(r, SIZES.map((s) => [s, s[1]]));
  const waist = waist0 + Math.round(between(r, -3, 3));
  const first = pick(r, FIRST), name = `${first} ${pick(r, LAST)}`;
  const id = uuid(r), conv = uuid(r);
  const L = { id, name, phone: `55${pick(r, ddds)}9${String(Math.floor(r() * 1e8)).padStart(8, "0")}`, size: null, created_at: iso(t0), handoff_at: null, opted_out_at: null, state: null, ctwa: ad ? `demo-clid-${n}` : null };
  const msgs = [], turns = [], calls = [];
  let stage = "novo", at = t0, lastIn = t0, lastOut = null, cost = 0, flagged = null;
  const says = (text, delay) => { at += delay; if (at > now) return false; msgs.push({ id: `${conv}-${msgs.length}`, conversation_id: conv, direction: "inbound", body: text, created_at: iso(at), external_id: `wamid.demo${n}${msgs.length}` }); lastIn = at; calls.push({ id: `${conv}-i${calls.length}`, conversation_id: conv, cost_brl: 0.002, created_at: iso(at) }); return true; };
  // Resposta da Malu: cada reescrita é uma chamada a mais ao modelo; o custo vai para llm_calls e para a conversa.
  const malu = (text, outcome = "send", reason = null) => {
    const when = maluAt(r, at); if (when > now) return false; at = when;
    const rewrites = r() < 0.55 - 0.3 * q ? (r() < 0.75 ? 1 : 2) : 0;
    for (let k = 0; k <= rewrites; k++) { const c = Math.round(between(r, .006, .012) * 10000) / 10000; cost += c; calls.push({ id: `${conv}-c${calls.length}`, conversation_id: conv, cost_brl: c, created_at: iso(at) }); }
    msgs.push({ id: `${conv}-${msgs.length}`, conversation_id: conv, direction: "outbound", body: text, created_at: iso(at), external_id: null }); lastOut = at;
    turns.push({ id: `${conv}-t${turns.length}`, conversation_id: conv, outcome, reason, rewrites, agent_version: ver.version, created_at: iso(at) });
    return true;
  };
  const human = (text, delay) => { at += delay; if (at > now) return false; msgs.push({ id: `${conv}-${msgs.length}`, conversation_id: conv, direction: "outbound", body: text, created_at: iso(at), external_id: `human:${conv}:${msgs.length}` }); lastOut = at; return true; };
  const remind = (text, when) => { if (when > now) return; msgs.push({ id: `${conv}-${msgs.length}`, conversation_id: conv, direction: "outbound", body: text, created_at: iso(when), external_id: `regua:${conv}:${msgs.length}` }); lastOut = Math.max(lastOut ?? 0, when); };
  const reply = () => between(r, 0.5, 9) * MIN * (r() < 0.15 ? 12 : 1);

  // Destino desta cliente, pela qualidade da versão no ar, pelo estado e pelo criativo.
  const pConv = (0.052 + 0.035 * q) * ufConv * (ad ? ad.conv : 1.2), pUnres = 0.085 - 0.045 * q, pOpt = 0.017;
  const u = r(), fate = u < pConv ? "buy" : u < pConv + pUnres ? "unres" : u < pConv + pUnres + pOpt ? "optout" : "silent";
  const depth = fate === "buy" ? 5 : fate === "silent" ? weighted(r, [[0, 46 - 4 * q], [1, 22], [2, 17], [3, 15]]) : Math.floor(between(r, 0, 3));
  const audio = r() < 0.14 ? 1 + Math.floor(r() * 3) : 0;
  for (let k = 0; k < audio; k++) calls.push({ id: `${conv}-a${k}`, conversation_id: null, cost_brl: 0.011, created_at: iso(t0 + (k + 1) * 4 * MIN) }); // transcrição: sem conversa, como grava a função whatsapp
  const units = weighted(r, [[1, 76], [2, 17], [3, 7]]), prepay = r() < 0.3;

  let ok = says(pick(r, OPENERS), 0) && malu(pick(r, GREET(first)));
  if (ok) stage = "conversando";
  const special = fate === "unres" ? pick(r, SPECIAL) : null;
  const step = (k) => ok && depth >= k;
  if (ok && fate === "optout") { ok = says(pick(r, OPTOUT), reply()) && malu("Tudo bem, não te mando mais mensagens. Se mudar de ideia é só chamar 💜", "opted_out", "a cliente pediu para sair: texto"); if (ok) { L.opted_out_at = iso(at); stage = "perdido"; } }
  else {
    if (step(1) && says(pick(r, WAIST(waist)), reply()) && (L.size = size) && malu(`Pra ${waist} cm o ideal é o ${size}. O colete sai por R$ 129,90 com pagamento na entrega e frete grátis. Me passa o seu CEP que eu vejo se chega aí?`)) stage = "tamanho_definido"; else if (depth >= 1) ok = false;
    if (step(2) && says(`${Math.floor(10000 + r() * 89999)}-${String(Math.floor(r() * 999)).padStart(3, "0")}`, reply()) && (L.state = uf) && malu(`Chega sim! Em ${city} a entrega é em até 7 dias úteis e você paga na porta. Prefere pagar na entrega ou antecipado com 10% off?`)) stage = "cobertura_conhecida"; else if (depth >= 2) ok = false;
    if (step(3) && says(units > 1 ? `quero ${units}, ${prepay ? "no pix" : "na entrega"}` : prepay ? "pix com desconto" : "na entrega", reply())
      && malu(`Perfeito! ${units > 1 ? `${units} peças saem por ${(prepay ? PRE : COD)[units - 1].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. ` : ""}Segue o link pra confirmar seus dados: https://encorpa.com.br/p/${n.slice(-6)}`)) stage = "link_enviado"; else if (depth >= 3) ok = false;
    if (special && ok) {
      ok = says(special[2], reply()) && malu("Vou confirmar isso com a equipe e já te retorno, tá? 💜", special[0], special[1]);
      if (ok) { flagged = at; if (special[0] === "handoff") L.handoff_at = iso(at); }
      // O operador atende das 08:00 às 22:00 e responde em 5 a 40 min (a pausa da Malu só sai quando ele devolve a conversa).
      const h = hourBRT(at), open = h >= 8 && h < 22 ? 0 : (((8 - h + 24) % 24) * HOUR - new Date(at).getUTCMinutes() * MIN);
      if (ok && r() < 0.85) human(`Oi ${first}! Aqui é o Rodrigo, da Encorpa. ${special[0] === "handoff" ? "Já vi aqui e resolvo pra você agora." : "Serve sim, te explico."}`, open + between(r, 5, 40) * MIN);
    }
  }
  // Pedido: criado depois do link; o status anda com o tempo (Logzz na entrega, Coinzz no antecipado).
  if (fate === "buy" && ok && says("pronto, fiz o pedido", reply()) && malu("Pedido confirmado! 💜 Você vai receber a confirmação por aqui e o entregador avisa antes de passar.")) {
    stage = "pedido_criado";
    const o = orderFor(r, at, now, units, prepay, size, acc.order());
    D.orders.push({ ...o, id: uuid(r), lead_id: id });
    stage = o.stage;
    if (ad) { acc.perAd[ad.id].ordered++; if (o.delivered) acc.perAd[ad.id].delivered++; }
  }
  // Sem resposta dela: a régua manda os lembretes (60 min, 9h do dia seguinte, cupom em 71 h) e encerra depois de 72 h.
  if (fate === "silent" || (!ok && fate !== "optout" && !flagged)) {
    remind(`${first}, conseguiu ver? Se ficou alguma dúvida sobre o tamanho é só me falar 💜`, lastOut + 60 * MIN);
    const next9 = lastOut - ((lastOut - BRT) % DAY) + DAY + 9 * HOUR; remind("Bom dia! Passando pra lembrar que o colete com pagamento na entrega ainda está disponível pra você 😊", next9);
    remind("Última chamada: com o cupom SUPER20 você leva com 20% off até hoje à noite.", t0 + 71 * HOUR);
    if (now - lastIn > 72 * HOUR) stage = "perdido";
  }
  if (ad) { acc.perAd[ad.id].leads++; if (L.opted_out_at) acc.perAd[ad.id].opted++; }

  D.leads.push(L);
  D.conversations.push({ id: conv, lead_id: id, stage, cost_brl: Math.round(cost * 10000) / 10000, last_inbound_at: iso(lastIn), last_outbound_at: lastOut ? iso(lastOut) : null, created_at: iso(t0) });
  for (const m of msgs) D.messages.push(m);
  for (const x of turns) D.turn_outcomes.push(x);
  for (const c of calls) D.llm_calls.push(c);
  D.eval_conversation_cost.push({ day: dayBRT(t0), cost_brl: cost });
  // Por dia e por versão, como as views eval_*: respostas, prontas, avisos ao operador, reescritas e o que cada gate barrou.
  for (const x of turns) {
    const day = dayBRT(Date.parse(x.created_at)), T = (acc.turnsByDay[day] ??= { turns: 0, sent: 0, fallbacks: 0, handoffs: 0, rewrites: 0, cost: 0 });
    T.turns++; T.sent += x.outcome !== "handoff"; T.fallbacks += x.outcome === "fallback"; T.handoffs += x.outcome === "handoff"; T.rewrites += x.rewrites;
    const V = (acc.byVersion[x.agent_version] ??= { turns: 0, fallbacks: 0, handoffs: 0, rewrites: 0, cost: 0, convs: 0 });
    V.turns++; V.fallbacks += x.outcome === "fallback"; V.handoffs += x.outcome === "handoff"; V.rewrites += x.rewrites;
    for (const [gate, share] of [["tamanho", 1], ["preço", 1], ["endereço", .5], ["cobertura", .6], ["checkout", .4]]) {
      if (r() > share) continue;
      const G = (acc.gatesByDay[`${day}|${gate}`] ??= { checks: 0, blocks: 0 }); G.checks++;
      if (x.rewrites && r() < 0.2) G.blocks++;
    }
  }
  if (turns.length) { const day = dayBRT(Date.parse(turns[0].created_at)); acc.turnsByDay[day].cost += cost; const V = acc.byVersion[ver.version]; V.cost += cost; V.convs++; }
  D.profiles.push(profile(r, L, stage, msgs, audio, fate, special));
}

function orderFor(r, at, now, units, prepay, size, seq) {
  const amount = (prepay ? PRE : COD)[units - 1], age = (now - at) / DAY, deliverIn = between(r, 3.5, 9);
  const refused = !prepay && r() < 0.15, returned = r() < (prepay ? 0.06 : 0.05), unpaid = prepay && r() < 0.08, cancelled = !prepay && r() < 0.02;
  let status, stage = "pedido_criado", updated = at, delivered = false;
  if (cancelled && age > 0.5) { status = "Cancelado"; stage = "perdido"; updated = at + 0.5 * DAY; }
  else if (prepay && unpaid) { status = age > 1 ? "Não pago" : "Aguardando pagamento"; stage = age > 1 ? "perdido" : "link_enviado"; updated = at + Math.min(age, 1) * DAY; }
  else if (age < 1) status = prepay ? "Aprovado" : "Agendado";
  else if (age < deliverIn - 1.5) { status = prepay ? "Aprovado" : "Agendado"; updated = at + 0.6 * DAY; }
  else if (age < deliverIn) { status = "Em rota"; stage = "em_rota"; updated = at + (deliverIn - 1.5) * DAY; }
  else if (refused) { status = "Frustrado"; stage = "recusado"; updated = at + deliverIn * DAY; }
  else { status = prepay ? "Entregue" : "Completo"; stage = "entregue_pago"; updated = at + deliverIn * DAY; delivered = true; if (returned && age > deliverIn + 9) { status = prepay ? "Reembolsado" : "Devolvido"; updated = at + (deliverIn + 9) * DAY; delivered = false; } }
  return { external_id: `${prepay ? "CZ" : "LZ"}${seq}`, created_at: iso(at), updated_at: iso(Math.min(updated, now)), amount_brl: amount, status, payment_method: prepay ? "prepay" : "cod", units, size, scheduled_for: prepay ? null : iso(at + Math.ceil(between(r, 1, 3)) * DAY).slice(0, 10), stage, delivered };
}

// Perfil e score do lead (a view lead_profiles_v): sinais da própria conversa. Pedido criado = 100.
function profile(r, L, stage, msgs, audio, fate, special) {
  const reach = { novo: 5, conversando: 18, tamanho_definido: 38, cobertura_conhecida: 55, caminho_escolhido: 62, link_enviado: 72 }[stage];
  const bought = ["pedido_criado", "em_rota", "entregue_pago"].includes(stage);
  const objections = [...new Set([r() < .32 && "preco", r() < .18 && "confianca", r() < .14 && "tamanho", r() < .12 && "entrega", r() < .08 && "pagamento", r() < .06 && "conforto", r() < .07 && "resultado", special && r() < .5 && "outra"].filter(Boolean))];
  const sens = weighted(r, [["alta", objections.includes("preco") ? 60 : 18], ["media", 40], ["baixa", 30]]);
  const score = bought ? 100 : stage === "perdido" ? Math.round(between(r, 2, 22)) : Math.max(0, Math.min(95, Math.round((reach ?? 10) + between(r, -8, 10) - objections.length * 4 - (sens === "alta" ? 6 : 0))));
  const band = score >= 60 ? "quente" : score >= 30 ? "morna" : "fria";
  return { id: L.id, created_at: L.created_at, stage, score, score_band: band, score_at: msgs.at(-1)?.created_at ?? L.created_at,
    occasion: r() < 0.72 ? weighted(r, [["dia a dia", 40], ["trabalho", 18], ["festa", 12], ["pós-parto", 10], ["casamento", 6], ["academia", 8], ["viagem", 6]]) : null,
    objections, price_sensitivity: msgs.length > 2 ? sens : null, audio_count: audio };
}

// Hermes: confere todo dia às 08:47 e roda quando chegaram 50 leads novos; propõe, o operador decide e a aprovada vira versão nova.
function hermes(D, versions, now) {
  const times = D.leads.map((l) => Date.parse(l.created_at)).sort((a, b) => a - b);
  let i = 0, since = 0, k = 0, last = null;
  const first = times[0] - ((times[0] - BRT) % DAY) + DAY + (8 * 60 + 47) * MIN;
  for (let check = first; check <= now; check += DAY) {
    while (i < times.length && times[i] < check) { i++; since++; }
    if (since < 50) continue;
    const r = rng(`hermes ${check}`), id = `demo-run-${k++}`, ok = r() < 0.35 ? 0 : r() < 0.7 ? 1 : 2, premise = Math.floor(between(r, 0, 3.4));
    D.hermes_runs.push({ id, created_at: iso(check + between(r, 4, 9) * MIN), started_at: iso(check), source: "production", model: "muse-spark-1.3", conversations_seen: since, leads_seen: since, proposals_ok: ok, proposals_rejected: r() < 0.4 ? 1 : 0, cost_usd: Math.round(between(r, .32, .55) * 100) / 100, premise_conversations: premise, commit_sha: Math.floor(r() * 0xfffffff).toString(16) });
    for (let p = 0; p < ok; p++) {
      const t = PROPOSALS[(k + p) % PROPOSALS.length], at = check + 10 * MIN, age = (now - at) / DAY, accepted = r() < 0.72;
      const status = age < 1 ? "proposed" : age < 2 ? (accepted ? "accepted" : "rejected") : age < 3 ? (accepted ? "implementing" : "rejected") : accepted ? "published" : "rejected";
      const v = versionAt(versions, at + 3 * DAY).version;
      D.hermes_proposals.push({ id: `${id}-p${p}`, code: `H-${D.hermes_proposals.length + 1}`, target: t.target, status, rationale: t.rationale, diff: t.diff, leads_seen: since, run_id: id, created_at: iso(at),
        evidence: { o_que: t.rationale, por_que: `${2 + Math.floor(r() * 4)} conversas da rodada mostram o problema.`, objetivo: "Nenhuma conversa com o mesmo problema na próxima rodada", como_medir: "Conversas com o problema ÷ conversas lidas na próxima rodada", classe: t.classe, severidade: t.severidade, evidencias: [{ conversa: `conversa-${String(1 + Math.floor(r() * since)).padStart(2, "0")}`, mensagem: 2 + Math.floor(r() * 6), trecho: t.quote }] },
        ...(status !== "proposed" ? { decided_at: iso(at + 0.4 * DAY), decision_reason: accepted ? "Aprovado." : "Recusado: não sustenta a margem ou contradiz a oferta." } : {}),
        ...(["implementing", "published"].includes(status) ? { executed_at: iso(at + 1.2 * DAY), execution_ref: `turn v${v}` } : {}),
        ...(status === "published" ? { published_at: iso(at + 2 * DAY), result: "Guarda: teste de regressão na suíte do turn." } : {}) });
    }
    last = check; since = 0;
  }
  while (i < times.length) { i++; since++; }
  D.hermes_backlog.push({ leads_since_last_run: since, last_run_at: last ? iso(last) : null, due: since >= 50 });
}

function metaRaw(daily) {
  return {
    campaigns: [{ id: "c1", name: "Encorpa — CTWA — Sempre ligado", objective: "OUTCOME_ENGAGEMENT", status: "ACTIVE", daily_budget: null, lifetime_budget: null }],
    adsets: [
      { id: "s1", name: "Conjunto A — Brasil aberto, mulheres 18–55", campaign_id: "c1", status: "ACTIVE", daily_budget: 25, lifetime_budget: null, optimization: "CONVERSATIONS", audience: { age: "18–55", genders: [2], places: "BR" } },
      { id: "s2", name: "Conjunto B — Sudeste, Centro-Oeste e Sul", campaign_id: "c1", status: "ACTIVE", daily_budget: 25, lifetime_budget: null, optimization: "CONVERSATIONS", audience: { age: "18–55", genders: [2], places: "SP, RJ, MG, ES, PR, SC, RS, GO, DF, MT, MS" } }],
    ads: ADS.map((a) => ({ id: a.id, name: a.name, adset_id: a.adset, campaign_id: "c1", status: a.to > 0 ? "PAUSED" : "ACTIVE", creative: { title: a.name, body: "Cintura marcada na hora, sem apertar. Pagamento na entrega e frete grátis.", thumb: "", type: "VIDEO" } })),
    daily,
  };
}

// Workflows de exemplo, só quando o navegador ainda não tem a leitura do n8n de verdade (o operador pediu para manter os dele).
const DEMO_WORKFLOWS = (now) => ({
  read: 300,
  workflows: [
    { id: "w1", name: "Encorpa — Turno da agente", active: true, runs: 140, errors: 0, last: { status: "success", at: iso(now) }, nodes: [["Mensagem chega", "webhook", 0, 0], ["Chama a função turn", "httpRequest", 220, 0], ["Deu certo?", "if", 440, 0], ["Responde", "respondToWebhook", 660, -80], ["Avisa o operador", "emailSend", 660, 80]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["Mensagem chega", "Chama a função turn"], ["Chama a função turn", "Deu certo?"], ["Deu certo?", "Responde"], ["Deu certo?", "Avisa o operador"]] },
    { id: "w2", name: "Encorpa — Relógio da régua", active: true, runs: 96, errors: 0, last: { status: "success", at: iso(now) }, nodes: [["A cada 10 min", "scheduleTrigger", 0, 0], ["Varre follow-ups", "httpRequest", 220, 0], ["Avisa o operador", "emailSend", 440, 0]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["A cada 10 min", "Varre follow-ups"], ["Varre follow-ups", "Avisa o operador"]] },
  ],
  runs: Array.from({ length: 12 }, (_, i) => ({ workflow: i % 3 ? "Encorpa — Turno da agente" : "Encorpa — Relógio da régua", status: "success", mode: i % 3 ? "webhook" : "trigger", at: iso(now - i * 6e5), ms: 400 + i * 90 })),
});

// Número do WhatsApp na Meta (Malu › Número): o que a Graph API devolve para um número saudável.
export const DEMO_NUMBER = { ok: true, phone: "+55 11 9XXXX-0000", name: "Encorpa", status: "CONNECTED", quality: "GREEN", tier: "TIER_1K", name_status: "APPROVED", throughput: "STANDARD", verification: "VERIFIED", mode: "LIVE",
  account: { name: "Encorpa", review: "APPROVED", verification: "verified" },
  templates: [{ name: "pos_venda_confirmacao", status: "APPROVED", category: "UTILITY", language: "pt_BR", quality: "GREEN" }, { name: "pedido_a_caminho", status: "APPROVED", category: "UTILITY", language: "pt_BR", quality: "GREEN" }, { name: "lembrete_entrega", status: "APPROVED", category: "UTILITY", language: "pt_BR", quality: "UNKNOWN" }] };

// O retrato do portal com os dados de exemplo. automations: a última leitura do n8n de verdade guardada no navegador, se houver.
export function demoData(automations, now = Date.now()) {
  const D = demoRaw(now), profiles = D.profiles;
  delete D.profiles;
  const data = build(D, now);
  const auto = automations?.workflows ? automations : DEMO_WORKFLOWS(now);
  data.global.automations = auto;
  data.global.number = DEMO_NUMBER;
  data.global.channel = channel(data.global.health.whatsapp, auto, DEMO_NUMBER);
  data.global.health.n8n = { ok: true, detail: `${auto.workflows.filter((w) => w.active).length} workflows ativos` };
  data.global.health.supabase.detail = `dados de exemplo · ${data.global.health.supabase.detail}`;
  data.global.health.number = { ok: true, detail: "conectado · qualidade alta · 1.000 conversas por dia" };
  data.global.profiles = profiles;
  return { ...data, demo: true, source: "demo" };
}
