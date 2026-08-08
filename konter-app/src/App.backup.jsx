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
  users: [
    { id: uid(), username: "owner", password: "owner123", name: "Pemilik Konter", role: "owner" },
    { id: uid(), username: "kasir1", password: "kasir123", name: "Karyawan Kasir", role: "karyawan" },
  ],
  storeName: "Dhell Cell",
});

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "karyawan"] },
  { key: "kasir", label: "Kasir", icon: ShoppingCart, roles: ["owner", "karyawan"] },
  { key: "produk", label: "Produk & Stok", icon: Package, roles: ["owner", "karyawan"] },
  { key: "ppob", label: "PPOB", icon: Smartphone, roles: ["owner", "karyawan"] },
  { key: "keuangan", label: "Keuangan", icon: Wallet, roles: ["owner"] },
  { key: "laporan", label: "Laporan", icon: BarChart3, roles: ["owner"] },
  { key: "pengguna", label: "Pengguna", icon: Users, roles: ["owner"] },
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("konter-app-data");
        if (res && res.value) setData(JSON.parse(res.value));
        else {
          const seed = seedData();
          setData(seed);
          await window.storage.set("konter-app-data", JSON.stringify(seed));
        }
      } catch (e) {
        const seed = seedData();
        setData(seed);
        try { await window.storage.set("konter-app-data", JSON.stringify(seed)); } catch (e2) {}
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try { await window.storage.set("konter-app-data", JSON.stringify(next)); }
    catch (e) { showToast("Gagal menyimpan data (offline?). Perubahan tetap tersimpan di sesi ini.", "warn"); }
  };

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6F8", fontFamily: "Inter, sans-serif", color: "#334155" }}>
        Memuat aplikasi…
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen data={data} onLogin={setCurrentUser} storeName={data.storeName} />;
  }

  const visibleNav = NAV.filter((n) => n.roles.includes(currentUser.role));

  return (
    <div style={{ fontFamily: "Inter, ui-sans-serif, sans-serif", background: "#F4F5F7", minHeight: "100vh", color: "#1E2530", display: "flex" }}>
      <style>{globalCss}</style>
      {/* Sidebar */}
      <aside style={{ width: 232, background: "#16233A", color: "#CBD5E1", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#1FAE7A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Store size={18} color="#0B1526" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff", lineHeight: 1.1 }}>{data.storeName}</div>
            <div style={{ fontSize: 11, color: "#7D8CA3" }}>Sistem Kasir Konter</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const active = page === n.key;
            return (
              <button key={n.key} onClick={() => setPage(n.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8,
                  border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 500,
                  background: active ? "#1FAE7A" : "transparent", color: active ? "#08150F" : "#CBD5E1",
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
          <button onClick={() => setCurrentUser(null)} style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#F0A0A0", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "7px 10px", width: "100%", cursor: "pointer"
          }}>
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: "22px 26px 60px", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        {page === "dashboard" && <Dashboard data={data} setPage={setPage} />}
        {page === "kasir" && <Kasir data={data} persist={persist} showToast={showToast} currentUser={currentUser} storeName={data.storeName} />}
        {page === "produk" && <Produk data={data} persist={persist} showToast={showToast} role={currentUser.role} />}
        {page === "ppob" && <Ppob data={data} persist={persist} showToast={showToast} currentUser={currentUser} />}
        {page === "keuangan" && <Keuangan data={data} persist={persist} showToast={showToast} />}
        {page === "laporan" && <Laporan data={data} />}
        {page === "pengguna" && <Pengguna data={data} persist={persist} showToast={showToast} currentUser={currentUser} />}
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: 22, right: 22, background: toast.type === "warn" ? "#B45309" : "#0F172A",
          color: "#fff", padding: "11px 16px", borderRadius: 9, fontSize: 13.5, boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          display: "flex", alignItems: "center", gap: 8, zIndex: 999, maxWidth: 340
        }}>
          <CheckCircle2 size={16} /> {toast.msg}
        </div>
      )}
    </div>
  );
}

