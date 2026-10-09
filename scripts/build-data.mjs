// Gera data.js (cópia estática) a partir do Supabase. Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build-data.mjs
//   node scripts/build-data.mjs --fixture scripts/fixture.json   (teste sem rede)
import { readFile, writeFile } from "node:fs/promises";
import { buildAll } from "../lib/build.mjs";

const fixtureArg = process.argv.indexOf("--fixture");
const fixture = fixtureArg > 0 ? JSON.parse(await readFile(process.argv[fixtureArg + 1], "utf8")) : null;
const { data, D } = await buildAll({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, fixture });
await writeFile("data.js", "// Gerado por scripts/build-data.mjs. Não edite à mão.\nwindow.PORTAL_DATA = " + JSON.stringify(data) + ";\n");
console.log("data.js gerado:", Object.keys(data).length, "períodos;", D.leads.length, "leads;", D.orders.length, "pedidos");
