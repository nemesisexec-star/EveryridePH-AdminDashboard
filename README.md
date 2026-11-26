# Everyride · Operations Dashboard

Internal admin dashboard for **Everyride Car Rental Services** — track every booking, manage the fleet, see who's picking up and returning today, and keep an eye on collections.

Pure static site (HTML + CSS + vanilla JS). No build step, no dependencies — works as-is on GitHub Pages.

## Pages

| Page | What it does |
|---|---|
| **Overview** | Today's pickups/returns, active rentals, revenue chart, fleet status, items needing attention |
| **Bookings** | Searchable/filterable list. Add, edit, cancel, delete. Mark *picked up* / *returned*. Record payments |
| **Calendar** | 14-day timeline per vehicle. Click an empty day to start a booking. Double-booking is blocked |
| **Fleet** | Vehicle cards with live status (Available / On rent / Maintenance). Add/edit vehicles and rates |
| **Customers** | Auto-built from bookings: lifetime spend, repeat renters, balances |
| **Finance** | Billed vs collected, revenue by vehicle, outstanding balances, CSV export |

## Deploy on GitHub Pages

1. Push these files to the root of the `main` branch.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`** → Save.
3. Your dashboard will be live at `https://nemesisexec-star.github.io/EveryridePH-AdminDashboard/`.

## Important: where data is stored

GitHub Pages only serves static files, so bookings are saved in the **browser's localStorage** on each device. That means:

- Data is **not shared** between staff devices/browsers yet.
- Use **Data & backup** (the database icon, top right) to export/import a JSON backup or a CSV for Excel.
- The first launch loads **demo data** — open *Data & backup → Start fresh* to clear it before real use.
- There is no login. Treat the URL as private, or make the repo/page private (GitHub Pages private needs a paid plan), until a backend is added.

### Next step for multi-user use
To have the whole team share one live database, swap the `save()` / `load()` functions in `js/app.js` for a hosted backend such as Supabase or Firebase (both have free tiers and work from a static site) and add staff login.

## Project structure

```
index.html        App shell
css/styles.css    Design system (brand green + yellow, Apple-style)
js/app.js         All views, data layer, booking logic
assets/           Logo, favicon, hero banner
.nojekyll         Tells GitHub Pages to serve files as-is
```

## Business rules built in

- Rental days = return date − pickup date (24-hour blocks, minimum 1).
- Total = days × (daily rate + optional driver fee ₱1,500/day) − discount.
- A vehicle can't be double-booked on overlapping dates; vehicles in maintenance can't be booked.
- Change the driver fee at the top of `js/app.js` (`DRIVER_FEE`).
