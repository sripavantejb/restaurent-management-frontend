# Decisions Log

## Stack & structure
- Layout: `frontend/` (Next.js UI + API routes, models, lib) and `backend/` (DB seed).
- Default `MONGODB_URI` points at MongoDB Atlas cluster `cluster0` database `restaurantos` (not `dsa-tracker`, so seed cannot wipe that app's data).
- Tailwind CSS **v3** instead of v4: this machine's Application Control policy blocks native optional binaries (`@tailwindcss/oxide`, Next SWC). v3 + PostCSS builds cleanly; Next falls back to `@next/swc-wasm-nodejs`.
- Fonts loaded via Google Fonts CSS link instead of `next/font` to avoid SWC/font pipeline issues on the same host.

## Multi-tenancy
- Tenant plugin filters on both `restaurantId` and `branchId` for business collections.
- User model is restaurant-scoped only (no branchId on User); branch comes from JWT / active branch header.
- Owner can switch branch via `x-branch-id` header; others are locked to their JWT branchId.

## Auth
- JWT in httpOnly cookie `ros_token`. No refresh tokens.
- Middleware redirects unauthenticated users to `/login` and role-homes cashiers → `/pos`, chefs → `/kds`.

## Money
- All amounts stored as integer paise. GST fixed at 5% applied after discount.

## Real-time
- Client polls every 2000ms with useEffect; no websockets.
