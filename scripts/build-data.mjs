// Gera data.js (cópia estática) a partir do Supabase. Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build-data.mjs
//   (opcional) N8N_URL=... N8N_API_KEY=... para a aba Automações
//   node scripts/build-data.mjs --fixture scripts/fixture.json   (teste sem rede)
import { readFile, writeFile } from "node:fs/promises";
import { buildAll } from "../lib/build.mjs";

const fixtureArg = process.argv.indexOf("--fixture");
const fixture = fixtureArg > 0 ? JSON.parse(await readFile(process.argv[fixtureArg + 1], "utf8")) : null;
const { data, D } = await buildAll({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, n8nUrl: process.env.N8N_URL, n8nKey: process.env.N8N_API_KEY, metaToken: process.env.META_ACCESS_TOKEN, metaAccount: process.env.META_AD_ACCOUNT_ID, fixture });
// O retrato vai para o git, que guarda para sempre: sem conversas nem nomes de clientes.
data.global.chats = [];
if (data.global.hermes) data.global.hermes.proposals = data.global.hermes.proposals.map(({ evidence, diff, ...x }) => ({ ...x, evidence: null, diff: null }));
data.global.orders = data.global.orders.map(({ name, ...o }) => ({ ...o, name: null }));
await writeFile("public/data.js", "// Gerado por scripts/build-data.mjs (sem conversas, nomes de clientes nem evidências do Hermes). Não edite à mão.\nwindow.PORTAL_DATA = " + JSON.stringify(data) + ";\n");
console.log("public/data.js gerado:", Object.keys(data.periods).length, "períodos;", D.leads.length, "leads;", D.orders.length, "pedidos");
