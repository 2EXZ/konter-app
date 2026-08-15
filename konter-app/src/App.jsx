import { supabase } from "./lib/supabase";
import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Smartphone, Wallet, BarChart3,
  Users, LogOut, Plus, Minus, Trash2, Search, AlertTriangle, TrendingUp,
  TrendingDown, Printer, Send, X, Pencil, CheckCircle2, Wifi, WifiOff,
  Zap, Droplets, ShieldCheck, CreditCard, ArrowDownCircle, ArrowUpCircle,
  Download, ChevronRight, Store
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const THEME = {
  ink: "#0A1020",
  navy: "#0B1220",
  navySoft: "#111C31",
  navyLight: "#1A2B49",
  blue: "#4F7CFF",
  blue2: "#6C5CE7",
  cyan: "#22D3EE",
  mint: "#2DD4BF",
  text: "#111827",
  muted: "#728096",
  border: "#E6EAF0",
  surface: "#FFFFFF",
  canvas: "#F3F5F9",
};

// ---------- helpers ----------
const rupiah = (n) =>
  "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const STORE = {
  name: import.meta.env.VITE_STORE_NAME || "Dhell Cell",
  phone: import.meta.env.VITE_STORE_PHONE || "",
  address: import.meta.env.VITE_STORE_ADDRESS || "",
};

const isBrowserOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const localDateKey = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
const todayStr = () => localDateKey(new Date());
const formatDate = (value) => new Date(value).toLocaleDateString("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const formatTime = (value) => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const formatDateTime = (value) => `${formatDate(value)} • ${formatTime(value)}`;
const nowTime = () => formatDateTime(new Date());
const paymentLabel = (method) => ({
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
}[method] || method || "-");

const CATEGORY_LABEL = {
  aksesoris: "Aksesoris",
  perdana: "Kartu Perdana",
  pulsa: "Pulsa & Paket Data",
  hp: "Handphone / Unit",
};

const useIsMobile = (breakpoint = 860) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
};

