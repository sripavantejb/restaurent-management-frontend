# RestaurantOS — frontend

Next.js 15 App Router (UI + API routes + models).

## Setup

```bash
npm install
# Configure .env.local from .env.example
npm run seed
npm run dev
```

Open http://localhost:3000

See the root [README.md](../README.md) for the full feature list and demo credentials.

### Demo users (password `demo1234`)

| Email | Role | URL |
|---|---|---|
| admin@restaurantos.com | Platform admin | `/admin/login` |
| owner@demo.com | OWNER | `/login` |
| manager@demo.com | MANAGER | `/login` |
| cashier@demo.com | CASHIER → `/pos` | `/login` |
| waiter@demo.com | WAITER → `/waiter` | `/login` |
| chef@demo.com | CHEF → `/kds` | `/login` |
