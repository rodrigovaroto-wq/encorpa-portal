// Casca do portal: fundo em ondas, menu lateral, topo, busca e a página da rota (#/pagina/sub-aba).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Background } from "./components/Background.jsx";
import { Palette } from "./components/Palette.jsx";
import { MobileNav, Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { demoData, loadData } from "./lib/data.js";
import { useLiveChats, withLive } from "./lib/live.js";
import { store } from "./lib/format.js";
import { parseRoute } from "./lib/nav.js";
import { Ads } from "./pages/Ads.jsx";
import { Automations } from "./pages/Automations.jsx";
import { Chat } from "./pages/Chat.jsx";
import { Customers } from "./pages/Customers.jsx";
import { Finance } from "./pages/Finance.jsx";
import { Home } from "./pages/Home.jsx";
import { Integrations } from "./pages/Integrations.jsx";
import { Leads } from "./pages/Leads.jsx";
import { Malu } from "./pages/Malu.jsx";
import { Notes } from "./pages/Notes.jsx";
import { Orders } from "./pages/Orders.jsx";

const VIEWS = { home: Home, chat: Chat, orders: Orders, malu: Malu, ads: Ads, customers: Customers, leads: Leads, money: Finance, auto: Automations, integrations: Integrations, notes: Notes };
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

  // Uma carga que cai no retrato do navegador (sem conversas) mantém as conversas da última carga ao vivo: antes, uma falha
  // de rede esvaziava a tela Conversas e a conversa aberta "sumia" no meio do atendimento.
  const refresh = useCallback(async () => {
    const next = demo ? demoData() : (await loadData()) || false;
    setData((prev) => (next && next.source !== "live" && !next.demo && !prev?.demo && prev?.global?.chats?.length ? { ...next, global: { ...next.global, chats: prev.global.chats } } : next));
  }, [demo]);
  // Com a aba escondida não busca; ao voltar, busca se o último retrato passou de 5 min.
  useEffect(() => {
    let at = 0;
    const run = () => { at = Date.now(); refresh(); };
    const tick = () => { if (document.visibilityState === "visible" && Date.now() - at >= REFRESH - 1000) run(); };
    run();
    const t = setInterval(tick, REFRESH);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);
  useEffect(() => { const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo(0, 0); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((x) => !x); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { document.documentElement.dataset.theme = prefs.theme; document.documentElement.dataset.motion = prefs.motion; }, [prefs]);

  const [live, reloadChats] = useLiveChats(!demo && location.protocol !== "file:", route.page.id === "chat" ? 15_000 : 60_000);
  const shown = useMemo(() => withLive(data, live), [data, live]);

  const View = VIEWS[route.page.id] || Home;
  return (
    <>
      <Background />
      <div className={`shell ${collapsed ? "side-collapsed" : ""}`}>
        <Sidebar route={route} collapsed={collapsed} onToggle={() => { setCollapsed(!collapsed); store.set("side", collapsed ? "0" : "1"); }} data={shown} period={period} />
        <main className="main">
          <Topbar route={route} period={period} setPeriod={setPeriod} data={shown} onSearch={() => setPalette(true)} prefs={prefs} setPrefs={setPrefs} demo={demo} setDemo={setDemo} />
          {shown ? <View key={route.page.id} data={shown} period={period} route={route} live={live} reloadChats={reloadChats} tabs={route.page.subs?.map(([k, l]) => [k, l])} /> : data === false ? <div className="loading">Não consegui carregar os dados agora. O portal tenta de novo em 5 minutos.</div> : <div className="loading"><span className="spinner" /> Carregando os dados…</div>}
        </main>
      </div>
      <MobileNav route={route} data={shown} period={period} />
      <Palette open={palette} onClose={() => setPalette(false)} data={shown} period={period} />
    </>
  );
}
