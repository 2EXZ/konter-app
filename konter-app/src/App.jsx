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

// ---------- helpers ----------
const rupiah = (n) =>
  "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const CATEGORY_LABEL = {
  aksesoris: "Aksesoris",
  perdana: "Kartu Perdana",
  pulsa: "Pulsa & Paket Data",
  hp: "Handphone / Unit",
};

const seedData = () => ({
  products: [
    { id: uid(), name: "Charger Type-C 25W", category: "aksesoris", sku: "AKS-001", price: 45000, cost: 28000, stock: 24, minStock: 5, supplier: "CV Sumber Jaya" },
    { id: uid(), name: "Kabel Data Micro USB", category: "aksesoris", sku: "AKS-002", price: 20000, cost: 12000, stock: 3, minStock: 5, supplier: "CV Sumber Jaya" },
    { id: uid(), name: "Headset Bluetooth TWS", category: "aksesoris", sku: "AKS-003", price: 85000, cost: 55000, stock: 10, minStock: 3, supplier: "Toko Aksesoris Pusat" },
    { id: uid(), name: "Tempered Glass Universal", category: "aksesoris", sku: "AKS-004", price: 15000, cost: 7000, stock: 40, minStock: 10, supplier: "Toko Aksesoris Pusat" },
    { id: uid(), name: "Kartu Perdana Telkomsel", category: "perdana", sku: "SIM-TSEL", price: 15000, cost: 8000, stock: 12, minStock: 5, supplier: "Distributor Telkomsel", serial: "TSEL-0001..0012" },
    { id: uid(), name: "Kartu Perdana XL", category: "perdana", sku: "SIM-XL", price: 12000, cost: 6000, stock: 2, minStock: 5, supplier: "Distributor XL", serial: "XL-0001..0002" },
    { id: uid(), name: "Pulsa Rp 20.000 (All Operator)", category: "pulsa", sku: "PLS-20", price: 21000, cost: 19500, stock: 999, minStock: 0, supplier: "Digiflazz" },
    { id: uid(), name: "Pulsa Rp 50.000 (All Operator)", category: "pulsa", sku: "PLS-50", price: 51500, cost: 49500, stock: 999, minStock: 0, supplier: "Digiflazz" },
  ],
  sales: [],
  financeTx: [],
  debts: [],
  ppobTx: [],
  stockLog: [],
  storeName: "Dhell Cell",
});

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Data operasional (produk/kasir/keuangan/dll) — SEMENTARA masih localStorage
  // (bukan Supabase) sambil menunggu Tahap 2/3 migrasi tabel products/sales/dst.
  // Sebelumnya kode ini memakai `window.storage`, API yang hanya ada di sandbox
  // artifact Claude.ai dan TIDAK ADA di browser sungguhan — itu sebabnya data
  // selalu reset ke seed setiap refresh saat sudah di-deploy. localStorage di
  // sini hanya menyelesaikan "hilang saat refresh di 1 device", BUKAN sinkron
  // multi-device (itu baru selesai setelah data pindah ke Supabase).
  const STORAGE_KEY = "konter-app-data";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
      else {
        const seed = seedData();
        setData(seed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      }
    } catch (e) {
      setData(seedData());
    }
    setLoading(false);
  }, []);

  // ===== SUPABASE AUTH SESSION =====
  useEffect(() => {
    const loadProfile = async (userId, email) => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && profile) {
        setCurrentUser({ id: profile.id, email, name: profile.full_name, role: profile.role });
      } else {
        // Profil belum ada (trigger belum sempat jalan / race condition) — jangan macet di loading.
        setCurrentUser({ id: userId, email, name: email, role: "cashier" });
      }
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
        (payload) => {
          setCurrentUser((prev) => prev ? {
            ...prev,
            name: payload.new.full_name ?? prev.name,
            role: payload.new.role ?? prev.role,
            email: payload.new.email ?? prev.email,
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

  const persist = async (next) => {
    setData(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (e) { showToast("Gagal menyimpan data ke penyimpanan lokal.", "warn"); }
  };

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading || authLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6F8", fontFamily: "Inter, sans-serif", color: "#334155" }}>
        Memuat aplikasi…
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen storeName={data.storeName} />;
  }

  const visibleNav = NAV.filter((n) => n.roles.includes(currentUser.role));

  const NavContent = () => (
    <>
      <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Store size={18} color="#FFFFFF" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.storeName}</div>
          <div style={{ fontSize: 11, color: "#7D8CA3" }}>Sistem Kasir Konter</div>
        </div>
        {isMobile && (
          <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 7, width: 28, height: 28, color: "#fff", cursor: "pointer", flexShrink: 0 }}>
            <X size={15} style={{ margin: "auto" }} />
          </button>
        )}
      </div>
      <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = page === n.key;
          return (
            <button key={n.key} onClick={() => { setPage(n.key); setDrawerOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8,
                border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 500,
                background: active ? "#2563EB" : "transparent", color: active ? "#FFFFFF" : "#CBD5E1",
                transition: "background .12s", textAlign: "left"
              }}>
              <Icon size={17} />
              {n.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 12.5, color: "#fff", fontWeight: 600 }}>{currentUser.name}</div>
        <div style={{ fontSize: 11, color: "#7D8CA3", marginBottom: 10, textTransform: "capitalize" }}>{currentUser.role}</div>
        <button onClick={() => supabase.auth.signOut({ scope: "local" })} style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#F0A0A0", background: "transparent",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "7px 10px", width: "100%", cursor: "pointer"
        }}>
          <LogOut size={14} /> Keluar
        </button>
      </div>
    </>
  );

  return (
    <div style={{ fontFamily: "Inter, ui-sans-serif, sans-serif", background: "#F4F5F7", minHeight: "100vh", color: "#1E2530", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
      <style>{globalCss}</style>

      {/* Mobile topbar */}
      {isMobile && (
        <div style={{ position: "sticky", top: 0, zIndex: 120, background: "#16233A", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="Buka menu" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <LayoutDashboard size={16} color="#fff" style={{ display: "none" }} />
            <span style={{ display: "block", width: 16 }}>
              <span style={{ display: "block", height: 2, background: "#fff", borderRadius: 2, marginBottom: 3 }} />
              <span style={{ display: "block", height: 2, background: "#fff", borderRadius: 2, marginBottom: 3 }} />
              <span style={{ display: "block", height: 2, background: "#fff", borderRadius: 2 }} />
            </span>
          </button>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Store size={15} color="#FFFFFF" />
          </div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.storeName}</div>
        </div>
      )}

      {/* Sidebar (desktop: static column, mobile: off-canvas drawer) */}
      {isMobile ? (
        <>
          {drawerOpen && (
            <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 140 }} />
          )}
          <aside style={{
            width: 250, background: "#16233A", color: "#CBD5E1", display: "flex", flexDirection: "column",
            position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 150,
            transform: drawerOpen ? "translateX(0)" : "translateX(-104%)", transition: "transform .22s ease"
          }}>
            <NavContent />
          </aside>
        </>
      ) : (
        <aside style={{ width: 232, background: "#16233A", color: "#CBD5E1", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
          <NavContent />
        </aside>
      )}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? "16px 14px 70px" : "22px 26px 60px", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        {page === "dashboard" && <Dashboard setPage={setPage} isMobile={isMobile} showToast={showToast} currentUser={currentUser} />}
        {page === "kasir" && <Kasir showToast={showToast} currentUser={currentUser} storeName={data.storeName} isMobile={isMobile} />}
        {page === "produk" && <Produk role={currentUser.role} showToast={showToast} />}
        {page === "ppob" && <Ppob showToast={showToast} currentUser={currentUser} isMobile={isMobile} />}
        {page === "keuangan" && <Keuangan showToast={showToast} isMobile={isMobile} currentUser={currentUser} />}
        {page === "laporan" && <Laporan isMobile={isMobile} showToast={showToast} />}
        {page === "pengguna" && <Pengguna currentUser={currentUser} showToast={showToast} />}
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: 18, left: isMobile ? 14 : "auto", right: isMobile ? 14 : 22,
          background: toast.type === "warn" ? "#B45309" : "#0F172A",
          color: "#fff", padding: "11px 16px", borderRadius: 9, fontSize: 13.5, boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          display: "flex", alignItems: "center", gap: 8, zIndex: 999, maxWidth: isMobile ? "none" : 340
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {toast.msg}
        </div>
      )}
    </div>
  );
}

