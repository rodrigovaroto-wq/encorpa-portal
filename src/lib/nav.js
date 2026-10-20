// Menu do portal: seções do Sidebar UI (Operação, Análise, Sistema), páginas e sub-abas.
// desc = a linha que explica a página; badge(data, p) = contador ao lado do item, só quando pede atenção.
export const NAV = [
  { sec: "Operação", items: [
    { id: "home", label: "Painel", icon: "home", desc: "Os números que mandam no período, a variação de cada um e para onde estão indo." },
    { id: "chat", label: "Conversas", icon: "chat", desc: "Todas as conversas da Malu com as clientes, com a ficha de cada uma.", badge: (g) => g.chats?.filter((c) => c.status === "unresolved").length },
    { id: "orders", label: "Pedidos", icon: "box", desc: "Cada pedido na Logzz e na Coinzz, onde está e a agenda de entregas.", badge: (g) => g.orders?.filter((o) => ["created", "en_route"].includes(o.step)).length },
  ] },
  { sec: "Análise", items: [
    { id: "malu", label: "Malu", icon: "agent", badge: (g, p) => p?.gaps?.length, subs: [
      ["results", "Resultados", "Quantas conversas a Malu resolveu sozinha, por desfecho e por versão."],
      ["gaps", "Lacunas", "O que a Malu ainda não resolve sozinha: cada linha é um contorno a construir."],
      ["service", "Atendimento", "Funil da conversa, tempos de resposta e volume por hora."],
      ["health", "Saúde e versões", "Resposta pronta, reescritas, gates, canal e o antes × depois de cada versão."],
      ["hermes", "Hermes", "O supervisor offline: cada rodada, as propostas com motivo e evidência, a decisão e o que mudou na Malu."]] },
    { id: "ads", label: "Anúncios", icon: "ads", subs: [
      ["campaigns", "Campanhas", "Campanhas do Meta Ads com orçamento, estado e resultado, atualizadas a cada 5 minutos."],
      ["adsets", "Conjuntos", "Conjuntos de anúncios: público, posicionamento, orçamento e resultado."],
      ["ads", "Anúncios e criativos", "Cada anúncio com o criativo e as métricas, a comparação entre eles e a conversão por estado."],
      ["tests", "Testes de Criativos", "Os anúncios reais lado a lado, o vencedor de cada métrica, a região A × B, o piso de amostra e os critérios de pausa."],
      ["goals", "Metas", "Cada meta do teste contra o valor de agora."],
      ["ref", "Premissas", "Oferta, economia por pedido e premissas do teste, com a data de cada fonte."]] },
    { id: "customers", label: "Clientes", icon: "users", desc: "De onde vêm as clientes, em que estado compram mais e quantas voltam." },
    { id: "money", label: "Financeiro", icon: "money", subs: [
      ["result", "Resultado", "Do faturamento ao resultado, com anúncio, IA, WhatsApp e custos fixos, e o investido até agora."],
      ["api", "Consumo de API", "Custo do modelo (chamadas dos leads) e do WhatsApp no período, por dia, por lead e a projeção do mês."],
      ["cash", "Caixa", "Quanto caixa o gasto com anúncios pede para rodar a operação no período, com CPL e conversão ideais ou digitados."],
      ["compare", "Comparação", "Todas as métricas contra o período anterior."]] },
  ] },
  { sec: "Sistema", items: [
    { id: "auto", label: "Automações", icon: "flow", badge: (g) => g.automations?.workflows?.filter((w) => w.active && w.errors).length, subs: [
      ["workflows", "Workflows", "Os workflows do n8n com estado, última execução e o desenho de cada um."],
      ["flow", "Fluxo da Malu", "O caminho de uma mensagem dela até a resposta, e onde cada desfecho nasce."],
      ["runs", "Execuções", "As últimas execuções do n8n, com estado e duração."]] },
    { id: "integrations", label: "Integrações", icon: "plug", desc: "Cada fonte que o portal lê, se está respondendo e o que trouxe na última leitura.", badge: (g) => Object.values(g.health || {}).filter((h) => h.ok === false).length },
    { id: "notes", label: "Notas", icon: "note", desc: "Anotações do operador, com etiqueta. Ficam guardadas neste navegador." },
  ] },
];

export const PAGES = NAV.flatMap((s) => s.items);
export const pageBy = (id) => PAGES.find((p) => p.id === id) || PAGES[0];

// "#/malu/gaps" ou "#/chat?c=<id>": página, sub-aba e parâmetros.
export function parseRoute(hash) {
  const [path, qs = ""] = hash.replace(/^#\/?/, "").split("?");
  const [id, sub] = path.split("/");
  const page = pageBy(id);
  const s = page.subs ? page.subs.find(([k]) => k === sub) || page.subs[0] : null;
  return { page, sub: s, query: Object.fromEntries(new URLSearchParams(qs)) };
}
