// Login do portal (HTTP Basic) para o site inteiro e para /api/data.
// Usuários na variável PORTAL_USERS do Vercel, no formato "email1:senha1:papel,email2:senha2" (papel opcional, lib/auth.mjs).
// Sem a variável, ninguém entra (falha fechada).
import { next } from "@vercel/functions";
import { userOf } from "./lib/auth.mjs";

export const config = { matcher: "/:path*" };

const deny = () => new Response("Login necessário", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Encorpa Portal de Dados", charset="UTF-8"', "Cache-Control": "no-store" } });

export default function middleware(request) {
  return userOf(request.headers.get("authorization"), process.env.PORTAL_USERS) ? next() : deny();
}
