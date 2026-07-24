"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function slugifyPreview(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function RegisterRestaurantPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [branchName, setBranchName] = useState("Main");
  const [branchCode, setBranchCode] = useState("B1");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : slugifyPreview(name)),
    [slug, slugTouched, name]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await platformFetch("/api/platform/restaurants", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: effectiveSlug || undefined,
          address,
          gstNumber,
          contactEmail,
          contactPhone,
          status,
          branchName,
          branchCode,
          ownerName,
          ownerEmail,
          ownerPassword,
        }),
      });
      router.push(`/admin/restaurants/${data.restaurant.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <Link
          href="/admin/restaurants"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Restaurants
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Register restaurant
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Creates the tenant, first branch, and owner login in one step.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Restaurant
          </h2>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Slug
            <Input
              className="mt-1"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="auto-from-name"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Address
            <Input
              className="mt-1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--muted)]">
              GST number
              <Input
                className="mt-1"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Status
              <select
                className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] bg-white px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--muted)]">
              Contact email
              <Input
                className="mt-1"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Contact phone
              <Input
                className="mt-1"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            First branch
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--muted)]">
              Branch name
              <Input
                className="mt-1"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Branch code
              <Input
                className="mt-1"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                required
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Owner account
          </h2>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Owner name
            <Input
              className="mt-1"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Owner email
            <Input
              className="mt-1"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Owner password
            <Input
              className="mt-1"
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
        </Card>

        {error ? (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Registering…" : "Register restaurant"}
          </Button>
          <Link href="/admin/restaurants">
            <Button type="button" variant="secondary" size="lg">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
