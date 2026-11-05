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

// Login de quem foi convidado pelo portal (04/11): e-mail e senha em portal_users (migração 0034 do Ricos-com-AI), com a senha só em
// hash PBKDF2-SHA256 (210 mil voltas, sal de 16 bytes). Quem está em PORTAL_USERS entra primeiro e vence o banco. Sem dependência:
// Web Crypto, que roda no middleware (Edge) e nas funções (Node).
const ITER = 210_000, enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8)), unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password, salt, iter) {
  const k = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, k, 256));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt, ITER))}`;
}
export async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored || "").split("$");
  if (kind !== "pbkdf2" || !(+iter > 0) || !salt || !hash) return false;
  const a = await pbkdf2(password, unb64(salt), +iter), b = unb64(hash);
  return a.length === b.length && a.reduce((x, v, i) => x | (v ^ b[i]), 0) === 0; // comparação em tempo constante
}
export const sha256Hex = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

// Quem fez o pedido: PORTAL_USERS ou, se não estiver lá, um login do banco. Um acerto fica 60 s na memória (o middleware roda em toda
// requisição, inclusive de arquivo); um erro nunca fica guardado.
const seen = new Map();
export async function whoIs(authorization, { raw = process.env.PORTAL_USERS, url, key, fetchImpl = fetch } = {}) {
  const env = userOf(authorization, raw);
  if (env) return env;
  const header = String(authorization || "");
  if (!header.startsWith("Basic ") || !url || !key) return null;
  const hit = seen.get(header);
  if (hit && Date.now() - hit.at < 60_000) return hit.user;
  let given;
  try { given = new TextDecoder().decode(unb64(header.slice(6))); } catch { return null; }
  const i = given.indexOf(":"), email = given.slice(0, i).trim().toLowerCase(), password = given.slice(i + 1);
  if (i < 1 || !password || !/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const r = await fetchImpl(`${url}/rest/v1/portal_users?email=eq.${encodeURIComponent(email)}&select=email,role,password_hash`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => null);
  const row = r?.ok ? (await r.json())[0] : null;
  if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) return null;
  const user = { email: row.email, role: ROLES.includes(row.role) ? row.role : "leitura" };
  if (seen.size > 200) seen.clear();
  seen.set(header, { at: Date.now(), user });
  return user;
}
