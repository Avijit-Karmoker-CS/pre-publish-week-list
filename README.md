# Pre-Publish Week List

Local-first coordination tool for Atlantic Canada startup-support orgs: **check peer events before you publish**, so same-day clashes drop — without a daily checklist and **without a database**.

Live repo: https://github.com/Avijit-Karmoker-CS/pre-publish-week-list

## Why this exists

About 25 orgs run founder events with no shared view. Staff publish blind. Founders skip or split attendance. Thin teams reject heavy process. Discovery budget is capped at CAD 200.

## Features

- **Pre-publish check** — pick date + time band first; see clash risk before saving
- **Week board** — Monday–Sunday view with filters (org, time band, search)
- **Clash detection** — same date + same time band (morning / afternoon / evening)
- **Pilot stats** — events this week, events sitting in clash slots, orgs posting
- **Checked-before-publish** flag on each row
- **Demo seed** — sample week including a Thursday evening clash
- **CSV / JSON export & import** — share a sheet dump or restore a backup
- **Print week** — browser print stylesheet for Meet / handouts
- **localStorage only** — no server, no login, no DB

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm run build
npm run preview
```

## Pilot scope (bet 1)

- 5–8 peer organizations
- Fields: **title · date · time band · org** (+ posted by, notes)
- Rule: check list → publish on Eventbrite → add your row (~2 minutes)
- Measure clashes and usage for **2 weeks**
- Stop if unused; pivot if crowded slots persist; continue only with proof

## Presentation

[Download the 6-slide deck](./pre-publish-week-list-6-slides.pptx)

## License

MIT
