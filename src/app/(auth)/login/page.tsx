"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/api-url";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState("demo1234");
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
      const role = data.user.role;
      router.replace(
        role === "CASHIER" ? "/pos" : role === "CHEF" ? "/kds" : "/dashboard"
      );
    } catch {
      setError(
        "Could not reach the server. Start `npm run dev` and ensure MongoDB is running."
      );
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, #f3e6d8 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, #e8f2ef 0%, transparent 45%), #faf8f5",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-[var(--border)] bg-white/90 p-8"
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          RestaurantOS
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Demo password for all roles: <span className="num">demo1234</span>
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
        <label className="mt-4 block text-xs font-medium text-[var(--muted)]">
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

        <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Platform admin?{" "}
          <a href="/admin/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
            Sign in at /admin/login
          </a>
        </p>
      </form>
    </div>
  );
}
