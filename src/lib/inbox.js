// Filtros da caixa de entrada (Painel e Conversas), a partir das conversas que a tela já tem.
// Esperando resposta: a última mensagem é dela, ou a Malu passou para o operador e ninguém respondeu depois; só com a janela de
// 24 h aberta (fora dela não dá para responder com texto livre) e sem opt-out.
// Tempo excedido: esperando há mais de SLA_MIN minutos. Com pessoa: a Malu está pausada na conversa e o operador responde.
export const SLA_MIN = 15;

export function waitingSince(c) {
  if (c.optedOut || !c.windowOpen) return null;
  const last = c.messages.at(-1);
  if (!last) return null;
  if (!last.out) return Date.parse(last.at);
  if (c.status !== "unresolved" || !c.flaggedAt) return null;
  const flagged = Date.parse(c.flaggedAt);
  return c.messages.some((m) => m.op && Date.parse(m.at) >= flagged) ? null : flagged;
}

export const INBOX = [
  ["unanswered", "Não respondidas", "esperando resposta, com a janela de 24 h aberta", (c) => waitingSince(c) != null],
  ["person", "Com pessoa", "a Malu está pausada e você responde", (c) => !!c.paused],
  ["overdue", "Tempo excedido", `esperando há mais de ${SLA_MIN} min`, (c, now) => { const w = waitingSince(c); return w != null && now - w > SLA_MIN * 60000; }],
];

export const inboxCounts = (chats, now = Date.now()) => Object.fromEntries(INBOX.map(([id, , , test]) => [id, (chats || []).filter((c) => test(c, now)).length]));
export const inboxTest = (id) => INBOX.find(([k]) => k === id)?.[3];
