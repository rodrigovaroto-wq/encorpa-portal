// Login do portal (HTTP Basic) para o site inteiro e para /api/data.
// Usuários na variável PORTAL_USERS do Vercel, no formato "email1:senha1:papel,email2:senha2" (papel opcional, lib/auth.mjs).
// Sem a variável, ninguém entra (falha fechada).
import { next } from "@vercel/functions";
import { whoIs } from "./lib/auth.mjs";
import { SUPABASE_URL, serviceKey } from "./lib/env.mjs";

export const config = { matcher: "/:path*" };

const deny = () => new Response("Login necessário", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Encorpa Portal de Dados", charset="UTF-8"', "Cache-Control": "no-store" } });

// Fora do login só o coletor de visitas do site (public/track.js e api/track.js, 04/11): o site da Encorpa não tem a senha do portal.
// Também fora: a página do convite e a função que cria a senha (quem foi convidado ainda não tem login).
export const PUBLIC = new Set(["/track.js", "/api/track", "/convite.html", "/api/invite"]);

export default async function middleware(request) {
  if (PUBLIC.has(new URL(request.url).pathname)) return next();
  return (await whoIs(request.headers.get("authorization"), { url: SUPABASE_URL, key: serviceKey() })) ? next() : deny();
}
