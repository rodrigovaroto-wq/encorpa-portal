// Login do portal (HTTP Basic) para o site inteiro e para /api/data.
// Usuários na variável PORTAL_USERS do Vercel, no formato "email1:senha1,email2:senha2".
// Sem a variável, ninguém entra (falha fechada).
import { next } from "@vercel/functions";

export const config = { matcher: "/:path*" };

const deny = () => new Response("Login necessário", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Encorpa Portal de Dados", charset="UTF-8"', "Cache-Control": "no-store" } });

export default function middleware(request) {
  const users = (process.env.PORTAL_USERS || "").split(",").map((u) => u.trim()).filter(Boolean);
  const header = request.headers.get("authorization") || "";
  if (!users.length || !header.startsWith("Basic ")) return deny();
  let given;
  try { given = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0))); } catch { return deny(); }
  return users.includes(given) ? next() : deny();
}
