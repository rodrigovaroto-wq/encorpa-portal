# Caso portal — o que a Octadesk mostra e o que serve para o nosso portal

> Escrito em 2026-10-14. Fontes: o vídeo do tour da plataforma (57 s, enviado pelo operador), a transcrição da demo de 14/10
> e a triagem `docs/agente-ia/03-pesquisa/07-triagem-reuniao-octadesk.md` no `Ricos-com-AI`.
> Melhorias do agente (Malu) ficam no `Ricos-com-AI`; aqui fica só o que é tela, métrica e configuração do portal.

## 1. O que veio do REA

**Nada. O REA não foi rodado**, por três motivos:

1. **Não funciona deste ambiente.** A sessão roda num container na nuvem. Um Chrome aberto aqui não aparece para o operador,
   que não consegue digitar o teste de 15 s, e o container não tem login da Octadesk.
2. **Não responderia às perguntas.** Como o agente raciocina, como gera as mensagens, como fala com o WhatsApp e onde guarda
   os dados são coisas que rodam no servidor da Octadesk. O navegador só vê a interface e as chamadas que ela faz. Script e
   mapa de código-fonte mostram como a tela foi montada, não a inteligência.
3. **Copiar o código não é um caminho que eu sigo.** `beta.octadesk.com` é a área logada dos clientes deles. Baixar scripts e
   mapas de código-fonte para replicar a plataforma é copiar código proprietário, e os termos de uso deles proíbem. O risco
   jurídico fica com a Encorpa, e o ganho é zero: o que queremos (abas, métricas, formas de configurar) aparece na tela.

## 2. O que eu li por conta própria

### 2.1 Vídeo (tour interativo "Marcos, gerente de vendas")

| Tempo | Tela | Evidência (texto na tela) | Serve para nós? |
|---|---|---|---|
| 0:00 | Login + início do tour | "Marcos… precisava ter visibilidade da operação de vendas" | — |
| 0:03–0:06 | Configurações › Modelos de mensagem | "Novo modelo de mensagem", cabeçalho Imagem/Vídeo/Documento/Localização, prévia com variáveis `nome-contato`, `nome-agente`, `nome-empresa`; categoria Marketing; menu: Telefones, Modelos de mensagem, Disparo em massa, Gerenciar tags, Pesquisa de satisfação, API | **Sim:** aba "Templates" só de leitura (nome, categoria, status de aprovação). Criar template continua no painel da Meta, que é do sócio |
| 0:12 | Estúdio de automação › Nova campanha | "Disparo em massa… lista de leads… personalizada com o nome de cada vendedor" | Não agora (opt-in de marketing, R6.1) |
| 0:09, 0:33 | Conversas (caixa de entrada) | Filtros "Todas 149 · Suas 5 · Tempo excedido 98 · Não respondidas 3 · Menções · Participações · Não atribuídas · Conversas do bot 27"; grupos Comercial/Financeiro/Suporte; faixa "97 conversas com o tempo excedido"; "Janela de cobrança iniciada em…"; painel lateral: Tags, Origem, Eventos da conversa, Lead/Cliente, Responsável | **Sim, em forma de números:** contadores "com a Malu / com pessoa / tempo excedido / não respondidas" e a janela de 24 h aberta |
| 0:15–0:27 | Etapas da conversa (fluxo) | Blocos: mensagem, arquivo, catálogo, "Direcione a conversa para o WOZ", perguntas (nome, e-mail, CPF, telefone), "Definir horário de atendimento", "Tagear conversa", "Valide uma informação", "Conecte a outro sistema" (POST para API, caminho de sucesso e de falha); nó "Assistente de vendas WOZ (AI)": "Tentativas de resposta antes de direcionar: 3", "Redirecionamento baseado no assunto: Encerrar / Falar com um humano / Proposta" | **Não como editor.** O nosso fluxo é código testado (R11.1). Vale como **diagrama de leitura** e como prova de que o desenho é o mesmo: as 3 tentativas antes de passar para pessoa são as nossas reescritas do gate |
| 0:36–0:39 | Áudio na conversa | "RESUMO WOZ: TAMANHO: 678 RESUMO: …", "Ver transcrição original" | A Malu já transcreve. Não temos o **resumo visível para o operador** |
| 0:42–0:51 | Lembrete / follow-up | "Criar lembrete… vinculado à conversa", "Visível só para você", ícones imprimir/transferir/lembrete/encerrar | A régua da Malu é automática. Não precisamos de lembrete manual |
| 0:54 | Fim do tour (CTA) | "Faça como o Marcos… Fazer uma reunião" | — |

**O vídeo não mostra** a tela de criação de agente nem a de analytics, que são as que mais interessam. Elas só aparecem na
transcrição da demo.

### 2.2 Transcrição da demo: as métricas de analytics deles

Para "os números baterem", usamos as mesmas definições com os nossos dados:

| Métrica Octadesk | Definição nossa | Dado que já temos | Falta |
|---|---|---|---|
| Atendimentos | leads com conversa no período | `leads.created_at` | — |
| Transferidos | leads com `handoff_at` | `leads.handoff_at` | — |
| Resolvidos pela IA / taxa de resolução | atendimentos − transferidos; ÷ atendimentos | idem | — |
| Por agente / por versão | o mesmo, por `agent_version` | `eval_version_outcomes` (por turno) | handoff por conversa e por versão (view nova no `Ricos-com-AI`) |
| Tempo médio até a primeira resposta | 1ª mensagem dela → 1ª da Malu | `messages.created_at` | view agregada (o portal não lê conversa) |
| Tempo médio de atendimento | 1ª → última mensagem | idem | idem |
| Volume de conversa por hora | mensagens recebidas por hora do dia | idem | idem |
| Conversão por canal / etiqueta / campanha | pedidos ÷ leads por origem | `eval_attribution`, `conversations.stage` | etiqueta com nome de negócio |
| Pesquisa de satisfação | nota de 1 a 5 depois da entrega | não existe | template UTILITY + toque na régua (depois da L3) |

## 3. Proposta para o portal, em ordem

1. **Taxa de resolução, atendimentos e transferidos** no grupo "Agente (Malu)". São só contas sobre `leads` em `lib/build.mjs`,
   sem view nova. É a métrica que você mais gostou na demo e é a meta R21.1.
2. **Versões com resolução e venda por versão.** Precisa de uma view no `Ricos-com-AI`.
3. **Tempos: 1ª resposta, atendimento, volume por hora.** Precisa de uma view agregada sobre `messages`, sem texto.
4. **Contadores ao vivo:** com a Malu, com pessoa, janela de 24 h aberta.
5. **Templates (só leitura)**, quando houver mais de 3.
