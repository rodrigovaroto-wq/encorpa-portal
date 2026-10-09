# encorpa-portal

Portal de análise de dados e operação da Encorpa. Briefing: `docs/agente-ia/05-plano/11-portal-briefing.md`
no repositório `Ricos-com-AI`. HTML, CSS e JavaScript puros, sem build.

## Abrir

- Dois cliques em `index.html` (extraia o ZIP inteiro: a fonte está em `fonts/`).
- Botão **Ver exemplo** liga dados inventados (marcados na tela) para ver tudo funcionando.
- Com um servidor (`python3 -m http.server 8000`) o portal lê `data.json` automaticamente.

## O que já funciona

Períodos (dia a 12 meses), painel com 8 números e variação, piso de amostra, seis critérios de pausa
e decisão do dia 12 calculados sozinhos, e os setores: vídeos, fluxo de dinheiro, agente do WhatsApp,
anúncio e site, região e comparação. Atualiza sozinho a cada 1 h.

## Publicado no Vercel

- `api/data.js` lê o Supabase na hora e guarda a resposta 30 min no cache. A página busca em `/api/data` a cada 30 min e mostra o horário em "atualizado".
- `middleware.js` pede e-mail e senha (login do navegador) para o site todo e para `/api/data`.
- Variáveis do projeto no Vercel (Settings > Environment Variables):
  - `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`): a chave service_role. Só no servidor, nunca no navegador.
  - `SUPABASE_URL` (opcional; padrão: o projeto da Encorpa).
  - `PORTAL_USERS`: quem pode entrar, no formato `email1:senha1,email2:senha2`. **Sem ela ninguém entra.**
- `lib/build.mjs` tem a conta das métricas (usada pela função e por `scripts/build-data.mjs`). Só lê views agregadas e datas: nunca nome, telefone, endereço, CPF ou conversa.
- `data.js` é uma cópia de segurança (retrato de 09/10). Se `/api/data` falhar, o portal mostra esse retrato.

## Arquivo local

Abrindo `index.html` direto no computador, o portal mostra o retrato de `data.js`.

## Ligar dados reais (servidor)

Publique um `data.json` na mesma pasta. Um objeto por período (`day`, `week`, `month`, `3m`, `6m`, `9m`, `12m`):

```json
{ "week": {
  "updated": "2026-10-09T19:00:00Z",
  "metrics": { "leads": { "value": 120, "previous": 100, "series": [10, 12, 15] } },
  "totals": { "leads": 320, "orders": 31 },
  "api_over_pct": 3.8,
  "channel": { "number": "Saudável", "cloud_api": "Operando", "window": "72 h ativa", "templates": "3 aprovados" }
} }
```

Os ids das métricas estão em `app.js` (`GROUPS`). Campos opcionais: `pause`, `videos`, `segments`,
`money`, `funnel`, `versions`, `gates`. A chave do Supabase nunca vai no navegador: quem gera o
`data.json` é um job no servidor (n8n ou função), lendo só as views `eval_*`.
