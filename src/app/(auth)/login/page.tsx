"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api-url";
import styles from "./login.module.css";

const DEMO_ROLES = [
  { label: "Owner", email: "owner@demo.com", hint: "Full access" },
  { label: "Manager", email: "manager@demo.com", hint: "Ops + reports" },
  { label: "Cashier", email: "cashier@demo.com", hint: "POS" },
  { label: "Waiter", email: "waiter@demo.com", hint: "Floor" },
  { label: "Chef", email: "chef@demo.com", hint: "KDS" },
] as const;

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          `${data.error || "Login failed"}. ${data.hint || "Try owner@demo.com / demo1234."}`
        );
        setLoading(false);
        return;
      }
      await refresh();
      const role = data.user.role as string;
      router.replace(
        role === "CASHIER"
          ? "/pos"
          : role === "CHEF"
            ? "/kds"
            : role === "WAITER"
              ? "/waiter"
              : "/dashboard"
      );
    } catch {
      setError(
        "Could not reach the server. Start `npm run dev` and ensure MongoDB is running."
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero} aria-hidden={false}>
        <div className={styles.heroGlow} />
        <div className={styles.heroPattern} />
        <div>
          <p className={styles.brandEyebrow}>Multi-tenant restaurant ERP</p>
          <h1 className={styles.brandMark}>RestaurantOS</h1>
          <p className={styles.heroLead}>
            One system for floor, kitchen, billing, inventory, CRM, and AI —
            built for busy service, not spreadsheet ops.
          </p>
          <ul className={styles.heroList}>
            <li>
              <span className={styles.dot} />
              Live POS, KDS, and QR guest ordering
            </li>
            <li>
              <span className={styles.dot} />
              Inventory, HR, finance, and loyalty in one tenant
            </li>
            <li>
              <span className={styles.dot} />
              AI Copilot grounded on your restaurant data
            </li>
          </ul>
        </div>
        <p className={styles.heroFoot}>Demo tenant · India GST-ready · INR</p>
      </section>

      <section className={styles.panel}>
        <form onSubmit={onSubmit} className={styles.card}>
          <div className={styles.mobileBrand}>
            <p className={styles.brandEyebrow}>RestaurantOS</p>
            <p className={styles.brandMark}>Sign in</p>
          </div>

          <h2 className={styles.title}>Staff console</h2>
          <p className={styles.subtitle}>
            Use a demo role below, or enter your restaurant credentials.
          </p>

          <div className={styles.roles} role="group" aria-label="Demo roles">
            {DEMO_ROLES.map((r) => (
              <button
                key={r.email}
                type="button"
                className={`${styles.roleBtn} ${
                  email === r.email ? styles.roleBtnActive : ""
                }`}
                onClick={() => {
                  setEmail(r.email);
                  setPassword(DEMO_PASSWORD);
                  setError("");
                }}
              >
                <strong>{r.label}</strong>
                <span>{r.hint}</span>
              </button>
            ))}
          </div>

          <label className="mt-5 block text-xs font-medium text-[var(--muted)]">
            Email
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-[var(--muted)]">
            Password
            <Input
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="mt-5 w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className={styles.meta}>
            Platform admin?{" "}
            <a href="/admin/login">Sign in at /admin/login</a>
          </p>
        </form>
      </section>
    </div>
  );
}
