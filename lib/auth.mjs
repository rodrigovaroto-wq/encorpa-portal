// Usuários e papéis do portal (23/10), na variável PORTAL_USERS do Vercel: "email:senha:papel", separados por vírgula.
// O papel é opcional e fica no fim; sem ele a pessoa é admin (quem já estava na lista continua com tudo).
//   admin     vê tudo, responde, testa a Malu e vê a lista de usuários em Configurações
//   operador  vê tudo, responde às clientes, pausa e devolve a Malu e usa Malu › Teste
//   leitura   só vê: sem responder, sem pausar a Malu e sem Malu › Teste
// Usado pelo login (middleware.js) e pelas funções que escrevem (api/chat.js, api/test.js). Sem dependência: roda no middleware.
export const ROLES = ["admin", "operador", "leitura"];
export const ROLE_LABEL = { admin: "Administrador", operador: "Operador", leitura: "Só leitura" };

export function parseUsers(raw = "") {
  return String(raw).split(",").map((u) => u.trim()).filter(Boolean).map((u) => {
    const parts = u.split(":"), last = parts.at(-1);
    const role = parts.length > 2 && ROLES.includes(last) ? last : "admin";
    const cred = role === last && parts.length > 2 ? parts.slice(0, -1).join(":") : u;
    return { email: cred.split(":")[0], cred, role };
  });
}

// Quem fez o pedido, pelo cabeçalho do login do navegador (Basic). null se não bate com ninguém da lista.
export function userOf(authorization, raw = process.env.PORTAL_USERS) {
  const header = String(authorization || "");
  if (!header.startsWith("Basic ")) return null;
  let given;
  try { given = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0))); } catch { return null; }
  const u = parseUsers(raw).find((x) => x.cred === given);
  return u ? { email: u.email, role: u.role } : null;
}

export const canWrite = (role) => role === "admin" || role === "operador";
