// Integrações (o "Connected Ecosystem" do Glassy CRM, só leitura): cada fonte que o portal lê e se respondeu na última leitura.
import { ago } from "../lib/format.js";
import { Chip, Note, PageHead } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";

const SOURCES = [
  ["supabase", "Supabase", "Leads, conversas, pedidos e métricas da Malu", "plug"],
  ["meta", "Meta Ads", "Campanhas, conjuntos, anúncios e métricas diárias", "ads"],
  ["n8n", "n8n", "Workflows e execuções", "flow"],
  ["whatsapp", "WhatsApp (Malu respondendo)", "Última mensagem que a Malu mandou", "chat"],
  ["malu", "Versão da Malu", "Versão do agente no ar", "agent"],
  ["hermes", "Hermes", "Supervisor offline: última rodada", "bolt"],
];

export function Integrations({ data }) {
  const h = data.global.health || {};
  const ok = SOURCES.filter(([k]) => h[k]?.ok === true).length;
  return (
    <div className="page">
      <PageHead crumb="Sistema" title="Integrações" desc="Cada fonte que o portal lê, se está respondendo e o que trouxe na última leitura." right={<span className="glass pill">{ok} de {SOURCES.length} respondendo</span>} />
      <div className="wf-grid">
        {SOURCES.map(([k, name, what, icon]) => {
          const s = h[k] || { ok: null, detail: "sem leitura" };
          const detail = String(s.detail).replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/, (iso) => ago(iso));
          return (
            <article key={k} className="glass wf-card">
              <div className="wf-head"><span className="round icon-badge"><Icon name={icon} /></span><Chip tone={s.ok === true ? "ok" : s.ok === false ? "bad" : ""}>{s.ok === true ? "Respondendo" : s.ok === false ? "Com erro" : "Não configurado"}</Chip></div>
              <h3>{name}</h3><p className="sub">{what}</p><p className="detail">{detail}</p>
            </article>
          );
        })}
      </div>
      <Note>Só leitura: o portal não conecta nem desconecta nada. Saldo da Logzz e do Mercado Pago não aparece porque as duas não têm API de saldo.</Note>
    </div>
  );
}
