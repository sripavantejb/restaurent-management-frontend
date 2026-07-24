# RestaurantOS — 3-minute demo script

Use two browser windows (or one normal + one private window).

## Prep

```bash
npm run seed
npm run dev
```

Open http://localhost:3000

## Click path

1. **Waiter takes a dine-in order**  
   - Window A → login `waiter@demo.com` / `demo1234`  
   - Open **POS** → **Dine-In** → **Pick table** → choose a green FREE table  
   - Add **Hyderabadi Chicken Biryani** (+ configure if prompted) and **Butter Naan**  
   - **Save & Send to Kitchen** — note the order number toast

2. **Chef works the ticket**  
   - Window B → login `chef@demo.com` / `demo1234` (lands on **KDS**)  
   - Ticket appears under **NEW** within ~2s with a live timer  
   - Tap card → **COOKING** → tap again → **READY**

3. **Cashier bills the same order**  
   - Window A → sign out → login `cashier@demo.com` / `demo1234`  
   - Open **Orders** → click the order from step 1  
   - Under the bill, click **Pay UPI** (or CARD / CASH)  
   - Status becomes COMPLETED; table returns to FREE on **Tables**

4. **Dashboard revenue + branch switch**  
   - Login `owner@demo.com` / `demo1234` → **Dashboard**  
   - Today's revenue / order count include the payment  
   - Sidebar branch switcher → **Gachibowli** — KPIs change  
   - Switch back to **Banjara Hills** — numbers restore  
   - OWNER also sees the branch comparison row

## What this proves

JWT + RBAC, tenant filter via branch switch, POS → KDS polling → payment → reports on real Mongo data.
