# RestaurantOS — frontend

Next.js 15 App Router (UI + API routes).

## Setup

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

### Demo users (password `demo1234`)

| Email | Role | URL |
|---|---|---|
| admin@restaurantos.com | Platform admin | `/admin/login` |
| owner@demo.com | OWNER | `/login` |
| manager@demo.com | MANAGER | `/login` |
| cashier@demo.com | CASHIER → `/pos` | `/login` |
| waiter@demo.com | WAITER | `/login` |
| chef@demo.com | CHEF → `/kds` | `/login` |

### Platform admin

- `/admin/login` — SaaS platform admin sign-in
- `/admin` — overview of restaurant registrations
- `/admin/restaurants` — list / filter tenants
- `/admin/restaurants/new` — register a restaurant (tenant + branch + owner)
