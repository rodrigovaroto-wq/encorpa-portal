// Login do portal (HTTP Basic) para o site inteiro e para /api/data.
// Usuários na variável PORTAL_USERS do Vercel, no formato "email1:senha1:papel,email2:senha2" (papel opcional, lib/auth.mjs).
// Sem a variável, ninguém entra (falha fechada).
import { next } from "@vercel/functions";
import { userOf } from "./lib/auth.mjs";

export const config = { matcher: "/:path*" };

const deny = () => new Response("Login necessário", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Encorpa Portal de Dados", charset="UTF-8"', "Cache-Control": "no-store" } });

// Fora do login só o coletor de visitas do site (public/track.js e api/track.js, 04/11): o site da Encorpa não tem a senha do portal.
export const PUBLIC = new Set(["/track.js", "/api/track"]);

export default function middleware(request) {
  if (PUBLIC.has(new URL(request.url).pathname)) return next();
  return userOf(request.headers.get("authorization"), process.env.PORTAL_USERS) ? next() : deny();
}
