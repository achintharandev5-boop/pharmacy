# Pharmacy Admin Dashboard V2 — Operations Command Center Plan

**Author:** Senior SaaS Product Designer & Lead Full-Stack Architect  
**Target System:** Production-Grade Pharmacy Operations Command Center  
**Date:** October 5, 2026  

---

## 1. Current Dashboard Architecture Overview

The existing admin dashboard at `/admin` is basic. It displays simple text counts, mock recent patients, and raw system indicators without real-time database analytics, deep drill-downs, or domain-driven operational metrics.

### Key Limitations Being Fixed:
- No real-time database aggregation for today's prescriptions, labels, patients served, or items dispensed.
- Lack of interactive activity charts (line/area chart for activity over 7d/30d/3m/1y).
- Absence of workload distribution charts (Prescription Status donut chart & Dispensing by Time bar chart).
- Missing dedicated administrative sub-routes (`/admin/patients`, `/admin/patients/[id]`, `/admin/prescriptions`, `/admin/prescriptions/[id]`, `/admin/products`, `/admin/products/[id]`, `/admin/inventory`, `/admin/labels`, `/admin/analytics`, `/admin/settings`).
- Missing Patient 360° Profile view with historical prescriptions, medicines list, and reprint triggers.
- Missing Stock Movement Audit Log & Inventory Alert Center.

---

## 2. Target Operations Command Center Architecture

```
[ Next.js 15 Admin App Router ]
  ├── Shared Layout: Persistent Left Sidebar (240px) + Header Bar with Global Search & Alerts
  ├── Pages:
  │    ├── /admin                      (Executive Overview Command Center)
  │    ├── /admin/patients             (Patient Directory with search & filters)
  │    ├── /admin/patients/[id]        (Patient 360° Profile & Prescription History)
  │    ├── /admin/prescriptions        (Prescription Records Master List)
  │    ├── /admin/prescriptions/[id]    (Prescription Detail, Items & Audit Log)
  │    ├── /admin/products             (Product Catalog & Stock Management)
  │    ├── /admin/products/[id]        (Product Detail & Stock Movement History)
  │    ├── /admin/inventory            (Inventory Dashboard & Priority Alerts)
  │    ├── /admin/labels               (Label History Log)
  │    ├── /admin/analytics            (Pharmacy Analytics & Top Dispensed Medicines)
  │    └── /admin/settings             (System Settings & Gateway Health)
  │
  ▼
[ NestJS Admin Dashboard API (`/admin/dashboard/*`) ]
  ├── GET /admin/dashboard/summary            (SQL COUNT/SUM aggregations for 6 KPI cards)
  ├── GET /admin/dashboard/activity           (date_trunc('day') SQL trend for activity chart)
  ├── GET /admin/dashboard/status-breakdown   (Prescription Status & Dispensing by Time)
  ├── GET /admin/dashboard/top-products       (Most dispensed products SQL aggregation)
  ├── GET /admin/dashboard/alerts             (Low stock, expiring products & system alerts)
  ├── GET /admin/dashboard/recent-activity    (Audit events feed from `prescription_events`)
  ├── GET /admin/patients                     (Patients list with counts & last visit)
  ├── GET /admin/patients/:id                 (Patient 360 profile with prescription history)
  ├── GET /admin/products/:id/movements       (Stock movement audit trail)
  └── GET /admin/health                       (System health check for DB, API, SMS, Print)
  │
  ▼
[ PostgreSQL Database (Supabase) ]
  ├── `prescriptions`, `prescription_items`, `customers`, `products`
  └── `inventory_movements`, `prescription_events`
```

---

## 3. Required Database Schema & Queries

### SQL Aggregations for Performance (Server-Side)
- **Today Summary KPI:**
  `SELECT count(*) FROM prescriptions WHERE created_at >= CURRENT_DATE`
  `SELECT sum(print_count) FROM prescriptions WHERE created_at >= CURRENT_DATE`
  `SELECT count(DISTINCT customer_id) FROM prescriptions WHERE created_at >= CURRENT_DATE`
  `SELECT sum(quantity) FROM prescription_items WHERE created_at >= CURRENT_DATE`
  `SELECT count(*) FROM products WHERE stock_quantity <= 15`
  `SELECT count(*) FROM products WHERE expiry_date <= (CURRENT_DATE + INTERVAL '30 days')`

- **Activity Trend (7d, 30d, 3m, 6m, 1y):**
  `SELECT date_trunc('day', created_at) AS date, count(id) AS prescriptions FROM prescriptions WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`

- **Top Dispensed Products:**
  `SELECT product_name_snapshot, sum(quantity) as total_dispensed FROM prescription_items GROUP BY 1 ORDER BY 2 DESC LIMIT 10`

- **Dispensing by Time of Day:**
  `SELECT CASE WHEN EXTRACT(HOUR FROM created_at) BETWEEN 6 AND 11 THEN 'Morning' WHEN EXTRACT(HOUR FROM created_at) BETWEEN 12 AND 17 THEN 'Afternoon' ELSE 'Evening' END as time_of_day, count(*) FROM prescriptions GROUP BY 1`

---

## 4. UI/UX Design System & Layout Specification

- **Color Palette:**
  - Background: `#F8FAFC` (Slate-50)
  - Surface: `#FFFFFF` with 1px border `#E2E8F0`
  - Primary Accent: `#4F46E5` (Indigo-600)
  - Text Primary: `#0F172A` (Slate-900)
  - Text Secondary: `#64748B` (Slate-500)
  - Success: `#16A34A` (Emerald-600)
  - Warning: `#D97706` (Amber-600)
  - Danger: `#DC2626` (Red-600)
- **Typography:** Inter / Geist font family, compact enterprise padding (20-24px), 12px rounded cards.
- **Icons:** Pure `lucide-react` SVG icons (no emoji icons).
- **Navigation:**
  - Left Sidebar (240px fixed width on desktop, drawer on mobile).
  - Header: Global search input (`"Search patient, phone, prescription, product or barcode..."`), Notification bell, System health badge, Admin profile, Logout button, and `← Label Workstation` shortcut button.

---

## 5. New Backend Controllers & Services Required

1. `apps/api/src/admin/admin.controller.ts`
2. `apps/api/src/admin/admin.service.ts`
3. `apps/api/src/admin/admin.module.ts`
4. Register `AdminModule` in `app.module.ts`.

---

## 6. Implementation Sequence

- **PHASE 1:** Create NestJS `AdminModule` & Dashboard Analytics SQL Endpoints.
- **PHASE 2:** Create Web Server Actions (`apps/web/app/actions/admin.ts`).
- **PHASE 3:** Build Command Center Shell Layout (`apps/web/app/admin/layout.tsx` & Sidebar/Header).
- **PHASE 4:** Build Executive Overview (`/admin`) with 6 KPI cards, Recharts Activity Chart, Status Donut, Time Bar Chart, Smart Alert Center, Recent Prescriptions, Top Products & System Health.
- **PHASE 5:** Build Patient Directory & Patient 360° Profile (`/admin/patients` & `/admin/patients/[id]`).
- **PHASE 6:** Build Prescription Directory & Detail View (`/admin/prescriptions` & `/admin/prescriptions/[id]`).
- **PHASE 7:** Build Product Directory, Stock Management & Detail View (`/admin/products` & `/admin/products/[id]`).
- **PHASE 8:** Build Inventory Dashboard (`/admin/inventory`) & Analytics View (`/admin/analytics`).
- **PHASE 9:** Automated Testing, Typechecking, Linting & Build Verification.