const useOnlineStatus = () => {
  const [online, setOnline] = useState(() => isBrowserOnline());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
};

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "cashier"] },
  { key: "kasir", label: "Kasir", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { key: "produk", label: "Produk & Stok", icon: Package, roles: ["owner", "cashier"] },
  { key: "ppob", label: "PPOB", icon: Smartphone, roles: ["owner", "cashier"] },
  { key: "keuangan", label: "Keuangan", icon: Wallet, roles: ["owner"] },
  { key: "laporan", label: "Laporan", icon: BarChart3, roles: ["owner"] },
  { key: "pengguna", label: "Pengguna", icon: Users, roles: ["owner"] },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const isMobile = useIsMobile();
  const isOnline = useOnlineStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = `${STORE.name} POS`;
  }, []);

  // ===== SUPABASE AUTH SESSION =====
  useEffect(() => {
    const loadProfile = async (userId, email) => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("id", userId)
        .single();

      if (error || !profile) {
        console.error("Profil pengguna tidak tersedia:", error);
        setCurrentUser(null);
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      if (profile.is_active === false) {
        setCurrentUser(null);
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      setCurrentUser({
        id: profile.id,
        email: profile.email || email,
        name: profile.full_name,
        role: profile.role,
        isActive: true,
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id, session.user.email);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setCurrentUser(null); return; }
      loadProfile(session.user.id, session.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep the signed-in user's name/role synchronized when an owner updates
  // the profile from another device. This also makes role changes take effect
  // without requiring logout/login.
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`profile-self-${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${currentUser.id}` },
        async (payload) => {
          if (payload.new.is_active === false) {
            setCurrentUser(null);
            await supabase.auth.signOut({ scope: "local" });
            return;
          }

          setCurrentUser((prev) => prev ? {
            ...prev,
            name: payload.new.full_name ?? prev.name,
            role: payload.new.role ?? prev.role,
            email: payload.new.email ?? prev.email,
            isActive: payload.new.is_active ?? prev.isActive,
          } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Never leave an account on an owner-only page after its role changes.
  useEffect(() => {
    if (!currentUser) return;
    const allowed = NAV.some((item) => item.key === page && item.roles.includes(currentUser.role));
    if (!allowed) setPage("dashboard");
  }, [currentUser?.role, page]);


  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.canvas, fontFamily: "Inter, ui-sans-serif, sans-serif", color: THEME.text }}>
        Memuat aplikasi…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <style>{globalCss}</style>
        <LoginScreen storeName={STORE.name} />
      </>
    );
  }

  const visibleNav = NAV.filter((n) => n.roles.includes(currentUser.role));
  const operationalNav = visibleNav.filter((n) => ["dashboard", "kasir", "produk", "ppob"].includes(n.key));
  const managementNav = visibleNav.filter((n) => ["keuangan", "laporan", "pengguna"].includes(n.key));
  const activeNav = NAV.find((n) => n.key === page);

  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const active = page === item.key;
    return (
      <button
        key={item.key}
        className={active ? "side-nav-item active" : "side-nav-item"}
        onClick={() => { setPage(item.key); setDrawerOpen(false); }}
      >
        <span className="side-nav-icon"><Icon size={18} /></span>
        <span className="side-nav-label">{item.label}</span>
        {active && <span className="side-nav-dot" />}
      </button>
    );
  };

  const NavContent = () => (
    <>
      <div className="brand-block">
        <div className="brand-mark"><Store size={20} /></div>
        <div className="brand-copy">
          <div className="brand-name">{STORE.name}</div>
          <div className="brand-sub">Sistem Kasir</div>
        </div>
        {isMobile && <button className="icon-ghost-dark" onClick={() => setDrawerOpen(false)}><X size={17} /></button>}
      </div>

      <div className={isOnline ? "sidebar-status" : "sidebar-status offline"}>
        {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
        <div>
          <b>{isOnline ? "Online" : "Offline"}</b>
          <small>{isOnline ? "Cloud & realtime aktif" : "Transaksi dihentikan"}</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">OPERASIONAL</div>
        {operationalNav.map((item) => <NavButton key={item.key} item={item} />)}
        {managementNav.length > 0 && <>
          <div className="nav-section-label nav-section-gap">MANAJEMEN</div>
          {managementNav.map((item) => <NavButton key={item.key} item={item} />)}
        </>}
      </nav>

      <div className="sidebar-profile">
        <div className="avatar-circle">{(currentUser.name || "U").trim().slice(0,1).toUpperCase()}</div>
        <div className="profile-copy">
          <b>{currentUser.name}</b>
          <span>{currentUser.role === "owner" ? "Pemilik" : "Karyawan"}</span>
        </div>
        <button className="icon-ghost-dark" title="Keluar" onClick={() => supabase.auth.signOut({ scope: "local" })}><LogOut size={16} /></button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <style>{globalCss}</style>

      {isMobile && (
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Buka menu">
            <span /><span /><span />
          </button>
          <div className="mobile-brand"><div className="brand-mark small"><Store size={16} /></div><b>{STORE.name}</b></div>
          <div className="mobile-avatar">{(currentUser.name || "U").trim().slice(0,1).toUpperCase()}</div>
        </header>
      )}

      {isMobile ? (
        <>
          {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
          <aside className={drawerOpen ? "sidebar mobile open" : "sidebar mobile"}><NavContent /></aside>
        </>
      ) : (
        <aside className="sidebar"><NavContent /></aside>
      )}

      <section className="workspace">
        {!isMobile && (
          <header className="workspace-topbar">
            <div className="workspace-heading">
              <span className="workspace-kicker">DHELL CELL / {currentUser.role === "owner" ? "PEMILIK" : "KARYAWAN"}</span>
              <b>{activeNav?.label || "Dashboard"}</b>
            </div>
            <div className="workspace-right">
              <div className={isOnline ? "live-pill" : "live-pill offline"}>
                {isOnline ? <Wifi size={13}/> : <WifiOff size={13}/>}
                {isOnline ? "Online" : "Offline"}
              </div>
              <div className="date-pill">
                {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })}
              </div>
              <div className="user-pill" title={`${currentUser.name} • ${currentUser.role === "owner" ? "Pemilik" : "Karyawan"}`}>
                <div className="avatar-circle mini">{(currentUser.name || "U").trim().slice(0,1).toUpperCase()}</div>
                <b>{currentUser.name}</b>
              </div>
            </div>
          </header>
        )}

        <main className="workspace-content">
          {!isOnline && (
            <div className="offline-banner">
              <WifiOff size={16}/>
              <div>
                <b>Tidak ada koneksi internet.</b>
                <span>Jangan lanjutkan transaksi sampai status kembali Online.</span>
              </div>
            </div>
          )}
          {page === "dashboard" && <Dashboard setPage={setPage} isMobile={isMobile} showToast={showToast} currentUser={currentUser} />}
          {page === "kasir" && <Kasir showToast={showToast} currentUser={currentUser} storeInfo={STORE} isMobile={isMobile} />}
          {page === "produk" && <Produk role={currentUser.role} showToast={showToast} isMobile={isMobile} />}
          {page === "ppob" && <Ppob showToast={showToast} currentUser={currentUser} isMobile={isMobile} />}
          {page === "keuangan" && <Keuangan showToast={showToast} isMobile={isMobile} currentUser={currentUser} />}
          {page === "laporan" && <Laporan isMobile={isMobile} showToast={showToast} currentUser={currentUser} />}
          {page === "pengguna" && <Pengguna currentUser={currentUser} showToast={showToast} isMobile={isMobile} />}
        </main>
      </section>

      {isMobile && (
        <nav className="mobile-bottom-nav">
          {operationalNav.map((n) => {
            const Icon = n.icon;
            const active = page === n.key;
            return <button key={n.key} className={active ? "active" : ""} onClick={() => setPage(n.key)}><Icon size={19}/><span>{n.label === "Produk & Stok" ? "Produk" : n.label}</span></button>;
          })}
          {managementNav.length > 0 && <button onClick={() => setDrawerOpen(true)}><Users size={19}/><span>Lainnya</span></button>}
        </nav>
      )}

      {toast && (
        <div className={toast.type === "warn" ? "toast-ui warn" : "toast-ui"}>
          <CheckCircle2 size={17} /> <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

const globalCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; background: #F3F5F9; }
  body { -webkit-tap-highlight-color: transparent; }
  button, input, select { font-family: inherit; }
  button { transition: .16s ease; }
  button:not(:disabled):active { transform: scale(.985); }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid rgba(79,124,255,.16); outline-offset: 1px; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #CAD2DF; border-radius: 999px; }
  table { border-collapse: separate; border-spacing: 0; width: 100%; font-variant-numeric: tabular-nums; }
  table thead th { background: #F8FAFC; border-bottom: 1px solid #E9EDF3; text-align: left; white-space: nowrap; }
  table tbody td { border-bottom: 1px solid #EEF1F5; text-align: left; line-height: 1.4; }
  table tbody tr:hover td { background: #FBFCFE; }
  table th:first-child, table td:first-child { padding-left:14px; }
  table th:last-child, table td:last-child { padding-right:14px; }
  table th.num, table td.num { text-align: right; white-space: nowrap; }
  table th.center, table td.center { text-align: center; white-space: nowrap; }
  table th.actions, table td.actions { text-align: right; white-space: nowrap; width: 1%; }

  .app-shell { min-height: 100vh; display: flex; background: #F3F5F9; color: #111827; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .sidebar { width: 230px; height: 100vh; position: sticky; top: 0; flex-shrink: 0; display: flex; flex-direction: column; color: #D7DFEC; background: linear-gradient(180deg,#09111F 0%,#0C1628 62%,#0A1425 100%); border-right: 1px solid rgba(255,255,255,.055); }
  .brand-block { min-height: 84px; display: flex; align-items: center; gap: 11px; padding: 18px 16px; }
  .brand-mark { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; color: #fff; background: linear-gradient(145deg,#527CFF,#6C5CE7); box-shadow: 0 12px 30px rgba(79,124,255,.28); }
  .brand-mark.small { width: 30px; height: 30px; border-radius: 10px; }
  .brand-copy { min-width: 0; }
  .brand-name { font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brand-sub { margin-top: 3px; font-size: 10.5px; letter-spacing: .11em; color: #71829C; text-transform: uppercase; }
  .sidebar-status { margin: 2px 12px 14px; padding: 10px 11px; border-radius: 12px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.055); display: flex; align-items: center; gap: 9px; }
  .sidebar-status div { display:flex; flex-direction:column; gap:2px; }
  .sidebar-status b { font-size: 11.5px; color: #E8EEF8; }
  .sidebar-status small { font-size: 10.5px; color: #7386A4; }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #2DD4BF; box-shadow: 0 0 0 4px rgba(45,212,191,.10), 0 0 18px rgba(45,212,191,.55); flex-shrink: 0; }
  .sidebar-nav { flex: 1; padding: 0 10px 12px; overflow-y:auto; }
  .nav-section-label { padding: 8px 9px 7px; font-size: 9.5px; font-weight: 800; letter-spacing: .14em; color: #566A88; }
  .nav-section-gap { margin-top: 12px; }
  .side-nav-item { position: relative; width: 100%; height: 43px; padding: 0 11px; margin: 2px 0; border: 1px solid transparent; border-radius: 11px; background: transparent; color: #91A0B7; display: flex; align-items: center; gap: 10px; cursor:pointer; text-align:left; }
  .side-nav-item:hover { background: rgba(255,255,255,.04); color: #DDE6F4; }
  .side-nav-item.active { color:#fff; background: linear-gradient(90deg,rgba(79,124,255,.22),rgba(79,124,255,.07)); border-color: rgba(100,139,255,.19); }
  .side-nav-icon { width: 27px; height: 27px; display:grid; place-items:center; border-radius:9px; }
  .side-nav-item.active .side-nav-icon { background: #4F7CFF; box-shadow:0 8px 18px rgba(79,124,255,.24); }
  .side-nav-label { font-size: 12.8px; font-weight: 610; }
  .side-nav-dot { margin-left:auto; width:5px; height:5px; border-radius:50%; background:#7EA0FF; }
  .sidebar-profile { min-height: 72px; padding: 12px; border-top:1px solid rgba(255,255,255,.055); display:flex; align-items:center; gap:9px; }
  .avatar-circle { width:34px; height:34px; border-radius:11px; display:grid; place-items:center; color:#fff; background:linear-gradient(145deg,#1D2F4C,#2A4672); border:1px solid rgba(255,255,255,.08); font-size:12px; font-weight:800; flex-shrink:0; }
  .avatar-circle.mini { width:30px; height:30px; border-radius:10px; background:linear-gradient(145deg,#4F7CFF,#6C5CE7); }
  .profile-copy { min-width:0; flex:1; display:flex; flex-direction:column; }
  .profile-copy b { color:#F7FAFF; font-size:11.8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .profile-copy span { font-size:10.5px; color:#7487A4; margin-top:2px; }
  .icon-ghost-dark { width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.025); color:#8FA1BA; display:grid; place-items:center; cursor:pointer; }
  .icon-ghost-dark:hover { color:#fff; background:rgba(255,255,255,.07); }

  .workspace { min-width:0; flex:1; display:flex; flex-direction:column; }
  .workspace-topbar { height:72px; padding:0 28px; background:rgba(255,255,255,.82); backdrop-filter:blur(16px); border-bottom:1px solid #E8EBF0; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:80; }
  .workspace-heading { display:flex; flex-direction:column; gap:3px; }
  .workspace-kicker { font-size:9.5px; font-weight:800; letter-spacing:.13em; color:#9AA6B7; }
  .workspace-heading b { font-size:16px; color:#111827; }
  .workspace-right { display:flex; align-items:center; gap:8px; }
  .live-pill,.date-pill { height:36px; padding:0 11px; border-radius:11px; background:#fff; border:1px solid #E5E9F0; display:flex; align-items:center; gap:7px; font-size:11px; font-weight:600; color:#667085; white-space:nowrap; }
  .user-pill { height:36px; max-width:190px; padding:3px 11px 3px 4px; border-radius:11px; background:#fff; border:1px solid #E5E9F0; color:#111827; display:flex; align-items:center; gap:8px; box-shadow:0 1px 2px rgba(16,24,40,.03); }
  .user-pill .avatar-circle.mini { width:28px; height:28px; min-width:28px; border-radius:8px; }
  .user-pill b { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:700; }
  .workspace-content { width:100%; max-width:1440px; margin:0 auto; padding:24px 28px 64px; }

  .mobile-header { height:58px; padding:0 13px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; color:#fff; background:rgba(10,16,32,.96); backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,.06); }
  .mobile-menu-btn { width:34px; height:34px; border:none; background:rgba(255,255,255,.055); border-radius:10px; display:flex; flex-direction:column; justify-content:center; gap:4px; padding:0 9px; }
  .mobile-menu-btn span { height:1.5px; width:100%; background:#fff; border-radius:2px; }
  .mobile-brand { display:flex; align-items:center; gap:8px; font-size:13px; }
  .mobile-avatar { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; font-size:11px; font-weight:800; background:linear-gradient(145deg,#4F7CFF,#6C5CE7); }
  .drawer-backdrop { position:fixed; inset:0; background:rgba(4,9,18,.56); backdrop-filter:blur(4px); z-index:140; }
  .sidebar.mobile { position:fixed; top:0; left:0; z-index:150; transform:translateX(-105%); transition:transform .22s ease; width:min(245px,84vw); }
  .sidebar.mobile.open { transform:translateX(0); }
  .mobile-bottom-nav { display:none; }

  .page-title-row { margin-bottom:18px; }
  .page-title-row h1 { letter-spacing:-.025em; }
  .ui-card { background:#fff; border:1px solid #E6EAF0; border-radius:15px; box-shadow:0 3px 12px rgba(16,24,40,.035); }
  .ui-card:hover { box-shadow:0 8px 24px rgba(16,24,40,.055); }
  .ui-btn-primary { background:#111827 !important; color:#fff !important; box-shadow:none !important; }
  .ui-btn-primary:hover:not(:disabled) { background:#1E293B !important; transform:translateY(-1px); }
  .ui-btn-outline:hover:not(:disabled) { background:#F8FAFC !important; }
  .ui-field { background:#fff !important; }
  .ui-field:focus { border-color:#4F7CFF !important; box-shadow:0 0 0 3px rgba(79,124,255,.10); outline:none; }

  .login-shell-v2 {
    min-height:100vh;
    display:grid;
    grid-template-columns:minmax(0,1.08fr) minmax(430px,.92fr);
    background:#F3F5F9;
    color:#111827;
    font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  .login-visual-v2 {
    position:relative;
    overflow:hidden;
    min-height:100vh;
    padding:44px 50px;
    display:flex;
    flex-direction:column;
    color:#fff;
    background:
      radial-gradient(circle at 18% 12%,rgba(79,124,255,.26),transparent 29%),
      radial-gradient(circle at 88% 76%,rgba(34,211,238,.13),transparent 24%),
      linear-gradient(145deg,#08111F 0%,#0B1729 50%,#123154 100%);
  }
  .login-visual-v2:after {
    content:"";
    position:absolute;
    width:390px;
    height:390px;
    right:-210px;
    bottom:-175px;
    border:1px solid rgba(255,255,255,.08);
    border-radius:50%;
    box-shadow:
      0 0 0 62px rgba(255,255,255,.016),
      0 0 0 124px rgba(255,255,255,.010);
  }
  .login-grid-art {
    position:absolute;
    inset:0;
    opacity:.18;
    pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
    background-size:44px 44px;
    mask-image:linear-gradient(to bottom,#000 0%,rgba(0,0,0,.72) 65%,transparent 100%);
  }
  .login-brand-v2 {
    position:relative;
    z-index:2;
    display:flex;
    align-items:center;
    gap:11px;
  }
  .login-brand-v2 .brand-mark {
    width:42px;
    height:42px;
    border-radius:13px;
  }
  .login-brand-copy b {
    display:block;
    font-size:15px;
    letter-spacing:-.01em;
  }
  .login-brand-copy span {
    display:block;
    margin-top:3px;
    color:#7890B2;
    font-size:9.5px;
    font-weight:750;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .login-hero-copy {
    position:relative;
    z-index:2;
    width:min(590px,100%);
    margin:auto 0;
    padding:48px 0 40px;
  }
  .login-status-pill {
    width:max-content;
    max-width:100%;
    display:inline-flex;
    align-items:center;
    gap:8px;
    height:32px;
    padding:0 11px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.045);
    color:#9AB0CF;
    font-size:10px;
    font-weight:750;
    letter-spacing:.04em;
    backdrop-filter:blur(10px);
  }
  .login-hero-copy h1 {
    max-width:570px;
    margin:19px 0 0;
    color:#fff;
    font-size:clamp(38px,4.15vw,64px);
    line-height:.98;
    letter-spacing:-.058em;
    font-weight:860;
  }
  .login-hero-copy p {
    max-width:510px;
    margin:19px 0 0;
    color:#93A7C5;
    font-size:13.5px;
    line-height:1.75;
  }
  .login-feature-row {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:25px;
  }
  .login-feature-chip {
    display:inline-flex;
    align-items:center;
    gap:7px;
    min-height:34px;
    padding:7px 10px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.075);
    background:rgba(255,255,255,.035);
    color:#AAB9CF;
    font-size:10.5px;
    font-weight:650;
  }
  .login-feature-chip svg { color:#6F91FF; }
  .login-preview {
    position:relative;
    z-index:2;
    width:min(520px,100%);
    margin-bottom:4px;
    padding:13px;
    border:1px solid rgba(255,255,255,.075);
    border-radius:16px;
    background:rgba(255,255,255,.038);
    backdrop-filter:blur(12px);
    box-shadow:0 18px 60px rgba(0,0,0,.10);
  }
  .login-preview-top {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:10px;
  }
  .login-preview-top b { font-size:10.5px; color:#DDE7F7; }
  .login-preview-top span { font-size:9.5px; color:#7087A8; }
  .login-preview-grid {
    display:grid;
    grid-template-columns:1.35fr .65fr .65fr;
    gap:8px;
  }
  .login-preview-card {
    min-width:0;
    min-height:64px;
    padding:11px;
    border-radius:11px;
    background:rgba(255,255,255,.045);
    border:1px solid rgba(255,255,255,.055);
  }
  .login-preview-card span {
    display:block;
    font-size:9px;
    color:#7187A8;
  }
  .login-preview-card b {
    display:block;
    margin-top:6px;
    font-size:14px;
    color:#F7FAFF;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .login-preview-card.primary {
    background:linear-gradient(145deg,rgba(79,124,255,.20),rgba(79,124,255,.075));
    border-color:rgba(100,139,255,.18);
  }
  .login-panel-v2 {
    min-height:100vh;
    padding:42px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#F3F5F9;
  }
  .login-card-v2 {
    width:420px;
    max-width:100%;
  }
  .login-mobile-brand {
    display:none;
  }
  .login-card-heading {
    margin-bottom:17px;
  }
  .login-card-heading .eyebrow {
    display:inline-flex;
    align-items:center;
    gap:7px;
    color:#4F7CFF;
    font-size:9.8px;
    font-weight:850;
    letter-spacing:.13em;
    text-transform:uppercase;
  }
  .login-card-heading h2 {
    margin:8px 0 0;
    color:#111827;
    font-size:28px;
    line-height:1.1;
    letter-spacing:-.04em;
  }
  .login-card-heading p {
    margin:8px 0 0;
    color:#7A879A;
    font-size:11.8px;
    line-height:1.65;
  }
  .login-card-v2 .form-box {
    background:#fff;
    border:1px solid #E3E8EF;
    border-radius:18px;
    padding:22px;
    box-shadow:0 18px 55px rgba(15,23,42,.08);
  }
  .login-card-v2 .form-box .ui-field {
    min-height:44px;
    border-radius:11px;
    background:#FBFCFE !important;
  }
  .login-submit-btn {
    width:100%;
    min-height:44px !important;
    margin-top:2px;
    border-color:#4F7CFF !important;
    background:linear-gradient(135deg,#4F7CFF,#5B6FF7) !important;
    box-shadow:0 10px 22px rgba(79,124,255,.20) !important;
  }
  .login-submit-btn:hover:not(:disabled) {
    background:linear-gradient(135deg,#456FF0,#5365E8) !important;
  }
  .login-security-note {
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    margin-top:14px;
    color:#98A3B3;
    font-size:10.2px;
  }
  .login-footer-v2 {
    margin-top:24px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    color:#A0AABC;
    font-size:9.8px;
  }


  .dashboard-hero { min-height:210px; border-radius:20px; padding:24px; color:#fff; background:radial-gradient(circle at 85% 12%,rgba(108,92,231,.30),transparent 30%),linear-gradient(135deg,#0A1020,#12223D 58%,#153A5D); display:grid; grid-template-columns:minmax(0,1.2fr) minmax(290px,.8fr); gap:18px; overflow:hidden; position:relative; }
  .dashboard-hero:after { content:""; position:absolute; width:260px; height:260px; border:1px solid rgba(255,255,255,.08); border-radius:50%; right:-90px; bottom:-150px; box-shadow:0 0 0 48px rgba(255,255,255,.018),0 0 0 96px rgba(255,255,255,.012); }
  .hero-kicker { font-size:10px; font-weight:800; letter-spacing:.13em; color:#7F94B5; text-transform:uppercase; }
  .hero-main-value { font-size:38px; font-weight:820; letter-spacing:-.04em; margin-top:8px; }
  .hero-sub { color:#94A7C3; font-size:12.5px; margin-top:5px; }
  .hero-actions { margin-top:22px; display:flex; gap:8px; flex-wrap:wrap; }
  .hero-action { height:36px; padding:0 12px; border-radius:10px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.06); color:#DDE7F7; display:flex; align-items:center; gap:7px; cursor:pointer; font-size:11.5px; font-weight:650; }
  .hero-action.primary { background:#4F7CFF; border-color:#4F7CFF; color:#fff; }
  .hero-side { align-self:stretch; display:grid; grid-template-columns:1fr 1fr; gap:9px; z-index:1; }
  .hero-mini { border:1px solid rgba(255,255,255,.075); background:rgba(255,255,255,.045); border-radius:14px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; min-height:78px; }
  .hero-mini span { font-size:10.5px; color:#8297B7; }
  .hero-mini b { font-size:18px; margin-top:8px; }

  .metric-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:14px 0; }
  .metric-tile { background:#fff; border:1px solid #E6EAF0; border-radius:15px; padding:15px 16px; display:flex; align-items:center; gap:12px; }
  .metric-icon { width:38px; height:38px; border-radius:12px; display:grid; place-items:center; background:#F2F5FA; color:#4F7CFF; }
  .metric-tile span { display:block; color:#7A879A; font-size:10.5px; margin-bottom:3px; }
  .metric-tile b { font-size:17px; color:#111827; }
  .panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .panel-heading > div { min-width:0; }
  .panel-heading b { font-size:13.5px; }
  .panel-heading span { font-size:10.5px; color:#8B97A9; }

  .activity-grid-head { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(135px,.65fr) 132px 105px; gap:14px; padding:0 0 8px; border-bottom:1px solid #E8EDF3; color:#95A0B0; font-size:9.5px; font-weight:800; letter-spacing:.055em; text-transform:uppercase; }
  .activity-grid-head span:last-child { text-align:right; }
  .transaction-row { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(135px,.65fr) 132px 105px; align-items:center; gap:14px; min-height:62px; padding:10px 0; border-bottom:1px solid #EEF1F5; }
  .transaction-row:last-child { border-bottom:none; }
  .tx-product-cell { min-width:0; display:flex; align-items:center; gap:10px; }
  .tx-icon { width:34px; height:34px; border-radius:11px; display:grid; place-items:center; background:#EFF4FF; color:#4F7CFF; flex-shrink:0; }
  .tx-product-copy { min-width:0; text-align:left; }
  .tx-product-copy b { display:block; font-size:11.8px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tx-product-copy small { display:block; font-size:9.6px; color:#9AA5B5; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tx-meta-cell,.tx-time-cell { min-width:0; text-align:left; }
  .tx-meta-cell b,.tx-time-cell b { display:block; font-size:10.8px; color:#4B5563; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tx-meta-cell span,.tx-time-cell span { display:block; margin-top:3px; font-size:9.7px; color:#9AA5B5; text-transform:capitalize; }
  .tx-value { font-size:12.2px; font-weight:800; color:#111827; white-space:nowrap; text-align:right; font-variant-numeric:tabular-nums; }

  .stock-table-head { display:grid; grid-template-columns:minmax(0,1fr) 46px minmax(90px,1fr); gap:10px; padding-bottom:7px; border-bottom:1px solid #EEF1F5; color:#9AA5B5; font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
  .stock-table-head span:nth-child(2) { text-align:center; }
  .stock-row { padding:10px 0; display:grid; grid-template-columns:minmax(0,1fr) 46px minmax(90px,1fr); align-items:center; gap:10px; border-bottom:1px solid #F2F4F7; }
  .stock-row:last-of-type { border-bottom:none; }
  .stock-name { min-width:0; font-size:10.9px; font-weight:750; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .stock-count { text-align:center; font-size:10.5px; font-weight:800; color:#B76A0C; white-space:nowrap; }
  .stock-meter { width:100%; height:5px; background:#EEF1F5; border-radius:99px; overflow:hidden; }
  .stock-meter span { display:block; height:100%; background:linear-gradient(90deg,#F59E0B,#FB7185); border-radius:99px; }

  .pos-layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(340px,.75fr); gap:16px; align-items:start; }
  .pos-catalog { background:#fff; border:1px solid #E6EAF0; border-radius:18px; overflow:hidden; }
  .pos-toolbar { padding:15px; border-bottom:1px solid #EDF0F4; }
  .category-chips { display:flex; gap:7px; overflow-x:auto; padding-top:10px; scrollbar-width:none; }
  .category-chips::-webkit-scrollbar { display:none; }
  .category-chip { border:1px solid #E5E9F0; background:#fff; color:#66758A; height:31px; padding:0 11px; border-radius:9px; font-size:10.8px; font-weight:650; cursor:pointer; white-space:nowrap; }
  .category-chip.active { border-color:#111827; background:#111827; color:#fff; }
  .product-grid-v2 { display:grid; grid-template-columns:repeat(auto-fill,minmax(155px,1fr)); gap:9px; padding:13px; max-height:610px; overflow-y:auto; }
  .product-card-v2 { min-height:142px; text-align:left; padding:12px; border:1px solid #E8EBF0; border-radius:14px; background:#fff; cursor:pointer; display:flex; flex-direction:column; }
  .product-card-v2:hover:not(:disabled) { border-color:#BFCBDE; transform:translateY(-1px); box-shadow:0 8px 18px rgba(15,23,42,.05); }
  .product-card-v2:disabled { opacity:.48; cursor:not-allowed; background:#F8FAFC; }
  .product-thumb { height:48px; border-radius:11px; display:grid; place-items:center; background:linear-gradient(145deg,#F3F6FB,#EAF0F9); color:#6982AA; margin-bottom:10px; }
  .product-name-v2 { font-size:11.8px; font-weight:700; line-height:1.35; flex:1; }
  .product-meta-v2 { display:flex; align-items:flex-end; justify-content:space-between; gap:6px; margin-top:8px; }
  .product-price-v2 { font-size:12.8px; font-weight:800; color:#111827; }
  .stock-pill { font-size:9.5px; border-radius:7px; padding:3px 6px; background:#F1F5F9; color:#64748B; white-space:nowrap; }
  .stock-pill.low { background:#FFF3DC; color:#B45309; }
  .pos-cart { position:sticky; top:88px; border-radius:18px; overflow:hidden; background:#0C1628; color:#fff; box-shadow:0 18px 40px rgba(12,22,40,.12); }
  .cart-head { padding:16px 17px 13px; border-bottom:1px solid rgba(255,255,255,.07); display:flex; align-items:center; justify-content:space-between; }
  .cart-head b { font-size:13.5px; }
  .cart-head span { font-size:10.5px; color:#788CA9; }
  .cart-body { padding:10px 15px 15px; }
  .cart-item-v2 { padding:10px 0; display:flex; gap:8px; align-items:center; border-bottom:1px solid rgba(255,255,255,.06); }
  .cart-item-main { flex:1; min-width:0; }
  .cart-item-main b { display:block; font-size:11.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cart-item-main span { font-size:10.2px; color:#788CA9; margin-top:2px; display:block; }
  .qty-control { display:flex; align-items:center; gap:5px; }
  .qty-control button { width:24px; height:24px; border-radius:7px; border:1px solid rgba(255,255,255,.10); color:#D7E2F2; background:rgba(255,255,255,.045); display:grid; place-items:center; cursor:pointer; }
  .qty-control strong { width:18px; text-align:center; font-size:11px; }
  .cart-form { padding-top:12px; }
  .cart-form .ui-field { background:#111E34 !important; color:#F3F7FD !important; border-color:rgba(255,255,255,.08) !important; }
  .payment-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:10px 0; }
  .payment-btn { height:34px; border-radius:9px; border:1px solid rgba(255,255,255,.09); background:#111E34; color:#8194B1; font-size:10.5px; font-weight:700; cursor:pointer; text-transform:capitalize; }
  .payment-btn.active { background:#4F7CFF; border-color:#4F7CFF; color:#fff; }
  .cart-total-box { margin-top:13px; padding:13px; border-radius:12px; background:linear-gradient(135deg,#132441,#122E4B); border:1px solid rgba(255,255,255,.07); }
  .cart-total-line { display:flex; justify-content:space-between; align-items:center; }
  .cart-total-line span { font-size:10.5px; color:#8297B6; }
  .cart-total-line b { font-size:23px; letter-spacing:-.03em; }
  .checkout-btn { width:100%; margin-top:10px; min-height:41px; background:#fff !important; color:#101827 !important; }

  .service-grid-v2 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .service-card-v2 { min-height:92px; padding:12px; border-radius:14px; border:1px solid #E6EAF0; background:#fff; cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; align-items:flex-start; }
  .service-card-v2.active { color:#fff; background:linear-gradient(145deg,#111C31,#173A61); border-color:#173A61; box-shadow:0 10px 26px rgba(17,28,49,.12); }
  .service-card-v2 .service-icon { width:34px; height:34px; border-radius:11px; display:grid; place-items:center; background:#F0F4FA; color:#4F7CFF; }
  .service-card-v2.active .service-icon { background:rgba(255,255,255,.09); color:#7EA0FF; }
  .service-card-v2 b { font-size:11.5px; line-height:1.3; }
  .ppob-layout { display:grid; grid-template-columns:minmax(320px,.72fr) minmax(0,1.28fr); gap:14px; align-items:start; }
  .dark-total-card { margin-top:14px; padding:15px; border-radius:14px; color:#fff; background:linear-gradient(135deg,#0C1628,#173150); }

  .form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

  .ppob-history-wrap { min-width:0; }
  .ppob-history-head { display:grid; grid-template-columns:34px minmax(0,1.25fr) minmax(150px,.78fr) 128px; gap:12px; align-items:center; padding:0 0 8px; border-bottom:1px solid #E8EDF3; color:#95A0B0; font-size:9.2px; font-weight:800; letter-spacing:.055em; text-transform:uppercase; }
  .ppob-history-head span:last-child { text-align:right; }
  .ppob-history-list { max-height:470px; overflow-y:auto; }
  .ppob-history-row { display:grid; grid-template-columns:34px minmax(0,1.25fr) minmax(150px,.78fr) 128px; gap:12px; align-items:center; min-height:68px; padding:10px 0; border-bottom:1px solid #EEF1F5; }
  .ppob-history-row:last-child { border-bottom:none; }
  .ppob-service-cell,.ppob-meta-cell { min-width:0; }
  .ppob-service-cell b,.ppob-meta-cell b { display:block; font-size:11.5px; line-height:1.35; color:#172033; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ppob-service-cell span,.ppob-meta-cell span { display:block; margin-top:3px; font-size:9.8px; line-height:1.35; color:#95A0B0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ppob-amount-cell { display:flex; flex-direction:column; align-items:flex-end; gap:5px; text-align:right; min-width:0; }
  .ppob-amount-cell > b { font-size:11.8px; font-weight:800; color:#111827; white-space:nowrap; font-variant-numeric:tabular-nums; }

  .finance-hero-v2 { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); gap:12px; margin-bottom:14px; }
  .finance-balance-card { min-height:170px; padding:20px; border-radius:19px; color:#fff; background:radial-gradient(circle at 88% 18%,rgba(79,124,255,.34),transparent 28%),linear-gradient(135deg,#09111F,#10233D); display:flex; flex-direction:column; justify-content:space-between; }
  .finance-balance-card .value { font-size:34px; font-weight:820; letter-spacing:-.04em; margin-top:7px; }
  .finance-side-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .finance-mini-card { padding:15px; border-radius:15px; background:#fff; border:1px solid #E6EAF0; }
  .finance-mini-card span { font-size:10.5px; color:#7D899A; display:block; }
  .finance-mini-card b { font-size:16px; display:block; margin-top:7px; }

  .report-hero-v2 { padding:19px 20px; border-radius:18px; color:#fff; background:linear-gradient(135deg,#0A1020,#152C4B); display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
  .report-stat { padding:10px 12px; border-right:1px solid rgba(255,255,255,.08); }
  .report-stat:last-child { border-right:none; }
  .report-stat span { font-size:10.5px; color:#8196B5; display:block; }
  .report-stat b { font-size:23px; margin-top:5px; display:block; letter-spacing:-.025em; }

  .mobile-card-list { display:flex; flex-direction:column; gap:9px; }
  .inventory-mobile-card,.stock-history-mobile-card,.user-mobile-card {
    background:#fff;
    border:1px solid #E6EAF0;
    border-radius:14px;
    padding:13px;
    box-shadow:0 3px 12px rgba(16,24,40,.03);
  }
  .inventory-mobile-head,.user-mobile-head {
    display:flex;
    align-items:flex-start;
    gap:10px;
  }
  .inventory-mobile-icon,.user-mobile-avatar {
    width:36px;
    height:36px;
    border-radius:11px;
    display:grid;
    place-items:center;
    flex-shrink:0;
    background:#F0F4FA;
    color:#647FA8;
  }
  .user-mobile-avatar {
    color:#fff;
    background:linear-gradient(145deg,#4F7CFF,#6C5CE7);
    font-size:11px;
    font-weight:800;
  }
  .mobile-card-title { min-width:0; flex:1; }
  .mobile-card-title b {
    display:block;
    font-size:12.3px;
    color:#111827;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .mobile-card-title span {
    display:block;
    margin-top:3px;
    color:#93A0B2;
    font-size:10.2px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .mobile-card-meta {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    margin-top:11px;
    padding-top:10px;
    border-top:1px solid #EEF1F5;
  }
  .mobile-card-meta > div span {
    display:block;
    color:#98A3B3;
    font-size:9.3px;
    margin-bottom:3px;
  }
  .mobile-card-meta > div b {
    display:block;
    color:#263246;
    font-size:11px;
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .mobile-card-actions {
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:6px;
    margin-top:10px;
  }
  .stock-history-mobile-card .history-top {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:10px;
  }
  .stock-history-mobile-card .history-title b {
    display:block;
    font-size:12px;
  }
  .stock-history-mobile-card .history-title span {
    display:block;
    margin-top:3px;
    font-size:9.8px;
    color:#95A0B0;
  }
  .access-info-card {
    margin-top:12px;
    padding:12px 13px;
    border:1px solid #E6EAF0;
    border-radius:12px;
    background:#F8FAFC;
    color:#66758A;
    font-size:10.8px;
    line-height:1.65;
  }
  .access-info-card b { color:#334155; }

  .toast-ui { position:fixed; right:22px; bottom:20px; z-index:999; min-width:260px; max-width:360px; padding:11px 13px; border-radius:12px; color:#fff; background:#0D1628; border:1px solid rgba(255,255,255,.08); box-shadow:0 18px 42px rgba(15,23,42,.20); display:flex; align-items:center; gap:8px; font-size:12.5px; }
  .toast-ui.warn { background:#9A5B12; }

  @media (max-width: 1050px) {
    .pos-layout { grid-template-columns:minmax(0,1.2fr) minmax(310px,.8fr); }
    .dashboard-hero { grid-template-columns:1fr; }
    .hero-side { grid-template-columns:repeat(4,1fr); }
    .finance-hero-v2 { grid-template-columns:1fr; }
  }
  @media (max-width: 860px) {
    .app-shell { display:block; }
    .workspace-content { padding:15px 13px calc(112px + env(safe-area-inset-bottom)); scroll-padding-bottom:calc(112px + env(safe-area-inset-bottom)); }
    .mobile-bottom-nav { position:fixed; left:10px; right:10px; bottom:calc(8px + env(safe-area-inset-bottom)); z-index:110; height:62px; padding:5px 6px; border-radius:18px; display:flex; align-items:center; justify-content:space-around; background:rgba(10,16,32,.96); backdrop-filter:blur(14px); box-shadow:0 14px 42px rgba(10,16,32,.25); border:1px solid rgba(255,255,255,.06); }
    .mobile-bottom-nav button { min-width:50px; height:50px; border:none; background:transparent; color:#72839E; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:8.5px; font-weight:700; }
    .mobile-bottom-nav button.active { color:#fff; }
    .mobile-bottom-nav button.active svg { color:#7EA0FF; }
    .dashboard-hero { min-height:auto; padding:18px; border-radius:17px; grid-template-columns:1fr; }
    .hero-main-value { font-size:31px; }
    .hero-side { grid-template-columns:1fr 1fr; }
    .metric-strip { grid-template-columns:1fr; gap:8px; }
    .activity-grid-head { display:none; }
    .transaction-row { grid-template-columns:minmax(0,1fr) auto; grid-template-areas:"product total" "meta total" "time total"; gap:4px 10px; padding:11px 0; }
    .tx-product-cell { grid-area:product; }
    .tx-meta-cell { grid-area:meta; padding-left:44px; display:flex; align-items:center; gap:6px; }
    .tx-meta-cell span { margin-top:0; }
    .tx-time-cell { grid-area:time; padding-left:44px; display:flex; align-items:center; gap:5px; }
    .tx-time-cell span { margin-top:0; }
    .tx-value { grid-area:total; align-self:center; font-size:11.8px; }
    .stock-table-head { grid-template-columns:minmax(0,1fr) 44px minmax(80px,1fr); }
    .stock-row { grid-template-columns:minmax(0,1fr) 44px minmax(80px,1fr); }
    .pos-layout,.ppob-layout { grid-template-columns:1fr; }
    .pos-cart { position:relative; top:auto; margin-bottom:14px; }
    .cart-form { padding-bottom:72px; }
    .category-chips { margin-right:-15px; padding-right:15px; overscroll-behavior-inline:contain; }
    .product-grid-v2 { grid-template-columns:repeat(2,minmax(0,1fr)); max-height:none; }
    .service-grid-v2 { grid-template-columns:1fr 1fr; }
    .ppob-history-head { display:none; }
    .ppob-history-row { grid-template-columns:34px minmax(0,1fr) auto; grid-template-areas:"icon service amount" "icon meta amount"; gap:4px 10px; min-height:72px; padding:11px 0; }
    .ppob-history-row .tx-icon { grid-area:icon; }
    .ppob-service-cell { grid-area:service; }
    .ppob-meta-cell { grid-area:meta; }
    .ppob-meta-cell b,.ppob-meta-cell span { display:inline; margin:0; }
    .ppob-meta-cell span:before { content:" • "; }
    .ppob-amount-cell { grid-area:amount; align-self:center; }
    .finance-side-grid { grid-template-columns:1fr 1fr; }
    .report-hero-v2 { grid-template-columns:1fr; }
    .report-stat { border-right:none; border-bottom:1px solid rgba(255,255,255,.07); }
    .report-stat:last-child { border-bottom:none; }
    .toast-ui { left:13px; right:13px; bottom:84px; max-width:none; min-width:0; }
    .login-shell-v2 { grid-template-columns:1fr; background:#F3F5F9; }
    .login-visual-v2 { min-height:320px; padding:28px 22px 48px; }
    .login-hero-copy { margin-top:46px; margin-bottom:0; padding:0; }
    .login-hero-copy h1 { max-width:520px; font-size:clamp(34px,8vw,48px); }
    .login-preview { display:none; }
    .login-panel-v2 { min-height:auto; padding:0 18px 28px; margin-top:-24px; position:relative; z-index:4; background:transparent; }
    .login-card-v2 { width:520px; }
    .login-card-heading { padding:26px 4px 0; }
    .login-card-heading h2 { font-size:25px; }
    .login-card-v2 .form-box { border-radius:18px; box-shadow:0 18px 55px rgba(15,23,42,.12); }
    .login-footer-v2 { padding:0 4px; }
  }
  @media (max-width: 560px) {
    .login-visual-v2 { min-height:285px; padding:22px 18px 42px; }
    .login-brand-v2 { gap:9px; }
    .login-brand-v2 .brand-mark { width:38px; height:38px; }
    .login-hero-copy { margin-top:38px; }
    .login-status-pill { height:29px; font-size:9.5px; }
    .login-hero-copy h1 { font-size:34px; line-height:1.02; }
    .login-hero-copy p { font-size:12px; line-height:1.65; margin-top:14px; }
    .login-feature-row { margin-top:17px; gap:6px; }
    .login-feature-chip { min-height:30px; font-size:9.5px; padding:6px 8px; }
    .login-panel-v2 { padding-left:11px; padding-right:11px; }
    .login-card-heading { padding-left:7px; padding-right:7px; }
    .login-card-v2 .form-box { padding:18px; }
    .login-footer-v2 { font-size:9px; }
    .workspace-content { padding-left:11px; padding-right:11px; padding-bottom:calc(112px + env(safe-area-inset-bottom)); }
    .product-grid-v2 { gap:7px; padding:10px; }
    .product-card-v2 { min-height:132px; }
    .service-grid-v2 { gap:7px; }
    .form-grid-2 { grid-template-columns:1fr; }
    .panel-heading { align-items:flex-start; }
    .ppob-history-row { grid-template-columns:30px minmax(0,1fr) auto; gap:4px 8px; }
    .ppob-amount-cell > b { font-size:11px; }
    .finance-side-grid { grid-template-columns:1fr; }
  }

  /* ---------- Operational safety / correction UI ---------- */
  .operation-warning {
    display:flex;
    align-items:flex-start;
    gap:9px;
    padding:11px 12px;
    border:1px solid #F5D6A3;
    border-radius:11px;
    background:#FFF8EC;
    color:#8A5A13;
    font-size:11.5px;
    line-height:1.55;
  }
  .operation-warning svg { flex-shrink:0; margin-top:1px; }
  .payment-summary-box {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:8px;
  }
  .payment-summary-box > div {
    min-width:0;
    padding:10px;
    border:1px solid #E7EBF1;
    border-radius:11px;
    background:#F8FAFC;
  }
  .payment-summary-box span { display:block; color:#8A97A9; font-size:9.8px; margin-bottom:4px; }
  .payment-summary-box b { display:block; color:#182235; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .page-actions { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
  .segmented-tabs {
    display:inline-flex;
    padding:3px;
    border-radius:11px;
    background:#E9EDF3;
    margin-bottom:10px;
  }
  .segmented-tabs button {
    border:none;
    min-height:32px;
    padding:7px 12px;
    border-radius:8px;
    background:transparent;
    color:#788598;
    font-size:10.8px;
    font-weight:750;
    cursor:pointer;
  }
  .segmented-tabs button.active {
    background:#fff;
    color:#111827;
    box-shadow:0 2px 8px rgba(15,23,42,.06);
  }
  .section-note {
    padding:11px 13px;
    margin-bottom:10px;
    border:1px solid #E8ECF2;
    border-radius:11px;
    background:#F8FAFC;
    color:#758398;
    font-size:10.8px;
    line-height:1.6;
  }
  .row-actions { display:flex; align-items:center; justify-content:flex-end; gap:5px; }
  .system-entry-label { color:#98A3B3; font-size:10px; font-weight:700; white-space:nowrap; }
  .is-voided { opacity:.68; }
  tr.is-voided td { background:#FAFBFC; color:#8C97A6; }
  .void-reason {
    margin-top:9px;
    padding-top:8px;
    border-top:1px dashed #E4E8EE;
    color:#8A97A9;
    font-size:10.2px;
    line-height:1.5;
  }
  .finance-mobile-card,.debt-mobile-card,.sale-audit-mobile-card {
    border:1px solid #E5EAF1;
    border-radius:15px;
    background:#fff;
    padding:14px;
    box-shadow:0 4px 16px rgba(15,23,42,.035);
  }
  .finance-mobile-top {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
  }
  .money-value,.sale-total {
    flex-shrink:0;
    font-size:13px;
    font-weight:850;
    font-variant-numeric:tabular-nums;
    white-space:nowrap;
  }
  .money-value.income { color:#0F8B6D; }
  .money-value.expense { color:#BE123C; }
  .mobile-note {
    margin-top:9px;
    color:#66758A;
    font-size:11px;
    line-height:1.5;
    word-break:break-word;
  }
  .mobile-card-footer {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-top:11px;
  }
  .debt-number-grid {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:7px;
    margin-top:11px;
  }
  .debt-number-grid > div {
    min-width:0;
    padding:9px;
    border-radius:10px;
    background:#F7F9FC;
  }
  .debt-number-grid span { display:block; color:#91A0B4; font-size:9.5px; margin-bottom:4px; }
  .debt-number-grid b { display:block; color:#253248; font-size:10.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .transaction-type-toggle {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:7px;
  }
  .transaction-type-toggle button {
    min-height:40px;
    border:1px solid #DFE5ED;
    border-radius:10px;
    background:#fff;
    color:#5E6B7E;
    font-size:12px;
    font-weight:750;
    cursor:pointer;
  }
  .transaction-type-toggle button.active {
    border-color:#4F7CFF;
    background:#EEF3FF;
    color:#315AD0;
    box-shadow:0 0 0 2px rgba(79,124,255,.10);
  }
  .nominal-presets {
    display:flex;
    gap:6px;
    flex-wrap:wrap;
    margin-top:8px;
  }
  .nominal-chip {
    min-height:32px;
    padding:0 10px;
    border-radius:9px;
    border:1px solid #E3E8EF;
    background:#fff;
    color:#66758A;
    font-size:10.5px;
    font-weight:750;
    cursor:pointer;
  }
  .nominal-chip.active {
    border-color:#111827;
    background:#111827;
    color:#fff;
  }
  .text-danger-action {
    border:none;
    background:transparent;
    padding:2px 0;
    color:#BE123C;
    font-size:9.8px;
    font-weight:800;
    cursor:pointer;
  }
  .finance-balance-breakdown {
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    font-size:10.5px;
    color:#8195B4;
  }
  .report-grid-v2 {
    display:grid;
    grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);
    gap:14px;
  }
  .report-chart-wrap { width:100%; height:280px; }
  .top-product-chart { width:100%; height:190px; }
  .top-product-row {
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px 0;
    border-bottom:1px solid #F0F2F5;
  }
  .top-product-row > span:nth-child(2) {
    min-width:0;
    flex:1;
    color:#526074;
    font-size:11px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .top-product-row b { font-size:11px; }

  @media (max-width: 860px) {
    /* More comfortable mobile rhythm and typography */
    .workspace-content {
      padding:18px 14px calc(132px + env(safe-area-inset-bottom)) !important;
      scroll-padding-bottom:calc(132px + env(safe-area-inset-bottom)) !important;
    }
    .page-title-row {
      margin-bottom:17px !important;
      gap:11px !important;
      align-items:flex-start !important;
    }
    .page-title-row > div:first-child { width:100%; }
    .page-title-row h1 {
      font-size:24px !important;
      line-height:1.15 !important;
      letter-spacing:-.035em !important;
    }
    .page-title-row > div:first-child > div {
      margin-top:6px !important;
      font-size:13.5px !important;
      line-height:1.55 !important;
    }
    .page-actions,.report-actions {
      width:100%;
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .page-actions > *, .report-actions > * {
      width:100% !important;
      min-width:0;
    }
    .ui-card {
      border-radius:16px !important;
    }
    .panel-heading {
      align-items:flex-start !important;
      margin-bottom:15px !important;
      text-align:left !important;
    }
    .panel-heading > div { text-align:left !important; }
    .panel-heading b {
      font-size:14.5px !important;
      line-height:1.35 !important;
    }
    .panel-heading span {
      font-size:12px !important;
      line-height:1.5 !important;
    }
    label {
      font-size:12.5px !important;
      line-height:1.35 !important;
      margin-bottom:7px !important;
    }
    .ui-field {
      min-height:48px !important;
      font-size:16px !important; /* prevents iOS auto zoom */
      line-height:1.25 !important;
      border-radius:12px !important;
    }
    .ui-btn-primary,.ui-btn-outline,.ui-btn-danger,.ui-btn-ghost {
      min-height:44px !important;
      font-size:13.5px !important;
      line-height:1.2 !important;
      border-radius:11px !important;
    }
    .mobile-bottom-nav {
      height:68px !important;
      bottom:calc(8px + env(safe-area-inset-bottom)) !important;
    }
    .mobile-bottom-nav button {
      min-width:54px !important;
      height:56px !important;
      font-size:9.8px !important;
      line-height:1.05 !important;
      gap:4px !important;
    }
    .mobile-bottom-nav button svg {
      width:21px !important;
      height:21px !important;
    }
    .mobile-card-list { gap:11px !important; }
    .inventory-mobile-card,.stock-history-mobile-card,.user-mobile-card,
    .finance-mobile-card,.debt-mobile-card,.sale-audit-mobile-card {
      padding:15px !important;
      border-radius:16px !important;
    }
    .mobile-card-title b {
      font-size:14px !important;
      line-height:1.35 !important;
    }
    .mobile-card-title span {
      margin-top:4px !important;
      font-size:11.5px !important;
      line-height:1.4 !important;
    }
    .mobile-card-meta > div span {
      font-size:10.5px !important;
    }
    .mobile-card-meta > div b {
      font-size:12.5px !important;
      line-height:1.4 !important;
    }
    .category-chips {
      display:flex !important;
      flex-wrap:nowrap !important;
      overflow-x:auto !important;
      gap:7px !important;
      padding-bottom:6px !important;
      scrollbar-width:none;
    }
    .category-chips::-webkit-scrollbar { display:none; }
    .category-chip {
      flex:0 0 auto !important;
      white-space:nowrap !important;
    }
    .product-card-v2 b {
      font-size:13.5px !important;
      line-height:1.35 !important;
    }
    .product-price {
      font-size:15px !important;
    }
    .product-stock {
      font-size:10.5px !important;
    }
    .service-card-v2 {
      min-height:108px !important;
      padding:13px !important;
    }
    .service-card-v2 b {
      font-size:13px !important;
      line-height:1.35 !important;
    }
    .nominal-presets {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px;
    }
    .nominal-chip {
      width:100%;
      min-height:39px;
      font-size:11.5px;
    }
    .dark-total-card {
      padding:16px !important;
      border-radius:14px !important;
    }
    .ppob-service-cell b,.ppob-meta-cell b {
      font-size:12.5px !important;
    }
    .ppob-service-cell span,.ppob-meta-cell span {
      font-size:10.8px !important;
    }
    .ppob-amount-cell > b {
      font-size:12.5px !important;
    }
    .finance-balance-card {
      min-height:auto !important;
      padding:20px !important;
    }
    .finance-balance-card .value {
      font-size:30px !important;
    }
    .finance-balance-breakdown {
      margin-top:16px;
      gap:5px 10px;
      font-size:11.5px;
      line-height:1.5;
    }
    .finance-side-grid {
      grid-template-columns:1fr 1fr !important;
      gap:9px !important;
    }
    .finance-mini-card {
      min-height:92px !important;
      padding:14px !important;
    }
    .finance-mini-card span { font-size:11.5px !important; }
    .finance-mini-card b { font-size:16px !important; margin-top:6px !important; }
    .segmented-tabs {
      display:grid;
      grid-template-columns:1fr 1fr;
      width:100%;
      margin-bottom:12px;
    }
    .segmented-tabs button {
      min-height:42px;
      font-size:12.5px;
    }
    .section-note {
      font-size:11.5px;
      line-height:1.6;
      margin-bottom:12px;
    }
    .money-value,.sale-total {
      font-size:14px !important;
    }
    .mobile-note {
      font-size:12px !important;
    }
    .mobile-card-footer {
      align-items:flex-end;
      gap:8px;
    }
    .debt-number-grid span { font-size:10.5px; }
    .debt-number-grid b { font-size:11.5px; }
    .payment-summary-box {
      grid-template-columns:1fr;
    }
    .payment-summary-box span { font-size:11px; }
    .payment-summary-box b { font-size:13px; }
    .report-hero-v2 {
      grid-template-columns:1fr !important;
      gap:1px !important;
      padding:0 !important;
      overflow:hidden;
    }
    .report-stat {
      padding:15px 16px !important;
      border-right:none !important;
      border-bottom:1px solid rgba(255,255,255,.08);
    }
    .report-stat:last-child { border-bottom:none; }
    .report-stat span { font-size:10.5px !important; }
    .report-stat b { font-size:21px !important; }
    .report-grid-v2 {
      grid-template-columns:1fr;
      gap:12px;
    }
    .report-chart-wrap { height:245px; }
    .top-product-chart { height:170px; }
    .top-product-row > span:nth-child(2) { font-size:12px; }
    .top-product-row b { font-size:12px; }
    .operation-warning {
      font-size:12px;
    }
  }

  @media (max-width: 390px) {
    .workspace-content {
      padding-left:11px !important;
      padding-right:11px !important;
    }
    .page-title-row h1 { font-size:22px !important; }
    .page-title-row > div:first-child > div { font-size:12.8px !important; }
    .product-grid-v2 { grid-template-columns:1fr 1fr !important; gap:7px !important; }
    .finance-side-grid { grid-template-columns:1fr !important; }
    .debt-number-grid { grid-template-columns:1fr 1fr; }
    .debt-number-grid > div:last-child { grid-column:1 / -1; }
    .mobile-card-footer { flex-direction:column; align-items:stretch; }
    .mobile-card-footer > * { width:100%; }
    .row-actions { justify-content:flex-start; }
  }


  /* ---------- User lifecycle ---------- */
  .user-summary-grid {
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:10px;
    margin-bottom:14px;
  }
  .summary-label {
    color:#7C899B;
    font-size:10.5px;
    font-weight:700;
  }
  .summary-value {
    margin-top:6px;
    color:#111827;
    font-size:21px;
    font-weight:850;
    letter-spacing:-.03em;
  }
  .is-user-inactive {
    opacity:.76;
    background:#FAFBFC;
  }
  tr.is-user-inactive td {
    background:#FAFBFC;
  }
  .user-role-row {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-top:11px;
  }
  .user-role-row > span {
    color:#98A3B3;
    font-size:10px;
  }
  .user-deactivation-reason {
    margin-top:10px;
    padding:9px 10px;
    border-radius:10px;
    border:1px dashed #DDE3EA;
    background:#F8FAFC;
    color:#758398;
    font-size:10.5px;
    line-height:1.5;
    word-break:break-word;
  }
  .user-action-stack {
    width:100%;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:7px;
  }
  .user-action-stack > button:last-child:nth-child(3) {
    grid-column:1 / -1;
  }
  .inline-error {
    padding:10px 11px;
    border:1px solid #FECACA;
    border-radius:10px;
    background:#FFF1F2;
    color:#B91C1C;
    font-size:11.5px;
    line-height:1.5;
  }
  .danger-zone-box {
    display:flex;
    align-items:flex-start;
    gap:10px;
    padding:12px;
    border:1px solid #FECACA;
    border-radius:12px;
    background:#FFF1F2;
    color:#9F1239;
  }
  .danger-zone-box svg {
    flex-shrink:0;
    margin-top:1px;
  }
  .danger-zone-box b {
    display:block;
    font-size:12px;
  }
  .danger-zone-box span {
    display:block;
    margin-top:4px;
    color:#A64A64;
    font-size:11px;
    line-height:1.55;
  }

  @media (max-width: 860px) {
    .user-summary-grid {
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .user-summary-grid .ui-card {
      padding:14px !important;
    }
    .summary-label {
      font-size:11.5px;
    }
    .summary-value {
      font-size:22px;
    }
    .user-role-row > span {
      font-size:11px;
    }
    .user-deactivation-reason {
      font-size:11.5px;
      line-height:1.55;
    }
    .user-action-stack {
      gap:8px;
    }
    .user-action-stack button {
      width:100%;
      justify-content:center;
    }
  }

  @media (max-width: 390px) {
    .user-summary-grid {
      grid-template-columns:1fr 1fr;
    }
  }


  /* ---------- Production connectivity ---------- */
  .sidebar-status.offline {
    border-color:rgba(251,113,133,.28);
    background:rgba(190,18,60,.12);
    color:#FFD7E0;
  }
  .sidebar-status.offline small { color:#EBA4B5; }
  .live-pill.offline {
    color:#B42345;
    border-color:#F5CAD4;
    background:#FFF1F4;
  }
  .offline-banner {
    display:flex;
    align-items:flex-start;
    gap:10px;
    padding:11px 13px;
    margin-bottom:14px;
    border:1px solid #F4C9A8;
    border-radius:12px;
    background:#FFF7ED;
    color:#9A4D0C;
  }
  .offline-banner svg { flex-shrink:0; margin-top:1px; }
  .offline-banner b {
    display:block;
    font-size:11.5px;
  }
  .offline-banner span {
    display:block;
    margin-top:2px;
    color:#A7662D;
    font-size:10.5px;
    line-height:1.45;
  }

  @media (max-width: 860px) {
    .offline-banner {
      padding:12px 13px;
      margin-bottom:13px;
    }
    .offline-banner b { font-size:12.5px; }
    .offline-banner span { font-size:11.5px; }
  }


  /* =========================================================
     MOBILE PRECISION FINAL — Production v1.0 Candidate
     Fokus: baseline teks, wrapping, spacing, touch target
     ========================================================= */

  .metric-copy {
    min-width:0;
    flex:1;
    text-align:left;
  }
  .metric-copy span,
  .metric-copy b {
    display:block;
    text-align:left;
  }

  @media (max-width: 860px) {
    /* Dashboard hero */
    .dashboard-hero {
      padding:20px 16px !important;
      gap:16px !important;
      border-radius:18px !important;
    }
    .dashboard-hero > div:first-child {
      text-align:center;
    }
    .hero-kicker {
      font-size:10.5px !important;
      line-height:1.25 !important;
      letter-spacing:.16em !important;
    }
    .hero-main-value {
      margin-top:8px !important;
      font-size:34px !important;
      line-height:1.05 !important;
      letter-spacing:-.045em !important;
    }
    .hero-sub {
      margin-top:7px !important;
      font-size:12.5px !important;
      line-height:1.45 !important;
    }

    /* Exactly 2 actions on first row; owner report button spans full width */
    .hero-actions {
      display:grid !important;
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      gap:8px !important;
      margin-top:20px !important;
    }
    .hero-action {
      width:100% !important;
      min-width:0 !important;
      height:44px !important;
      padding:0 10px !important;
      justify-content:center !important;
      border-radius:11px !important;
      font-size:12px !important;
      line-height:1.1 !important;
      white-space:nowrap !important;
    }
    .hero-actions > .hero-action:nth-child(3) {
      grid-column:1 / -1;
    }

    /* Four hero mini KPIs use one visual baseline */
    .hero-side {
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      gap:9px !important;
    }
    .hero-mini {
      min-width:0 !important;
      min-height:96px !important;
      padding:13px 12px !important;
      align-items:center !important;
      justify-content:center !important;
      text-align:center !important;
      border-radius:14px !important;
    }
    .hero-mini span {
      min-height:17px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:11px !important;
      line-height:1.35 !important;
      white-space:nowrap;
    }
    .hero-mini b {
      display:block;
      margin-top:7px !important;
      font-size:18px !important;
      line-height:1.15 !important;
      font-variant-numeric:tabular-nums;
    }

    /* Supporting KPI cards: icon | copy, both text lines share the same left edge */
    .metric-strip {
      grid-template-columns:1fr !important;
      gap:10px !important;
      margin:14px 0 !important;
    }
    .metric-tile {
      display:grid !important;
      grid-template-columns:46px minmax(0,1fr) !important;
      align-items:center !important;
      column-gap:13px !important;
      min-height:94px !important;
      padding:14px 16px !important;
      border-radius:16px !important;
    }
    .metric-icon {
      width:46px !important;
      height:46px !important;
      border-radius:13px !important;
      align-self:center !important;
    }
    .metric-copy {
      min-width:0 !important;
      width:100% !important;
      text-align:left !important;
    }
    .metric-copy span {
      margin:0 !important;
      font-size:12.5px !important;
      line-height:1.4 !important;
      color:#7B899E !important;
      white-space:normal !important;
    }
    .metric-copy b {
      margin-top:5px !important;
      font-size:18px !important;
      line-height:1.15 !important;
      color:#111827 !important;
      font-variant-numeric:tabular-nums;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    /* Card headings: never let right-side actions collapse into 2 lines */
    .panel-heading {
      width:100%;
      min-width:0;
    }
    .panel-heading > div:first-child {
      min-width:0;
      flex:1;
    }
    .panel-heading > button,
    .panel-heading > .ui-btn-primary,
    .panel-heading > .ui-btn-outline,
    .panel-heading > .ui-btn-ghost,
    .panel-heading > .ui-btn-danger {
      flex:0 0 auto !important;
      width:auto !important;
      white-space:nowrap !important;
    }
    .dashboard-panel-heading {
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto !important;
      align-items:start !important;
      column-gap:10px !important;
    }
    .dashboard-panel-heading .ui-btn-ghost {
      min-height:34px !important;
      height:34px !important;
      padding:5px 7px !important;
      font-size:11.5px !important;
      border-radius:9px !important;
      white-space:nowrap !important;
    }

    /* Recent transaction list gets slightly more readable without becoming bulky */
    .transaction-row {
      min-height:72px !important;
      padding:12px 0 !important;
    }
    .tx-product-copy b {
      font-size:12.5px !important;
      line-height:1.4 !important;
    }
    .tx-product-copy small {
      font-size:10.5px !important;
      line-height:1.35 !important;
    }
    .tx-meta-cell b,
    .tx-time-cell b {
      font-size:11.5px !important;
    }
    .tx-meta-cell span,
    .tx-time-cell span {
      font-size:10.5px !important;
    }
    .tx-value {
      font-size:12.5px !important;
    }

    /* Stock panel */
    .stock-name,
    .stock-count {
      font-size:11.5px !important;
    }

    /* Kasir */
    .pos-toolbar {
      padding:14px !important;
    }
    .product-grid-v2 {
      padding:11px !important;
      gap:9px !important;
    }
    .product-card-v2 {
      min-height:145px !important;
      padding:12px !important;
    }
    .product-name-v2 {
      font-size:13px !important;
      line-height:1.4 !important;
    }
    .product-price-v2 {
      font-size:14.5px !important;
      line-height:1.2 !important;
    }
    .stock-pill {
      font-size:10px !important;
    }
    .cart-head b {
      font-size:15px !important;
    }
    .cart-head span {
      font-size:11.5px !important;
    }
    .cart-item-main b {
      font-size:12.5px !important;
    }
    .cart-item-main span {
      font-size:11px !important;
    }

    /* PPOB cards and total */
    .service-grid-v2 {
      gap:9px !important;
    }
    .service-card-v2 {
      min-height:116px !important;
      padding:14px !important;
    }
    .service-card-v2 b {
      font-size:13.5px !important;
      line-height:1.35 !important;
    }

    /* Keuangan / Piutang */
    .finance-mobile-card,
    .debt-mobile-card,
    .sale-audit-mobile-card,
    .inventory-mobile-card,
    .stock-history-mobile-card,
    .user-mobile-card {
      text-align:left !important;
    }
    .money-value,
    .sale-total {
      font-variant-numeric:tabular-nums;
    }

    /* User cards */
    .user-role-row {
      align-items:center !important;
    }

    /* Bottom navigation */
    .mobile-bottom-nav {
      left:12px !important;
      right:12px !important;
      border-radius:20px !important;
    }
    .mobile-bottom-nav button {
      padding:0 4px !important;
      white-space:nowrap !important;
    }
  }

  @media (max-width: 430px) {
    .workspace-content {
      padding-left:12px !important;
      padding-right:12px !important;
    }
    .dashboard-hero {
      padding-left:15px !important;
      padding-right:15px !important;
    }
    .hero-action {
      font-size:11.5px !important;
    }
    .dashboard-panel-heading {
      grid-template-columns:minmax(0,1fr) auto !important;
    }
  }

  @media (max-width: 360px) {
    .hero-actions {
      grid-template-columns:1fr !important;
    }
    .hero-actions > .hero-action:nth-child(3) {
      grid-column:auto;
    }
    .hero-side {
      grid-template-columns:1fr 1fr !important;
    }
    .dashboard-panel-heading {
      grid-template-columns:1fr !important;
      row-gap:7px !important;
    }
    .dashboard-panel-heading .ui-btn-ghost {
      justify-self:start;
    }
  }

`

// ---------- shared UI bits ----------
const Card = ({ children, style, className = "" }) => (
  <div className={`ui-card ${className}`} style={{ padding: 18, ...style }}>{children}</div>
);
const PageTitle = ({ title, subtitle, right }) => (
  <div className="page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
    <div style={{ minWidth: 0 }}>
      <h1 style={{ fontSize: 21, lineHeight: 1.15, fontWeight: 800, margin: 0, color: THEME.text }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 11.8, color: THEME.muted, marginTop: 5 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", style, type = "button", disabled, title, className = "" }) => {
  const styles = {
    primary: { background: THEME.ink, color: "#fff", border: `1px solid ${THEME.ink}` },
    outline: { background: "#fff", color: "#334155", border: `1px solid ${THEME.border}` },
    danger: { background: "#FFF1F2", color: "#BE123C", border: "1px solid #FFE0E6" },
    ghost: { background: "transparent", color: "#475569", border: "1px solid transparent" },
  };
  return <button className={`ui-btn-${variant} ${className}`.trim()} type={type} disabled={disabled} onClick={onClick} title={title} style={{
    minHeight: 36, padding: "8px 13px", borderRadius: 10, fontSize: 12.2, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: disabled ? .5 : 1, ...styles[variant], ...style
  }}>{children}</button>;
};
const Input = (props) => (
  <input {...props} className={`ui-field ${props.className || ""}`} style={{ minHeight: 38, padding: "8px 11px", borderRadius: 10, border: `1px solid ${THEME.border}`, fontSize: 12.5, width: "100%", color: THEME.text, ...props.style }} />
);
const Select = (props) => (
  <select {...props} className={`ui-field ${props.className || ""}`} style={{ minHeight: 38, padding: "8px 11px", borderRadius: 10, border: `1px solid ${THEME.border}`, fontSize: 12.5, width: "100%", color: THEME.text, ...props.style }} />
);
const Modal = ({ title, onClose, children, width = 440 }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,10,18,.58)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 220, padding: 14 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 17, width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: 20, border: `1px solid ${THEME.border}`, boxShadow: "0 30px 90px rgba(10,16,32,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <div><div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div><div style={{ width: 32, height: 3, borderRadius: 99, background: THEME.blue, marginTop: 7 }} /></div>
        <button onClick={onClose} style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "#F5F7FA", border: "1px solid #E8EBF0", borderRadius: 9, cursor: "pointer" }}><X size={15} /></button>
      </div>
      {children}
    </div>
  </div>
);
const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: { bg: "#F1F5F9", fg: "#526074" }, green: { bg: "#E9FBF6", fg: "#0F8B6D" },
    red: { bg: "#FFF0F2", fg: "#BE123C" }, amber: { bg: "#FFF6E7", fg: "#B76A0C" }, blue: { bg: "#EDF2FF", fg: "#3D63D8" },
  };
  const t = tones[tone];
  return <span style={{ display:"inline-flex", alignItems:"center", background:t.bg, color:t.fg, fontSize:9.8, fontWeight:800, padding:"4px 8px", borderRadius:7 }}>{children}</span>;
};

// ---------- Login ----------
function LoginScreen({ storeName }) {
  const [email, setEmail] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: p,
    });
    setSubmitting(false);
    if (error) {
      const msg = String(error.message || "");
      setErr(
        msg === "Invalid login credentials"
          ? "Email atau password salah."
          : msg.toLowerCase().includes("banned")
            ? "Akun ini sedang dinonaktifkan. Hubungi pemilik Dhell Cell."
            : msg
      );
    }
  };

  return (
    <div className="login-shell-v2">
      <section className="login-visual-v2">
        <div className="login-grid-art" />

        <div className="login-brand-v2">
          <div className="brand-mark"><Store size={20} /></div>
          <div className="login-brand-copy">
            <b>{storeName}</b>
            <span>Sistem Kasir Konter</span>
          </div>
        </div>

        <div className="login-hero-copy">
          <div className="login-status-pill">
            <span className="live-dot" />
            Cloud aktif • realtime tersambung
          </div>

          <h1>Satu sistem untuk seluruh operasional konter.</h1>
          <p>
            Kasir, stok, PPOB, keuangan, laporan, dan tim berada dalam satu
            workspace yang tersinkron otomatis.
          </p>

          <div className="login-feature-row">
            <span className="login-feature-chip">
              <Wifi size={13} /> Sinkron realtime
            </span>
            <span className="login-feature-chip">
              <ShieldCheck size={13} /> Hak akses pengguna
            </span>
            <span className="login-feature-chip">
              <CheckCircle2 size={13} /> Transaksi tercatat
            </span>
          </div>
        </div>

        <div className="login-preview">
          <div className="login-preview-top">
            <b>{storeName} • Ringkasan operasional</b>
            <span>Realtime</span>
          </div>
          <div className="login-preview-grid">
            <div className="login-preview-card primary">
              <span>Omzet hari ini</span>
              <b>Siap dipantau</b>
            </div>
            <div className="login-preview-card">
              <span>Stok</span>
              <b>Terhubung</b>
            </div>
            <div className="login-preview-card">
              <span>Cloud</span>
              <b>Aktif</b>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel-v2">
        <div className="login-card-v2">
          <div className="login-mobile-brand">
            <div className="brand-mark small"><Store size={16} /></div>
            <b>{storeName}</b>
          </div>

          <div className="login-card-heading">
            <span className="eyebrow">
              <span className="live-dot" /> AKSES SISTEM
            </span>
            <h2>Selamat datang kembali.</h2>
            <p>
              Masuk menggunakan akun pemilik atau karyawan yang sudah terdaftar.
            </p>
          </div>

          <div className="form-box">
            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: 13 }}
            >
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  placeholder="Masukkan password"
                />
              </Field>

              {err && (
                <div
                  style={{
                    padding: "10px 11px",
                    borderRadius: 10,
                    border: "1px solid #FFE0E6",
                    background: "#FFF1F2",
                    color: "#BE123C",
                    fontSize: 11.5,
                  }}
                >
                  {err}
                </div>
              )}

              <Btn
                className="login-submit-btn"
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  minHeight: 44,
                  background: "#4F7CFF",
                  borderColor: "#4F7CFF",
                }}
              >
                {submitting ? "Memproses…" : "Masuk ke Dhell Cell"}
              </Btn>
            </form>
          </div>

          <div className="login-security-note">
            <ShieldCheck size={12} />
            Sesi aman • data tersinkron otomatis
          </div>

          <div className="login-footer-v2">
            <span>Dhell Cell Cloud POS</span>
            <span>Owner & Karyawan</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ setPage, isMobile, showToast, currentUser }) {
  const [salesToday, setSalesToday] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const loadDashboard = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [todayRes, recentRes, productsRes, debtsRes] = await Promise.all([
      supabase
        .from("sales")
        .select("id, invoice_number, total_amount, total_profit, profit, payment_method, customer_name, cashier_name, created_at, status")
        .eq("status", "completed")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id, invoice_number, total_amount, payment_method, customer_name, cashier_name, created_at, status")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("products")
        .select("id, name, category, stock, minimum_stock")
        .order("name"),
      supabase
        .from("debts")
        .select("amount, paid, status")
        .eq("status", "belum lunas"),
    ]);

    if (todayRes.error) showToast("Gagal memuat dashboard penjualan: " + todayRes.error.message, "warn");
    if (recentRes.error) showToast("Gagal memuat transaksi terbaru: " + recentRes.error.message, "warn");
    if (productsRes.error) showToast("Gagal memuat stok dashboard: " + productsRes.error.message, "warn");

    const todayRows = todayRes.error ? [] : (todayRes.data || []);
    const recentRows = recentRes.error ? [] : (recentRes.data || []);
    const productRows = productsRes.error ? [] : (productsRes.data || []);

    let itemRows = [];
    if (recentRows.length > 0) {
      const { data: items, error: itemError } = await supabase
        .from("sale_items")
        .select("sale_id, product_name, quantity")
        .in("sale_id", recentRows.map((s) => s.id));
      if (!itemError) itemRows = items || [];
    }

    const itemMap = {};
    itemRows.forEach((it) => {
      if (!itemMap[it.sale_id]) itemMap[it.sale_id] = [];
      itemMap[it.sale_id].push({
        name: it.product_name,
        qty: Number(it.quantity) || 0,
      });
    });

    setSalesToday(todayRows);
    setRecentSales(recentRows.map((s) => ({
      ...s,
      items: itemMap[s.id] || [],
    })));
    setLowStock(productRows
      .filter((p) => p.category !== "pulsa" && Number(p.stock) <= Number(p.minimum_stock || 0))
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: Number(p.stock) || 0,
        minStock: Number(p.minimum_stock) || 0,
      }))
    );

    if (!debtsRes.error) {
      setTotalDebt((debtsRes.data || []).reduce(
        (sum, d) => sum + Math.max(Number(d.amount || 0) - Number(d.paid || 0), 0),
        0
      ));
    } else {
      // Cashier memang tidak punya akses tabel debts; jangan jadikan error dashboard.
      setTotalDebt(0);
    }

    setLoadingDashboard(false);
  };

  useEffect(() => {
    loadDashboard();

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, loadDashboard)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const omzetToday = salesToday.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const profitToday = salesToday.reduce(
    (a, s) => a + Number(s.profit ?? s.total_profit ?? 0),
    0
  );

  const stats = [
    { label: "Omzet Hari Ini", value: rupiah(omzetToday), icon: TrendingUp, tone: THEME.blue },
    { label: "Estimasi Profit Hari Ini", value: rupiah(profitToday), icon: Wallet, tone: "#0EA5E9" },
    { label: "Transaksi Hari Ini", value: salesToday.length, icon: ShoppingCart, tone: "#7C3AED" },
    { label: "Stok Menipis", value: lowStock.length, icon: AlertTriangle, tone: "#D97706" },
  ];

  if (loadingDashboard) return <div style={{ padding:30, textAlign:"center", color:THEME.muted }}>Memuat dashboard...</div>;

  return (
    <div>
      <PageTitle title={`Halo, ${currentUser.name.split(" ")[0]}`} subtitle="Ringkasan kondisi toko secara realtime" />

      <section className="dashboard-hero">
        <div style={{ position:"relative", zIndex:1 }}>
          <div className="hero-kicker">OMZET HARI INI</div>
          <div className="hero-main-value">{rupiah(omzetToday)}</div>
          <div className="hero-sub">{salesToday.length} transaksi tercatat hari ini</div>
          <div className="hero-actions">
            <button className="hero-action primary" onClick={()=>setPage("kasir")}><ShoppingCart size={14}/> Transaksi Baru</button>
            <button className="hero-action" onClick={()=>setPage("produk")}><Package size={14}/> Cek Stok</button>
            {currentUser.role === "owner" && <button className="hero-action" onClick={()=>setPage("laporan")}><BarChart3 size={14}/> Lihat Laporan</button>}
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-mini"><span>Profit hari ini</span><b>{rupiah(profitToday)}</b></div>
          <div className="hero-mini"><span>Stok menipis</span><b>{lowStock.length}</b></div>
          <div className="hero-mini"><span>Transaksi</span><b>{salesToday.length}</b></div>
          <div className="hero-mini"><span>Sinkronisasi</span><b style={{ color:"#63E6C9" }}>AKTIF</b></div>
        </div>
      </section>

      <div className="metric-strip">
        <div className="metric-tile">
          <div className="metric-icon"><TrendingUp size={17}/></div>
          <div className="metric-copy">
            <span>Rata-rata nilai transaksi</span>
            <b>{rupiah(salesToday.length ? omzetToday / salesToday.length : 0)}</b>
          </div>
        </div>
        <div className="metric-tile">
          <div className="metric-icon" style={{ color:"#0F9F7A", background:"#ECFBF6" }}><Wallet size={17}/></div>
          <div className="metric-copy">
            <span>Margin hari ini</span>
            <b>{omzetToday ? `${Math.round((profitToday/omzetToday)*100)}%` : "0%"}</b>
          </div>
        </div>
        <div className="metric-tile">
          <div className="metric-icon" style={{ color:"#B76A0C", background:"#FFF6E7" }}><AlertTriangle size={17}/></div>
          <div className="metric-copy">
            <span>Perlu perhatian</span>
            <b>{lowStock.length} produk</b>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "minmax(0,1.35fr) minmax(300px,.65fr)", gap:14 }}>
        <Card>
          <div className="panel-heading dashboard-panel-heading">
            <div>
              <b>Transaksi terbaru</b>
              <span style={{ display:"block", marginTop:3 }}>Riwayat penjualan terbaru dari seluruh perangkat</span>
            </div>
            <Btn variant="ghost" onClick={()=>setPage("kasir")}>Buka Kasir <ChevronRight size={13}/></Btn>
          </div>
          {recentSales.length === 0 ? <Empty text="Belum ada transaksi penjualan."/> : <>
            <div className="activity-grid-head"><span>Produk</span><span>Kasir & metode</span><span>Waktu</span><span>Total</span></div>
            {recentSales.map((sale)=>{
              const itemText=sale.items.length ? sale.items.map((i)=>`${i.name}${i.qty>1?` ×${i.qty}`:""}`).join(", ") : (sale.invoice_number || "Penjualan");
              const dt=new Date(sale.created_at);
              const paymentLabel=sale.payment_method==="cash"?"Tunai":sale.payment_method==="qris"?"QRIS":sale.payment_method==="transfer"?"Transfer":(sale.payment_method||"-");
              return <div className="transaction-row" key={sale.id}>
                <div className="tx-product-cell"><div className="tx-icon"><ShoppingCart size={15}/></div><div className="tx-product-copy"><b>{itemText}</b><small>{sale.invoice_number || "Transaksi penjualan"}</small></div></div>
                <div className="tx-meta-cell"><b>{sale.cashier_name || "Kasir"}</b><span>{paymentLabel}</span></div>
                <div className="tx-time-cell"><b>{formatDate(dt)}</b><span>{formatTime(dt)}</span></div>
                <div className="tx-value">{rupiah(Number(sale.total_amount||0))}</div>
              </div>;
            })}
          </>}
        </Card>

        <Card>
          <div className="panel-heading"><div><b>Pantauan stok</b><span style={{ display:"block", marginTop:3 }}>Produk yang sudah mendekati stok minimum</span></div><Package size={16} color="#7C8798"/></div>
          {lowStock.length===0 ? <Empty text="Semua stok aman."/> : <>
            <div className="stock-table-head"><span>Produk</span><span>Sisa</span><span>Kondisi</span></div>
            {lowStock.slice(0,7).map((p)=>{
              const ratio=Math.max(7,Math.min(100,(p.stock/Math.max(p.minStock,1))*50));
              return <div className="stock-row" key={p.id}><div className="stock-name">{p.name}</div><div className="stock-count">{p.stock}</div><div className="stock-meter"><span style={{ width:`${ratio}%` }}/></div></div>;
            })}
          </>}
          <Btn variant="outline" onClick={()=>setPage("produk")} style={{ width:"100%", marginTop:10 }}>Buka Stok <ChevronRight size={13}/></Btn>
          {currentUser.role==="owner" && totalDebt>0 && <div style={{ marginTop:10,padding:"10px 11px",borderRadius:10,background:"#FFF8EC",fontSize:10.8,color:"#94601B" }}>Piutang belum lunas: <b>{rupiah(totalDebt)}</b></div>}
        </Card>
      </div>
    </div>
  );
}
const Empty = ({ text }) => <div style={{ fontSize: 13, color: "#94A3B8", padding: "18px 0", textAlign: "center" }}>{text}</div>;

// ---------- Kasir (POS) ----------
function Kasir({ showToast, currentUser, storeInfo, isMobile }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("semua");
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const loadProducts = async () => {
    setLoadingProducts(true);
    const { data: rows, error } = await supabase.from("products").select("*").order("name");
    setLoadingProducts(false);
    if (error) { showToast("Gagal memuat produk: " + error.message, "warn"); return; }
    setProducts((rows || []).map(mapRowToProduct));
  };
  useEffect(() => { loadProducts(); }, []);
  const filtered = products.filter((p) => (cat === "semua" || p.category === cat) && (p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || "").toLowerCase().includes(query.toLowerCase())));
  const addToCart = (p) => {
    if (p.stock <= 0) { showToast("Stok produk habis.", "warn"); return; }
    setCart((c) => { const ex = c.find((x) => x.productId === p.id); if (ex) { if (ex.qty >= p.stock) { showToast("Jumlah melebihi stok tersedia.", "warn"); return c; } return c.map((x) => x.productId === p.id ? { ...x, qty: x.qty + 1, stock: p.stock } : x); } return [...c, { productId:p.id, name:p.name, price:p.price, qty:1, stock:p.stock }]; });
  };
  const changeQty = (id, delta) => setCart((c) => c.map((x) => { if (x.productId !== id) return x; const q=x.qty+delta; const latest=products.find((p)=>p.id===id); const available=latest?.stock ?? x.stock; if(q>available){showToast("Jumlah melebihi stok tersedia.","warn");return x;} return {...x,qty:q,stock:available}; }).filter((x)=>x.qty>0));
  const removeItem=(id)=>setCart((c)=>c.filter((x)=>x.productId!==id));
  const total=cart.reduce((a,x)=>a+x.price*x.qty,0);
  const checkout=async()=>{
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Transaksi belum diproses.", "warn");
      return;
    }
    if(cart.length===0){showToast("Keranjang masih kosong.","warn");return;}
    const paid=payment==="cash"?Number(paidAmount):total;
    if(payment==="cash"&&(!Number.isFinite(paid)||paid<total)){showToast("Uang tunai kurang dari total belanja.","warn");return;}
    setCheckoutLoading(true);
    const {data:result,error}=await supabase.rpc("create_sale",{p_items:cart.map((x)=>({product_id:x.productId,quantity:x.qty})),p_payment_method:payment,p_paid_amount:paid,p_customer_name:customer.trim()||null});
    setCheckoutLoading(false);
    if(error){showToast("Transaksi gagal: "+error.message,"warn");await loadProducts();return;}
    const saleResult=Array.isArray(result)?result[0]:result;
    const sale={id:saleResult.sale_id,invoiceNumber:saleResult.invoice_number,date:saleResult.created_at,items:cart.map((x)=>({...x})),total:Number(saleResult.total_amount),payment,paidAmount:Number(saleResult.paid_amount),changeAmount:Number(saleResult.change_amount),customer:customer||"Umum",cashier:currentUser.name};
    setReceipt(sale); setCart([]); setCustomer(""); setPaidAmount(""); showToast(`Transaksi berhasil • ${sale.invoiceNumber}`); await loadProducts();
  };

  const categories=[["semua","Semua"],...Object.entries(CATEGORY_LABEL)];
  const cashPaid = Number(paidAmount);
  const checkoutReady =
    cart.length > 0 &&
    (payment !== "cash" || (Number.isFinite(cashPaid) && cashPaid >= total));

  return (
    <div>
      <PageTitle title="Kasir" subtitle="Transaksi cepat dan praktis" right={<div style={{ fontSize:10.5,color:THEME.muted }}>{products.filter((p) => p.stock > 0).length} produk tersedia</div>} />
      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="pos-toolbar">
            <div style={{ position:"relative" }}><Search size={15} style={{ position:"absolute",left:11,top:12,color:"#9AA5B5" }}/><Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari produk atau SKU…" style={{ paddingLeft:34 }}/></div>
            <div className="category-chips">{categories.map(([k,l])=><button key={k} className={cat===k?"category-chip active":"category-chip"} onClick={()=>setCat(k)}>{l}</button>)}</div>
          </div>
          {loadingProducts ? <Empty text="Memuat produk…"/> : <div className="product-grid-v2">{filtered.length===0 && <Empty text="Produk tidak ditemukan."/>}{filtered.map((p)=><button className="product-card-v2" key={p.id} disabled={p.stock<=0} onClick={()=>addToCart(p)}><div className="product-thumb"><Package size={22}/></div><div className="product-name-v2">{p.name}</div><div className="product-meta-v2"><div className="product-price-v2">{rupiah(p.price)}</div><span className={p.stock<=p.minStock?"stock-pill low":"stock-pill"}>stok {p.stock}</span></div></button>)}</div>}
        </section>

        <aside className="pos-cart">
          <div className="cart-head"><div><b>Keranjang</b><span style={{ display:"block",marginTop:2 }}>{cart.length === 0 ? "0 produk" : `${cart.length} produk • ${cart.reduce((a,x)=>a+x.qty,0)} item`}</span></div><ShoppingCart size={18} color="#7187A8"/></div>
          <div className="cart-body">
            {cart.length===0 ? <div style={{ padding:"34px 6px",textAlign:"center",color:"#657A9A",fontSize:11.5 }}><ShoppingCart size={27} style={{ marginBottom:8,opacity:.55 }}/><div>Belum ada produk dipilih</div></div> : <div style={{ maxHeight:245,overflowY:"auto" }}>{cart.map((x)=><div className="cart-item-v2" key={x.productId}><div className="cart-item-main"><b>{x.name}</b><span>{rupiah(x.price)} × {x.qty}</span></div><div className="qty-control"><button onClick={()=>changeQty(x.productId,-1)}><Minus size={11}/></button><strong>{x.qty}</strong><button onClick={()=>changeQty(x.productId,1)}><Plus size={11}/></button><button onClick={()=>removeItem(x.productId)} style={{ color:"#FB7185" }}><Trash2 size={11}/></button></div></div>)}</div>}
            <div className="cart-form">
              <Input placeholder="Nama pelanggan (opsional)" value={customer} onChange={(e)=>setCustomer(e.target.value)} />
              <div className="payment-grid">{["cash","transfer","qris"].map((m)=><button key={m} className={payment===m?"payment-btn active":"payment-btn"} onClick={()=>setPayment(m)}>{paymentLabel(m)}</button>)}</div>
              {payment==="cash" && <Input type="number" min="0" placeholder="Uang diterima" value={paidAmount} onChange={(e)=>setPaidAmount(e.target.value)} />}
              <div className="cart-total-box"><div className="cart-total-line"><span>Total pembayaran</span><b>{rupiah(total)}</b></div>{payment==="cash"&&Number(paidAmount)>=total&&total>0&&<div className="cart-total-line" style={{ marginTop:8 }}><span>Kembalian</span><strong style={{ fontSize:11 }}>{rupiah(Number(paidAmount)-total)}</strong></div>}</div>
              <Btn className="checkout-btn" onClick={checkout} disabled={checkoutLoading || !checkoutReady} style={{ width:"100%",marginTop:10,background:"#fff",color:"#111827" }}>{checkoutLoading?"Memproses…":"Selesaikan Pembayaran"}</Btn>
            </div>
          </div>
        </aside>
      </div>
      {receipt && <ReceiptModal sale={receipt} storeInfo={storeInfo} onClose={()=>setReceipt(null)}/>} 
    </div>
  );
}
const miniBtn = { width: 22, height: 22, borderRadius: 6, border: "1px solid #D8DCE3", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function ReceiptModal({ sale, storeInfo, onClose }) {
  const storeMeta = [storeInfo.address, storeInfo.phone].filter(Boolean).join("\n");
  const text = `*${storeInfo.name}*\n${storeMeta ? `${storeMeta}\n` : ""}${formatDateTime(sale.date)}\nKasir: ${sale.cashier}\nPelanggan: ${sale.customer}\n\n` +
    sale.items.map((i) => `${i.name} x${i.qty} = ${rupiah(i.price * i.qty)}`).join("\n") +
    `\n\nInvoice: ${sale.invoiceNumber || sale.id}\nTOTAL: ${rupiah(sale.total)}\nMetode: ${paymentLabel(sale.payment)}${sale.payment === "cash" ? `\nTunai: ${rupiah(sale.paidAmount)}\nKembali: ${rupiah(sale.changeAmount)}` : ""}\n\nTerima kasih telah berbelanja!`;
  const waLink = "https://wa.me/?text=" + encodeURIComponent(text);
  return (
    <Modal title="Struk Transaksi" onClose={onClose} width={380}>
      <div id="receipt-print" style={{ fontFamily: "monospace", fontSize: 12.5, background: "#FAFAFA", border: "1px dashed #CBD5E1", borderRadius: 8, padding: 14, whiteSpace: "pre-wrap" }}>
        {text.replace(/\*/g, "")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={() => window.print()}><Printer size={14} /> Cetak</Btn>
        <a href={waLink} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
          <Btn style={{ width: "100%", justifyContent: "center" }}><Send size={14} /> Kirim WA</Btn>
        </a>
      </div>
    </Modal>
  );
}

// ---------- Produk & Stok ----------
// ---------- Produk & Stok (Supabase: products + stock_movements) ----------
const mapRowToProduct = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  sku: r.sku || "",
  price: Number(r.selling_price) || 0,
  cost: Number(r.purchase_price) || 0,
  stock: r.stock,
  minStock: r.minimum_stock,
  supplier: r.supplier || "",
  serial: r.serial || "",
  imei: r.imei || "",
});

function Produk({ role, showToast, isMobile }) {
  const [tab, setTab] = useState("produk");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // product or "new"
  const [stockModal, setStockModal] = useState(null); // {product, mode}
  const [products, setProducts] = useState(null);
  const [logs, setLogs] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const loadProducts = async () => {
    const { data: rows, error } = await supabase.from("products").select("*").order("name");
    if (error) { setLoadErr(error.message); return; }
    setLoadErr("");
    setProducts(rows.map(mapRowToProduct));
  };
  const loadLogs = async () => {
    const { data: rows, error } = await supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, before_stock, after_stock, note, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setLogs(rows);
  };
  useEffect(() => { loadProducts(); loadLogs(); }, []);

  const filtered = (products || []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || "").toLowerCase().includes(query.toLowerCase()));
  const productCount = (products || []).length;
  const lowCount = (products || []).filter((p) => p.category !== "pulsa" && Number(p.stock) <= Number(p.minStock || 0)).length;
  const inventoryValue = (products || []).reduce((sum, p) => sum + (Number(p.cost || 0) * Number(p.stock || 0)), 0);

  const saveProduct = async (f) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Produk belum disimpan.", "warn");
      return false;
    }
    const payload = {
      name: f.name,
      category: f.category,
      sku: f.sku?.trim() || null,
      selling_price: Number(f.price) || 0,
      purchase_price: Number(f.cost) || 0,
      minimum_stock: Number(f.minStock) || 0,
      supplier: f.supplier || null,
      serial: f.category === "perdana" ? (f.serial || null) : null,
      imei: f.category === "hp" ? (f.imei || null) : null,
    };
    if (f.id) {
      // Edit: stok TIDAK ikut diubah di sini — perubahan stok harus lewat
      // tombol Barang Masuk/Keluar supaya selalu tercatat di stock_movements.
      const { error } = await supabase.from("products").update(payload).eq("id", f.id);
      if (error) { showToast("Gagal menyimpan: " + error.message, "warn"); return false; }
    } else {
      const initialStock = Number(f.stock) || 0;
      const { data: inserted, error } = await supabase.from("products").insert(payload).select().single();
      if (error) { showToast("Gagal menyimpan: " + error.message, "warn"); return false; }
      if (initialStock > 0) {
        const { error: rpcErr } = await supabase.rpc("adjust_stock", {
          p_product_id: inserted.id, p_direction: "in", p_movement_type: "purchase",
          p_quantity: initialStock, p_note: "Stok awal saat produk dibuat",
        });
        if (rpcErr) showToast("Produk tersimpan, tapi stok awal gagal tercatat: " + rpcErr.message, "warn");
      }
    }
    setEditing(null);
    showToast("Produk tersimpan.");
    loadProducts(); loadLogs();
    return true;
  };

  const deleteProduct = async (id) => {
    const product = (products || []).find((p) => p.id === id);
    const confirmed = window.confirm(
      `Hapus ${product?.name || "produk ini"}? Produk hanya dapat dihapus jika belum memiliki riwayat stok/penjualan.`
    );
    if (!confirmed) return;
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Produk belum dihapus.", "warn");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      showToast(
        error.code === "23503"
          ? "Produk tidak bisa dihapus karena sudah punya riwayat stok."
          : "Gagal menghapus: " + error.message,
        "warn"
      );
      return;
    }
    showToast("Produk dihapus.");
    loadProducts();
  };

  const doStockMove = async (product, mode, movementType, qty, note) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Stok belum diperbarui.", "warn");
      return false;
    }
    qty = Number(qty);
    if (!qty || qty <= 0) { showToast("Jumlah harus lebih dari 0.", "warn"); return; }
    const { error } = await supabase.rpc("adjust_stock", {
      p_product_id: product.id, p_direction: mode, p_movement_type: movementType,
      p_quantity: qty, p_note: note || null,
    });
    if (error) { showToast("Gagal memperbarui stok: " + error.message, "warn"); return; }
    setStockModal(null);
    showToast("Stok diperbarui.");
    loadProducts(); loadLogs();
  };

  return (
    <div>
      <PageTitle title="Produk & Stok" subtitle="Kelola produk, stok, dan pergerakan barang" right={role==="owner"&&<Btn onClick={()=>setEditing("new")}><Plus size={14}/> Tambah Produk</Btn>} />
      {loadErr&&<div style={{ padding:"10px 12px",borderRadius:10,background:"#FFF1F2",color:"#BE123C",fontSize:11.5,marginBottom:12 }}>Gagal memuat: {loadErr}</div>}
      <div className="metric-strip" style={{ marginTop:0 }}>
        <div className="metric-tile"><div className="metric-icon"><Package size={17}/></div><div className="metric-copy"><span>Total produk</span><b>{productCount}</b></div></div>
        <div className="metric-tile"><div className="metric-icon" style={{color:"#B76A0C",background:"#FFF6E7"}}><AlertTriangle size={17}/></div><div className="metric-copy"><span>Stok menipis</span><b>{lowCount}</b></div></div>
        <div className="metric-tile"><div className="metric-icon" style={{color:"#0F8B6D",background:"#E9FBF6"}}><Wallet size={17}/></div><div className="metric-copy"><span>Nilai Persediaan</span><b>{rupiah(inventoryValue)}</b></div></div>
      </div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10,flexWrap:"wrap" }}>
        <div style={{ display:"inline-flex",padding:3,borderRadius:10,background:"#E9EDF3" }}>{[["produk","Daftar Produk"],["riwayat","Riwayat Stok"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{ border:"none",padding:"7px 11px",borderRadius:8,background:tab===k?"#fff":"transparent",boxShadow:tab===k?"0 2px 8px rgba(15,23,42,.06)":"none",fontSize:10.8,fontWeight:750,color:tab===k?"#111827":"#788598",cursor:"pointer" }}>{l}</button>)}</div>
        {tab==="produk"&&<div style={{ position:"relative",width:280,maxWidth:"100%" }}><Search size={14} style={{position:"absolute",left:10,top:12,color:"#A1ABBA"}}/><Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari produk / SKU…" style={{paddingLeft:31}}/></div>}
      </div>
      {tab==="produk" && (
        isMobile ? (
          <div className="mobile-card-list">
            {products===null&&!loadErr&&<Empty text="Memuat produk…"/>}
            {products&&filtered.length===0&&<Empty text="Belum ada produk."/>}
            {filtered.map((p)=>(
              <div className="inventory-mobile-card" key={p.id}>
                <div className="inventory-mobile-head">
                  <div className="inventory-mobile-icon"><Package size={16}/></div>
                  <div className="mobile-card-title">
                    <b>{p.name}</b>
                    <span>{p.sku || "Tanpa SKU"} • {p.supplier || "Tanpa supplier"}</span>
                  </div>
                  <Badge tone={p.stock<=p.minStock&&p.category!=="pulsa"?"amber":"green"}>Stok {p.stock}</Badge>
                </div>
                <div className="mobile-card-meta">
                  <div><span>Kategori</span><b>{CATEGORY_LABEL[p.category]}</b></div>
                  <div><span>Harga Jual</span><b>{rupiah(p.price)}</b></div>
                </div>
                {role==="owner" && (
                  <div className="mobile-card-actions">
                    <button onClick={()=>setStockModal({product:p,mode:"in"})} title="Barang masuk" style={iconBtn}><ArrowDownCircle size={14} color="#3D63D8"/></button>
                    <button onClick={()=>setStockModal({product:p,mode:"out"})} title="Barang keluar" style={iconBtn}><ArrowUpCircle size={14} color="#B76A0C"/></button>
                    <button onClick={()=>setEditing(p)} title="Edit produk" style={iconBtn}><Pencil size={13}/></button>
                    <button onClick={()=>deleteProduct(p.id)} title="Hapus produk" style={iconBtn}><Trash2 size={13} color="#BE123C"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table>
                <thead><tr style={{textAlign:"left",fontSize:10,color:"#7C8899",textTransform:"uppercase",letterSpacing:".05em"}}><th style={th}>Produk</th><th style={th}>Kategori</th><th style={th} className="num">Harga</th><th style={th} className="center">Stok</th><th style={th}>Supplier</th><th style={th} className="actions">Aksi</th></tr></thead>
                <tbody>{filtered.map((p)=><tr key={p.id} style={{fontSize:12}}><td style={td}><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:32,height:32,borderRadius:10,display:"grid",placeItems:"center",background:"#F0F4FA",color:"#7086A7"}}><Package size={15}/></div><div><b style={{fontSize:11.7}}>{p.name}</b><div style={{fontSize:9.8,color:"#9AA5B5",marginTop:2}}>{p.sku||"Tanpa SKU"}</div></div></div></td><td style={td}><Badge tone="blue">{CATEGORY_LABEL[p.category]}</Badge></td><td style={td} className="num"><b>{rupiah(p.price)}</b></td><td style={td} className="center"><Badge tone={p.stock<=p.minStock&&p.category!=="pulsa"?"amber":"green"}>{p.stock}</Badge></td><td style={{...td,maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.supplier||"-"}>{p.supplier||"-"}</td><td style={{...td,textAlign:"right",whiteSpace:"nowrap"}} className="actions">{role==="owner"&&<><button onClick={()=>setStockModal({product:p,mode:"in"})} title="Barang masuk" style={iconBtn}><ArrowDownCircle size={14} color="#3D63D8"/></button><button onClick={()=>setStockModal({product:p,mode:"out"})} title="Barang keluar" style={iconBtn}><ArrowUpCircle size={14} color="#B76A0C"/></button><button onClick={()=>setEditing(p)} title="Edit produk" style={iconBtn}><Pencil size={13}/></button><button onClick={()=>deleteProduct(p.id)} title="Hapus produk" style={iconBtn}><Trash2 size={13} color="#BE123C"/></button></>}</td></tr>)}</tbody>
              </table>
            </div>
            {products===null&&!loadErr&&<Empty text="Memuat produk…"/>}
            {products&&filtered.length===0&&<Empty text="Belum ada produk."/>}
          </Card>
        )
      )}
      {tab==="riwayat" && (
        isMobile ? (
          <div className="mobile-card-list">
            {logs===null&&<Empty text="Memuat riwayat…"/>}
            {logs&&logs.length===0&&<Empty text="Belum ada riwayat stok."/>}
            {(logs||[]).map((l)=>(
              <div className="stock-history-mobile-card" key={l.id}>
                <div className="history-top">
                  <div className="history-title">
                    <b>{l.products?.name || "-"}</b>
                    <span>{formatDateTime(l.created_at)}</span>
                  </div>
                  <Badge tone={["purchase","return"].includes(l.movement_type)?"green":"amber"}>{MOVEMENT_LABEL[l.movement_type]||l.movement_type}</Badge>
                </div>
                <div className="mobile-card-meta">
                  <div><span>Jumlah</span><b>{l.quantity}</b></div>
                  <div><span>Perubahan Stok</span><b>{l.before_stock} → {l.after_stock}</b></div>
                </div>
                {l.note && <div style={{marginTop:9,fontSize:10.5,color:"#718096",lineHeight:1.5}}>{l.note}</div>}
              </div>
            ))}
          </div>
        ) : (
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}><table><thead><tr style={{textAlign:"left",fontSize:10,color:"#7C8899",textTransform:"uppercase",letterSpacing:".05em"}}><th style={th}>Tanggal</th><th style={th}>Produk</th><th style={th}>Jenis</th><th style={th} className="center">Jumlah</th><th style={th} className="center">Sebelum → Sesudah</th><th style={th}>Catatan</th></tr></thead><tbody>{(logs||[]).map((l)=><tr key={l.id} style={{fontSize:12}}><td style={{...td,whiteSpace:"nowrap"}}>{formatDateTime(l.created_at)}</td><td style={td}><b>{l.products?.name||"-"}</b></td><td style={td}><Badge tone={["purchase","return"].includes(l.movement_type)?"green":"amber"}>{MOVEMENT_LABEL[l.movement_type]||l.movement_type}</Badge></td><td style={td} className="center">{l.quantity}</td><td style={td} className="center">{l.before_stock} → {l.after_stock}</td><td style={td}>{l.note||"-"}</td></tr>)}</tbody></table></div>
            {logs===null&&<Empty text="Memuat riwayat…"/>}
            {logs&&logs.length===0&&<Empty text="Belum ada riwayat stok."/>}
          </Card>
        )
      )}
      {editing&&<ProductModal product={editing==="new"?null:editing} onSave={saveProduct} onClose={()=>setEditing(null)}/>} 
      {stockModal&&<StockMoveModal {...stockModal} onSave={doStockMove} onClose={()=>setStockModal(null)}/>} 
    </div>
  );
}
const MOVEMENT_LABEL = { purchase: "Pembelian", return: "Retur", adjustment: "Penyesuaian", other: "Lainnya", sale: "Penjualan" };
const th = { padding: "10px 12px", fontWeight: 800 };
const td = { padding: "11px 12px", verticalAlign: "middle" };
const iconBtn = { background: "#F8FAFC", border: "1px solid #E6EAF0", borderRadius: 8, width: 29, height: 29, marginLeft: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };

function ProductModal({ product, onSave, onClose }) {
  const [f, setF] = useState(product || { name: "", category: "aksesoris", sku: "", price: "", cost: "", stock: "", minStock: 3, supplier: "", serial: "", imei: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const isEdit = !!product;
  const valid =
    f.name.trim().length > 0 &&
    Number(f.price) > 0 &&
    Number(f.cost) >= 0 &&
    Number(f.minStock) >= 0 &&
    (isEdit || Number(f.stock) >= 0);

  return (
    <Modal title={isEdit ? "Edit Produk" : "Tambah Produk"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Produk"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Kategori">
          <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div className="form-grid-2">
          <Field label="SKU / Kode Produk"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Supplier"><Input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} /></Field>
        </div>
        <div className="form-grid-2">
          <Field label="Harga Modal"><Input type="number" value={f.cost} onChange={(e) => set("cost", Number(e.target.value))} /></Field>
          <Field label="Harga Jual"><Input type="number" value={f.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
        </div>
        <div className="form-grid-2">
          <Field label={isEdit ? "Stok (ubah lewat Barang Masuk/Keluar)" : "Stok Awal"}>
            <Input type="number" value={f.stock} disabled={isEdit} onChange={(e) => set("stock", Number(e.target.value))}
              style={isEdit ? { background: "#F1F5F9", color: "#94A3B8" } : {}} />
          </Field>
          <Field label="Batas Stok Minimum"><Input type="number" value={f.minStock} onChange={(e) => set("minStock", Number(e.target.value))} /></Field>
        </div>
        {(f.category === "perdana" || f.category === "hp") && (
          <Field label={f.category === "perdana" ? "No. Serial Kartu (opsional)" : "No. IMEI (opsional)"}>
            <Input value={f.category === "perdana" ? f.serial : f.imei} onChange={(e) => set(f.category === "perdana" ? "serial" : "imei", e.target.value)} />
          </Field>
        )}
        <Btn
          disabled={!valid || saving}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            const ok = await onSave({
              ...f,
              name: f.name.trim(),
              price: Number(f.price) || 0,
              cost: Number(f.cost) || 0,
              stock: Number(f.stock) || 0,
              minStock: Number(f.minStock) || 0,
            });
            if (ok === false) setSaving(false);
          }}
          style={{ justifyContent: "center", marginTop: 6 }}
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </Btn>
      </div>
    </Modal>
  );
}
const Field = ({ label, children }) => (
  <div>
    <label style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".02em", color: "#607086", marginBottom: 5, display: "block", textAlign: "left" }}>
      {label}
    </label>
    {children}
  </div>
);

const IN_TYPES = [["purchase", "Pembelian / Restock"], ["return", "Retur dari pelanggan"], ["adjustment", "Penyesuaian stok"], ["other", "Lainnya"]];
const OUT_TYPES = [["adjustment", "Penyesuaian stok"], ["other", "Rusak / hilang / lainnya"]];

function StockMoveModal({ product, mode, onSave, onClose }) {
  const typeOptions = mode === "in" ? IN_TYPES : OUT_TYPES;
  const [movementType, setMovementType] = useState(typeOptions[0][0]);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await onSave(product, mode, movementType, qty, note);
    setSaving(false);
  };
  return (
    <Modal title={(mode === "in" ? "Barang Masuk" : "Barang Keluar") + " — " + product.name} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#64748B" }}>Stok saat ini: <b>{product.stock}</b></div>
        <Field label="Jenis">
          <Select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            {typeOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Jumlah"><Input type="number" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label={movementType === "adjustment" || movementType === "other" ? "Alasan koreksi" : "Catatan (opsional)"}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              movementType === "adjustment"
                ? "Contoh: Koreksi salah input stok 12 Agu"
                : mode === "in"
                  ? "Restock dari supplier"
                  : "Rusak / retur / lainnya"
            }
          />
        </Field>
        {(movementType === "adjustment" || movementType === "other") && (
          <div style={{fontSize:10.5,color:"#8A97A9",lineHeight:1.5}}>
            Koreksi stok wajib memiliki alasan agar riwayat tetap dapat diaudit.
          </div>
        )}
        <Btn
          onClick={submit}
          disabled={saving || Number(qty) <= 0 || ((movementType === "adjustment" || movementType === "other") && note.trim().length < 3)}
          style={{ justifyContent: "center" }}
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </Btn>
      </div>
    </Modal>
  );
}


function ReasonModal({
  title,
  description,
  confirmLabel = "Batalkan Transaksi",
  onConfirm,
  onClose,
  danger = true,
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3 || saving) return;
    setSaving(true);
    const ok = await onConfirm(reason.trim());
    setSaving(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal title={title} onClose={onClose} width={400}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {description && (
          <div className="operation-warning">
            <AlertTriangle size={16}/>
            <span>{description}</span>
          </div>
        )}
        <Field label="Alasan">
          <Input
            autoFocus
            value={reason}
            onChange={(e)=>setReason(e.target.value)}
            placeholder="Contoh: Salah input nominal"
          />
        </Field>
        <div style={{fontSize:10.5,color:"#8A97A9",lineHeight:1.55}}>
          Alasan disimpan sebagai audit trail dan dapat dilihat kembali pada riwayat.
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="outline" onClick={onClose} style={{flex:1}}>Kembali</Btn>
          <Btn
            variant={danger ? "danger" : "primary"}
            disabled={reason.trim().length < 3 || saving}
            onClick={submit}
            style={{flex:1}}
          >
            {saving ? "Memproses…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function DebtPaymentModal({ debt, onPay, onClose }) {
  const remaining = Math.max(Number(debt.amount || 0) - Number(debt.paid || 0), 0);
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  const [saving, setSaving] = useState(false);
  const numericAmount = Number(amount);
  const valid = numericAmount > 0 && numericAmount <= remaining;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onPay(debt.id, numericAmount);
    setSaving(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal title={`Pembayaran Piutang — ${debt.customer}`} onClose={onClose} width={400}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="payment-summary-box">
          <div><span>Total Piutang</span><b>{rupiah(Number(debt.amount || 0))}</b></div>
          <div><span>Sudah Dibayar</span><b>{rupiah(Number(debt.paid || 0))}</b></div>
          <div><span>Sisa</span><b>{rupiah(remaining)}</b></div>
        </div>
        <Field label="Jumlah Pembayaran">
          <Input
            type="number"
            min="1"
            max={remaining}
            value={amount}
            onChange={(e)=>setAmount(e.target.value)}
            placeholder="Rp0"
          />
        </Field>
        {numericAmount > remaining && (
          <div style={{fontSize:11,color:"#BE123C"}}>Pembayaran tidak boleh melebihi sisa piutang.</div>
        )}
        <Btn disabled={!valid || saving} onClick={submit}>
          {saving ? "Menyimpan…" : "Catat Pembayaran"}
        </Btn>
      </div>
    </Modal>
  );
}


// ---------- PPOB ----------
const PPOB_TYPES = [
  { key: "pulsa", label: "Pulsa / Paket Data", icon: Smartphone, fieldLabel: "Nomor HP", placeholder: "08xxxxxxxxxx", presets: [10000, 20000, 25000, 50000, 100000] },
  { key: "listrik", label: "Token Listrik (PLN)", icon: Zap, fieldLabel: "No. Meter / ID Pelanggan", placeholder: "Masukkan nomor meter / ID pelanggan", presets: [20000, 50000, 100000, 200000] },
  { key: "bpjs", label: "BPJS Kesehatan", icon: ShieldCheck, fieldLabel: "No. Peserta / Virtual Account", placeholder: "Masukkan nomor peserta / VA", presets: [] },
  { key: "pdam", label: "PDAM / Air", icon: Droplets, fieldLabel: "No. Pelanggan", placeholder: "Masukkan nomor pelanggan PDAM", presets: [] },
];

function Ppob({ showToast, currentUser, isMobile }) {
  const [type, setType] = useState("pulsa");
  const [target, setTarget] = useState("");
  const [nominal, setNominal] = useState("");
  const [fee, setFee] = useState(1500);
  const [transactions, setTransactions] = useState([]);
  const [loadingPpob, setLoadingPpob] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelTx, setCancelTx] = useState(null);
  const active = PPOB_TYPES.find((t) => t.key === type);
  const total = Number(nominal) > 0 ? Number(nominal) + (Number(fee) || 0) : 0;

  const loadPpob = async () => {
    const { data: rows, error } = await supabase
      .from("ppob_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) showToast("Gagal memuat transaksi PPOB: " + error.message, "warn");
    else setTransactions(rows || []);
    setLoadingPpob(false);
  };

  useEffect(() => {
    loadPpob();
    const channel = supabase
      .channel("ppob-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ppob_transactions" }, loadPpob)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const submit = async () => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Transaksi PPOB belum diproses.", "warn");
      return;
    }

    const cleanTarget = target.trim();
    const amount = Number(nominal);
    const adminFee = Number(fee);

    if (!cleanTarget || !amount) {
      showToast("Lengkapi nomor tujuan dan nominal.", "warn");
      return;
    }
    if (amount <= 0 || adminFee < 0) {
      showToast("Nominal harus lebih dari 0 dan biaya admin tidak boleh negatif.", "warn");
      return;
    }
    if (saving) return;

    setSaving(true);
    const { error } = await supabase.rpc("create_ppob_transaction", {
      p_service_type: type,
      p_target: cleanTarget,
      p_nominal: amount,
      p_fee: adminFee,
    });
    setSaving(false);

    if (error) {
      showToast("Transaksi PPOB gagal: " + error.message, "warn");
      return;
    }

    setTarget("");
    setNominal("");
    showToast("Transaksi PPOB tersimpan (simulasi).");
    await loadPpob();
  };

  const voidSimulation = async (reason) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembatalan belum diproses.", "warn");
      return false;
    }
    if (!cancelTx) return false;
    const { error } = await supabase.rpc("void_ppob_simulation", {
      p_ppob_id: cancelTx.id,
      p_reason: reason,
    });
    if (error) {
      showToast("Gagal membatalkan PPOB: " + error.message, "warn");
      return false;
    }
    showToast("Transaksi PPOB simulasi dibatalkan.");
    await loadPpob();
    return true;
  };

  const labelFor = (key) => PPOB_TYPES.find((x) => x.key === key)?.label || key;
  const statusTone = (status) =>
    status === "failed" ? "red" :
    status === "pending" ? "amber" :
    status === "voided" ? "slate" : "green";
  const statusLabel = (status) =>
    status === "simulation_success" ? "Simulasi berhasil" :
    status === "failed" ? "Gagal" :
    status === "pending" ? "Diproses" :
    status === "voided" ? "Dibatalkan" :
    status === "success" ? "Berhasil" : status;

  return (
    <div>
      <PageTitle title="PPOB" subtitle="Layanan digital dengan pencatatan transaksi realtime" />

      <div className="service-grid-v2">
        {PPOB_TYPES.map((svc)=>{
          const Icon=svc.icon;
          return (
            <button
              key={svc.key}
              className={type===svc.key?"service-card-v2 active":"service-card-v2"}
              onClick={()=>{setType(svc.key);setNominal("");}}
            >
              <span className="service-icon"><Icon size={17}/></span>
              <b>{svc.label}</b>
            </button>
          );
        })}
      </div>

      <div className="ppob-layout">
        <Card>
          <div className="panel-heading">
            <div>
              <b>Transaksi baru</b>
              <span style={{display:"block",marginTop:3}}>
                Provider belum terhubung • transaksi saat ini hanya simulasi
              </span>
            </div>
            <Badge tone="amber">SIMULASI</Badge>
          </div>

          <Field label={active.fieldLabel}>
            <Input value={target} onChange={(e)=>setTarget(e.target.value)} placeholder={active.placeholder}/>
          </Field>

          <div style={{height:10}}/>
          <Field label="Nominal">
            <Input type="number" min="1" value={nominal} onChange={(e)=>setNominal(e.target.value)} placeholder="Masukkan nominal"/>
          </Field>

          {active.presets.length>0 && (
            <div className="nominal-presets">
              {active.presets.map((n)=>(
                <button
                  key={n}
                  onClick={()=>setNominal(n)}
                  className={Number(nominal)===n ? "nominal-chip active" : "nominal-chip"}
                >
                  {rupiah(n)}
                </button>
              ))}
            </div>
          )}

          <div style={{height:10}}/>
          <Field label="Biaya Admin">
            <Input type="number" min="0" value={fee} onChange={(e)=>setFee(e.target.value)}/>
          </Field>

          <div className="dark-total-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
              <div>
                <span style={{fontSize:10.5,color:"#8196B5"}}>TOTAL BAYAR</span>
                <div style={{fontSize:10,color:"#657C9D",marginTop:3}}>Nominal + biaya admin</div>
              </div>
              <b style={{fontSize:24,letterSpacing:"-.03em",whiteSpace:"nowrap"}}>{rupiah(total)}</b>
            </div>
          </div>

          <Btn
            onClick={submit}
            disabled={saving || !target.trim() || Number(nominal) <= 0 || Number(fee) < 0}
            style={{width:"100%",marginTop:10}}
          >
            {saving?"Memproses…":"Proses Transaksi"}
          </Btn>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <b>Riwayat PPOB</b>
              <span style={{display:"block",marginTop:3}}>Sinkron dari seluruh perangkat</span>
            </div>
            <Smartphone size={16} color="#7C8798"/>
          </div>

          {loadingPpob ? <Empty text="Memuat transaksi…"/> : transactions.length === 0 ? <Empty text="Belum ada transaksi PPOB."/> : (
            <div className="ppob-history-wrap">
              <div className="ppob-history-head">
                <span></span><span>Layanan & tujuan</span><span>Waktu & operator</span><span>Total & status</span>
              </div>
              <div className="ppob-history-list">
                {transactions.slice(0,30).map((t) => {
                  const dt = new Date(t.created_at);
                  const cancelled = t.status === "voided";
                  return (
                    <div className={`ppob-history-row ${cancelled ? "is-voided" : ""}`} key={t.id}>
                      <div className="tx-icon"><Smartphone size={14}/></div>
                      <div className="ppob-service-cell">
                        <b>{labelFor(t.service_type)}</b>
                        <span>{t.target}</span>
                      </div>
                      <div className="ppob-meta-cell">
                        <b>{formatDate(dt)}</b>
                        <span>{formatTime(dt)} • {t.operator_name || currentUser.name}</span>
                      </div>
                      <div className="ppob-amount-cell">
                        <b>{rupiah(Number(t.total_amount||0))}</b>
                        <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>
                        {currentUser.role === "owner" && t.status === "simulation_success" && (
                          <button className="text-danger-action" onClick={()=>setCancelTx(t)}>
                            Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {cancelTx && (
        <ReasonModal
          title="Batalkan PPOB Simulasi"
          description={`Batalkan ${labelFor(cancelTx.service_type)} ke ${cancelTx.target}? Fee terkait juga akan dibatalkan dari Keuangan.`}
          confirmLabel="Batalkan PPOB"
          onConfirm={voidSimulation}
          onClose={()=>setCancelTx(null)}
        />
      )}
    </div>
  );
}

// ---------- Keuangan ----------
function Keuangan({ showToast, isMobile, currentUser }) {
  const [tab, setTab] = useState("kas");
  const [txModal, setTxModal] = useState(null); // "new" or transaction row
  const [debtModal, setDebtModal] = useState(null); // "new" or debt row
  const [paymentDebt, setPaymentDebt] = useState(null);
  const [cancelTx, setCancelTx] = useState(null);
  const [cancelDebt, setCancelDebt] = useState(null);
  const [undoPaymentTx, setUndoPaymentTx] = useState(null);
  const [financeTx, setFinanceTx] = useState([]);
  const [debts, setDebts] = useState([]);
  const [salesOmzet, setSalesOmzet] = useState(0);
  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinance = async () => {
    const [txRes, debtRes, salesRes] = await Promise.all([
      supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase.from("sales").select("total_amount,status").eq("status", "completed"),
    ]);

    if (txRes.error) showToast("Gagal memuat keuangan: " + txRes.error.message, "warn");
    if (debtRes.error) showToast("Gagal memuat piutang: " + debtRes.error.message, "warn");

    if (!txRes.error) setFinanceTx(txRes.data || []);
    if (!debtRes.error) setDebts(debtRes.data || []);
    if (!salesRes.error) {
      setSalesOmzet((salesRes.data || []).reduce((a, x) => a + Number(x.total_amount || 0), 0));
    }
    setLoadingFinance(false);
  };

  useEffect(() => {
    loadFinance();
    const channel = supabase.channel("finance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, loadFinance)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, loadFinance)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadFinance)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeFinanceTx = financeTx.filter((t) => !t.voided_at);
  const manualIncome = activeFinanceTx.filter((t) => t.type === "in").reduce((a, t) => a + Number(t.amount || 0), 0);
  const expense = activeFinanceTx.filter((t) => t.type === "out").reduce((a, t) => a + Number(t.amount || 0), 0);
  const operationalBalance = salesOmzet + manualIncome - expense;
  const activeDebtCount = debts.filter((d) => d.status === "belum lunas").length;

  const saveTx = async (tx) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Transaksi keuangan belum disimpan.", "warn");
      return false;
    }
    if (tx.id) {
      const { error } = await supabase.rpc("update_manual_finance_transaction", {
        p_tx_id: tx.id,
        p_type: tx.type,
        p_category: tx.category.trim(),
        p_amount: Number(tx.amount),
        p_note: tx.note?.trim() || null,
      });
      if (error) {
        showToast("Gagal memperbarui transaksi: " + error.message, "warn");
        return false;
      }
      setTxModal(null);
      showToast("Transaksi keuangan diperbarui.");
    } else {
      const { error } = await supabase.from("finance_transactions").insert({
        type: tx.type,
        category: tx.category.trim(),
        amount: Number(tx.amount),
        note: tx.note?.trim() || null,
        user_id: currentUser.id,
      });
      if (error) {
        showToast("Gagal menyimpan: " + error.message, "warn");
        return false;
      }
      setTxModal(null);
      showToast("Catatan keuangan ditambahkan.");
    }

    await loadFinance();
    return true;
  };

  const voidManualTx = async (reason) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembatalan transaksi belum diproses.", "warn");
      return false;
    }
    if (!cancelTx) return false;
    const { error } = await supabase.rpc("void_manual_finance_transaction", {
      p_tx_id: cancelTx.id,
      p_reason: reason,
    });
    if (error) {
      showToast("Gagal membatalkan transaksi: " + error.message, "warn");
      return false;
    }
    showToast("Transaksi keuangan dibatalkan.");
    await loadFinance();
    return true;
  };

  const addDebt = async (d) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Piutang belum disimpan.", "warn");
      return false;
    }
    const { error } = await supabase.from("debts").insert({
      customer: d.customer.trim(),
      amount: Number(d.amount),
      note: d.note?.trim() || null,
      created_by: currentUser.id,
    });
    if (error) {
      showToast("Gagal menyimpan piutang: " + error.message, "warn");
      return false;
    }
    setDebtModal(null);
    showToast("Piutang pelanggan ditambahkan.");
    await loadFinance();
    return true;
  };

  const updateDebt = async (d) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Perubahan piutang belum disimpan.", "warn");
      return false;
    }
    const { error } = await supabase.rpc("update_debt_operational", {
      p_debt_id: d.id,
      p_customer: d.customer.trim(),
      p_amount: Number(d.amount),
      p_note: d.note?.trim() || null,
    });
    if (error) {
      showToast("Gagal memperbarui piutang: " + error.message, "warn");
      return false;
    }
    setDebtModal(null);
    showToast("Piutang diperbarui.");
    await loadFinance();
    return true;
  };

  const saveDebt = async (d) => d.id ? updateDebt(d) : addDebt(d);

  const voidDebt = async (reason) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembatalan piutang belum diproses.", "warn");
      return false;
    }
    if (!cancelDebt) return false;
    const { error } = await supabase.rpc("void_debt_operational", {
      p_debt_id: cancelDebt.id,
      p_reason: reason,
    });
    if (error) {
      showToast("Gagal membatalkan piutang: " + error.message, "warn");
      return false;
    }
    showToast("Piutang dibatalkan.");
    await loadFinance();
    return true;
  };

  const payDebt = async (id, amount) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembayaran piutang belum diproses.", "warn");
      return false;
    }
    const { error } = await supabase.rpc("pay_debt", {
      p_debt_id: id,
      p_amount: Number(amount),
    });
    if (error) {
      showToast("Gagal mencatat pembayaran: " + error.message, "warn");
      return false;
    }
    showToast("Pembayaran piutang dicatat.");
    await loadFinance();
    return true;
  };

  const undoDebtPayment = async (reason) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembatalan pembayaran belum diproses.", "warn");
      return false;
    }
    if (!undoPaymentTx) return false;
    const { error } = await supabase.rpc("undo_debt_payment", {
      p_finance_tx_id: undoPaymentTx.id,
      p_reason: reason,
    });
    if (error) {
      showToast("Gagal membatalkan pembayaran: " + error.message, "warn");
      return false;
    }
    showToast("Pembayaran piutang berhasil dibatalkan.");
    await loadFinance();
    return true;
  };

  const sourceLabel = (t) =>
    t.reference_type === "ppob" ? "PPOB" :
    t.reference_type === "debt" ? "Piutang" :
    "Manual";

  const debtStatusLabel = (status) =>
    status === "lunas" ? "Lunas" :
    status === "dibatalkan" ? "Dibatalkan" :
    "Belum Lunas";

  if (loadingFinance) {
    return <div style={{padding:30,textAlign:"center",color:THEME.muted}}>Memuat keuangan...</div>;
  }

  const financeActions = (t) => {
    if (t.voided_at) return null;

    if (!t.reference_type) {
      return (
        <div className="row-actions">
          <button title="Edit transaksi" style={iconBtn} onClick={()=>setTxModal(t)}>
            <Pencil size={13}/>
          </button>
          <button title="Batalkan transaksi" style={iconBtn} onClick={()=>setCancelTx(t)}>
            <X size={13} color="#BE123C"/>
          </button>
        </div>
      );
    }

    if (t.reference_type === "debt") {
      return (
        <Btn
          variant="outline"
          style={{minHeight:30,padding:"5px 8px",fontSize:10.5}}
          onClick={()=>setUndoPaymentTx(t)}
        >
          Batalkan Pembayaran
        </Btn>
      );
    }

    return <span className="system-entry-label">Otomatis</span>;
  };

  return (
    <div>
      <PageTitle
        title="Keuangan"
        subtitle="Arus kas, pemasukan, pengeluaran, dan piutang"
        right={
          <div className="page-actions">
            <Btn variant="outline" onClick={()=>setDebtModal("new")}><Plus size={13}/> Tambah Piutang</Btn>
            <Btn onClick={()=>setTxModal("new")}><Plus size={13}/> Catat Transaksi</Btn>
          </div>
        }
      />

      <div className="finance-hero-v2">
        <div className="finance-balance-card">
          <div>
            <div className="hero-kicker">SALDO OPERASIONAL</div>
            <div className="value">{rupiah(operationalBalance)}</div>
          </div>
          <div className="finance-balance-breakdown">
            <span>Omzet penjualan {rupiah(salesOmzet)}</span>
            <span>+</span>
            <span>Arus kas lainnya {rupiah(manualIncome-expense)}</span>
          </div>
        </div>

        <div className="finance-side-grid">
          <div className="finance-mini-card"><span>Pemasukan lain</span><b style={{color:"#0F8B6D"}}>{rupiah(manualIncome)}</b></div>
          <div className="finance-mini-card"><span>Pengeluaran</span><b style={{color:"#BE123C"}}>{rupiah(expense)}</b></div>
          <div className="finance-mini-card"><span>Omzet penjualan</span><b>{rupiah(salesOmzet)}</b></div>
          <div className="finance-mini-card"><span>Piutang aktif</span><b>{activeDebtCount}</b></div>
        </div>
      </div>

      <div className="segmented-tabs">
        {[["kas","Riwayat Kas"],["piutang","Piutang"]].map(([k,l])=>(
          <button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "kas" && (
        <>
          <div className="section-note">
            Penjualan kasir dihitung otomatis dari data penjualan. Transaksi manual dapat diedit atau dibatalkan. Transaksi otomatis dikoreksi dari sumbernya agar data tetap konsisten.
          </div>

          {isMobile ? (
            <div className="mobile-card-list">
              {financeTx.length === 0 && <Empty text="Belum ada catatan keuangan."/>}
              {financeTx.map((t)=>(
                <div className={`finance-mobile-card ${t.voided_at ? "is-voided" : ""}`} key={t.id}>
                  <div className="finance-mobile-top">
                    <div className="mobile-card-title">
                      <b>{t.category}</b>
                      <span>{formatDateTime(t.created_at)} • {sourceLabel(t)}</span>
                    </div>
                    <div className={`money-value ${t.type === "in" ? "income" : "expense"}`}>
                      {t.type==="in"?"+":"-"}{rupiah(Number(t.amount))}
                    </div>
                  </div>

                  {t.note && <div className="mobile-note">{t.note}</div>}

                  <div className="mobile-card-footer">
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <Badge tone={t.type==="in"?"green":"red"}>{t.type==="in"?"Pemasukan":"Pengeluaran"}</Badge>
                      {t.voided_at && <Badge tone="slate">Dibatalkan</Badge>}
                    </div>
                    {financeActions(t)}
                  </div>

                  {t.voided_at && t.void_reason && (
                    <div className="void-reason">Alasan: {t.void_reason}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table>
                  <thead>
                    <tr style={{fontSize:10,color:"#7C8899",textTransform:"uppercase"}}>
                      <th style={th}>Tanggal</th>
                      <th style={th}>Kategori</th>
                      <th style={th}>Catatan</th>
                      <th style={th}>Sumber</th>
                      <th style={th}>Jenis</th>
                      <th style={th} className="num">Jumlah</th>
                      <th style={th}>Status</th>
                      <th style={th} className="actions">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeTx.map((t)=>(
                      <tr key={t.id} className={t.voided_at ? "is-voided" : ""} style={{fontSize:12}}>
                        <td style={{...td,whiteSpace:"nowrap"}}>{formatDateTime(t.created_at)}</td>
                        <td style={td}><b>{t.category}</b></td>
                        <td style={{...td,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.note||"-"}>{t.note||"-"}</td>
                        <td style={td}><Badge tone={t.reference_type ? "slate" : "blue"}>{sourceLabel(t)}</Badge></td>
                        <td style={td}><Badge tone={t.type==="in"?"green":"red"}>{t.type==="in"?"Masuk":"Keluar"}</Badge></td>
                        <td style={{...td,fontWeight:800,color:t.voided_at?"#94A3B8":t.type==="in"?"#0F8B6D":"#BE123C",whiteSpace:"nowrap"}} className="num">
                          {t.type==="in"?"+":"-"}{rupiah(Number(t.amount))}
                        </td>
                        <td style={td}>{t.voided_at ? <Badge tone="slate">Dibatalkan</Badge> : <Badge tone="green">Aktif</Badge>}</td>
                        <td style={td} className="actions">{financeActions(t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {financeTx.length===0&&<Empty text="Belum ada catatan keuangan."/>}
            </Card>
          )}
        </>
      )}

      {tab === "piutang" && (
        isMobile ? (
          <div className="mobile-card-list">
            {debts.length===0&&<Empty text="Belum ada piutang pelanggan."/>}
            {debts.map((d)=>{
              const remaining = Math.max(Number(d.amount||0)-Number(d.paid||0),0);
              const cancelled = d.status === "dibatalkan";
              return (
                <div className={`debt-mobile-card ${cancelled ? "is-voided" : ""}`} key={d.id}>
                  <div className="finance-mobile-top">
                    <div className="mobile-card-title">
                      <b>{d.customer}</b>
                      <span>{formatDate(d.created_at)}</span>
                    </div>
                    <Badge tone={d.status==="lunas"?"green":cancelled?"slate":"amber"}>{debtStatusLabel(d.status)}</Badge>
                  </div>

                  {d.note && <div className="mobile-note">{d.note}</div>}

                  <div className="debt-number-grid">
                    <div><span>Total</span><b>{rupiah(Number(d.amount||0))}</b></div>
                    <div><span>Terbayar</span><b>{rupiah(Number(d.paid||0))}</b></div>
                    <div><span>Sisa</span><b>{rupiah(remaining)}</b></div>
                  </div>

                  {!cancelled && (
                    <div className="mobile-card-actions">
                      {d.status!=="lunas" && <Btn onClick={()=>setPaymentDebt(d)} style={{minHeight:34}}>Bayar</Btn>}
                      <Btn variant="outline" onClick={()=>setDebtModal(d)} style={{minHeight:34}}>Edit</Btn>
                      {Number(d.paid||0)===0 && (
                        <Btn variant="danger" onClick={()=>setCancelDebt(d)} style={{minHeight:34}}>Batalkan</Btn>
                      )}
                    </div>
                  )}

                  {cancelled && d.void_reason && <div className="void-reason">Alasan: {d.void_reason}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table>
                <thead>
                  <tr style={{fontSize:10,color:"#7C8899",textTransform:"uppercase"}}>
                    <th style={th}>Pelanggan</th>
                    <th style={th} className="num">Total</th>
                    <th style={th} className="num">Terbayar</th>
                    <th style={th} className="num">Sisa</th>
                    <th style={th} className="center">Status</th>
                    <th style={th} className="actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d)=>{
                    const remaining = Math.max(Number(d.amount||0)-Number(d.paid||0),0);
                    const cancelled = d.status==="dibatalkan";
                    return (
                      <tr key={d.id} className={cancelled?"is-voided":""} style={{fontSize:12}}>
                        <td style={td}>
                          <b>{d.customer}</b>
                          <div style={{fontSize:9.8,color:"#9AA5B5",marginTop:2}}>{d.note || "-"}</div>
                        </td>
                        <td style={td} className="num">{rupiah(Number(d.amount))}</td>
                        <td style={td} className="num">{rupiah(Number(d.paid))}</td>
                        <td style={td} className="num"><b>{rupiah(remaining)}</b></td>
                        <td style={td} className="center">
                          <Badge tone={d.status==="lunas"?"green":cancelled?"slate":"amber"}>{debtStatusLabel(d.status)}</Badge>
                        </td>
                        <td style={td} className="actions">
                          {!cancelled && (
                            <div className="row-actions">
                              {d.status!=="lunas" && <Btn onClick={()=>setPaymentDebt(d)} style={{minHeight:30,padding:"5px 8px"}}>Bayar</Btn>}
                              <button title="Edit piutang" style={iconBtn} onClick={()=>setDebtModal(d)}><Pencil size={13}/></button>
                              {Number(d.paid||0)===0 && <button title="Batalkan piutang" style={iconBtn} onClick={()=>setCancelDebt(d)}><X size={13} color="#BE123C"/></button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {debts.length===0&&<Empty text="Belum ada piutang pelanggan."/>}
          </Card>
        )
      )}

      {txModal && (
        <TxModal
          transaction={txModal==="new" ? null : txModal}
          onSave={saveTx}
          onClose={()=>setTxModal(null)}
        />
      )}

      {debtModal && (
        <DebtModal
          debt={debtModal==="new" ? null : debtModal}
          onSave={saveDebt}
          onClose={()=>setDebtModal(null)}
        />
      )}

      {paymentDebt && (
        <DebtPaymentModal debt={paymentDebt} onPay={payDebt} onClose={()=>setPaymentDebt(null)}/>
      )}

      {cancelTx && (
        <ReasonModal
          title="Batalkan Transaksi Keuangan"
          description={`Transaksi ${cancelTx.category} sebesar ${rupiah(Number(cancelTx.amount))} akan dibatalkan, bukan dihapus permanen.`}
          onConfirm={voidManualTx}
          onClose={()=>setCancelTx(null)}
        />
      )}

      {cancelDebt && (
        <ReasonModal
          title="Batalkan Piutang"
          description={`Piutang ${cancelDebt.customer} akan ditandai dibatalkan. Tindakan ini hanya tersedia sebelum ada pembayaran.`}
          confirmLabel="Batalkan Piutang"
          onConfirm={voidDebt}
          onClose={()=>setCancelDebt(null)}
        />
      )}

      {undoPaymentTx && (
        <ReasonModal
          title="Batalkan Pembayaran Piutang"
          description={`Pembayaran ${rupiah(Number(undoPaymentTx.amount))} akan dibalik dan sisa piutang dihitung ulang secara otomatis.`}
          confirmLabel="Batalkan Pembayaran"
          onConfirm={undoDebtPayment}
          onClose={()=>setUndoPaymentTx(null)}
        />
      )}
    </div>
  );
}

function TxModal({ transaction, onSave, onClose }) {
  const [f, setF] = useState(transaction ? {
    id: transaction.id,
    type: transaction.type,
    category: transaction.category || "",
    amount: String(transaction.amount || ""),
    note: transaction.note || "",
  } : {
    type: "in",
    category: "",
    amount: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const valid = f.category.trim().length > 0 && Number(f.amount) > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave(f);
    setSaving(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal title={transaction ? "Edit Transaksi Keuangan" : "Catat Transaksi Keuangan"} onClose={onClose} width={400}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="transaction-type-toggle">
          {["in","out"].map((t)=>(
            <button key={t} className={f.type===t?"active":""} onClick={()=>setF({...f,type:t})}>
              {t==="in"?"Pemasukan":"Pengeluaran"}
            </button>
          ))}
        </div>
        <Field label="Kategori">
          <Input
            value={f.category}
            onChange={(e)=>setF({...f,category:e.target.value})}
            placeholder={f.type==="in"?"Contoh: Modal tambahan, pendapatan jasa":"Contoh: Sewa tempat, listrik toko"}
          />
        </Field>
        <Field label="Jumlah">
          <Input type="number" min="1" value={f.amount} onChange={(e)=>setF({...f,amount:e.target.value})} placeholder="Rp0"/>
        </Field>
        <Field label="Catatan">
          <Input value={f.note} onChange={(e)=>setF({...f,note:e.target.value})} placeholder="Opsional"/>
        </Field>
        <Btn disabled={!valid || saving} onClick={submit}>
          {saving ? "Menyimpan…" : transaction ? "Simpan Perubahan" : "Simpan Transaksi"}
        </Btn>
      </div>
    </Modal>
  );
}

function DebtModal({ debt, onSave, onClose }) {
  const [f, setF] = useState(debt ? {
    id: debt.id,
    customer: debt.customer || "",
    amount: String(debt.amount || ""),
    paid: Number(debt.paid || 0),
    note: debt.note || "",
  } : {
    customer:"",
    amount:"",
    paid:0,
    note:"",
  });
  const [saving, setSaving] = useState(false);
  const valid = f.customer.trim().length > 0 && Number(f.amount) > 0;
  const amountLocked = !!debt && Number(debt.paid||0) > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave(f);
    setSaving(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal title={debt ? "Edit Piutang Pelanggan" : "Tambah Piutang Pelanggan"} onClose={onClose} width={400}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Field label="Nama Pelanggan">
          <Input value={f.customer} onChange={(e)=>setF({...f,customer:e.target.value})}/>
        </Field>
        <Field label="Jumlah Piutang">
          <Input
            type="number"
            min="1"
            value={f.amount}
            disabled={amountLocked}
            onChange={(e)=>setF({...f,amount:e.target.value})}
            placeholder="Rp0"
            style={amountLocked?{background:"#F4F6F8",color:"#8490A2"}:{}}
          />
        </Field>
        {amountLocked && (
          <div style={{fontSize:10.5,color:"#8A97A9",lineHeight:1.5}}>
            Jumlah pokok dikunci karena piutang sudah memiliki pembayaran. Nama pelanggan dan catatan tetap dapat diperbaiki.
          </div>
        )}
        <Field label="Catatan">
          <Input
            value={f.note}
            onChange={(e)=>setF({...f,note:e.target.value})}
            placeholder="Contoh: Pembelian aksesoris belum dibayar"
          />
        </Field>
        <Btn disabled={!valid || saving} onClick={submit}>
          {saving ? "Menyimpan…" : debt ? "Simpan Perubahan" : "Simpan Piutang"}
        </Btn>
      </div>
    </Modal>
  );
}

// ---------- Laporan ----------
function Laporan({ isMobile, showToast, currentUser }) {
  const [range, setRange] = useState("7");
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [cancelSale, setCancelSale] = useState(null);
  const days = Number(range);

  const rangeStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  };

  const loadReport = async () => {
    setLoadingReport(true);
    const start = rangeStart();

    const salesRes = await supabase
      .from("sales")
      .select("id, invoice_number, customer_name, cashier_name, payment_method, total_amount, total_profit, profit, created_at, status, voided_at, void_reason")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true });

    if (salesRes.error) {
      showToast("Gagal memuat laporan penjualan: " + salesRes.error.message, "warn");
      setSales([]);
      setItems([]);
      setLoadingReport(false);
      return;
    }

    const saleRows = salesRes.data || [];
    let itemRows = [];

    if (saleRows.length > 0) {
      const itemRes = await supabase
        .from("sale_items")
        .select("sale_id, product_id, product_name, sku, quantity, purchase_price, selling_price, subtotal, profit, created_at")
        .in("sale_id", saleRows.map((s) => s.id))
        .order("created_at", { ascending: true });

      if (itemRes.error) {
        showToast("Gagal memuat item laporan: " + itemRes.error.message, "warn");
      } else {
        itemRows = itemRes.data || [];
      }
    }

    setSales(saleRows);
    setItems(itemRows);
    setLoadingReport(false);
  };

  useEffect(() => {
    loadReport();
  }, [range]);

  useEffect(() => {
    const channel = supabase
      .channel("report-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadReport)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items" }, loadReport)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [range]);

  const activeSales = sales.filter((s)=>s.status !== "voided");
  const activeSaleIds = new Set(activeSales.map((s)=>s.id));
  const activeItems = items.filter((it)=>activeSaleIds.has(it.sale_id));

  const omzet = activeSales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const profit = activeSales.reduce((a, s) => a + Number(s.profit ?? s.total_profit ?? 0), 0);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      map[localDateKey(d)] = 0;
    }

    activeSales.forEach((s) => {
      const key = localDateKey(s.created_at);
      if (key in map) map[key] += Number(s.total_amount || 0);
    });

    return Object.entries(map).map(([date, total]) => ({
      date: date.slice(5),
      total,
    }));
  }, [sales, days]);

  const topProducts = useMemo(() => {
    const map = {};
    activeItems.forEach((it) => {
      const name = it.product_name || "Produk";
      map[name] = (map[name] || 0) + Number(it.quantity || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }));
  }, [items, sales]);

  const COLORS = ["#2563EB", "#0EA5E9", "#7C3AED", "#D97706", "#DC2626", "#0D9488"];

  const csvCell = (value) => {
    const cellText = String(value ?? "");
    return `"${cellText.replaceAll('"', '""')}"`;
  };

  const exportCsv = () => {
    const saleMap = Object.fromEntries(sales.map((s) => [s.id, s]));
    const rows = [[
      "Tanggal",
      "Waktu",
      "Invoice",
      "Status",
      "Item",
      "SKU",
      "Qty",
      "Harga Jual",
      "Subtotal",
      "Profit Item",
      "Pembayaran",
      "Pelanggan",
      "Kasir",
      "Alasan Pembatalan",
    ]];

    items.forEach((it) => {
      const sale = saleMap[it.sale_id] || {};
      const occurredAt = sale.created_at || it.created_at;
      rows.push([
        formatDate(occurredAt),
        formatTime(occurredAt),
        sale.invoice_number || "",
        sale.status === "voided" ? "Dibatalkan" : "Selesai",
        it.product_name || "",
        it.sku || "",
        Number(it.quantity || 0),
        Number(it.selling_price || 0),
        Number(it.subtotal || 0),
        Number(it.profit || 0),
        paymentLabel(sale.payment_method),
        sale.customer_name || "Umum",
        sale.cashier_name || "",
        sale.void_reason || "",
      ]);
    });

    const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `laporan-penjualan-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const voidSale = async (reason) => {
    if (!isBrowserOnline()) {
      showToast("Tidak ada koneksi internet. Pembatalan penjualan belum diproses.", "warn");
      return false;
    }
    if (!cancelSale) return false;
    const { error } = await supabase.rpc("void_sale_operational", {
      p_sale_id: cancelSale.id,
      p_reason: reason,
    });
    if (error) {
      showToast("Gagal membatalkan penjualan: " + error.message, "warn");
      return false;
    }
    showToast("Penjualan dibatalkan dan stok dikembalikan.");
    await loadReport();
    return true;
  };

  if (loadingReport) {
    return <div style={{padding:30,textAlign:"center",color:THEME.muted}}>Memuat laporan...</div>;
  }

  const recentForAudit = [...sales].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  return (
    <div>
      <PageTitle
        title="Laporan & Analitik"
        subtitle="Ringkasan performa penjualan toko"
        right={
          <div className="page-actions report-actions">
            <Select value={range} onChange={(e)=>setRange(e.target.value)} style={{width:145}}>
              <option value="7">7 Hari</option>
              <option value="30">30 Hari</option>
              <option value="90">90 Hari</option>
            </Select>
            <Btn variant="outline" onClick={exportCsv} disabled={sales.length===0}>
              <Download size={13}/> {isMobile?"CSV":"Unduh CSV"}
            </Btn>
          </div>
        }
      />

      <div className="report-hero-v2">
        <div className="report-stat"><span>Total Omzet</span><b>{rupiah(omzet)}</b></div>
        <div className="report-stat"><span>Profit Kotor</span><b>{rupiah(profit)}</b></div>
        <div className="report-stat"><span>Jumlah Transaksi</span><b>{activeSales.length}</b></div>
      </div>

      <div className="report-grid-v2">
        <Card>
          <div className="panel-heading">
            <div><b>Tren omzet</b><span style={{display:"block",marginTop:3}}>Pergerakan omzet harian</span></div>
            <BarChart3 size={16} color="#7B8799"/>
          </div>
          <div className="report-chart-wrap">
            <ResponsiveContainer>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="4 4" stroke="#EEF1F5" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:isMobile?11:10,fill:"#8592A4"}} axisLine={false} tickLine={false} minTickGap={days>=90?28:days>=30?18:10}/>
                <YAxis tick={{fontSize:isMobile?11:10,fill:"#8592A4"}} axisLine={false} tickLine={false} width={isMobile?46:52} tickFormatter={(v)=>(v>=1000000?`${(v/1000000).toFixed(v%1000000?1:0)}jt`:v>=1000?`${Math.round(v/1000)}k`:v)}/>
                <Tooltip formatter={(v)=>rupiah(v)} labelFormatter={(label)=>`Tanggal ${label}`}/>
                <Bar dataKey="total" fill="#4F7CFF" radius={[7,7,2,2]} maxBarSize={34}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="panel-heading">
            <div><b>Produk terlaris</b><span style={{display:"block",marginTop:3}}>Berdasarkan jumlah terjual</span></div>
            <Package size={16} color="#7B8799"/>
          </div>
          {topProducts.length===0 ? <Empty text="Belum ada data penjualan."/> : (
            <>
              <div className="top-product-chart">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={topProducts} dataKey="qty" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3}>
                      {topProducts.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                {topProducts.map((p,i)=>(
                  <div className="top-product-row" key={p.name}>
                    <span style={{width:7,height:7,borderRadius:50,background:COLORS[i%COLORS.length],flexShrink:0}}/>
                    <span>{p.name}</span>
                    <b>{p.qty}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card style={{marginTop:14}}>
        <div className="panel-heading">
          <div>
            <b>Riwayat Penjualan</b>
            <span style={{display:"block",marginTop:3}}>
              Penjualan yang salah dibatalkan, bukan dihapus. Stok akan dikembalikan otomatis.
            </span>
          </div>
          <Badge tone="blue">{recentForAudit.length} transaksi</Badge>
        </div>

        {recentForAudit.length===0 ? <Empty text="Belum ada transaksi penjualan."/> : isMobile ? (
          <div className="mobile-card-list">
            {recentForAudit.map((sale)=>(
              <div className={`sale-audit-mobile-card ${sale.status==="voided"?"is-voided":""}`} key={sale.id}>
                <div className="finance-mobile-top">
                  <div className="mobile-card-title">
                    <b>{sale.invoice_number}</b>
                    <span>{formatDateTime(sale.created_at)} • {sale.cashier_name || "Kasir"}</span>
                  </div>
                  <b className="sale-total">{rupiah(Number(sale.total_amount||0))}</b>
                </div>
                <div className="mobile-card-footer">
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <Badge tone={sale.status==="voided"?"slate":"green"}>{sale.status==="voided"?"Dibatalkan":"Selesai"}</Badge>
                    <Badge tone="blue">{paymentLabel(sale.payment_method)}</Badge>
                  </div>
                  {sale.status!=="voided" && currentUser.role==="owner" && (
                    <Btn variant="danger" onClick={()=>setCancelSale(sale)} style={{minHeight:32,padding:"5px 9px"}}>
                      Batalkan
                    </Btn>
                  )}
                </div>
                {sale.void_reason && <div className="void-reason">Alasan: {sale.void_reason}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table>
              <thead>
                <tr style={{fontSize:10,color:"#7C8899",textTransform:"uppercase"}}>
                  <th style={th}>Tanggal</th>
                  <th style={th}>Invoice</th>
                  <th style={th}>Kasir</th>
                  <th style={th}>Pembayaran</th>
                  <th style={th} className="num">Total</th>
                  <th style={th}>Status</th>
                  <th style={th} className="actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentForAudit.map((sale)=>(
                  <tr key={sale.id} className={sale.status==="voided"?"is-voided":""} style={{fontSize:12}}>
                    <td style={{...td,whiteSpace:"nowrap"}}>{formatDateTime(sale.created_at)}</td>
                    <td style={td}><b>{sale.invoice_number}</b></td>
                    <td style={td}>{sale.cashier_name || "-"}</td>
                    <td style={td}><Badge tone="blue">{paymentLabel(sale.payment_method)}</Badge></td>
                    <td style={td} className="num"><b>{rupiah(Number(sale.total_amount||0))}</b></td>
                    <td style={td}><Badge tone={sale.status==="voided"?"slate":"green"}>{sale.status==="voided"?"Dibatalkan":"Selesai"}</Badge></td>
                    <td style={td} className="actions">
                      {sale.status!=="voided" && currentUser.role==="owner" && (
                        <Btn variant="danger" onClick={()=>setCancelSale(sale)} style={{minHeight:30,padding:"5px 8px"}}>
                          Batalkan
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cancelSale && (
        <ReasonModal
          title="Batalkan Penjualan"
          description={`Batalkan ${cancelSale.invoice_number} sebesar ${rupiah(Number(cancelSale.total_amount||0))}? Stok semua item akan dikembalikan otomatis.`}
          confirmLabel="Batalkan Penjualan"
          onConfirm={voidSale}
          onClose={()=>setCancelSale(null)}
        />
      )}
    </div>
  );
}

// ---------- Pengguna ----------
function Pengguna({ currentUser, showToast, isMobile }) {
  const [users, setUsers] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [modal, setModal] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [actionBusy, setActionBusy] = useState("");

  const loadUsers = async () => {
    setLoadErr("");
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, deactivated_at, deactivation_reason, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) setLoadErr(error.message);
    else setUsers(rows || []);
  };

  useEffect(() => {
    loadUsers();
    const channel = supabase
      .channel("profiles-admin-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        loadUsers,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const invokeAdminUsers = async (body) => {
    if (!isBrowserOnline()) {
      return { ok: false, error: "Tidak ada koneksi internet." };
    }
    const { data, error } = await supabase.functions.invoke("admin-users", { body });

    if (error) {
      let message = error.message || "Permintaan server gagal.";
      try {
        if (error.context?.json) {
          const payload = await error.context.json();
          if (payload?.error) message = payload.error;
        }
      } catch {
        // Keep original functions error.
      }
      return { ok: false, error: message };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: data?.error || "Respons server tidak valid",
        usage: data?.usage,
      };
    }

    return data;
  };

  const createEmployee = async (f) => {
    const result = await invokeAdminUsers({
      action: "create",
      email: f.email.trim().toLowerCase(),
      password: f.password,
      full_name: f.full_name.trim(),
    });

    if (!result.ok) {
      showToast("Gagal membuat akun: " + result.error, "warn");
      return false;
    }

    setCreateModal(false);
    showToast("Akun karyawan berhasil dibuat.");
    await loadUsers();
    return true;
  };

  const save = async (u) => {
    const original = (users || []).find((x) => x.id === u.id);

    if (
      u.id !== currentUser.id &&
      original?.role === "cashier" &&
      u.role === "owner"
    ) {
      const confirmed = window.confirm(
        `Jadikan ${u.full_name.trim() || "pengguna ini"} sebagai Pemilik? Akun ini akan mendapatkan akses penuh ke seluruh aplikasi.`,
      );
      if (!confirmed) return false;
    }

    const payload = { full_name: u.full_name.trim() };
    if (u.id !== currentUser.id) payload.role = u.role;

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", u.id);

    if (error) {
      showToast("Gagal menyimpan: " + error.message, "warn");
      return false;
    }

    setModal(null);
    showToast("Pengguna tersimpan.");
    await loadUsers();
    return true;
  };

  const setUserActive = async (user, active, reason = "") => {
    if (!user || user.id === currentUser.id) return false;
    const key = `${active ? "enable" : "disable"}-${user.id}`;
    setActionBusy(key);

    const result = await invokeAdminUsers({
      action: "set_active",
      user_id: user.id,
      active,
      reason,
    });

    setActionBusy("");

    if (!result.ok) {
      showToast(
        `${active ? "Gagal mengaktifkan" : "Gagal menonaktifkan"} akun: ${result.error}`,
        "warn",
      );
      return false;
    }

    showToast(
      active
        ? `Akun ${user.full_name} diaktifkan kembali.`
        : `Akun ${user.full_name} dinonaktifkan.`,
    );
    await loadUsers();
    return true;
  };

  const hardDeleteUser = async (user) => {
    if (!user || user.id === currentUser.id) return false;
    setActionBusy(`delete-${user.id}`);

    const result = await invokeAdminUsers({
      action: "delete",
      user_id: user.id,
    });

    setActionBusy("");

    if (!result.ok) {
      showToast("Akun tidak dapat dihapus: " + result.error, "warn");
      return false;
    }

    showToast(`Akun ${user.full_name} dihapus permanen.`);
    setDeleteUser(null);
    await loadUsers();
    return true;
  };

  const activeUsers = users ? users.filter((u) => u.is_active !== false) : [];
  const inactiveUsers = users ? users.filter((u) => u.is_active === false) : [];
  const activeOwners = users
    ? users.filter((u) => u.role === "owner" && u.is_active !== false)
    : [];

  const UserActions = ({ u, mobile = false }) => {
    const isSelf = u.id === currentUser.id;
    const busy =
      actionBusy === `enable-${u.id}` ||
      actionBusy === `disable-${u.id}` ||
      actionBusy === `delete-${u.id}`;

    if (isSelf) {
      return (
        <Btn
          variant="outline"
          onClick={() => setModal(u)}
          style={mobile ? { minHeight: 34 } : { minHeight: 30, padding: "5px 8px" }}
        >
          <Pencil size={12}/> Edit Profil
        </Btn>
      );
    }

    return (
      <div className={mobile ? "user-action-stack" : "row-actions"}>
        <Btn
          variant="outline"
          disabled={busy}
          onClick={() => setModal(u)}
          style={mobile ? { minHeight: 34 } : { minHeight: 30, padding: "5px 8px" }}
        >
          <Pencil size={12}/> Edit
        </Btn>

        {u.is_active === false ? (
          <>
            <Btn
              disabled={busy}
              onClick={() => setUserActive(u, true)}
              style={mobile ? { minHeight: 34 } : { minHeight: 30, padding: "5px 8px" }}
            >
              Aktifkan
            </Btn>

            {u.role === "cashier" && (
              <Btn
                variant="danger"
                disabled={busy}
                onClick={() => setDeleteUser(u)}
                style={mobile ? { minHeight: 34 } : { minHeight: 30, padding: "5px 8px" }}
              >
                Hapus
              </Btn>
            )}
          </>
        ) : (
          <Btn
            variant="outline"
            disabled={busy || (u.role === "owner" && activeOwners.length <= 1)}
            title={
              u.role === "owner" && activeOwners.length <= 1
                ? "Pemilik aktif terakhir tidak dapat dinonaktifkan"
                : "Nonaktifkan akun"
            }
            onClick={() => setDeactivateUser(u)}
            style={mobile ? { minHeight: 34 } : { minHeight: 30, padding: "5px 8px" }}
          >
            Nonaktifkan
          </Btn>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageTitle
        title="Pengguna & Hak Akses"
        subtitle="Kelola akun, status akses, dan keamanan pengguna"
        right={
          <Btn onClick={() => setCreateModal(true)}>
            <Plus size={15}/> Tambah Karyawan
          </Btn>
        }
      />

      <div className="user-summary-grid">
        <Card>
          <div className="summary-label">Total Pengguna</div>
          <div className="summary-value">{users?.length ?? "-"}</div>
        </Card>
        <Card>
          <div className="summary-label">Aktif</div>
          <div className="summary-value">{users ? activeUsers.length : "-"}</div>
        </Card>
        <Card>
          <div className="summary-label">Nonaktif</div>
          <div className="summary-value">{users ? inactiveUsers.length : "-"}</div>
        </Card>
        <Card>
          <div className="summary-label">Pemilik Aktif</div>
          <div className="summary-value">{users ? activeOwners.length : "-"}</div>
        </Card>
      </div>

      {isMobile ? (
        <div className="mobile-card-list">
          {loadErr && (
            <div className="inline-error">
              Gagal memuat pengguna: {loadErr}
            </div>
          )}
          {users === null && !loadErr && <Empty text="Memuat…"/>}
          {users && users.length === 0 && <Empty text="Belum ada pengguna."/>}

          {(users || []).map((u) => {
            const inactive = u.is_active === false;
            return (
              <div
                className={`user-mobile-card ${inactive ? "is-user-inactive" : ""}`}
                key={u.id}
              >
                <div className="user-mobile-head">
                  <div className="user-mobile-avatar">
                    {(u.full_name || "U").trim().slice(0,1).toUpperCase()}
                  </div>

                  <div className="mobile-card-title">
                    <b>
                      {u.full_name}
                      {u.id === currentUser.id ? " (Anda)" : ""}
                    </b>
                    <span>{u.email || "-"}</span>
                  </div>

                  <Badge tone={inactive ? "slate" : "green"}>
                    {inactive ? "Nonaktif" : "Aktif"}
                  </Badge>
                </div>

                <div className="user-role-row">
                  <Badge tone={u.role === "owner" ? "blue" : "slate"}>
                    {u.role === "owner" ? "Pemilik" : "Karyawan"}
                  </Badge>
                  {inactive && u.deactivated_at && (
                    <span>Sejak {formatDate(u.deactivated_at)}</span>
                  )}
                </div>

                <div className="mobile-card-meta">
                  <div>
                    <span>Bergabung</span>
                    <b>{u.created_at ? formatDate(u.created_at) : "-"}</b>
                  </div>
                  <div>
                    <span>Hak Akses</span>
                    <b>
                      {inactive
                        ? "Tidak dapat login"
                        : u.role === "owner"
                          ? "Penuh"
                          : "Operasional"}
                    </b>
                  </div>
                </div>

                {inactive && u.deactivation_reason && (
                  <div className="user-deactivation-reason">
                    Alasan nonaktif: {u.deactivation_reason}
                  </div>
                )}

                <div className="mobile-card-actions">
                  <UserActions u={u} mobile/>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {loadErr && (
            <div className="inline-error" style={{margin:14}}>
              Gagal memuat pengguna: {loadErr}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr style={{ textAlign:"left", fontSize:11.5, color:"#64748B", textTransform:"uppercase" }}>
                  <th style={th}>Pengguna</th>
                  <th style={th}>Peran</th>
                  <th style={th}>Status</th>
                  <th style={th}>Bergabung</th>
                  <th style={th} className="actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((u) => {
                  const inactive = u.is_active === false;
                  return (
                    <tr
                      key={u.id}
                      className={inactive ? "is-user-inactive" : ""}
                      style={{fontSize:12.5}}
                    >
                      <td style={td}>
                        <div style={{fontWeight:700}}>
                          {u.full_name}
                          {u.id === currentUser.id && (
                            <span style={{color:"#94A3B8",fontSize:10.5}}> (Anda)</span>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop:3,
                            maxWidth:280,
                            whiteSpace:"nowrap",
                            overflow:"hidden",
                            textOverflow:"ellipsis",
                            color:"#8A97A9",
                            fontSize:10.5,
                          }}
                          title={u.email || "-"}
                        >
                          {u.email || "-"}
                        </div>
                      </td>

                      <td style={td}>
                        <Badge tone={u.role === "owner" ? "blue" : "slate"}>
                          {u.role === "owner" ? "Pemilik" : "Karyawan"}
                        </Badge>
                      </td>

                      <td style={td}>
                        <Badge tone={inactive ? "slate" : "green"}>
                          {inactive ? "Nonaktif" : "Aktif"}
                        </Badge>
                        {inactive && u.deactivated_at && (
                          <div style={{marginTop:4,fontSize:9.5,color:"#94A3B8"}}>
                            {formatDate(u.deactivated_at)}
                          </div>
                        )}
                      </td>

                      <td style={{...td,whiteSpace:"nowrap"}}>
                        {u.created_at ? formatDate(u.created_at) : "-"}
                      </td>

                      <td style={td} className="actions">
                        <UserActions u={u}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {users === null && !loadErr && <Empty text="Memuat…"/>}
          {users && users.length === 0 && <Empty text="Belum ada pengguna."/>}
        </Card>
      )}

      <div className="access-info-card">
        <b>Nonaktifkan</b> untuk karyawan yang sudah tidak bekerja agar riwayat transaksi tetap tersimpan.
        <b> Hapus permanen</b> hanya tersedia untuk akun Karyawan yang sudah nonaktif dan belum pernah digunakan dalam transaksi operasional.
      </div>

      {createModal && (
        <CreateEmployeeModal
          onSave={createEmployee}
          onClose={() => setCreateModal(false)}
        />
      )}

      {modal && (
        <UserModal
          user={modal}
          isSelf={modal.id === currentUser.id}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}

      {deactivateUser && (
        <ReasonModal
          title="Nonaktifkan Pengguna"
          description={`Nonaktifkan akun ${deactivateUser.full_name}? Akun tidak dapat login atau melakukan transaksi, tetapi seluruh riwayat tetap tersimpan.`}
          confirmLabel="Nonaktifkan Akun"
          onConfirm={(reason) => setUserActive(deactivateUser, false, reason)}
          onClose={() => setDeactivateUser(null)}
        />
      )}

      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          busy={actionBusy === `delete-${deleteUser.id}`}
          onDelete={hardDeleteUser}
          onClose={() => setDeleteUser(null)}
        />
      )}
    </div>
  );
}

function CreateEmployeeModal({ onSave, onClose }) {
  const [f, setF] = useState({ full_name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!f.full_name.trim()) return;
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return;
    if (f.password.length < 8) return;
    setSaving(true);
    const ok = await onSave(f);
    if (!ok) setSaving(false);
  };
  return (
    <Modal title="Tambah Karyawan" onClose={onClose} width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Lengkap"><Input autoFocus value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="Nama karyawan" /></Field>
        <Field label="Email Login"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="karyawan@email.com" /></Field>
        <Field label="Password Awal"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Minimal 8 karakter" /></Field>
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 10, fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
          Akun baru otomatis dibuat sebagai <b>Karyawan</b>. Password awal dapat diberikan langsung kepada karyawan dan sebaiknya diganti setelah login pertama.
        </div>
        <Btn onClick={submit} disabled={saving || !f.full_name.trim() || !/^\S+@\S+\.\S+$/.test(f.email.trim()) || f.password.length < 8} style={{ justifyContent: "center" }}>
          {saving ? "Membuat akun…" : "Buat Akun Karyawan"}
        </Btn>
      </div>
    </Modal>
  );
}

function UserModal({ user, isSelf, onSave, onClose }) {
  const [f, setF] = useState({ id: user.id, full_name: user.full_name, role: user.role });
  return (
    <Modal title="Edit Pengguna" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Lengkap"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Peran">
          <Select disabled={isSelf} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="cashier">Karyawan</option>
            <option value="owner">Pemilik</option>
          </Select>
        </Field>
        {isSelf && <div style={{ fontSize: 12, color: "#64748B" }}>Peran akun Anda sendiri tidak dapat diubah dari form ini untuk mencegah kehilangan akses pemilik.</div>}
        <Btn disabled={!f.full_name.trim()} onClick={() => onSave(f)} style={{ justifyContent: "center" }}>Simpan</Btn>
      </div>
    </Modal>
  );
}


function DeleteUserModal({ user, busy, onDelete, onClose }) {
  const [confirmText, setConfirmText] = useState("");
  const ready = confirmText.trim().toUpperCase() === "HAPUS";

  return (
    <Modal title="Hapus Pengguna Permanen" onClose={onClose} width={420}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="danger-zone-box">
          <AlertTriangle size={17}/>
          <div>
            <b>Ini tindakan permanen.</b>
            <span>
              Akun <strong>{user.full_name}</strong> hanya akan dihapus jika belum memiliki riwayat penjualan, stok, PPOB, keuangan, atau piutang.
            </span>
          </div>
        </div>

        <div style={{fontSize:11.5,color:"#66758A",lineHeight:1.6}}>
          Jika akun pernah dipakai, sistem akan menolak penghapusan dan akun harus tetap disimpan dalam status <b>Nonaktif</b>.
        </div>

        <Field label='Ketik "HAPUS" untuk konfirmasi'>
          <Input
            autoFocus
            value={confirmText}
            onChange={(e)=>setConfirmText(e.target.value)}
            placeholder="HAPUS"
          />
        </Field>

        <div style={{display:"flex",gap:8}}>
          <Btn variant="outline" onClick={onClose} style={{flex:1}}>
            Kembali
          </Btn>
          <Btn
            variant="danger"
            disabled={!ready || busy}
            onClick={()=>onDelete(user)}
            style={{flex:1}}
          >
            {busy ? "Menghapus…" : "Hapus Permanen"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
