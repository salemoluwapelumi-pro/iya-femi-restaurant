# Iya Femi Restaurant Digital Platform

A complete web platform for **Iya Femi Restaurant**, Broadcasting Road, Minna, Niger State — a customer-facing ordering website plus a secure admin dashboard, built with vanilla HTML/CSS/JavaScript, Node.js (Express) and PostgreSQL.

## What it does

**Customers can:**
- Browse the menu by category, search, sort and see current prices
- Add meals to a cart, choose delivery / pickup / dine-in, and check out
- Pay by bank transfer (details shown after checkout) or cash on delivery/pickup
- Track orders by order number + phone number through a status timeline
- Read approved reviews and submit their own (verified when tied to a completed order)
- Find opening hours, phone numbers, WhatsApp link and Google Maps directions

**Restaurant staff can (via `/admin`):**
- See a dashboard: today's orders, paid revenue, pending orders, popular meals
- Manage menu items (create/edit/archive, prices, images, availability, featured)
- Manage categories and delivery zones/fees
- Process orders: change status, verify payments with unique transaction references
- Moderate customer reviews
- Edit restaurant settings: contact info, opening hours, minimum order, **bank account details** (placeholders are seeded — fill in real details in Admin → Settings), social links
- Review a full audit log of admin actions

## Technology

- Frontend: semantic HTML5, CSS3 (mobile-first, no framework), vanilla JavaScript
- Backend: Node.js + Express (REST API)
- Database: PostgreSQL
- Auth: JWT + bcrypt password hashing, rate limiting on login and write endpoints

## Project structure

```
├── frontend/            # Static customer site + admin SPA (served by Express)
│   ├── index.html, menu.html, checkout.html, track.html, contact.html
│   ├── admin/index.html
│   ├── css/  js/  assets/
├── backend/
│   ├── server.js
│   ├── routes/  controllers/  models/  middleware/  config/
├── database/
│   ├── schema/schema.sql   # tables
│   ├── init.js             # creates tables
│   └── seed.js             # seeds admin, menu, zones, settings
├── .env.example
└── package.json
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database (PostgreSQL)

```bash
sudo -u postgres psql -c "CREATE USER iyafemi WITH PASSWORD 'iyafemi_dev';"
sudo -u postgres psql -c "CREATE DATABASE iyafemi OWNER iyafemi;"
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, a strong random `JWT_SECRET`, and the initial `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### 4. Initialize and seed the database

```bash
npm run db:init   # creates tables
npm run db:seed   # seeds admin account, categories, menu, delivery zones, settings
```

The seed uses **estimated menu prices** from public sources and **placeholder bank details / logo** — update them in Admin → Settings once confirmed with the restaurant.

### 5. Run

```bash
npm start         # or: npm run dev (auto-restarts on change)
```

- Customer site: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin (log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`)

## API overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/menu` | — | Menu (`?category=&search=&sort=`) |
| GET | `/api/categories` | — | Active categories |
| GET | `/api/settings/public` | — | Public restaurant info + open/closed state |
| GET | `/api/delivery-zones` | — | Active delivery zones and fees |
| POST | `/api/orders` | — | Place an order (server recalculates all totals) |
| GET | `/api/orders/track/:orderNumber?phone=` | — | Track an order (phone must match) |
| GET/POST | `/api/reviews` | — | Approved reviews / submit review |
| POST | `/api/auth/login` | — | Admin login → JWT |
| * | `/api/admin/...` | JWT | Dashboard, menu, categories, orders, payments, reviews, settings, zones, uploads, audit log |

All responses use `{ success, data }` or `{ success: false, error }`.

## Business rules enforced

- Unavailable/archived items cannot be ordered; availability is revalidated at checkout
- The server computes order totals from current database prices — client totals are never trusted
- Order items snapshot the price at purchase time, so later price changes never affect past orders
- Only authenticated staff can change order status or mark payments; each payment needs a unique transaction reference (duplicates are rejected)
- Orders are blocked outside opening hours and below the configured minimum order
- Price changes, status changes and settings edits are written to the audit log

## Testing

```bash
npm run lint      # syntax-checks all JS files
```

Manual flow: place an order on the site → log in at `/admin` → confirm the order, record the payment reference, advance the status → track it as the customer.

## Deployment notes

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a production `DATABASE_URL`
- Run behind a reverse proxy (nginx/Caddy) with HTTPS
- Serve with a process manager, e.g. `pm2 start backend/server.js --name iyafemi`
- Run `npm run db:init && npm run db:seed` once against the production database
