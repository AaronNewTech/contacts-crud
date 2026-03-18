# Contacts CRUD (with simple scheduler)

A small Django app for managing contacts, contact methods (email/phone/social), and a minimal event scheduler attached to contacts. It provides a single-page-ish UI with a contact list and a detail pane that includes contact methods and per-contact events/calendar views.

This repository contains the backend (Django) and a small client-side UI written in vanilla JavaScript and CSS.

## Key features

- Create, read, update and delete contacts
- Add/remove contact methods (email, phone, social)
- Minimal per-contact event scheduler (create/update/delete events)
- Calendar month grid view and list view of events
- Client-side validation for contact methods (basic dedupe & email format checks)
- Centralized AJAX helper that attaches CSRF token from page meta (<meta name="csrf-token">) and surfaces 403-friendly banners
- CLI smoke test (`tools/smoke.sh`) that exercises create/update/delete flows and reports results

## Tech/stack

- Python 3.x
- Django (project entry: `manage.py`, app modules: `contact/`, `contact_method/`, `contacts_crud/`)
- SQLite included for local development (db.sqlite3 in repo) — switch to Postgres for production
- Frontend: vanilla JS (extracted to `static/js/home.js`) and CSS in `static/css/home.css`

## Project layout (high-level)

- `manage.py` — Django CLI
- `contacts_crud/` — core Django settings and URL config
- `contact/` — contact model, templates, and views
- `contact_method/` — contact method model and APIs
- `static/` — static assets (js, css, images)
  - `static/js/home.js` — main client script (handles fetchJson, UI wiring, calendar views)
  - `static/css/home.css` — styles
- `templates/` — top-level templates (home.html)
- `tools/smoke.sh` — simple CLI smoke tester that extracts CSRF meta and exercises APIs

## Important implementation notes

- CSRF: client JS expects a `<meta name="csrf-token" content="{{ csrf_token }}">` tag in the rendered page head. The small `fetchJson()` helper reads this meta and sets `X-CSRFToken` for non-GET requests. This is intentional (explicit meta source) and works with Django's `csrf_token` template tag when `CsrfViewMiddleware` is enabled.

- Static files: the UI was refactored to move inline JS into `static/js/home.js` and the template now includes it via `{% static 'js/home.js' %}`. Make sure `collectstatic` and your static-file serving (WhiteNoise, nginx, CDN) are configured in production.

- Client validation: some UX validation exists (email regex, duplicate contact methods, event overlap checks). These are client-side conveniences only — server-side validation and DB constraints are required for authoritative enforcement under concurrency.

- Events overlap: the UI performs an overlap check for events per contact as a UX guard.

## Smoke test (CLI)

There is a small helper script `tools/smoke.sh` that:

- fetches the homepage to extract the CSRF meta token
- runs a create -> update -> create event -> update event -> delete event -> delete contact lifecycle
- stores temporary outputs for debugging

Usage (local dev):

```bash
chmod +x tools/smoke.sh
./tools/smoke.sh
```

## API endpoints (high-level)

The project exposes JSON endpoints for contacts and events. Examples (relative to site root):

- `GET /contacts/api/` — list contacts (UI uses template-rendered list, check views)
- `POST /contacts/api/create/` — create contact (expects JSON payload)
- `GET /contacts/api/<pk>/` — fetch contact detail including methods and events
- `POST /contacts/api/<pk>/update/` — update contact
- `DELETE /contacts/api/<pk>/delete/` — delete contact
- `POST /contacts/api/<pk>/events/create/` — create event for contact
- `POST /contacts/event/<event_id>/update/` — update event
- `DELETE /contacts/event/<event_id>/delete/` — delete event

(See the app `views.py` files for exact request/response shapes.)

## Where to look in the code

- `static/js/home.js` — main front-end logic (fetchJson helper, renderers, DOM wiring)
- `static/css/home.css` — styles (recent tweaks: event header alignment and image-button hover darken)
- `templates/home.html` — page layout and meta tag for CSRF token
- `tools/smoke.sh` — CLI smoke test
- `contact/`, `contact_method/` — models, views and admin
