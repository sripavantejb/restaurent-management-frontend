"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { formatMoney } from "@/lib/money";
import { apiUrl } from "@/lib/api-url";

type Phase = "loading" | "invalid" | "landing" | "menu" | "track";

type Diet = "all" | "veg" | "nonveg" | "egg";

interface Variant {
  name: string;
  priceDelta: number;
}
interface Addon {
  name: string;
  price: number;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isVeg: boolean;
  isEgg: boolean;
  isAvailable: boolean;
  spiceLevel: number;
  variants: Variant[];
  addons: Addon[];
  bestseller?: boolean;
  repeatRate: number;
}

interface Category {
  id: string;
  name: string;
}

interface Bootstrap {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    menuVersion: string;
    maxOrderPaise?: number;
    qrOrderingEnabled?: boolean;
  };
  branch: { id: string; name: string; code: string };
  table: { id: string; number: number; status: string };
  openSession: {
    id: string;
    sessionNumber: string;
    status: string;
    guestCount: number;
    rounds: number;
    total: number;
    dueAmount: number;
  } | null;
  categories: Category[];
  items: MenuItem[];
}

interface CartLine {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  variant: string;
  addons: string[];
  notes: string;
  isVeg: boolean;
}

interface CheckoutRound {
  id: string;
  orderNumber: string;
  roundNumber: number;
  status: string;
  items: { name: string; qty: number; unitPrice: number; notes?: string; variant?: string }[];
  total: number;
  placedAt?: string;
  prepEtaMins?: number;
}

interface CheckoutData {
  session: {
    id: string;
    sessionNumber: string;
    status: string;
    guestCount: number;
    rounds: number;
    subtotal: number;
    taxAmount: number;
    tipAmount: number;
    total: number;
    dueAmount: number;
  };
  rounds: CheckoutRound[];
}

const C = {
  bg: "#FAF8F5",
  ink: "#12100E",
  accent: "#E4572E",
  teal: "#2A9D8F",
  muted: "#6B6560",
  border: "#E4DDD3",
};

const DEVICE_KEY = "ros_guest_device";

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function menuCacheKey(slug: string, branch: string, menuVersion: string) {
  return `ros_guest_menu:${slug}:${branch}:${menuVersion}`;
}

