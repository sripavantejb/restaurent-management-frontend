"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import { apiUrl } from "@/lib/api-url";
import { SERVICE_TYPE_LABEL, label, type ServiceType } from "@/lib/labels";
import { GuestBottomBar } from "@/components/guest/GuestBottomBar";
import { GuestCartSheet } from "@/components/guest/GuestCartSheet";
import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestItemSheet } from "@/components/guest/GuestItemSheet";
import { GuestLanding } from "@/components/guest/GuestLanding";
import { GuestMenu } from "@/components/guest/GuestMenu";
import { GuestToast } from "@/components/guest/GuestToast";
import { GuestTrack } from "@/components/guest/GuestTrack";
import type {
  Bootstrap,
  CartLine,
  CheckoutData,
  Diet,
  MenuItem,
  Phase,
} from "@/components/guest/types";
import {
  getDeviceId,
  linePrice,
  menuCacheKey,
  uid,
} from "@/components/guest/utils";
import styles from "@/components/guest/guest-theme.module.css";

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
  const [activeCat, setActiveCat] = useState("");
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
  const [paidAmount, setPaidAmount] = useState(0);
  const placingRef = useRef(false);

  const currency = boot?.restaurant.currency ?? "INR";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

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
  }, [slug, branch, token, version, pollCheckout]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

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
    setHint("");
    try {
      const postSession = async (act: "START" | "JOIN") => {
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
            action: act,
            deviceId: getDeviceId(),
          }),
        });
        return { res, data: await res.json() };
      };

      let { res, data } = await postSession(action);

      if (
        action === "START" &&
        res.status === 409 &&
        typeof data.error === "string" &&
        data.error.includes("already in use")
      ) {
        const qs = new URLSearchParams({ slug, branch, token, v: version });
        const bootRes = await fetch(apiUrl(`/api/guest/bootstrap?${qs}`), {
          credentials: "include",
        });
        if (bootRes.ok) {
          const fresh = (await bootRes.json()) as Bootstrap;
          setBoot(fresh);
          if (
            fresh.openSession?.status === "OPEN" ||
            fresh.openSession?.status === "BILL_REQUESTED"
          ) {
            ({ res, data } = await postSession("JOIN"));
          }
        }
      }

      if (!res.ok) {
        setError(data.error || "Could not start");
        setHint(data.hint || "");
        return;
      }

      const status = (data.status as string) || "OPEN";
      if (boot.categories[0]) setActiveCat(boot.categories[0].id);
      if (status === "BILL_REQUESTED") {
        setPhase("track");
        void pollCheckout();
      } else {
        setPhase("menu");
      }
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

  async function service(type: ServiceType) {
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
      const billLike = type === "BILL" || type === "GET_BILL";
      showToast(
        data.throttled
          ? data.message
          : billLike
            ? `${label(SERVICE_TYPE_LABEL, type)} — waiter will confirm`
            : `${label(SERVICE_TYPE_LABEL, type)} — staff notified`
      );
      if (billLike) void pollCheckout();
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
      setPaidAmount(data.amount ?? 0);
      setCart([]);
      setCheckout(null);
      setPhase("paid");
      showToast(
        data.message ||
          `Paid ${formatMoney(data.amount, currency)} — table ready for next guests`
      );
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
      <div className={styles.shell}>
        <p className={styles.muted} style={{ textAlign: "center", marginTop: 80 }}>
          Loading your table…
        </p>
      </div>
    );
  }

  if (phase === "paid") {
    return (
      <div className={styles.shell}>
        <div className={styles.centerState}>
          <p className={styles.eyebrow}>Bill paid</p>
          <h1 className={styles.display} style={{ fontSize: 28, margin: "12px 0 8px" }}>
            Thank you
          </h1>
          <p className="num" style={{ fontSize: 32, fontWeight: 700, margin: "0 0 12px" }}>
            {formatMoney(paidAmount, currency)}
          </p>
          <p className={styles.muted} style={{ lineHeight: 1.5 }}>
            Table {boot?.table.number ?? ""} is clear for the next guests. The same
            QR on this table starts a fresh session — no reprint needed.
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ marginTop: 20 }}
            onClick={() => {
              setPaidAmount(0);
              void loadBootstrap();
            }}
          >
            Start new session
          </button>
        </div>
      </div>
    );
  }

  if (phase === "invalid" || wrongTable) {
    return (
      <div className={styles.shell}>
        <div className={styles.centerState}>
          <p className={styles.eyebrow}>RestaurantOS</p>
          <h1 className={styles.display} style={{ fontSize: 28, margin: "12px 0 8px" }}>
            {wrongTable ? "Wrong table?" : error || "This code is out of date"}
          </h1>
          <p className={styles.muted} style={{ lineHeight: 1.5 }}>
            {wrongTable
              ? "Ask staff for the correct QR, or scan the code on your table."
              : hint || "Please ask your server for a new one."}
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ marginTop: 20 }}
            onClick={() => {
              setWrongTable(false);
              void loadBootstrap();
            }}
          >
            {wrongTable ? "Scan again" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  if (!boot) return null;

  return (
    <div className={styles.shell}>
      <GuestToast message={toast} />

      {phase === "landing" ? (
        <GuestLanding
          boot={boot}
          guestCount={guestCount}
          guestName={guestName}
          busy={busy}
          error={error}
          hint={hint}
          onGuestCount={setGuestCount}
          onGuestName={setGuestName}
          onStart={() => void startSession("START")}
          onJoin={() => void startSession("JOIN")}
          onWrongTable={() => setWrongTable(true)}
          onRefresh={() => void loadBootstrap()}
        />
      ) : null}

      {phase === "menu" || phase === "track" ? (
        <>
          <GuestHeader
            restaurantName={boot.restaurant.name}
            tableNumber={boot.table.number}
            phase={phase}
            diet={diet}
            search={search}
            onDiet={setDiet}
            onSearch={setSearch}
          />

          {phase === "menu" ? (
            <GuestMenu
              categories={boot.categories}
              activeCat={activeCat}
              items={filteredItems}
              currency={currency}
              onCategory={setActiveCat}
              onOpenItem={openConfig}
            />
          ) : null}

          {phase === "track" ? (
            <GuestTrack
              checkout={checkout}
              currency={currency}
              tipPercent={tipPercent}
              quickReorder={quickReorder}
              busy={busy}
              onTip={setTipPercent}
              onService={(t) => void service(t)}
              onPay={() => void pay({ tipPercent })}
              onPayAtCounter={() => void pay({ payAtCounter: true })}
              onOrderAgain={() => {
                setPhase("menu");
                if (boot.categories[0]) setActiveCat(boot.categories[0].id);
              }}
              onQuickReorder={(it) => {
                openConfig(it);
                setPhase("menu");
              }}
            />
          ) : null}

          <GuestBottomBar
            phase={phase}
            rounds={rounds}
            sessionTotal={sessionTotal}
            currency={currency}
            cartQty={cartQty}
            onTrack={() => setPhase("track")}
            onMenu={() => setPhase("menu")}
            onCart={() =>
              cartQty ? setShowCart(true) : showToast("Add items first")
            }
          />
        </>
      ) : null}

      {configItem ? (
        <GuestItemSheet
          item={configItem}
          currency={currency}
          variant={cfgVariant}
          addons={cfgAddons}
          notes={cfgNotes}
          qty={cfgQty}
          onVariant={setCfgVariant}
          onToggleAddon={(name) =>
            setCfgAddons((prev) =>
              prev.includes(name)
                ? prev.filter((x) => x !== name)
                : [...prev, name]
            )
          }
          onNotes={setCfgNotes}
          onQty={setCfgQty}
          onAdd={() =>
            addToCart(
              configItem,
              cfgVariant,
              cfgAddons,
              cfgNotes.trim(),
              cfgQty
            )
          }
          onClose={() => setConfigItem(null)}
        />
      ) : null}

      {showCart ? (
        <GuestCartSheet
          cart={cart}
          currency={currency}
          cartTotal={cartTotal}
          busy={busy}
          onClose={() => setShowCart(false)}
          onQty={(index, nextQty) =>
            setCart((prev) =>
              prev
                .map((x, j) => (j === index ? { ...x, qty: nextQty } : x))
                .filter((x) => x.qty > 0)
            )
          }
          onPlace={() => void placeOrder()}
        />
      ) : null}
    </div>
  );
}
