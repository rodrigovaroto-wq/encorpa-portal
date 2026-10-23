# Handoff — encorpa-portal

> Atualizado em 23/10/2026. O que já está no código, o que falta e quem faz. Itens que dependem de acesso a uma plataforma
> (Vercel, Supabase, n8n, Meta) ficam como **pendente**, com o passo a passo.

## Feito (PR rodrigovaroto-wq/encorpa-portal#6, branch `claude/wonderful-davinci-mxhcb8`)

- Painel: blocos no formato da fileira de 4 (3 por fileira = 4/3 maior), número sempre na mesma altura, caixa de entrada em 3 blocos
  (não respondidas, com pessoa, tempo excedido de 15 min).
- Visual: só o wordmark "Encorpa Dashboard", 7 cores (roxo, azul, laranja, amarelo, verde, branco, preto) no tema escuro e claro,
  bloco selecionado com texto branco no claro.
- Configurações: janela no meio da tela com fundo desfocado, em abas (Aparência, Dados, Usuários e acesso, Empresa).
- Usuários com papel em `PORTAL_USERS` (`email:senha:papel`: admin, operador, leitura; sem papel = admin). O servidor confere.
- Clientes › Origem e recompra (gráfico com seletor de métrica) e Score e Perfil (era a aba Leads).
- Malu › Número do WhatsApp (estado, qualidade, limite, templates) e Malu › Teste (conversas simuladas, várias ao mesmo tempo).
- Conversas: imagem original da cliente (`api/media.js`), assim que a Malu gravar o id (ver pendente 3).
- Dados de exemplo: um ano simulado passado pela mesma conta do servidor; tudo fecha entre as abas.
- Malu › Resultados: resolução honesta e, embaixo, a do critério de mercado; venda por versão; Financeiro › custo por pedido.

## Pendente

### 1. `INBOUND_SIGNING_SECRET` no Vercel (Malu › Teste) — operador

A função `turn` só aceita mensagem com o selo, e o selo é feito com esse segredo. O Supabase guarda o valor mas não mostra.
Por isso o caminho é gerar um novo e gravar o mesmo valor nos dois lugares:

1. Gerar o valor (64 letras e números, de 0-9 e a-f). Qualquer um destes:
   - Mac ou Linux, no Terminal: `openssl rand -hex 32`
   - Windows, no PowerShell: `-join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })`
   - Copie a linha que sair (ex.: `3f9a…`, 64 caracteres). Não cole em chat nem em e-mail.
2. Supabase: projeto da Encorpa → **Edge Functions** → **Secrets** → `INBOUND_SIGNING_SECRET` → editar → colar → salvar.
   As funções `whatsapp` e `turn` passam a usar o valor novo juntas, na próxima mensagem.
3. Vercel: projeto `encorpa-portal` → **Settings** → **Environment Variables** → adicionar `INBOUND_SIGNING_SECRET` com o mesmo
   valor (Production e Preview) → salvar → **Deployments** → no último, **Redeploy**.
4. Se roda a rodada de personas do Ricos-com-AI pela porta do n8n, troque o valor no ambiente dela também.
5. Teste: Malu › Teste → Nova conversa → "Oi". Se aparecer "A turn recusou a mensagem sem selo", o valor nos dois lugares não bate.

### 2. Variáveis do número no Vercel — operador

- `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`: já gravados (23/10).
- `WHATSAPP_WABA_ID`: o id da conta do WhatsApp Business. Só números, em geral 15 ou 16 dígitos (ex.: `102938475610293`).
  Onde achar: developers.facebook.com → o app → **WhatsApp** → **Configuração da API** (API Setup), campo "WhatsApp Business
  Account ID"; ou business.facebook.com → **Gerenciador do WhatsApp** → **Ferramentas da conta** → id embaixo do nome da conta.
  Não confundir com o id do número (`WHATSAPP_PHONE_NUMBER_ID`), que aparece logo acima, também só números.
- Depois de gravar, Redeploy. A aba Malu › Número do WhatsApp mostra a conta e os templates.

### 3. Imagens nas Conversas — publicar a função `whatsapp` — operador

