"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  PlatformAuthProvider,
  usePlatformAuth,
} from "@/components/PlatformAuthProvider";
import { apiUrl } from "@/lib/api-url";
import styles from "@/app/(auth)/login/login.module.css";

function LoginForm() {
  const router = useRouter();
  const { refresh } = usePlatformAuth();
  const [email, setEmail] = useState("admin@restaurantos.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/platform/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          `${data.error || "Login failed"}. ${
            data.hint || "Try admin@restaurantos.com / demo1234."
          }`
        );
        setLoading(false);
        return;
      }
      await refresh();
      router.replace("/admin");
    } catch {
      setError(
        "Could not reach the server. Start `npm run dev` and ensure MongoDB is running."
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroPattern} />
        <div>
          <p className={styles.brandEyebrow}>SaaS control plane</p>
          <h1 className={styles.brandMark}>RestaurantOS</h1>
          <p className={styles.heroLead}>
            Register restaurants, manage plans and billing, and keep every
            tenant isolated — from one platform console.
          </p>
          <ul className={styles.heroList}>
            <li>
              <span className={styles.dot} />
              Tenant onboarding without public signup
            </li>
            <li>
              <span className={styles.dot} />
              Plan limits, trials, and Razorpay billing
            </li>
            <li>
              <span className={styles.dot} />
              Cross-restaurant visibility for operators
            </li>
          </ul>
        </div>
        <p className={styles.heroFoot}>Platform admin · demo seed account</p>
      </section>

      <section className={styles.panel}>
        <form onSubmit={onSubmit} className={styles.card}>
          <div className={styles.mobileBrand}>
            <p className={styles.brandEyebrow}>RestaurantOS</p>
            <p className={styles.brandMark}>Admin</p>
          </div>

          <h2 className={styles.title}>Platform admin</h2>
          <p className={styles.subtitle}>
            Sign in to manage restaurant registrations across the SaaS
            platform.
          </p>

          <label className="mt-6 block text-xs font-medium text-[var(--muted)]">
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
            {loading ? "Signing in…" : "Sign in to console"}
          </Button>

          <p className={styles.meta}>
            Restaurant staff? <a href="/login">Sign in at /login</a>
          </p>
        </form>
      </section>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <PlatformAuthProvider>
      <LoginForm />
    </PlatformAuthProvider>
  );
}
