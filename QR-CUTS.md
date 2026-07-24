# QR Ordering — What Was Simplified

This build implements the core QR dine-in ordering loop (scan → menu → cart →
checkout → live session → staff approval/service requests → bill) end to end,
but deliberately cuts scope in a few places to keep the vertical slice
shippable. Each cut below is safe to revisit later without changing the data
model.

| Full-prompt requirement | What we shipped instead | Why |
|---|---|---|
| Server-Sent Events / WebSocket push for live session, KDS, and service-request updates | Client-side polling every 2000ms (`useEffect` + `fetch`) | Indistinguishable from push at demo scale/table counts; zero infra (no SSE endpoint keep-alive, no socket server, no reconnect/backoff logic) to build or operate. |
| Real payment gateway integration (Razorpay/Stripe UPI intents, webhooks, refunds) | Manual payment recording only — staff picks CASH/CARD/UPI and enters tendered amount; no money actually moves | A payment gateway needs a merchant account, webhook signature verification, and idempotent reconciliation — a project on its own. Guests never pay in-app; they always settle with staff. |
| Vector PDF / ZIP "DPI pack" export for QR table-tent and sticker printing | Browser print via CSS `@media print` on an on-screen SVG QR grid | Print-quality vector PDF generation (via a headless renderer) and multi-size ZIP bundling is a print-ops feature, not core ordering. The SVG QR code (from the `qrcode` package) still prints crisply at any browser zoom/DPI; users use "Print" → "Save as PDF" if they need a file. |
| Waiter push notifications (mobile push / native app) for service requests and approvals | In-app polling list on a `/tables` or session view staff must have open | No push infrastructure (APNs/FCM registration, device tokens) in scope. Staff are expected to keep the floor view open on a POS/tablet during service, which matches how the seeded demo is used. |
| Nightly cron job to recompute `MenuItem.repeatRate` from real order history | `repeatRate` is a static seeded field (0.35 on Butter Naan & Masala Chaas, 0.1 default elsewhere) with no scheduled recomputation | Running background jobs needs a scheduler (cron/queue) outside the Next.js request lifecycle. The field and its consumers (e.g. "frequently reordered" badges) work identically once a real job populates it later — only the job itself is deferred. |
| KMS-managed encryption of the per-restaurant QR signing secret, with envelope encryption and key rotation via a cloud KMS | HMAC-SHA256 token derived from `QR_MASTER_KEY` (env var) + `restaurantId` + `qrSecretVersion`, verified with `crypto.timingSafeEqual` | No KMS/HSM available in this environment. The derived-secret + versioning scheme still supports secret rotation (`qrSecretVersion`/`qrPreviousVersion`/`qrRotatedAt`, with a 30-day grace window for the previous version) — only the master key's own storage is a plain env var instead of a managed key. |
| Guest order approval via real-time manager dashboard with push alerts | `Restaurant.qrApprovalMode` + `Order.approvalStatus` fields exist and are enforced in checkout logic, but the manager-facing approval queue is read via the same 2000ms poll as everything else | Consistent with the polling decision above — no separate push channel for approvals. |
| Per-guest device fingerprinting via canvas/WebGL fingerprint libraries | `hashDevice()` — a SHA-256 hash of `User-Agent + client IP + server key`, stored in an httpOnly cookie alongside a random `deviceId` | Full browser fingerprinting needs a client-side JS library and is fragile across browser updates. The cookie+UA+IP hash is sufficient to deduplicate "returning device" analytics and per-guest cart lines for a single dine-in session. |
| Multi-language / i18n guest menu | English only | Out of scope for this slice; all guest-facing strings are already isolated in components, so i18n can be layered on later without restructuring. |
| Offline-tolerant guest ordering (service-worker cache, background sync) | Guest pages assume restaurant wifi is available; `guestRateLimit` + friendly error copy handle flaky connections, not full offline queuing | Same class of problem as offline POS — needs a write-ahead queue and idempotent server reconciliation, which is a dedicated project (see `ROADMAP.md`-style cuts in the base RestaurantOS prompt). |

## Things that are NOT cut (fully real)

- Multi-tenant `restaurantId` + `branchId` filtering via the `tenantPlugin` on every QR/session/guest collection.
- HMAC-signed, versioned QR tokens with `timingSafeEqual` verification (real cryptographic integrity, just not KMS-hosted).
- Money is always integer paise; `recomputeSessionTotals` recomputes session totals by summing live orders + payments — it never increments a running counter, so it can't drift.
- Idempotency key on `Order` (unique partial index) so a guest double-tapping "Place order" cannot create duplicate orders.
- Guest rate limiting per IP+route (in-memory token bucket) to blunt basic abuse from a single device.