- Código feito em rodrigovaroto-wq/Ricos-com-AI#81: a função `whatsapp` grava o id da imagem em `messages.media`.
- Merge feito em 23/10. Falta (pendente por acesso: esta sessão não tem chave nem conector da Supabase): publicar a função.
  - Caminho provado (07–08/10): o **conector MCP da Supabase** (`deploy_edge_function`) com `index.ts`, `whatsapp.ts`,
    `inbound-signature.ts`, `vendor/OpusDecoder.js`, `deno.json` e `deno.lock`, com `verify_jwt: false`.
  - Pelo CLI, no Codespace do Ricos-com-AI:
    `npx supabase functions deploy whatsapp --project-ref hbmkgakzrqmdlsvszjeo --use-api --no-verify-jwt`.
    **Sem `--no-verify-jwt` a função passa a recusar os webhooks da Meta e a Malu para de receber mensagens.** O caminho do
    CLI com o decodificador de áudio não foi reexecutado desde 08/10 (`docs/operacao/whatsapp-cloud-api.md`).
  - Depois do deploy: mandar uma foto para o número e conferir em Conversas que ela aparece; mandar um áudio e conferir a
    transcrição (prova de que o decodificador continua de pé).
- Atenção: as premissas do teste dizem "Malu congelada de 23/10 a 09/11". A mudança não mexe na conversa da Malu (só grava o id
  depois de entregar), mas é um deploy de função durante o congelamento. Decisão do operador.
- Só aparecem as imagens que chegarem depois do deploy; a Meta guarda cada uma por cerca de 30 dias.

### 4. Workflow "Encorpa — Portal: conversa não resolvida" no n8n — operador

- Código feito: `n8n/conversa-nao-resolvida.json` pula os telefones inventados (5500099…), para Malu › Teste não mandar e-mail.
- Falta importar no n8n do PikaPods (sem chave do n8n nesta sessão):
  1. Abrir o n8n (encorpa-fashion.pikapod.net) → workflow **Encorpa — Portal: conversa não resolvida**.
  2. Menu "…" → **Import from File** → escolher `n8n/conversa-nao-resolvida.json` deste repositório (ou abrir o nó
     **Monta os e-mails** e colar o código novo dele).
  3. Salvar e conferir que continua **Active**. A credencial de e-mail é a mesma.
- Até lá: uma conversa de teste que caia em "não resolvida" manda o e-mail ao operador. Apagar a conversa de teste logo depois evita.

### 5. Merge do PR rodrigovaroto-wq/encorpa-portal#6 — operador

CI verde até o commit `f537576`; a prévia do Vercel está no ar. Ao fazer o merge, o Vercel publica em produção. Depois do merge,
confirmar em produção: Configurações abre e mostra o seu papel; Malu › Número do WhatsApp lê o número; Conversas sem erro.

### 6. PR rodrigovaroto-wq/Ricos-com-AI#81 (id da imagem) — operador

- Merge feito em 23/10 (CI verde no commit `e0fd44a`, com `pnpm typecheck:function` em Deno). Falta só o deploy do item 3. O `HANDOFF.md` do Ricos-com-AI não foi atualizado por esta sessão: registrar lá a mudança da função `whatsapp` no merge.

## Ordem sugerida

1. `INBOUND_SIGNING_SECRET` no Supabase e no Vercel (item 1) e `WHATSAPP_WABA_ID` no Vercel (item 2).
2. Importar o workflow do n8n (item 4) antes de usar Malu › Teste com frequência.
3. Merge do portal (item 5) e teste de Malu › Teste em produção.
4. Deploy da `whatsapp` (item 3; o merge do Ricos-com-AI já foi feito), quando decidir sobre o congelamento da Malu.

## Próximos passos (depois dos pendentes)

- Várias empresas com dados separados (adiado: ver Decisões).
- Revisar os números de exemplo quando houver mais dados reais, para manter a simulação perto da operação.

## Decisões registradas

- Resolução da semana: mantida como está. As conversas de 24 a 72 h contam como abandonadas e, quando a régua termina sem compra,
  a Malu marca "perdido" (`turn/index.ts`, fim da régua) e elas viram "encerrou sem compra": a taxa se corrige sozinha.
- Várias empresas (dados separados por empresa) ficou fora: pede um banco e contas por empresa. Usuários e papéis já existem.
- Workflows do n8n de exemplo: nos dados de exemplo aparecem os workflows de verdade da última leitura guardada no navegador.
