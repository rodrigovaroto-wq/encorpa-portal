# encorpa-portal

Portal de análise de dados e otimização operacional da Encorpa. Briefing:
`docs/agente-ia/05-plano/11-portal-briefing.md` no repositório `Ricos-com-AI`.

Estado: só a estrutura (períodos, métricas, comparação, "Quando pausar"), sem dados.
Para ligar dados, implemente `loadData()` em `app.js`. A chave do Supabase fica no servidor, nunca no navegador.

Rodar: `python3 -m http.server 8000` e abrir http://localhost:8000