const globalCss = `
  * { box-sizing: border-box; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #1FAE7A; outline-offset: 1px; }
  input, select { font-family: inherit; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; }
`;

// ---------- shared UI bits ----------
const Card = ({ children, style }) => (
  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E7E9EE", padding: 18, ...style }}>{children}</div>
);
const PageTitle = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "#0F172A" }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", style, type = "button", disabled }) => {
  const styles = {
    primary: { background: "#1FAE7A", color: "#fff" },
    outline: { background: "#fff", color: "#334155", border: "1px solid #D8DCE3" },
    danger: { background: "#FEE2E2", color: "#B91C1C" },
    ghost: { background: "transparent", color: "#334155" },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
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
function LoginScreen({ data, onLogin, storeName }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const user = data.users.find((x) => x.username === u.trim() && x.password === p);
    if (user) onLogin(user);
    else setErr("Username atau password salah.");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F1B2E", fontFamily: "Inter, sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 34, width: 360, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#1FAE7A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store size={20} color="#0B1526" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{storeName}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>Masuk ke sistem kasir</div>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Username</label>
            <Input value={u} onChange={(e) => setU(e.target.value)} placeholder="owner / kasir1" style={{ marginTop: 5 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Password</label>
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" style={{ marginTop: 5 }} />
          </div>
          {err && <div style={{ fontSize: 12.5, color: "#B91C1C" }}>{err}</div>}
          <Btn type="submit" style={{ justifyContent: "center", marginTop: 4 }}>Masuk</Btn>
        </form>
        <div style={{ marginTop: 16, fontSize: 11.5, color: "#94A3B8", lineHeight: 1.6 }}>
          Akun contoh — Owner: <b>owner / owner123</b><br />Karyawan: <b>kasir1 / kasir123</b>
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ data, setPage }) {
  const today = todayStr();
  const salesToday = data.sales.filter((s) => s.date.slice(0, 10) === today);
  const omzetToday = salesToday.reduce((a, s) => a + s.total, 0);
  const profitToday = salesToday.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.price - (it.cost || 0)) * it.qty, 0), 0);
  const lowStock = data.products.filter((p) => p.category !== "pulsa" && p.stock <= p.minStock);
  const totalDebt = data.debts.filter((d) => d.status !== "lunas").reduce((a, d) => a + (d.amount - d.paid), 0);
  const recentSales = [...data.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const stats = [
    { label: "Omzet Hari Ini", value: rupiah(omzetToday), icon: TrendingUp, tone: "#1FAE7A" },
    { label: "Estimasi Profit Hari Ini", value: rupiah(profitToday), icon: Wallet, tone: "#2563EB" },
    { label: "Transaksi Hari Ini", value: salesToday.length, icon: ShoppingCart, tone: "#7C3AED" },
    { label: "Stok Menipis", value: lowStock.length, icon: AlertTriangle, tone: "#D97706" },
  ];

  return (
    <div>
      <PageTitle title="Dashboard" subtitle={`Ringkasan operasional — ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />
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

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Transaksi Terbaru</div>
          {recentSales.length === 0 ? <Empty text="Belum ada transaksi penjualan." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentSales.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.items.map((i) => i.name).join(", ").slice(0, 40)}{s.items.map(i=>i.name).join(", ").length>40?"…":""}</div>
                    <div style={{ color: "#94A3B8", fontSize: 11.5 }}>{new Date(s.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })} · {s.payment}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: "#1FAE7A" }}>{rupiah(s.total)}</div>
                </div>
              ))}
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
          {totalDebt > 0 && (
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
function Kasir({ data, persist, showToast, currentUser, storeName }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("semua");
  const [cart, setCart] = useState([]); // {productId, name, price, cost, qty, stock}
  const [payment, setPayment] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState(null);

  const filtered = data.products.filter((p) =>
    (cat === "semua" || p.category === cat) &&
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const addToCart = (p) => {
    if (p.stock <= 0) { showToast("Stok produk habis.", "warn"); return; }
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id);
      if (ex) {
        if (ex.qty >= p.stock) { showToast("Jumlah melebihi stok tersedia.", "warn"); return c; }
        return c.map((x) => x.productId === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1, stock: p.stock }];
    });
  };
  const changeQty = (id, delta) => {
    setCart((c) => c.map((x) => {
      if (x.productId !== id) return x;
      const q = x.qty + delta;
      if (q > x.stock) { showToast("Jumlah melebihi stok tersedia.", "warn"); return x; }
      return { ...x, qty: q };
    }).filter((x) => x.qty > 0));
  };
  const removeItem = (id) => setCart((c) => c.filter((x) => x.productId !== id));
  const total = cart.reduce((a, x) => a + x.price * x.qty, 0);

  const checkout = async () => {
    if (cart.length === 0) { showToast("Keranjang masih kosong.", "warn"); return; }
    const sale = {
      id: uid(), date: new Date().toISOString(), items: cart, total, payment,
      customer: customer || "Umum", cashier: currentUser.name,
    };
    const products = data.products.map((p) => {
      const item = cart.find((x) => x.productId === p.id);
      return item ? { ...p, stock: p.stock - item.qty } : p;
    });
    const stockLog = [...data.stockLog, ...cart.map((x) => ({
      id: uid(), date: new Date().toISOString(), productId: x.productId, productName: x.name, type: "out", qty: x.qty, note: "Penjualan kasir",
    }))];
    const financeTx = [...data.financeTx, {
      id: uid(), date: new Date().toISOString(), type: "in", category: "Penjualan", amount: total, note: `Penjualan #${sale.id.slice(-5)}`,
    }];
    await persist({ ...data, products, stockLog, financeTx, sales: [...data.sales, sale] });
    setReceipt(sale);
    setCart([]); setCustomer("");
    showToast("Transaksi berhasil disimpan.");
  };

  return (
    <div>
      <PageTitle title="Kasir" subtitle="Input penjualan dan cetak struk" />
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#94A3B8" }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk atau scan barcode…" style={{ paddingLeft: 32 }} />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 190 }}>
              <option value="semua">Semua Kategori</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, maxHeight: 480, overflowY: "auto" }}>
            {filtered.length === 0 && <Empty text="Produk tidak ditemukan." />}
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} style={{
                textAlign: "left", border: "1px solid #E7E9EE", borderRadius: 10, padding: 11, cursor: p.stock > 0 ? "pointer" : "not-allowed",
                background: p.stock > 0 ? "#fff" : "#F8FAFC", opacity: p.stock > 0 ? 1 : 0.55
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, minHeight: 32 }}>{p.name}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1FAE7A" }}>{rupiah(p.price)}</div>
                <div style={{ fontSize: 11, color: p.stock <= p.minStock ? "#D97706" : "#94A3B8", marginTop: 3 }}>Stok: {p.stock}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card style={{ position: "sticky", top: 20 }}>
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
              {["cash", "transfer", "e-wallet"].map((m) => (
                <button key={m} onClick={() => setPayment(m)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: payment === m ? "1.5px solid #1FAE7A" : "1px solid #D8DCE3", background: payment === m ? "#EAFBF3" : "#fff",
                  color: payment === m ? "#0F7A54" : "#475569", textTransform: "capitalize"
                }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, borderTop: "1px dashed #E2E8F0", paddingTop: 12, marginBottom: 12 }}>
            <span>Total</span><span style={{ color: "#1FAE7A" }}>{rupiah(total)}</span>
          </div>
          <Btn onClick={checkout} style={{ width: "100%", justifyContent: "center" }}>Proses Pembayaran</Btn>
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
    `\n\nTOTAL: ${rupiah(sale.total)}\nBayar: ${sale.payment}\n\nTerima kasih telah berbelanja!`;
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
function Produk({ data, persist, showToast, role }) {
  const [tab, setTab] = useState("produk");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // product or "new"
  const [stockModal, setStockModal] = useState(null); // {product, mode}

  const filtered = data.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const saveProduct = async (p) => {
    let products;
    if (p.id) products = data.products.map((x) => x.id === p.id ? p : x);
    else products = [...data.products, { ...p, id: uid() }];
    await persist({ ...data, products });
    setEditing(null);
    showToast("Produk tersimpan.");
  };
  const deleteProduct = async (id) => {
    await persist({ ...data, products: data.products.filter((p) => p.id !== id) });
    showToast("Produk dihapus.");
  };
  const doStockMove = async (product, mode, qty, note) => {
    qty = Number(qty);
    if (!qty || qty <= 0) return;
    const products = data.products.map((p) => p.id === product.id ? { ...p, stock: mode === "in" ? p.stock + qty : Math.max(0, p.stock - qty) } : p);
    const stockLog = [...data.stockLog, { id: uid(), date: new Date().toISOString(), productId: product.id, productName: product.name, type: mode, qty, note: note || (mode === "in" ? "Barang masuk" : "Barang keluar") }];
    await persist({ ...data, products, stockLog });
    setStockModal(null);
    showToast("Stok diperbarui.");
  };

  return (
    <div>
      <PageTitle title="Produk & Stok" subtitle="Kelola aksesoris, kartu perdana, pulsa, dan unit HP"
        right={role === "owner" && <Btn onClick={() => setEditing("new")}><Plus size={15} /> Tambah Produk</Btn>} />

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["produk", "Daftar Produk"], ["riwayat", "Riwayat Keluar Masuk"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: tab === k ? "1.5px solid #1FAE7A" : "1px solid #D8DCE3", background: tab === k ? "#EAFBF3" : "#fff",
            color: tab === k ? "#0F7A54" : "#475569"
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
                      <button onClick={() => setStockModal({ product: p, mode: "in" })} title="Barang masuk" style={iconBtn}><ArrowDownCircle size={15} color="#1FAE7A" /></button>
                      <button onClick={() => setStockModal({ product: p, mode: "out" })} title="Barang keluar" style={iconBtn}><ArrowUpCircle size={15} color="#D97706" /></button>
                      {role === "owner" && <>
                        <button onClick={() => setEditing(p)} title="Edit" style={iconBtn}><Pencil size={14} color="#334155" /></button>
                        <button onClick={() => deleteProduct(p.id)} title="Hapus" style={iconBtn}><Trash2 size={14} color="#B91C1C" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty text="Belum ada produk." />}
          </div>
        </Card>
      )}

      {tab === "riwayat" && (
        <Card>
          <table>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                <th style={th}>Tanggal</th><th style={th}>Produk</th><th style={th}>Jenis</th><th style={th}>Jumlah</th><th style={th}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {[...data.stockLog].sort((a, b) => b.date.localeCompare(a.date)).map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                  <td style={td}>{new Date(l.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td style={td}>{l.productName}</td>
                  <td style={td}><Badge tone={l.type === "in" ? "green" : "amber"}>{l.type === "in" ? "Masuk" : "Keluar"}</Badge></td>
                  <td style={td}>{l.qty}</td>
                  <td style={td}>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.stockLog.length === 0 && <Empty text="Belum ada riwayat stok." />}
        </Card>
      )}

      {editing && <ProductModal product={editing === "new" ? null : editing} onSave={saveProduct} onClose={() => setEditing(null)} />}
      {stockModal && <StockMoveModal {...stockModal} onSave={doStockMove} onClose={() => setStockModal(null)} />}
    </div>
  );
}
const th = { padding: "8px 10px" };
const td = { padding: "10px 10px", verticalAlign: "top" };
const iconBtn = { background: "#F8FAFC", border: "1px solid #E7E9EE", borderRadius: 6, width: 27, height: 27, marginLeft: 5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };

function ProductModal({ product, onSave, onClose }) {
  const [f, setF] = useState(product || { name: "", category: "aksesoris", sku: "", price: "", cost: "", stock: "", minStock: 3, supplier: "", serial: "", imei: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modal title={product ? "Edit Produk" : "Tambah Produk"} onClose={onClose}>
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
          <Field label="Stok Awal"><Input type="number" value={f.stock} onChange={(e) => set("stock", Number(e.target.value))} /></Field>
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

function StockMoveModal({ product, mode, onSave, onClose }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title={(mode === "in" ? "Barang Masuk" : "Barang Keluar") + " — " + product.name} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#64748B" }}>Stok saat ini: <b>{product.stock}</b></div>
        <Field label="Jumlah"><Input type="number" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Catatan (opsional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "in" ? "Restock dari supplier" : "Rusak / retur / lainnya"} /></Field>
        <Btn onClick={() => onSave(product, mode, qty, note)} style={{ justifyContent: "center" }}>Simpan</Btn>
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

function Ppob({ data, persist, showToast, currentUser }) {
  const [type, setType] = useState("pulsa");
  const [target, setTarget] = useState("");
  const [nominal, setNominal] = useState("");
  const [fee, setFee] = useState(1500);
  const active = PPOB_TYPES.find((t) => t.key === type);
  const total = (Number(nominal) || 0) + (Number(fee) || 0);

  const submit = async () => {
    if (!target || !nominal) { showToast("Lengkapi nomor tujuan dan nominal.", "warn"); return; }
    const tx = { id: uid(), date: new Date().toISOString(), type, target, nominal: Number(nominal), fee: Number(fee), total, status: "sukses (simulasi)", operator: currentUser.name };
    const financeTx = [...data.financeTx, { id: uid(), date: new Date().toISOString(), type: "in", category: "PPOB - " + active.label, amount: fee, note: `Fee transaksi ${active.label} a.n ${target}` }];
    await persist({ ...data, ppobTx: [...data.ppobTx, tx], financeTx });
    setTarget(""); setNominal("");
    showToast("Transaksi PPOB berhasil (simulasi).");
  };

  return (
    <div>
      <PageTitle title="PPOB" subtitle="Top up pulsa, token listrik, BPJS, PDAM, dan tagihan lainnya" />
      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#9A5B0D", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        Modul ini berjalan dalam mode <b>simulasi</b>. Untuk transaksi PPOB nyata, hubungkan ke penyedia API PPOB (misalnya Digiflazz, Payment Gateway BUMN, atau H2H provider lain) — lihat bagian "Struktur API" pada dokumentasi.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {PPOB_TYPES.map((t) => (
              <button key={t.key} onClick={() => { setType(t.key); setNominal(""); }} style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, cursor: "pointer",
                border: type === t.key ? "1.5px solid #1FAE7A" : "1px solid #E7E9EE", background: type === t.key ? "#EAFBF3" : "#fff"
              }}>
                <t.icon size={18} color={type === t.key ? "#0F7A54" : "#475569"} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: type === t.key ? "#0F7A54" : "#334155" }}>{t.label}</span>
              </button>
            ))}
          </div>
          <Field label={active.placeholder}><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={active.placeholder} /></Field>
          <div style={{ height: 10 }} />
          <Field label="Nominal">
            <Input type="number" value={nominal} onChange={(e) => setNominal(e.target.value)} placeholder="Masukkan nominal" />
          </Field>
          {active.presets.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {active.presets.map((n) => (
                <button key={n} onClick={() => setNominal(n)} style={{
                  padding: "6px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                  border: Number(nominal) === n ? "1.5px solid #1FAE7A" : "1px solid #D8DCE3", background: Number(nominal) === n ? "#EAFBF3" : "#fff"
                }}>{rupiah(n)}</button>
              ))}
            </div>
          )}
          <div style={{ height: 10 }} />
          <Field label="Biaya Admin (Fee)"><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: "1px dashed #E2E8F0", marginTop: 14, paddingTop: 12 }}>
            <span>Total Bayar</span><span style={{ color: "#1FAE7A" }}>{rupiah(total)}</span>
          </div>
          <Btn onClick={submit} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>Proses Transaksi</Btn>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Riwayat Transaksi PPOB</div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            <table>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
                  <th style={th}>Waktu</th><th style={th}>Layanan</th><th style={th}>Tujuan</th><th style={th}>Total</th><th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data.ppobTx].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 12.5 }}>
                    <td style={td}>{new Date(t.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={td}>{PPOB_TYPES.find((x) => x.key === t.type)?.label}</td>
                    <td style={td}>{t.target}</td>
                    <td style={td}>{rupiah(t.total)}</td>
                    <td style={td}><Badge tone="green">{t.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.ppobTx.length === 0 && <Empty text="Belum ada transaksi PPOB." />}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Keuangan ----------
function Keuangan({ data, persist, showToast }) {
  const [tab, setTab] = useState("kas");
  const [txModal, setTxModal] = useState(false);
  const [debtModal, setDebtModal] = useState(false);

  const income = data.financeTx.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0);
  const expense = data.financeTx.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0);

  const addTx = async (tx) => {
    await persist({ ...data, financeTx: [...data.financeTx, { ...tx, id: uid(), date: new Date().toISOString() }] });
    setTxModal(false); showToast("Catatan keuangan ditambahkan.");
  };
  const addDebt = async (d) => {
    await persist({ ...data, debts: [...data.debts, { ...d, id: uid(), date: new Date().toISOString(), paid: 0, status: "belum lunas" }] });
    setDebtModal(false); showToast("Data utang-piutang ditambahkan.");
  };
  const payDebt = async (id, amount) => {
    const debts = data.debts.map((d) => {
      if (d.id !== id) return d;
      const paid = d.paid + amount;
      return { ...d, paid, status: paid >= d.amount ? "lunas" : "belum lunas" };
    });
    const financeTx = [...data.financeTx, { id: uid(), date: new Date().toISOString(), type: "in", category: "Pelunasan Piutang", amount, note: "Pembayaran piutang" }];
    await persist({ ...data, debts, financeTx });
    showToast("Pembayaran dicatat.");
  };

  return (
    <div>
      <PageTitle title="Keuangan" subtitle="Kas harian, laba rugi sederhana, dan utang-piutang pelanggan"
        right={<div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" onClick={() => setDebtModal(true)}><Plus size={14} /> Utang/Piutang</Btn>
          <Btn onClick={() => setTxModal(true)}><Plus size={14} /> Catat Transaksi</Btn>
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Total Pemasukan</div><div style={{ fontSize: 19, fontWeight: 700, color: "#1FAE7A" }}>{rupiah(income)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Total Pengeluaran</div><div style={{ fontSize: 19, fontWeight: 700, color: "#DC2626" }}>{rupiah(expense)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Saldo / Profit</div><div style={{ fontSize: 19, fontWeight: 700 }}>{rupiah(income - expense)}</div></Card>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["kas", "Kas & Ledger"], ["piutang", "Utang / Piutang"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: tab === k ? "1.5px solid #1FAE7A" : "1px solid #D8DCE3", background: tab === k ? "#EAFBF3" : "#fff",
            color: tab === k ? "#0F7A54" : "#475569"
          }}>{l}</button>
        ))}
      </div>

      {tab === "kas" && (
        <Card>
          <table>
            <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
              <th style={th}>Tanggal</th><th style={th}>Kategori</th><th style={th}>Catatan</th><th style={th}>Jenis</th><th style={th}>Jumlah</th>
            </tr></thead>
            <tbody>
              {[...data.financeTx].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                  <td style={td}>{new Date(t.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td style={td}>{t.category}</td>
                  <td style={td}>{t.note}</td>
                  <td style={td}><Badge tone={t.type === "in" ? "green" : "red"}>{t.type === "in" ? "Masuk" : "Keluar"}</Badge></td>
                  <td style={{ ...td, fontWeight: 700, color: t.type === "in" ? "#1FAE7A" : "#DC2626" }}>{t.type === "in" ? "+" : "-"}{rupiah(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.financeTx.length === 0 && <Empty text="Belum ada catatan keuangan." />}
        </Card>
      )}

      {tab === "piutang" && (
        <Card>
          <table>
            <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
              <th style={th}>Pelanggan</th><th style={th}>Total</th><th style={th}>Terbayar</th><th style={th}>Sisa</th><th style={th}>Status</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {data.debts.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{d.customer}</div><div style={{ fontSize: 11, color: "#94A3B8" }}>{d.note}</div></td>
                  <td style={td}>{rupiah(d.amount)}</td>
                  <td style={td}>{rupiah(d.paid)}</td>
                  <td style={td}>{rupiah(d.amount - d.paid)}</td>
                  <td style={td}><Badge tone={d.status === "lunas" ? "green" : "amber"}>{d.status}</Badge></td>
                  <td style={td}>
                    {d.status !== "lunas" && (
                      <Btn variant="outline" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => {
                        const amt = Number(prompt("Jumlah pembayaran:", d.amount - d.paid));
                        if (amt > 0) payDebt(d.id, amt);
                      }}>Bayar</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.debts.length === 0 && <Empty text="Belum ada data utang-piutang." />}
        </Card>
      )}

      {txModal && <TxModal onSave={addTx} onClose={() => setTxModal(false)} />}
      {debtModal && <DebtModal onSave={addDebt} onClose={() => setDebtModal(false)} />}
    </div>
  );
}
function TxModal({ onSave, onClose }) {
  const [f, setF] = useState({ type: "in", category: "", amount: "", note: "" });
  return (
    <Modal title="Catat Transaksi Keuangan" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["in", "out"].map((t) => (
            <button key={t} onClick={() => setF({ ...f, type: t })} style={{
              flex: 1, padding: "8px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: f.type === t ? "1.5px solid #1FAE7A" : "1px solid #D8DCE3", background: f.type === t ? "#EAFBF3" : "#fff"
            }}>{t === "in" ? "Pemasukan" : "Pengeluaran"}</button>
          ))}
        </div>
        <Field label="Kategori"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="mis. Sewa tempat, Listrik toko" /></Field>
        <Field label="Jumlah"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <Btn onClick={() => f.category && f.amount && onSave(f)} style={{ justifyContent: "center" }}>Simpan</Btn>
      </div>
    </Modal>
  );
}
function DebtModal({ onSave, onClose }) {
  const [f, setF] = useState({ customer: "", amount: "", note: "" });
  return (
    <Modal title="Tambah Utang / Piutang Pelanggan" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Pelanggan"><Input value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} /></Field>
        <Field label="Jumlah"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="mis. Ambil barang belum bayar" /></Field>
        <Btn onClick={() => f.customer && f.amount && onSave(f)} style={{ justifyContent: "center" }}>Simpan</Btn>
      </div>
    </Modal>
  );
}

// ---------- Laporan ----------
function Laporan({ data }) {
  const [range, setRange] = useState("7"); // days
  const days = Number(range);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const salesInRange = data.sales.filter((s) => new Date(s.date) >= cutoff);
  const omzet = salesInRange.reduce((a, s) => a + s.total, 0);
  const profit = salesInRange.reduce((a, s) => a + s.items.reduce((x, it) => x + (it.price - (it.cost || 0)) * it.qty, 0), 0);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    salesInRange.forEach((s) => { const k = s.date.slice(0, 10); if (k in map) map[k] += s.total; });
    return Object.entries(map).map(([date, total]) => ({ date: date.slice(5), total }));
  }, [salesInRange, days]);

  const topProducts = useMemo(() => {
    const map = {};
    salesInRange.forEach((s) => s.items.forEach((it) => {
      map[it.name] = (map[it.name] || 0) + it.qty;
    }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));
  }, [salesInRange]);

  const COLORS = ["#1FAE7A", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0EA5E9"];

  const exportCsv = () => {
    const rows = [["Tanggal", "Item", "Qty", "Total", "Pembayaran", "Pelanggan"]];
    salesInRange.forEach((s) => s.items.forEach((it) => rows.push([s.date, it.name, it.qty, it.price * it.qty, s.payment, s.customer])));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-penjualan-${todayStr()}.csv`;
    a.click();
  };

  return (
    <div>
      <PageTitle title="Laporan & Analitik" subtitle="Pantau performa penjualan konter"
        right={<div style={{ display: "flex", gap: 8 }}>
          <Select value={range} onChange={(e) => setRange(e.target.value)} style={{ width: 150 }}>
            <option value="7">7 Hari Terakhir</option>
            <option value="30">30 Hari Terakhir</option>
            <option value="90">90 Hari Terakhir</option>
          </Select>
          <Btn variant="outline" onClick={exportCsv}><Download size={14} /> Export CSV</Btn>
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Total Omzet</div><div style={{ fontSize: 19, fontWeight: 700 }}>{rupiah(omzet)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Estimasi Profit</div><div style={{ fontSize: 19, fontWeight: 700, color: "#1FAE7A" }}>{rupiah(profit)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "#64748B" }}>Jumlah Transaksi</div><div style={{ fontSize: 19, fontWeight: 700 }}>{salesInRange.length}</div></Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Grafik Omzet</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : v)} />
                <Tooltip formatter={(v) => rupiah(v)} />
                <Bar dataKey="total" fill="#1FAE7A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Produk Paling Laku</div>
          {topProducts.length === 0 ? <Empty text="Belum ada data penjualan." /> : (
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
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topProducts.map((p, i) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: COLORS[i % COLORS.length] }} />{p.name}</span>
                <b>{p.qty} terjual</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Pengguna ----------
function Pengguna({ data, persist, showToast, currentUser }) {
  const [modal, setModal] = useState(null);
  const save = async (u) => {
    let users;
    if (u.id) users = data.users.map((x) => x.id === u.id ? u : x);
    else users = [...data.users, { ...u, id: uid() }];
    await persist({ ...data, users });
    setModal(null); showToast("Pengguna tersimpan.");
  };
  const remove = async (id) => {
    if (id === currentUser.id) { showToast("Tidak bisa menghapus akun sendiri.", "warn"); return; }
    await persist({ ...data, users: data.users.filter((u) => u.id !== id) });
    showToast("Pengguna dihapus.");
  };
  return (
    <div>
      <PageTitle title="Pengguna & Hak Akses" subtitle="Kelola akun owner dan karyawan"
        right={<Btn onClick={() => setModal("new")}><Plus size={15} /> Tambah Pengguna</Btn>} />
      <Card>
        <table>
          <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "#64748B", textTransform: "uppercase" }}>
            <th style={th}>Nama</th><th style={th}>Username</th><th style={th}>Peran</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                <td style={td}>{u.name}</td>
                <td style={td}>{u.username}</td>
                <td style={td}><Badge tone={u.role === "owner" ? "blue" : "slate"}>{u.role === "owner" ? "Owner" : "Karyawan"}</Badge></td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button onClick={() => setModal(u)} style={iconBtn}><Pencil size={14} /></button>
                  <button onClick={() => remove(u.id)} style={iconBtn}><Trash2 size={14} color="#B91C1C" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ marginTop: 14, fontSize: 12, color: "#94A3B8" }}>
        <b>Owner</b> memiliki akses penuh (kasir, stok, PPOB, keuangan, laporan, pengguna). <b>Karyawan</b> hanya memiliki akses ke kasir, produk & stok, dan PPOB.
      </div>
      {modal && <UserModal user={modal === "new" ? null : modal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}
function UserModal({ user, onSave, onClose }) {
  const [f, setF] = useState(user || { name: "", username: "", password: "", role: "karyawan" });
  return (
    <Modal title={user ? "Edit Pengguna" : "Tambah Pengguna"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nama Lengkap"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Username"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Password"><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Peran">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="karyawan">Karyawan</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>
        <Btn onClick={() => f.name && f.username && f.password && onSave(f)} style={{ justifyContent: "center" }}>Simpan</Btn>
      </div>
    </Modal>
  );
}