const globalCss = `
  * { box-sizing: border-box; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #2563EB; outline-offset: 1px; }
  input, select { font-family: inherit; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; }
  body { -webkit-tap-highlight-color: transparent; }
  @media (max-width: 640px) {
    .page-title-row { flex-direction: column; align-items: stretch; }
    .page-title-row > *:last-child { width: 100%; }
    .page-title-row > *:last-child button, .page-title-row > *:last-child a { flex: 1; }
  }
`;

// ---------- shared UI bits ----------
const Card = ({ children, style }) => (
  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E7E9EE", padding: 18, ...style }}>{children}</div>
);
const PageTitle = ({ title, subtitle, right }) => (
  <div className="page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
    <div style={{ minWidth: 0 }}>
      <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "#0F172A" }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", style, type = "button", disabled, title }) => {
  const styles = {
    primary: { background: "#2563EB", color: "#fff" },
    outline: { background: "#fff", color: "#334155", border: "1px solid #D8DCE3" },
    danger: { background: "#FEE2E2", color: "#B91C1C" },
    ghost: { background: "transparent", color: "#334155" },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title} style={{
      padding: "9px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 7, opacity: disabled ? 0.55 : 1, ...styles[variant], ...style
    }}>{children}</button>
  );
};
const Input = (props) => (
  <input {...props} style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #D8DCE3", fontSize: 13.5, width: "100%", ...props.style }} />
);
const Select = (props) => (
  <select {...props} style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #D8DCE3", fontSize: 13.5, width: "100%", background: "#fff", ...props.style }} />
);
const Modal = ({ title, onClose, children, width = 440 }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{title}</div>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 7, padding: 5, cursor: "pointer" }}><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>
);
const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: { bg: "#F1F5F9", fg: "#475569" }, green: { bg: "#DCFCE7", fg: "#15803D" },
    red: { bg: "#FEE2E2", fg: "#B91C1C" }, amber: { bg: "#FEF3C7", fg: "#B45309" }, blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.fg, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{children}</span>;
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
      setErr(
        error.message === "Invalid login credentials"
          ? "Email atau password salah."
          : error.message
      );
    }
    // Sukses login: onAuthStateChange di App akan otomatis mengambil alih (set currentUser).
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F1B2E", fontFamily: "Inter, sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 34, width: 360, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{storeName}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>Masuk ke sistem kasir</div>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Email</label>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" style={{ marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Password</label>
            <Input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" style={{ marginTop: 5 }} />
          </div>
          {err && <div style={{ fontSize: 12.5, color: "#B91C1C" }}>{err}</div>}
          <Btn type="submit" disabled={submitting} style={{ justifyContent: "center", marginTop: 4 }}>
            {submitting ? "Memproses…" : "Masuk"}
          </Btn>
        </form>
      </div>
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
        .select("id, invoice_number, total_amount, total_profit, profit, payment_method, customer_name, cashier_name, created_at")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id, invoice_number, total_amount, payment_method, customer_name, cashier_name, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("products")
        .select("id, name, category, stock, minimum_stock")
        .order("name"),
      supabase
        .from("debts")
        .select("amount, paid, status")
        .neq("status", "lunas"),
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
    { label: "Omzet Hari Ini", value: rupiah(omzetToday), icon: TrendingUp, tone: "#2563EB" },
    { label: "Estimasi Profit Hari Ini", value: rupiah(profitToday), icon: Wallet, tone: "#0EA5E9" },
    { label: "Transaksi Hari Ini", value: salesToday.length, icon: ShoppingCart, tone: "#7C3AED" },
    { label: "Stok Menipis", value: lowStock.length, icon: AlertTriangle, tone: "#D97706" },
  ];

  if (loadingDashboard) {
    return <div style={{ padding: 30, textAlign: "center" }}>Memuat dashboard...</div>;
  }

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle={`Ringkasan operasional — ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        {stats.map((s, i) => (
          <Card key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.tone + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={17} color={s.tone} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Transaksi Terbaru</div>
          {recentSales.length === 0 ? <Empty text="Belum ada transaksi penjualan." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentSales.map((s) => {
                const itemText = s.items.length
                  ? s.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")
                  : (s.invoice_number || "Transaksi penjualan");
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 210 : 420 }}>{itemText}</div>
                      <div style={{ color: "#94A3B8", fontSize: 11.5 }}>
                        {new Date(s.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                        {" · "}{s.payment_method}
                        {s.cashier_name ? ` · ${s.cashier_name}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#2563EB", whiteSpace: "nowrap" }}>{rupiah(Number(s.total_amount || 0))}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <AlertTriangle size={15} color="#D97706" /> Stok Menipis
          </div>
          {lowStock.length === 0 ? <Empty text="Semua stok aman." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lowStock.slice(0, 8).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{p.name}</span>
                  <Badge tone="amber">{p.stock} tersisa</Badge>
                </div>
              ))}
            </div>
          )}

          <Btn variant="outline" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => setPage("produk")}>
            Kelola Stok <ChevronRight size={14} />
          </Btn>

          {currentUser.role === "owner" && totalDebt > 0 && (
            <div style={{ marginTop: 14, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 9, padding: 10, fontSize: 12.5 }}>
              Total piutang pelanggan belum lunas: <b>{rupiah(totalDebt)}</b>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
const Empty = ({ text }) => <div style={{ fontSize: 13, color: "#94A3B8", padding: "18px 0", textAlign: "center" }}>{text}</div>;

// ---------- Kasir (POS) ----------
function Kasir({ showToast, currentUser, storeName, isMobile }) {
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

  const filtered = products.filter((p) =>
    (cat === "semua" || p.category === cat) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || "").toLowerCase().includes(query.toLowerCase()))
  );

  const addToCart = (p) => {
    if (p.stock <= 0) { showToast("Stok produk habis.", "warn"); return; }
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id);
      if (ex) {
        if (ex.qty >= p.stock) { showToast("Jumlah melebihi stok tersedia.", "warn"); return c; }
        return c.map((x) => x.productId === p.id ? { ...x, qty: x.qty + 1, stock: p.stock } : x);
      }
      return [...c, { productId: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((c) => c.map((x) => {
      if (x.productId !== id) return x;
      const q = x.qty + delta;
      const latest = products.find((p) => p.id === id);
      const available = latest?.stock ?? x.stock;
      if (q > available) { showToast("Jumlah melebihi stok tersedia.", "warn"); return x; }
      return { ...x, qty: q, stock: available };
    }).filter((x) => x.qty > 0));
  };

  const removeItem = (id) => setCart((c) => c.filter((x) => x.productId !== id));
  const total = cart.reduce((a, x) => a + x.price * x.qty, 0);

  const checkout = async () => {
    if (cart.length === 0) { showToast("Keranjang masih kosong.", "warn"); return; }
    const paid = payment === "cash" ? Number(paidAmount) : total;
    if (payment === "cash" && (!Number.isFinite(paid) || paid < total)) {
      showToast("Uang tunai kurang dari total belanja.", "warn"); return;
    }

    setCheckoutLoading(true);
    const { data: result, error } = await supabase.rpc("create_sale", {
      p_items: cart.map((x) => ({ product_id: x.productId, quantity: x.qty })),
      p_payment_method: payment,
      p_paid_amount: paid,
      p_customer_name: customer.trim() || null,
    });
    setCheckoutLoading(false);

    if (error) {
      showToast("Transaksi gagal: " + error.message, "warn");
      await loadProducts();
      return;
    }

    const saleResult = Array.isArray(result) ? result[0] : result;
    const sale = {
      id: saleResult.sale_id,
      invoiceNumber: saleResult.invoice_number,
      date: saleResult.created_at,
      items: cart.map((x) => ({ ...x })),
      total: Number(saleResult.total_amount),
      payment,
      paidAmount: Number(saleResult.paid_amount),
      changeAmount: Number(saleResult.change_amount),
      customer: customer || "Umum",
      cashier: currentUser.name,
    };
    setReceipt(sale);
    setCart([]);
    setCustomer("");
    setPaidAmount("");
    showToast(`Transaksi berhasil • ${sale.invoiceNumber}`);
    await loadProducts();
  };

  return (
    <div>
      <PageTitle title="Kasir" subtitle="Input penjualan dan cetak struk" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#94A3B8" }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk / SKU…" style={{ paddingLeft: 32 }} />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: isMobile ? "100%" : 190 }}>
              <option value="semua">Semua Kategori</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {loadingProducts ? <Empty text="Memuat produk…" /> : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 128 : 150}px,1fr))`, gap: 10, maxHeight: isMobile ? 360 : 480, overflowY: "auto" }}>
              {filtered.length === 0 && <Empty text="Produk tidak ditemukan." />}
              {filtered.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} style={{
                  textAlign: "left", border: "1px solid #E7E9EE", borderRadius: 10, padding: 11, cursor: p.stock > 0 ? "pointer" : "not-allowed",
                  background: p.stock > 0 ? "#fff" : "#F8FAFC", opacity: p.stock > 0 ? 1 : 0.55
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, minHeight: 32 }}>{p.name}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#2563EB" }}>{rupiah(p.price)}</div>
                  <div style={{ fontSize: 11, color: p.stock <= p.minStock ? "#D97706" : "#94A3B8", marginTop: 3 }}>Stok: {p.stock}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card style={isMobile ? {} : { position: "sticky", top: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10 }}>Keranjang</div>
          {cart.length === 0 ? <Empty text="Belum ada item dipilih." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
              {cart.map((x) => (
                <div key={x.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>{rupiah(x.price)} × {x.qty}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <button onClick={() => changeQty(x.productId, -1)} style={miniBtn}><Minus size={12} /></button>
                    <span style={{ fontSize: 12.5, width: 18, textAlign: "center" }}>{x.qty}</span>
                    <button onClick={() => changeQty(x.productId, 1)} style={miniBtn}><Plus size={12} /></button>
                    <button onClick={() => removeItem(x.productId)} style={{ ...miniBtn, color: "#B91C1C" }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Input placeholder="Nama pelanggan (opsional)" value={customer} onChange={(e) => setCustomer(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Metode Pembayaran</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["cash", "transfer", "qris"].map((m) => (
                <button key={m} onClick={() => setPayment(m)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: payment === m ? "1.5px solid #2563EB" : "1px solid #D8DCE3", background: payment === m ? "#EFF6FF" : "#fff",
                  color: payment === m ? "#1D4ED8" : "#475569", textTransform: "capitalize"
                }}>{m}</button>
              ))}
            </div>
          </div>
          {payment === "cash" && (
            <Input type="number" min="0" placeholder="Uang diterima" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={{ marginBottom: 10 }} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, borderTop: "1px dashed #E2E8F0", paddingTop: 12, marginBottom: 12 }}>
            <span>Total</span><span style={{ color: "#2563EB" }}>{rupiah(total)}</span>
          </div>
          {payment === "cash" && Number(paidAmount) >= total && total > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: -5, marginBottom: 12, color: "#64748B" }}>
              <span>Estimasi kembalian</span><span>{rupiah(Number(paidAmount) - total)}</span>
            </div>
          )}
          <Btn onClick={checkout} disabled={checkoutLoading} style={{ width: "100%", justifyContent: "center" }}>
            {checkoutLoading ? "Memproses…" : "Proses Pembayaran"}
          </Btn>
        </Card>
      </div>

      {receipt && <ReceiptModal sale={receipt} storeName={storeName} onClose={() => setReceipt(null)} />}
    </div>
  );
}
const miniBtn = { width: 22, height: 22, borderRadius: 6, border: "1px solid #D8DCE3", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function ReceiptModal({ sale, storeName, onClose }) {
  const text = `*${storeName}*\n${new Date(sale.date).toLocaleString("id-ID")}\nKasir: ${sale.cashier}\nPelanggan: ${sale.customer}\n\n` +
    sale.items.map((i) => `${i.name} x${i.qty} = ${rupiah(i.price * i.qty)}`).join("\n") +
    `\n\nInvoice: ${sale.invoiceNumber || sale.id}\nTOTAL: ${rupiah(sale.total)}\nBayar: ${sale.payment}${sale.payment === "cash" ? `\nTunai: ${rupiah(sale.paidAmount)}\nKembali: ${rupiah(sale.changeAmount)}` : ""}\n\nTerima kasih telah berbelanja!`;
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

function Produk({ role, showToast }) {
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

  const filtered = (products || []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const saveProduct = async (f) => {
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
      if (error) { showToast("Gagal menyimpan: " + error.message, "warn"); return; }
    } else {
      const initialStock = Number(f.stock) || 0;
      const { data: inserted, error } = await supabase.from("products").insert(payload).select().single();
      if (error) { showToast("Gagal menyimpan: " + error.message, "warn"); return; }
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
  };

  const deleteProduct = async (id) => {
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
      <PageTitle title="Produk & Stok" subtitle="Kelola aksesoris, kartu perdana, pulsa, dan unit HP"
        right={role === "owner" && <Btn onClick={() => setEditing("new")}><Plus size={15} /> Tambah Produk</Btn>} />

      {loadErr && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 9, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>
          Gagal memuat produk dari server: {loadErr}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["produk", "Daftar Produk"], ["riwayat", "Riwayat Keluar Masuk"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: tab === k ? "1.5px solid #2563EB" : "1px solid #D8DCE3", background: tab === k ? "#EFF6FF" : "#fff",
            color: tab === k ? "#1D4ED8" : "#475569"
          }}>{l}</button>
        ))}
      </div>

      {tab === "produk" && (
        <Card>
          <div style={{ position: "relative", maxWidth: 320, marginBottom: 14 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#94A3B8" }} />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk / SKU…" style={{ paddingLeft: 32 }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                  <th style={th}>Produk</th><th style={th}>Kategori</th><th style={th}>Harga Jual</th>
                  <th style={th}>Stok</th><th style={th}>Supplier</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.sku}{p.serial ? " · " + p.serial : ""}</div>
                    </td>
                    <td style={td}><Badge tone="blue">{CATEGORY_LABEL[p.category]}</Badge></td>
                    <td style={td}>{rupiah(p.price)}</td>
                    <td style={td}>
                      <Badge tone={p.stock <= p.minStock && p.category !== "pulsa" ? "amber" : "green"}>{p.stock}</Badge>
                    </td>
                    <td style={td}>{p.supplier || "-"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {role === "owner" && <>
                        <button onClick={() => setStockModal({ product: p, mode: "in" })} title="Barang masuk" style={iconBtn}><ArrowDownCircle size={15} color="#2563EB" /></button>
                        <button onClick={() => setStockModal({ product: p, mode: "out" })} title="Barang keluar" style={iconBtn}><ArrowUpCircle size={15} color="#D97706" /></button>
                        <button onClick={() => setEditing(p)} title="Edit" style={iconBtn}><Pencil size={14} color="#334155" /></button>
                        <button onClick={() => deleteProduct(p.id)} title="Hapus" style={iconBtn}><Trash2 size={14} color="#B91C1C" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products === null && !loadErr && <Empty text="Memuat produk…" />}
            {products && filtered.length === 0 && <Empty text="Belum ada produk." />}
          </div>
        </Card>
      )}

      {tab === "riwayat" && (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                  <th style={th}>Tanggal</th><th style={th}>Produk</th><th style={th}>Jenis</th><th style={th}>Jumlah</th><th style={th}>Stok Sebelum→Sesudah</th><th style={th}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {(logs || []).map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{l.products?.name || "-"}</td>
                    <td style={td}><Badge tone={["purchase", "return"].includes(l.movement_type) ? "green" : "amber"}>{MOVEMENT_LABEL[l.movement_type] || l.movement_type}</Badge></td>
                    <td style={td}>{l.quantity}</td>
                    <td style={td}>{l.before_stock} → {l.after_stock}</td>
                    <td style={td}>{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs === null && <Empty text="Memuat riwayat…" />}
          {logs && logs.length === 0 && <Empty text="Belum ada riwayat stok." />}
        </Card>
      )}

      {editing && <ProductModal product={editing === "new" ? null : editing} onSave={saveProduct} onClose={() => setEditing(null)} />}
      {stockModal && <StockMoveModal {...stockModal} onSave={doStockMove} onClose={() => setStockModal(null)} />}
    </div>
  );
}
const MOVEMENT_LABEL = { purchase: "Pembelian", return: "Retur", adjustment: "Penyesuaian", other: "Lainnya", sale: "Penjualan" };
const th = { padding: "8px 10px" };
const td = { padding: "10px 10px", verticalAlign: "top" };
const iconBtn = { background: "#F8FAFC", border: "1px solid #E7E9EE", borderRadius: 6, width: 27, height: 27, marginLeft: 5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };

function ProductModal({ product, onSave, onClose }) {
  const [f, setF] = useState(product || { name: "", category: "aksesoris", sku: "", price: "", cost: "", stock: "", minStock: 3, supplier: "", serial: "", imei: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const isEdit = !!product;
  return (
    <Modal title={isEdit ? "Edit Produk" : "Tambah Produk"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Produk"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Kategori">
          <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="SKU / Barcode"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Supplier"><Input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Harga Modal"><Input type="number" value={f.cost} onChange={(e) => set("cost", Number(e.target.value))} /></Field>
          <Field label="Harga Jual"><Input type="number" value={f.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label={isEdit ? "Stok (ubah lewat Barang Masuk/Keluar)" : "Stok Awal"}>
            <Input type="number" value={f.stock} disabled={isEdit} onChange={(e) => set("stock", Number(e.target.value))}
              style={isEdit ? { background: "#F1F5F9", color: "#94A3B8" } : {}} />
          </Field>
          <Field label="Batas Stok Minim"><Input type="number" value={f.minStock} onChange={(e) => set("minStock", Number(e.target.value))} /></Field>
        </div>
        {(f.category === "perdana" || f.category === "hp") && (
          <Field label={f.category === "perdana" ? "No. Serial Kartu (opsional)" : "No. IMEI (opsional)"}>
            <Input value={f.category === "perdana" ? f.serial : f.imei} onChange={(e) => set(f.category === "perdana" ? "serial" : "imei", e.target.value)} />
          </Field>
        )}
        <Btn onClick={() => onSave({ ...f, price: Number(f.price) || 0, cost: Number(f.cost) || 0, stock: Number(f.stock) || 0, minStock: Number(f.minStock) || 0 })} style={{ justifyContent: "center", marginTop: 6 }}>Simpan</Btn>
      </div>
    </Modal>
  );
}
const Field = ({ label, children }) => (
  <div><label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>{label}</label>{children}</div>
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
        <Field label="Catatan (opsional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "in" ? "Restock dari supplier" : "Rusak / retur / lainnya"} /></Field>
        <Btn onClick={submit} disabled={saving} style={{ justifyContent: "center" }}>{saving ? "Menyimpan…" : "Simpan"}</Btn>
      </div>
    </Modal>
  );
}


// ---------- PPOB ----------
const PPOB_TYPES = [
  { key: "pulsa", label: "Pulsa / Paket Data", icon: Smartphone, placeholder: "08xxxxxxxxxx", presets: [10000, 20000, 25000, 50000, 100000] },
  { key: "listrik", label: "Token Listrik (PLN)", icon: Zap, placeholder: "No. Meter / ID Pelanggan", presets: [20000, 50000, 100000, 200000] },
  { key: "bpjs", label: "BPJS Kesehatan", icon: ShieldCheck, placeholder: "No. Virtual Account / Peserta", presets: [] },
  { key: "pdam", label: "PDAM / Air", icon: Droplets, placeholder: "No. Pelanggan PDAM", presets: [] },
];

function Ppob({ showToast, currentUser, isMobile }) {
  const [type, setType] = useState("pulsa");
  const [target, setTarget] = useState("");
  const [nominal, setNominal] = useState("");
  const [fee, setFee] = useState(1500);
  const [transactions, setTransactions] = useState([]);
  const [loadingPpob, setLoadingPpob] = useState(true);
  const [saving, setSaving] = useState(false);
  const active = PPOB_TYPES.find((t) => t.key === type);
  const total = (Number(nominal) || 0) + (Number(fee) || 0);

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
    const cleanTarget = target.trim();
    const amount = Number(nominal);
    const adminFee = Number(fee);

    if (!cleanTarget || !amount) {
      showToast("Lengkapi nomor tujuan dan nominal.", "warn");
      return;
    }
    if (amount <= 0 || adminFee < 0) {
      showToast("Nominal harus lebih dari 0 dan fee tidak boleh negatif.", "warn");
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

  const labelFor = (key) => PPOB_TYPES.find((x) => x.key === key)?.label || key;
  const statusTone = (status) => status === "failed" ? "red" : status === "pending" ? "amber" : "green";
  const statusLabel = (status) => status === "simulation_success" ? "Sukses (simulasi)" : status === "failed" ? "Gagal" : status === "pending" ? "Diproses" : status;

  return (
    <div>
      <PageTitle title="PPOB" subtitle="Top up pulsa, token listrik, BPJS, PDAM, dan tagihan lainnya" />
    <div
  style={{
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 12.5,
    color: "#9A5B0D",
    marginBottom: 16,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    lineHeight: 1.6,
  }}
>
  <AlertTriangle
    size={16}
    style={{
      marginTop: 2,
      flexShrink: 0,
    }}
  />

  <div style={{ flex: 1, minWidth: 0 }}>
    Modul PPOB sekarang{" "}
    <b>tersimpan dan sinkron lewat Supabase</b>, tetapi transaksi ke
    provider masih dalam mode <b>simulasi</b>. Integrasi provider nyata
    seperti Digiflazz/H2H membutuhkan credential server-side dan tidak
    boleh ditaruh di frontend.
  </div>
</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr", gap: 16 }}>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {PPOB_TYPES.map((t) => (
              <button key={t.key} onClick={() => { setType(t.key); setNominal(""); }} style={{
                display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "center" : "flex-start",
                gap: isMobile ? 10 : 8, padding: isMobile ? "10px 12px" : 12, borderRadius: 10, cursor: "pointer", width: "100%",
                border: type === t.key ? "1.5px solid #2563EB" : "1px solid #E7E9EE", background: type === t.key ? "#EFF6FF" : "#fff"
              }}>
                <t.icon size={18} color={type === t.key ? "#1D4ED8" : "#475569"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: type === t.key ? "#1D4ED8" : "#334155", textAlign: "left" }}>{t.label}</span>
              </button>
            ))}
          </div>
          <Field label={active.placeholder}><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={active.placeholder} /></Field>
          <div style={{ height: 10 }} />
          <Field label="Nominal">
            <Input type="number" min="1" value={nominal} onChange={(e) => setNominal(e.target.value)} placeholder="Masukkan nominal" />
          </Field>
          {active.presets.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {active.presets.map((n) => (
                <button key={n} onClick={() => setNominal(n)} style={{
                  padding: "6px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                  border: Number(nominal) === n ? "1.5px solid #2563EB" : "1px solid #D8DCE3", background: Number(nominal) === n ? "#EFF6FF" : "#fff"
                }}>{rupiah(n)}</button>
              ))}
            </div>
          )}
          <div style={{ height: 10 }} />
          <Field label="Biaya Admin (Fee)"><Input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: "1px dashed #E2E8F0", marginTop: 14, paddingTop: 12 }}>
            <span>Total Bayar</span><span style={{ color: "#2563EB" }}>{rupiah(total)}</span>
          </div>
          <Btn onClick={submit} disabled={saving} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
            {saving ? "Memproses…" : "Proses Transaksi"}
          </Btn>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Riwayat Transaksi PPOB</div>
          {loadingPpob ? <div style={{ padding: 18, textAlign: "center", color: "#64748B" }}>Memuat transaksi...</div> : transactions.length === 0 ? <Empty text="Belum ada transaksi PPOB." /> : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 460, overflowY: "auto" }}>
              {transactions.map((t) => (
                <div key={t.id} style={{ border: "1px solid #F1F5F9", borderRadius: 9, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{labelFor(t.service_type)}</div>
                    <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>{t.target}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: "#94A3B8" }}>{new Date(t.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                    <b>{rupiah(Number(t.total_amount || 0))}</b>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>Operator: {t.operator_name || currentUser.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ maxHeight: 460, overflowY: "auto", overflowX: "auto" }}>
              <table>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                    <th style={th}>Waktu</th><th style={th}>Layanan</th><th style={th}>Tujuan</th><th style={th}>Nominal</th><th style={th}>Fee</th><th style={th}>Total</th><th style={th}>Operator</th><th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 12.5 }}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(t.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{labelFor(t.service_type)}</td>
                      <td style={td}>{t.target}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(t.nominal || 0))}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(t.fee || 0))}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(t.total_amount || 0))}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{t.operator_name || "-"}</td>
                      <td style={td}><Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Keuangan ----------
function Keuangan({ showToast, isMobile, currentUser }) {
  const [tab, setTab] = useState("kas");
  const [txModal, setTxModal] = useState(false);
  const [debtModal, setDebtModal] = useState(false);
  const [financeTx, setFinanceTx] = useState([]);
  const [debts, setDebts] = useState([]);
  const [salesOmzet, setSalesOmzet] = useState(0);
  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinance = async () => {
    const [txRes, debtRes, salesRes] = await Promise.all([
      supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase.from("sales").select("total_amount"),
    ]);
    if (txRes.error) showToast("Gagal memuat keuangan: " + txRes.error.message, "warn");
    if (debtRes.error) showToast("Gagal memuat piutang: " + debtRes.error.message, "warn");
    if (!txRes.error) setFinanceTx(txRes.data || []);
    if (!debtRes.error) setDebts(debtRes.data || []);
    if (!salesRes.error) setSalesOmzet((salesRes.data || []).reduce((a, x) => a + Number(x.total_amount || 0), 0));
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

  const manualIncome = financeTx.filter((t) => t.type === "in").reduce((a, t) => a + Number(t.amount || 0), 0);
  const expense = financeTx.filter((t) => t.type === "out").reduce((a, t) => a + Number(t.amount || 0), 0);
  const operationalBalance = salesOmzet + manualIncome - expense;

  const addTx = async (tx) => {
    const { error } = await supabase.from("finance_transactions").insert({
      type: tx.type,
      category: tx.category.trim(),
      amount: Number(tx.amount),
      note: tx.note?.trim() || null,
      user_id: currentUser.id,
    });
    if (error) return showToast("Gagal menyimpan: " + error.message, "warn");
    setTxModal(false); showToast("Catatan keuangan ditambahkan.");
    await loadFinance();
  };
  const addDebt = async (d) => {
    const { error } = await supabase.from("debts").insert({
      customer: d.customer.trim(), amount: Number(d.amount), note: d.note?.trim() || null, created_by: currentUser.id
    });
    if (error) return showToast("Gagal menyimpan piutang: " + error.message, "warn");
    setDebtModal(false); showToast("Data utang-piutang ditambahkan.");
    await loadFinance();
  };
  const payDebt = async (id, amount) => {
    const { error } = await supabase.rpc("pay_debt", { p_debt_id: id, p_amount: Number(amount) });
    if (error) return showToast("Gagal mencatat pembayaran: " + error.message, "warn");
    showToast("Pembayaran dicatat.");
    await loadFinance();
  };

  if (loadingFinance) return <div style={{ padding: 30, textAlign: "center" }}>Memuat keuangan...</div>;

  return (
    <div>
      <PageTitle title="Keuangan" subtitle="Kas harian, omzet penjualan, dan utang-piutang pelanggan"
        right={<div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <Btn variant="outline" onClick={() => setDebtModal(true)} style={isMobile ? { flex: 1, justifyContent: "center" } : {}}><Plus size={14} /> Utang/Piutang</Btn>
          <Btn onClick={() => setTxModal(true)} style={isMobile ? { flex: 1, justifyContent: "center" } : {}}><Plus size={14} /> Catat Transaksi</Btn>
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Omzet Penjualan</div><div style={{ fontSize: 19, fontWeight: 700, color: "#2563EB" }}>{rupiah(salesOmzet)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Pemasukan Lain</div><div style={{ fontSize: 19, fontWeight: 700, color: "#1FAE7A" }}>{rupiah(manualIncome)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Total Pengeluaran</div><div style={{ fontSize: 19, fontWeight: 700, color: "#DC2626" }}>{rupiah(expense)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Saldo Operasional</div><div style={{ fontSize: 19, fontWeight: 700 }}>{rupiah(operationalBalance)}</div></Card>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["kas", "Kas & Ledger"], ["piutang", "Utang / Piutang"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: tab === k ? "1.5px solid #2563EB" : "1px solid #D8DCE3", background: tab === k ? "#EFF6FF" : "#fff",
            color: tab === k ? "#1D4ED8" : "#475569"
          }}>{l}</button>
        ))}
      </div>

      {tab === "kas" && (
        <Card>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>Penjualan kasir dihitung langsung dari tabel sales dan tidak diduplikasi sebagai pemasukan manual.</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                <th style={th}>Tanggal</th><th style={th}>Kategori</th><th style={th}>Catatan</th><th style={th}>Jenis</th><th style={th}>Jumlah</th>
              </tr></thead>
              <tbody>
                {financeTx.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(t.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={td}>{t.category}</td><td style={td}>{t.note || "-"}</td>
                    <td style={td}><Badge tone={t.type === "in" ? "green" : "red"}>{t.type === "in" ? "Masuk" : "Keluar"}</Badge></td>
                    <td style={{ ...td, fontWeight: 700, color: t.type === "in" ? "#1FAE7A" : "#DC2626", whiteSpace: "nowrap" }}>{t.type === "in" ? "+" : "-"}{rupiah(Number(t.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {financeTx.length === 0 && <Empty text="Belum ada catatan keuangan manual." />}
        </Card>
      )}

      {tab === "piutang" && (
        <Card><div style={{ overflowX: "auto" }}><table>
          <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
            <th style={th}>Pelanggan</th><th style={th}>Total</th><th style={th}>Terbayar</th><th style={th}>Sisa</th><th style={th}>Status</th><th style={th}></th>
          </tr></thead>
          <tbody>{debts.map((d) => (
            <tr key={d.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
              <td style={td}><div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{d.customer}</div><div style={{ fontSize: 11, color: "#94A3B8" }}>{d.note}</div></td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(d.amount))}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(d.paid))}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{rupiah(Number(d.amount) - Number(d.paid))}</td>
              <td style={td}><Badge tone={d.status === "lunas" ? "green" : "amber"}>{d.status}</Badge></td>
              <td style={td}>{d.status !== "lunas" && <Btn variant="outline" style={{ padding: "5px 9px", fontSize: 12, whiteSpace: "nowrap" }} onClick={() => {
                const remaining = Number(d.amount) - Number(d.paid);
                const amt = Number(prompt("Jumlah pembayaran:", remaining));
                if (amt > 0) payDebt(d.id, amt);
              }}>Bayar</Btn>}</td>
            </tr>
          ))}</tbody>
        </table></div>{debts.length === 0 && <Empty text="Belum ada data utang-piutang." />}</Card>
      )}

      {txModal && <TxModal onSave={addTx} onClose={() => setTxModal(false)} />}
      {debtModal && <DebtModal onSave={addDebt} onClose={() => setDebtModal(false)} />}
    </div>
  );
}
function TxModal({ onSave, onClose }) {
  const [f, setF] = useState({ type: "in", category: "", amount: "", note: "" });
  return <Modal title="Catat Transaksi Keuangan" onClose={onClose} width={380}><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", gap: 6 }}>{["in", "out"].map((t) => <button key={t} onClick={() => setF({ ...f, type: t })} style={{ flex:1,padding:"8px",borderRadius:8,fontSize:12.5,fontWeight:600,cursor:"pointer",border:f.type===t?"1.5px solid #2563EB":"1px solid #D8DCE3",background:f.type===t?"#EFF6FF":"#fff" }}>{t === "in" ? "Pemasukan" : "Pengeluaran"}</button>)}</div>
    <Field label="Kategori"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="mis. Sewa tempat, Listrik toko" /></Field>
    <Field label="Jumlah"><Input type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
    <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    <Btn onClick={() => f.category.trim() && Number(f.amount) > 0 && onSave(f)} style={{ justifyContent:"center" }}>Simpan</Btn>
  </div></Modal>;
}
function DebtModal({ onSave, onClose }) {
  const [f, setF] = useState({ customer: "", amount: "", note: "" });
  return <Modal title="Tambah Utang / Piutang Pelanggan" onClose={onClose} width={380}><div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    <Field label="Nama Pelanggan"><Input value={f.customer} onChange={(e) => setF({ ...f, customer:e.target.value })} /></Field>
    <Field label="Jumlah"><Input type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount:e.target.value })} /></Field>
    <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note:e.target.value })} placeholder="mis. Ambil barang belum bayar" /></Field>
    <Btn onClick={() => f.customer.trim() && Number(f.amount) > 0 && onSave(f)} style={{ justifyContent:"center" }}>Simpan</Btn>
  </div></Modal>;
}

// ---------- Laporan ----------
function Laporan({ isMobile, showToast }) {
  const [range, setRange] = useState("7");
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
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
      .select("id, invoice_number, customer_name, cashier_name, payment_method, total_amount, total_profit, profit, created_at")
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

  const omzet = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const profit = sales.reduce((a, s) => a + Number(s.profit ?? s.total_profit ?? 0), 0);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      map[key] = 0;
    }

    sales.forEach((s) => {
      const d = new Date(s.created_at);
      const key = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      if (key in map) map[key] += Number(s.total_amount || 0);
    });

    return Object.entries(map).map(([date, total]) => ({
      date: date.slice(5),
      total,
    }));
  }, [sales, days]);

  const topProducts = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const name = it.product_name || "Produk";
      map[name] = (map[name] || 0) + Number(it.quantity || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }));
  }, [items]);

  const COLORS = ["#2563EB", "#0EA5E9", "#7C3AED", "#D97706", "#DC2626", "#0D9488"];

  const csvCell = (value) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  const exportCsv = () => {
    const saleMap = Object.fromEntries(sales.map((s) => [s.id, s]));
    const rows = [[
      "Tanggal",
      "Invoice",
      "Item",
      "SKU",
      "Qty",
      "Harga Jual",
      "Subtotal",
      "Profit Item",
      "Pembayaran",
      "Pelanggan",
      "Kasir",
    ]];

    items.forEach((it) => {
      const sale = saleMap[it.sale_id] || {};
      rows.push([
        sale.created_at || it.created_at,
        sale.invoice_number || "",
        it.product_name || "",
        it.sku || "",
        Number(it.quantity || 0),
        Number(it.selling_price || 0),
        Number(it.subtotal || 0),
        Number(it.profit || 0),
        sale.payment_method || "",
        sale.customer_name || "Umum",
        sale.cashier_name || "",
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

  if (loadingReport) {
    return <div style={{ padding: 30, textAlign: "center" }}>Memuat laporan...</div>;
  }

  return (
    <div>
      <PageTitle title="Laporan & Analitik" subtitle="Data penjualan langsung dari Supabase"
        right={<div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <Select value={range} onChange={(e) => setRange(e.target.value)} style={{ width: isMobile ? "100%" : 150 }}>
            <option value="7">7 Hari Terakhir</option>
            <option value="30">30 Hari Terakhir</option>
            <option value="90">90 Hari Terakhir</option>
          </Select>
          <Btn variant="outline" onClick={exportCsv} disabled={sales.length === 0} style={isMobile ? { flexShrink: 0 } : {}}>
            <Download size={14} /> {isMobile ? "" : "Export CSV"}
          </Btn>
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Total Omzet</div><div style={{ fontSize: 19, fontWeight: 700 }}>{rupiah(omzet)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Profit Penjualan</div><div style={{ fontSize: 19, fontWeight: 700, color: "#1FAE7A" }}>{rupiah(profit)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Jumlah Transaksi</div><div style={{ fontSize: 19, fontWeight: 700 }}>{sales.length}</div></Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Grafik Omzet</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(v % 1000000 ? 1 : 0)}jt` : v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip formatter={(v) => rupiah(v)} />
                <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Produk Paling Laku</div>
          {topProducts.length === 0 ? <Empty text="Belum ada data penjualan." /> : (
            <>
              <div style={{ width: "100%", height: 220, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={topProducts} dataKey="qty" nameKey="name" innerRadius={45} outerRadius={75}>
                      {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topProducts.map((p, i) => (
                  <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    </span>
                    <b style={{ whiteSpace: "nowrap" }}>{p.qty} terjual</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Pengguna ----------
function Pengguna({ currentUser, showToast }) {
  const [users, setUsers] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [modal, setModal] = useState(null);
  const [createModal, setCreateModal] = useState(false);

  const loadUsers = async () => {
    setLoadErr("");
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at, updated_at")
      .order("created_at", { ascending: true });
    if (error) setLoadErr(error.message);
    else setUsers(rows || []);
  };

  useEffect(() => {
    loadUsers();
    const channel = supabase
      .channel("profiles-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadUsers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createEmployee = async (f) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "create",
        email: f.email.trim().toLowerCase(),
        password: f.password,
        full_name: f.full_name.trim(),
      },
    });

    if (error) {
      showToast("Gagal membuat akun: " + error.message, "warn");
      return false;
    }
    if (!data?.ok) {
      showToast("Gagal membuat akun: " + (data?.error || "Respons server tidak valid"), "warn");
      return false;
    }

    setCreateModal(false);
    showToast("Akun karyawan berhasil dibuat.");
    await loadUsers();
    return true;
  };

  const save = async (u) => {
    const payload = { full_name: u.full_name.trim() };
    if (u.id !== currentUser.id) payload.role = u.role;

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", u.id);
    if (error) { showToast("Gagal menyimpan: " + error.message, "warn"); return; }
    setModal(null);
    showToast("Pengguna tersimpan.");
    await loadUsers();
  };

  return (
    <div>
      <PageTitle
        title="Pengguna & Hak Akses"
        subtitle="Kelola akun owner dan karyawan"
        right={<Btn onClick={() => setCreateModal(true)}><Plus size={15} /> Tambah Karyawan</Btn>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 14 }}>
        <Card>
          <div style={{ fontSize: 12, color: "#64748B" }}>Total Pengguna</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{users?.length ?? "-"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "#64748B" }}>Owner</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{users ? users.filter((u) => u.role === "owner").length : "-"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "#64748B" }}>Karyawan / Kasir</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{users ? users.filter((u) => u.role === "cashier").length : "-"}</div>
        </Card>
      </div>

      <Card>
        {loadErr && <div style={{ fontSize: 12.5, color: "#B91C1C", marginBottom: 10 }}>Gagal memuat pengguna: {loadErr}</div>}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
              <th style={th}>Nama</th><th style={th}>Email</th><th style={th}>Peran</th><th style={th}>Bergabung</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {(users || []).map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 600 }}>{u.full_name}{u.id === currentUser.id && <span style={{ color: "#94A3B8", fontSize: 11 }}> (Anda)</span>}</div>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: "#64748B" }}>{u.email || "-"}</td>
                  <td style={td}><Badge tone={u.role === "owner" ? "blue" : "slate"}>{u.role === "owner" ? "Owner" : "Karyawan"}</Badge></td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "-"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setModal(u)} title="Edit pengguna" style={iconBtn}><Pencil size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users === null && !loadErr && <Empty text="Memuat…" />}
        {users && users.length === 0 && <Empty text="Belum ada pengguna." />}
      </Card>

      <div style={{ marginTop: 14, fontSize: 12.5, color: "#64748B", lineHeight: 1.65 }}>
        <b>Owner</b> memiliki akses penuh. <b>Karyawan</b> dapat membuka Dashboard, Kasir, Produk & Stok dalam mode lihat, serta PPOB.
        Keuangan, Laporan, Pengguna, perubahan produk, dan perubahan stok tetap dilindungi oleh hak akses database (RLS), bukan sekadar disembunyikan dari menu.
      </div>

      {createModal && <CreateEmployeeModal onSave={createEmployee} onClose={() => setCreateModal(false)} />}
      {modal && <UserModal user={modal} isSelf={modal.id === currentUser.id} onSave={save} onClose={() => setModal(null)} />}
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
            <option value="owner">Owner</option>
          </Select>
        </Field>
        {isSelf && <div style={{ fontSize: 12, color: "#64748B" }}>Peran akun Anda sendiri tidak dapat diubah dari form ini untuk mencegah kehilangan akses owner.</div>}
        <Btn onClick={() => f.full_name.trim() && onSave(f)} style={{ justifyContent: "center" }}>Simpan</Btn>
      </div>
    </Modal>
  );
}
