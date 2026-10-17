// Casca do portal: fundo em ondas, menu lateral, topo, busca e a página da rota (#/pagina/sub-aba).
import { useCallback, useEffect, useState } from "react";
import { Background } from "./components/Background.jsx";
import { Palette } from "./components/Palette.jsx";
import { MobileNav, Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { demoData, loadData } from "./lib/data.js";
import { store } from "./lib/format.js";
import { parseRoute } from "./lib/nav.js";
import { Ads } from "./pages/Ads.jsx";
import { Automations } from "./pages/Automations.jsx";
import { Chat } from "./pages/Chat.jsx";
import { Customers } from "./pages/Customers.jsx";
import { Finance } from "./pages/Finance.jsx";
import { Home } from "./pages/Home.jsx";
import { Integrations } from "./pages/Integrations.jsx";
import { Malu } from "./pages/Malu.jsx";
import { Notes } from "./pages/Notes.jsx";
import { Orders } from "./pages/Orders.jsx";

const VIEWS = { home: Home, chat: Chat, orders: Orders, malu: Malu, ads: Ads, customers: Customers, money: Finance, auto: Automations, integrations: Integrations, notes: Notes };
const REFRESH = 5 * 60 * 1000; // o servidor guarda a resposta 5 min

export function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [period, setPeriodState] = useState(() => store.get("period") || "week");
  const [demo, setDemoState] = useState(() => store.get("demo") === "1");
  const [prefs, setPrefsState] = useState(() => { try { return { theme: "dark", motion: "on", ...JSON.parse(store.get("prefs") || "{}") }; } catch { return { theme: "dark", motion: "on" }; } });
  const [collapsed, setCollapsed] = useState(() => store.get("side") === "1");
  const [palette, setPalette] = useState(false);
  const [data, setData] = useState(null);

  const setPeriod = (p) => { setPeriodState(p); store.set("period", p); };
  const setDemo = (d) => { setDemoState(d); store.set("demo", d ? "1" : "0"); };
  const setPrefs = (p) => { setPrefsState(p); store.set("prefs", JSON.stringify(p)); };

  const refresh = useCallback(async () => setData(demo ? demoData() : (await loadData()) || false), [demo]);
  useEffect(() => { refresh(); const t = setInterval(refresh, REFRESH); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo(0, 0); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((x) => !x); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { document.documentElement.dataset.theme = prefs.theme; document.documentElement.dataset.motion = prefs.motion; }, [prefs]);

  const View = VIEWS[route.page.id] || Home;
  return (
    <>
      <Background />
      <div className={`shell ${collapsed ? "side-collapsed" : ""}`}>
        <Sidebar route={route} collapsed={collapsed} onToggle={() => { setCollapsed(!collapsed); store.set("side", collapsed ? "0" : "1"); }} data={data} period={period} />
        <main className="main">
          <Topbar route={route} period={period} setPeriod={setPeriod} data={data} onSearch={() => setPalette(true)} prefs={prefs} setPrefs={setPrefs} demo={demo} setDemo={setDemo} />
          {data ? <View key={route.page.id} data={data} period={period} route={route} tabs={route.page.subs?.map(([k, l]) => [k, l])} /> : data === false ? <div className="loading">Não consegui carregar os dados agora. O portal tenta de novo em 5 minutos.</div> : <div className="loading"><span className="spinner" /> Carregando os dados…</div>}
        </main>
      </div>
      <MobileNav route={route} data={data} period={period} />
      <Palette open={palette} onClose={() => setPalette(false)} data={data} period={period} />
    </>
  );
}