function linePrice(item: MenuItem, variant: string, addons: string[]): number {
  const delta = item.variants?.find((v) => v.name === variant)?.priceDelta ?? 0;
  const addonSum = (item.addons ?? [])
    .filter((a) => addons.includes(a.name))
    .reduce((s, a) => s + a.price, 0);
  return item.price + delta + addonSum;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function GuestTableClient({
  slug,
  branch,
  token,
  version,
}: {
  slug: string;
  branch: string;
  token: string;
  version: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [diet, setDiet] = useState<Diet>("all");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [cfgVariant, setCfgVariant] = useState("");
  const [cfgAddons, setCfgAddons] = useState<string[]>([]);
  const [cfgNotes, setCfgNotes] = useState("");
  const [cfgQty, setCfgQty] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [tipPercent, setTipPercent] = useState(0);
  const [toast, setToast] = useState("");
  const [wrongTable, setWrongTable] = useState(false);
  const placingRef = useRef(false);

  const currency = boot?.restaurant.currency ?? "INR";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const loadBootstrap = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const qs = new URLSearchParams({ slug, branch, token, v: version });
      const res = await fetch(apiUrl(`/api/guest/bootstrap?${qs}`), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "This code is out of date");
        setHint(data.hint || "Please ask your server for a new one.");
        setPhase("invalid");
        return;
      }
      const b = data as Bootstrap;
      setBoot(b);
      if (b.openSession?.guestCount) setGuestCount(b.openSession.guestCount);

      const key = menuCacheKey(slug, branch, b.restaurant.menuVersion);
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            categories: b.categories,
            items: b.items,
            cachedAt: Date.now(),
          })
        );
      } catch {
        /* quota */
      }

      // Resume if cookie session already exists
      const sessRes = await fetch(apiUrl("/api/guest/session"), {
        credentials: "include",
      });
      const sess = await sessRes.json();
      if (sess.session) {
        if (b.categories[0]) setActiveCat(b.categories[0].id);
        setPhase("menu");
        void pollCheckout();
        return;
      }
      setPhase("landing");
    } catch {
      setError("Could not reach the restaurant");
      setHint("Check your connection and scan again.");
      setPhase("invalid");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, branch, token, version]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const pollCheckout = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/guest/checkout"), {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as CheckoutData;
      setCheckout(data);
      if (data.session.status === "CLOSED") {
        showToast("Paid — thank you!");
      }
    } catch {
      /* ignore transient */
    }
  }, []);

  useEffect(() => {
    if (phase !== "menu" && phase !== "track") return;
    void pollCheckout();
    const t = setInterval(() => void pollCheckout(), 2000);
    return () => clearInterval(t);
  }, [phase, pollCheckout]);

  async function startSession(action: "START" | "JOIN") {
    if (!boot) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/guest/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          branchCode: branch,
          token,
          tableId: boot.table.id,
          guestCount,
          guestName: guestName.trim(),
          action,
          deviceId: getDeviceId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start");
        setHint(data.hint || "");
        return;
      }
      setPhase("menu");
      if (boot.categories[0]) setActiveCat(boot.categories[0].id);
    } catch {
      setError("Network error");
      setHint("Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function openConfig(item: MenuItem) {
    if (!item.isAvailable) return;
    const needs =
      (item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0;
    if (!needs) {
      addToCart(item, "", [], "", 1);
      return;
    }
    setConfigItem(item);
    setCfgVariant(item.variants?.[0]?.name ?? "");
    setCfgAddons([]);
    setCfgNotes("");
    setCfgQty(1);
  }

  function addToCart(
    item: MenuItem,
    variant: string,
    addons: string[],
    notes: string,
    qty: number
  ) {
    const unitPrice = linePrice(item, variant, addons);
    setCart((prev) => {
      const idx = prev.findIndex(
        (l) =>
          l.menuItemId === item.id &&
          l.variant === variant &&
          l.notes === notes &&
          JSON.stringify(l.addons) === JSON.stringify(addons)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          qty,
          unitPrice,
          variant,
          addons,
          notes,
          isVeg: item.isVeg,
        },
      ];
    });
    showToast(`Added ${item.name}`);
    setConfigItem(null);
  }

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    [cart]
  );
  const cartQty = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  async function placeOrder() {
    if (!cart.length || placingRef.current) return;
    placingRef.current = true;
    setBusy(true);
    try {
      const put = await fetch(apiUrl("/api/guest/cart"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lines: cart.map((l) => ({
            menuItemId: l.menuItemId,
            qty: l.qty,
            variant: l.variant,
            addons: l.addons,
            notes: l.notes,
            guestLabel: guestName.trim() || "Guest",
          })),
        }),
      });
      const putData = await put.json();
      if (!put.ok) {
        showToast(putData.error || "Cart sync failed");
        return;
      }

      const key = uid();
      const res = await fetch(apiUrl("/api/guest/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        credentials: "include",
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Order failed");
        return;
      }
      setCart([]);
      setShowCart(false);
      setPhase("track");
      showToast(
        data.pendingApproval
          ? `Round ${data.roundNumber} sent for approval`
          : `Round ${data.roundNumber} sent to kitchen`
      );
      if (data.duplicateWarning) {
        showToast("Looks similar to a recent order — kitchen has it");
      }
      void pollCheckout();
    } catch {
      showToast("Could not place order — try again");
    } finally {
      setBusy(false);
      placingRef.current = false;
    }
  }

  async function service(type: "WAITER" | "WATER" | "CUTLERY" | "BILL") {
    try {
      const res = await fetch(apiUrl("/api/guest/service"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Request failed");
        return;
      }
      showToast(
        data.throttled
          ? data.message
          : type === "BILL"
            ? "Bill requested — staff on the way"
            : "Staff notified"
      );
      if (type === "BILL") void pollCheckout();
    } catch {
      showToast("Could not reach staff");
    }
  }

  async function pay(opts: { tipPercent?: number; payAtCounter?: boolean }) {
    setBusy(true);
    try {
      if (opts.payAtCounter) {
        const res = await fetch(apiUrl("/api/guest/checkout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "REQUEST_BILL", payAtCounter: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Could not request bill");
          return;
        }
        showToast("Pay at counter — staff bringing the bill");
        void pollCheckout();
        return;
      }
      const res = await fetch(apiUrl("/api/guest/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "PAY",
          method: "UPI",
          tipPercent: opts.tipPercent ?? tipPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Payment failed");
        return;
      }
      showToast(`Paid ${formatMoney(data.amount, currency)} — thank you!`);
      setCart([]);
      setPhase("landing");
      setCheckout(null);
      void loadBootstrap();
    } catch {
      showToast("Payment error");
    } finally {
      setBusy(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!boot) return [];
    return boot.items.filter((it) => {
      if (activeCat && it.categoryId !== activeCat) return false;
      if (diet === "veg" && !it.isVeg) return false;
      if (diet === "nonveg" && it.isVeg) return false;
      if (diet === "egg" && !it.isEgg) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !it.name.toLowerCase().includes(q) &&
          !(it.description || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [boot, activeCat, diet, search]);

  const quickReorder = useMemo(() => {
    if (!boot) return [];
    return boot.items
      .filter((i) => i.isAvailable && (i.repeatRate ?? 0) >= 0.3)
      .slice(0, 6);
  }, [boot]);

  const sessionTotal = checkout?.session.total ?? boot?.openSession?.total ?? 0;
  const rounds = checkout?.session.rounds ?? boot?.openSession?.rounds ?? 0;

  if (phase === "loading") {
    return (
      <div style={shell}>
        <p style={{ color: C.muted, textAlign: "center", marginTop: 80 }}>
          Loading your table…
        </p>
      </div>
    );
  }

  if (phase === "invalid" || wrongTable) {
    return (
      <div style={shell}>
        <div style={{ maxWidth: 360, margin: "64px auto", padding: 24, textAlign: "center" }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.16em",
              color: C.accent,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            RestaurantOS
          </p>
          <h1 style={{ fontSize: 28, margin: "12px 0 8px", color: C.ink }}>
            {wrongTable ? "Wrong table?" : error || "This code is out of date"}
          </h1>
          <p style={{ color: C.muted, lineHeight: 1.5 }}>
            {wrongTable
              ? "Ask staff for the correct QR, or scan the code on your table."
              : hint || "Please ask your server for a new one."}
          </p>
          {wrongTable ? (
            <button
              type="button"
              style={primaryBtn}
              onClick={() => {
                setWrongTable(false);
                void loadBootstrap();
              }}
            >
              Scan again
            </button>
          ) : (
            <button type="button" style={primaryBtn} onClick={() => void loadBootstrap()}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!boot) return null;

  return (
    <div style={shell}>
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: C.ink,
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            fontSize: 14,
            maxWidth: "90%",
          }}
        >
          {toast}
        </div>
      ) : null}

      {phase === "landing" ? (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "32px 20px 100px" }}>
          <p
            style={{
              fontSize: 13,
              color: C.muted,
              letterSpacing: "0.04em",
            }}
          >
            {boot.restaurant.name}
          </p>
          <p
            className="num"
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              margin: "8px 0 4px",
              color: C.ink,
            }}
          >
            TABLE {boot.table.number}
          </p>
          <p style={{ color: C.muted, marginBottom: 28 }}>{boot.branch.name}</p>

          {boot.restaurant.qrOrderingEnabled === false ? (
            <div
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                background: "#fff",
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                Ordering is paused
              </p>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.45 }}>
                This restaurant has turned off QR menu ordering for now. Please
                ask your server to take your order — scanning still confirms you
                are at Table {boot.table.number}.
              </p>
            </div>
          ) : (
            <>
          <label style={label}>Guests</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button
              type="button"
              style={stepBtn}
              aria-label="Fewer guests"
              onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
            >
              −
            </button>
            <span className="num" style={{ fontSize: 32, fontWeight: 600, minWidth: 40, textAlign: "center" }}>
              {guestCount}
            </span>
            <button
              type="button"
              style={stepBtn}
              aria-label="More guests"
              onClick={() => setGuestCount((c) => Math.min(6, c + 1))}
            >
              +
            </button>
          </div>

          <label style={label} htmlFor="guest-name">
            Your name (optional)
          </label>
          <input
            id="guest-name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="So kitchen can call you"
            style={input}
          />

          {error ? (
            <p style={{ color: C.accent, fontSize: 14, marginTop: 12 }}>
              {error}
              {hint ? ` — ${hint}` : ""}
            </p>
          ) : null}

          {boot.openSession ? (
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                style={primaryBtn}
                disabled={busy}
                onClick={() => void startSession("JOIN")}
              >
                Join table · Round {boot.openSession.rounds || 0}
              </button>
              <button
                type="button"
                style={ghostBtn}
                onClick={() => setWrongTable(true)}
              >
                This isn&apos;t my table
              </button>
            </div>
          ) : (
            <button
              type="button"
              style={{ ...primaryBtn, marginTop: 28 }}
              disabled={busy}
              onClick={() => void startSession("START")}
            >
              {busy ? "Starting…" : "Start ordering"}
            </button>
          )}
            </>
          )}
        </div>
      ) : null}

      {phase === "menu" || phase === "track" ? (
        <>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: C.bg,
              borderBottom: `1px solid ${C.border}`,
              padding: "10px 12px 8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <p style={{ fontSize: 12, color: C.muted }}>{boot.restaurant.name}</p>
                <p className="num" style={{ fontSize: 18, fontWeight: 700 }}>
                  Table {boot.table.number}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "veg", "egg", "nonveg"] as Diet[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiet(d)}
                    style={{
                      ...chip,
                      background: diet === d ? C.ink : "transparent",
                      color: diet === d ? "#fff" : C.muted,
                    }}
                  >
                    {d === "nonveg" ? "Non-veg" : d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {phase === "menu" ? (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu"
                style={{ ...input, marginTop: 8 }}
                aria-label="Search menu"
              />
            ) : null}
          </header>

          {phase === "menu" ? (
            <>
              <nav
                style={{
                  position: "sticky",
                  top: 96,
                  zIndex: 15,
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  padding: "8px 12px",
                  background: C.bg,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {boot.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    style={{
                      ...chip,
                      whiteSpace: "nowrap",
                      background: activeCat === c.id ? C.accent : "transparent",
                      color: activeCat === c.id ? "#fff" : C.ink,
                      borderColor: activeCat === c.id ? C.accent : C.border,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </nav>

              <div style={{ padding: "12px 12px 120px", display: "grid", gap: 10 }}>
                {filteredItems.length === 0 ? (
                  <p style={{ color: C.muted, textAlign: "center", padding: 24 }}>
                    No dishes match — clear search or switch diet filter.
                  </p>
                ) : (
                  filteredItems.map((it) => {
                    const unavailable = !it.isAvailable;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        disabled={unavailable}
                        onClick={() => openConfig(it)}
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderRadius: 6,
                          border: `1px solid ${C.border}`,
                          background: unavailable ? "#EFEAE3" : "#fff",
                          opacity: unavailable ? 0.75 : 1,
                          cursor: unavailable ? "not-allowed" : "pointer",
                          color: C.ink,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                marginRight: 6,
                                background: it.isVeg ? C.teal : C.accent,
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{it.name}</span>
                            {it.bestseller ? (
                              <span style={{ marginLeft: 6, fontSize: 11, color: C.accent }}>
                                Popular
                              </span>
                            ) : null}
                          </div>
                          <span className="num" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                            {formatMoney(it.price, currency)}
                          </span>
                        </div>
                        {it.description ? (
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.muted }}>
                            {it.description}
                          </p>
                        ) : null}
                        {unavailable ? (
                          <p style={{ margin: "8px 0 0", fontSize: 13, color: C.muted }}>
                            Currently unavailable
                          </p>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : null}

          {phase === "track" ? (
            <div style={{ padding: "16px 12px 140px", maxWidth: 480, margin: "0 auto" }}>
              <h2 style={{ fontSize: 22, marginBottom: 4 }}>Your orders</h2>
              <p style={{ color: C.muted, marginBottom: 16, fontSize: 14 }}>
                Updates every few seconds · {checkout?.session.status ?? "OPEN"}
              </p>

              {(checkout?.rounds ?? []).length === 0 ? (
                <p style={{ color: C.muted }}>No rounds yet — order from the menu.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {checkout!.rounds.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <p className="num" style={{ fontWeight: 700 }}>
                          Round {r.roundNumber}
                        </p>
                        <p style={{ fontSize: 13, color: C.teal }}>{r.status}</p>
                      </div>
                      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                        {r.items.map((it, i) => (
                          <li key={i} style={{ fontSize: 14, marginTop: 4 }}>
                            <span className="num">{it.qty}×</span> {it.name}
                            {it.variant ? ` (${it.variant})` : ""}
                          </li>
                        ))}
                      </ul>
                      <p className="num" style={{ marginTop: 8, fontWeight: 600 }}>
                        {formatMoney(r.total, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {quickReorder.length > 0 ? (
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Order again</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {quickReorder.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        style={chip}
                        onClick={() => {
                          openConfig(it);
                          setPhase("menu");
                        }}
                      >
                        + {it.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
                {(
                  [
                    ["WAITER", "Call waiter"],
                    ["WATER", "Water"],
                    ["CUTLERY", "Cutlery"],
                  ] as const
                ).map(([t, label]) => (
                  <button key={t} type="button" style={ghostBtn} onClick={() => void service(t)}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 28 }}>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Tip</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[0, 5, 10, 15].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTipPercent(p)}
                      style={{
                        ...chip,
                        background: tipPercent === p ? C.teal : "transparent",
                        color: tipPercent === p ? "#fff" : C.ink,
                      }}
                    >
                      {p === 0 ? "None" : `${p}%`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  style={primaryBtn}
                  disabled={busy || (checkout?.session.dueAmount ?? 0) <= 0}
                  onClick={() => void pay({ tipPercent })}
                >
                  Pay {formatMoney(checkout?.session.dueAmount ?? 0, currency)}
                </button>
                <button
                  type="button"
                  style={{ ...ghostBtn, width: "100%", marginTop: 10 }}
                  disabled={busy}
                  onClick={() => void pay({ payAtCounter: true })}
                >
                  Pay at counter
                </button>
                <button
                  type="button"
                  style={{ ...ghostBtn, width: "100%", marginTop: 10 }}
                  onClick={() => {
                    setPhase("menu");
                    if (boot.categories[0]) setActiveCat(boot.categories[0].id);
                  }}
                >
                  Order again
                </button>
              </div>
            </div>
          ) : null}

          {/* Bottom bar */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              borderTop: `1px solid ${C.border}`,
              background: "#fff",
              padding: "10px 14px calc(10px + env(safe-area-inset-bottom))",
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 30,
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: C.muted }}>
                {rounds} round{rounds === 1 ? "" : "s"} · session
              </p>
              <p className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                {formatMoney(sessionTotal, currency)}
              </p>
            </div>
            {phase === "menu" ? (
              <>
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={() => setPhase("track")}
                >
                  Track
                </button>
                <button
                  type="button"
                  style={primaryBtn}
                  onClick={() => (cartQty ? setShowCart(true) : showToast("Add items first"))}
                >
                  Cart · {cartQty}
                </button>
              </>
            ) : (
              <button type="button" style={primaryBtn} onClick={() => setPhase("menu")}>
                Menu
              </button>
            )}
          </div>
        </>
      ) : null}

      {/* Item config sheet */}
      {configItem ? (
        <div style={overlay} onClick={() => setConfigItem(null)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: 20 }}>{configItem.name}</h3>
            <p className="num" style={{ color: C.muted, marginBottom: 16 }}>
              {formatMoney(
                linePrice(configItem, cfgVariant, cfgAddons) * cfgQty,
                currency
              )}
            </p>
            {(configItem.variants?.length ?? 0) > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <p style={label}>Size / variant</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {configItem.variants.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setCfgVariant(v.name)}
                      style={{
                        ...chip,
                        background: cfgVariant === v.name ? C.ink : "transparent",
                        color: cfgVariant === v.name ? "#fff" : C.ink,
                      }}
                    >
                      {v.name}
                      {v.priceDelta
                        ? ` (${v.priceDelta > 0 ? "+" : ""}${formatMoney(v.priceDelta, currency)})`
                        : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {(configItem.addons?.length ?? 0) > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <p style={label}>Add-ons</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {configItem.addons.map((a) => {
                    const on = cfgAddons.includes(a.name);
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() =>
                          setCfgAddons((prev) =>
                            on ? prev.filter((x) => x !== a.name) : [...prev, a.name]
                          )
                        }
                        style={{
                          ...chip,
                          background: on ? C.teal : "transparent",
                          color: on ? "#fff" : C.ink,
                        }}
                      >
                        {a.name} (+{formatMoney(a.price, currency)})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <label style={label} htmlFor="notes">
              Notes
            </label>
            <input
              id="notes"
              value={cfgNotes}
              maxLength={140}
              onChange={(e) => setCfgNotes(e.target.value)}
              placeholder="Less spicy, no onion…"
              style={input}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
              <button
                type="button"
                style={stepBtn}
                onClick={() => setCfgQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                {cfgQty}
              </span>
              <button
                type="button"
                style={stepBtn}
                onClick={() => setCfgQty((q) => Math.min(20, q + 1))}
              >
                +
              </button>
            </div>
            <button
              type="button"
              style={primaryBtn}
              onClick={() =>
                addToCart(configItem, cfgVariant, cfgAddons, cfgNotes.trim(), cfgQty)
              }
            >
              Add to cart
            </button>
          </div>
        </div>
      ) : null}

      {/* Cart sheet */}
      {showCart ? (
        <div style={overlay} onClick={() => setShowCart(false)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 20 }}>Your cart</h3>
            {cart.length === 0 ? (
              <p style={{ color: C.muted }}>Cart is empty — pick something delicious.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {cart.map((l, i) => (
                  <li
                    key={`${l.menuItemId}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "10px 0",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, margin: 0 }}>
                        {l.name}
                        {l.variant ? ` · ${l.variant}` : ""}
                      </p>
                      {l.addons.length ? (
                        <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>
                          {l.addons.join(", ")}
                        </p>
                      ) : null}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <button
                          type="button"
                          style={{ ...stepBtn, width: 32, height: 32, fontSize: 16 }}
                          onClick={() =>
                            setCart((prev) =>
                              prev
                                .map((x, j) =>
                                  j === i ? { ...x, qty: x.qty - 1 } : x
                                )
                                .filter((x) => x.qty > 0)
                            )
                          }
                        >
                          −
                        </button>
                        <span className="num">{l.qty}</span>
                        <button
                          type="button"
                          style={{ ...stepBtn, width: 32, height: 32, fontSize: 16 }}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, qty: x.qty + 1 } : x
                              )
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="num" style={{ fontWeight: 600 }}>
                      {formatMoney(l.unitPrice * l.qty, currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p
              className="num"
              style={{ fontSize: 22, fontWeight: 700, margin: "16px 0" }}
            >
              {formatMoney(cartTotal, currency)}
            </p>
            <button
              type="button"
              style={primaryBtn}
              disabled={busy || !cart.length}
              onClick={() => void placeOrder()}
            >
              {busy ? "Sending…" : "Send to kitchen"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const shell: CSSProperties = {
  minHeight: "100dvh",
  background: C.bg,
  color: C.ink,
  fontFamily:
    '"DM Sans", "Segoe UI", system-ui, -apple-system, sans-serif',
};

const label: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: C.muted,
  marginBottom: 6,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const input: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  padding: "0 12px",
  fontSize: 16,
  background: "#fff",
  color: C.ink,
  boxSizing: "border-box",
};

const primaryBtn: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 6,
  border: "none",
  background: C.accent,
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  height: 44,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.ink,
  fontWeight: 500,
  fontSize: 14,
  padding: "0 14px",
  cursor: "pointer",
};

const stepBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "#fff",
  fontSize: 22,
  cursor: "pointer",
  color: C.ink,
};

const chip: CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  cursor: "pointer",
  background: "transparent",
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(18,16,14,0.45)",
  zIndex: 40,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const sheet: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "85dvh",
  overflow: "auto",
  background: C.bg,
  borderRadius: "12px 12px 0 0",
  padding: "20px 16px calc(20px + env(safe-area-inset-bottom))",
};
