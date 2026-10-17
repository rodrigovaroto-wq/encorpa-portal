# encorpa-portal

Portal de análise e operação da Encorpa. React 19 com Vite 8 (desde 16/10/2026), fundo roxo em ondas e cartões de vidro,
a partir dos templates Glassy Dashboard, Glassy CRM, Chat App UI e Sidebar UI.

## Rodar no computador

- `npm install` e depois `npm run dev` (abre em http://localhost:5173). Sem o Vercel não existe `/api/data`: o portal usa o
  último retrato guardado no navegador ou `public/data.js`. Em Preferências (engrenagem) dá para ligar os dados de exemplo.
- `npm run build` gera `dist/`, que é o que o Vercel publica.

## Estrutura

- `src/pages/`: Painel, Conversas, Pedidos, Malu, Anúncios, Clientes, Financeiro, Automações, Integrações, Notas.
- `src/components/`: fundo em ondas, menu lateral que recolhe, topo (período, busca ⌘K, notificações, preferências), gráficos e peças de vidro.
- `src/lib/`: constantes das métricas, carregamento dos dados, formatação e o menu.
- `lib/build.mjs` (servidor): monta os dados a partir do Supabase, do n8n e da Meta. `lib/meta.mjs`: leitura do Meta Ads.
- `api/data.js`: função do Vercel. `api/chat.js`: resposta do operador e a chave da Malu por conversa. `middleware.js`: login do site todo.
- `n8n/`: os dois workflows do n8n que são do portal (cópia do que está ativo no PikaPods).

## Publicado no Vercel

- `api/data.js` lê o Supabase, o n8n e a Meta na hora e guarda a resposta 5 min no cache. A página busca em `/api/data` a cada 5 min e mostra o horário em "atualizado".
- `middleware.js` pede e-mail e senha (login do navegador) para o site todo e para `/api/data`.
- Variáveis do projeto no Vercel (Settings > Environment Variables):
  - `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`): a chave service_role. Só no servidor, nunca no navegador.
  - `SUPABASE_URL` (opcional; padrão: o projeto da Encorpa).
  - `N8N_API_KEY` (opcional): chave da API do n8n para a seção Automações (workflows e execuções). `N8N_URL` opcional; padrão: o n8n da Encorpa no PikaPods. O portal lê só nome, tipo, posição e ligação dos nós, nunca os parâmetros.
  - `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID`: token só de leitura (`ads_read`) e a conta de anúncios, para a seção Anúncios.
  - `PORTAL_USERS`: quem pode entrar, no formato `email1:senha1,email2:senha2`. **Sem ela ninguém entra.**
- `lib/build.mjs` tem a conta das métricas (usada pela função e por `scripts/build-data.mjs`). Desde 16/10 (operador) traz as conversas com as clientes para a tela Conversas: nome, final do telefone, UF e o texto. Nunca endereço completo, CPF ou telefone inteiro.
- `public/data.js` é uma cópia de segurança sem conversas nem nomes de clientes (o git guarda para sempre). Se `/api/data` falhar, o portal mostra primeiro o último retrato bom guardado no navegador e só depois esse arquivo.

## Responder pelo portal (desde 16/10)

- Em Conversas, a caixa no pé da conversa envia pelo WhatsApp. `api/chat.js` primeiro pausa a Malu naquela conversa
  (`leads.handoff_at`, a chave que o turno e a régua já respeitam) e depois chama o webhook `portal-responder` do n8n.
- O workflow **Encorpa — Portal responder** (`n8n/portal-responder.json`) confere a `N8N_API_KEY` do portal contra a API do
  próprio n8n, passa pela mesma regra do formulário "Responder cliente" (`turn` › `human_reply`: janela de 24 h, texto,
  duplicata), grava a mensagem na conversa e entrega ao "WhatsApp envio". Se a Meta recusar, chega o e-mail de falha de envio.
- "Devolver para a Malu" limpa `handoff_at`: ela volta a responder a partir da próxima mensagem da cliente.
- Precisa de `N8N_API_KEY` no Vercel (a mesma da seção Automações).

## E-mail de conversa não resolvida (desde 16/10)

- O workflow **Encorpa — Portal: conversa não resolvida** (`n8n/conversa-nao-resolvida.json`) roda a cada 5 min e manda um
  e-mail ao operador quando uma conversa passa a ser "não resolvida" pela regra do portal (passagem ao operador ou resposta
  pronta, sem compra), com o link direto dela no portal. Janela fixa de 5 min: cada conversa gera um e-mail só. Desde 17/10 os
  avisos antigos "não precisa responder" (Turno da agente e Relógio da régua) estão desligados no n8n.

## Malu › Hermes

- Rodadas (`hermes_runs`), propostas com motivo, evidência, decisão e o que mudou (`hermes_proposals`) e quantos leads faltam
  para a próxima rodada (`hermes_backlog`). O Hermes roda pela Action `hermes.yml` do Ricos-com-AI. Cada proposta leva o nome
  da versão da Malu no ar quando nasceu ("Hermes V26"; antes da v1, de 05/10, "Hermes V0"), e o custo vai em reais (US$ × 5,40).
  Essas três tabelas são opcionais: se uma falhar, o resto do portal continua.
- `public/data.js` não leva a evidência nem a mudança proposta das propostas.
