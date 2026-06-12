# NutriPrint Old-Version Merge Report

## 1. Features present in `old_version` but missing or no longer exposed in the current project

- The old app exposed a password-based teacher auth flow with signup, login, logout, and a session-backed `/api/auth/me` check. The current app uses Supabase OTP auth and does not expose the old phone/password flow.
- The old single-page landing screen bundled Home, BMI, Meal Planner, Nutrition Catalog, Dashboard, and About into one interactive shell. The current project splits those into separate templates and only keeps the BMI/meal/catalog/dashboard surfaces that are still wired.
- The old frontend included bulk/compound behaviors that are not present in the current UI, including AI advice insertion into the poster, bulk poster generation, and a richer teacher dashboard flow tied to the older session model.
- The old static poster page supported a direct QR image endpoint and explicit save semantics around `saved_plans`. The current app stores meal plans through Supabase when they are generated and uses public poster/report routes instead.
- The old rule engine emphasized regional scoring, budget-aware ranking, portion scaling by BMI or age group, and a 6-day output. The current engine uses a 7-day Groq-first plan with fallback generation and a different schema.

## 2. Files that should be merged

- `old_version/meal_generator.py` should be merged conceptually into `services/fallback_engine.py` and/or `services/groq_engine.py` for any rule-engine improvements such as regional scoring, stronger variety constraints, and portion scaling logic.
- `old_version/static/js/app.js` contains the broadest set of legacy UI behaviors. Its useful pieces should be selectively merged into the current split frontend scripts rather than copied wholesale.
- `old_version/style.css` and `old_version/static/css/print.css` contain older layout and print styling ideas that can be ported selectively into the current Tailwind/template-based styling.
- `old_version/index.html` is still the best map of the original navigation and content flow. Its missing home/dashboard/about/catalog sections should be used as a reference for restoring or reintroducing equivalent sections.
- `old_version/database.py` and `old_version/migrate.py` should be used as schema/reference material only. Their table shapes and seed data are useful, but the current Supabase-backed data layer should remain the source of truth.

## 3. UI components that were removed

- The old top-level one-page navigation sections for Dashboard, Library, and About are no longer part of the current homepage shell.
- The old auth modal with sign-up/login tabs, teacher profile banner, and inline logout button is not present in the current UI.
- The old showcase cards and project-info bar at the top of the landing page are not carried over.
- The old plan/poster presentation included stronger QR-first poster affordances and a more explicit printable poster page.
- The old bulk/progress-oriented controls for generating many posters and reviewing growth over time are not present in the current frontend.

## 4. API routes that were removed or changed

- Removed/changed auth routes: `/api/auth/signup`, `/api/auth/login` with phone/password semantics, and `/api/auth/logout` from the old Flask app were replaced by Supabase OTP endpoints under `/auth/login`, `/auth/verify`, and `/auth/logout`.
- Removed/changed meal route: `/api/meals/generate` from the old app was renamed to `/api/meal/generate` in the current app.
- Removed persistence route: `/api/plans/save` no longer exists because the current app persists the meal plan during generation.
- Removed QR route: `/api/plans/qr/<qr_code>` was not exposed in the current project before this merge.
- Removed student-create route: `/api/students` from the old app is not exposed in the current API surface.

## 5. CSS/JS functionality that was removed

- The old `static/js/app.js` handled section routing, auth modal rendering, teacher banner updates, auto-fill behavior, and dashboard/library reloads in one file. The current frontend split those concerns and does not re-create all of them.
- The old JS included bulk poster and AI advice related actions that are not visible in the current split frontend.
- The old CSS was tightly coupled to the one-page layout and included styles for the old landing sections, info bar, and poster pages. The current styling is template- and utility-driven instead.
- The old splash/animation behavior was more coupled to the single-page landing experience; the current app uses a lighter splash/animation setup.

## 6. Database-related differences

- Old schema: direct PostgreSQL tables created in app startup (`teachers`, `students`, `bmi_records`, `saved_plans`, `foods`) with password hashes and QR-based saved plans.
- Current schema: Supabase-backed tables with OTP auth, teacher profiles keyed by `auth_user_id`, `meal_plans` JSON storage, and BMI records that store richer BMI analysis fields.
- Old `foods` content lived in the database and was seeded from Python; current food catalog is JSON-backed through `data/foods.json`.
- Old BMI storage kept a simpler physical-measurement record; current BMI storage stores percentile, z-score, classification, and advice text.
- Old saved plans used `qr_code` and a serialized `plan_data` payload; current plans use `share_token` and nested `plan_json`.

## 7. Recommended code changes to restore missing features safely

1. Keep the current Supabase auth and storage model as the source of truth.
2. Add compatibility routes only where they are thin wrappers around current behavior, not replacements for current auth or DB code.
3. Restore the missing QR image endpoint as a read-only helper so legacy poster flows can still render scannable codes.
4. Add a read-only `/api/auth/me` compatibility endpoint so old navigation logic can detect logged-in teachers without changing the new OTP flow.
5. Add a `/api/meals/generate` alias that forwards to `/api/meal/generate` so old clients still work.
6. Re-implement any retired UI affordances only as optional frontend components that consume the current APIs, not as a rewrite of the current homepage or dashboard.
7. If you want the old bulk generation and AI advice features back, port them incrementally into the current dashboard and poster pages after verifying the matching Supabase tables and payload shapes.

## Step-by-step merge plan

1. Keep the current FastAPI + Supabase auth, deployment, and database code unchanged.
2. Add backward-compatible aliases for the old meal and auth read paths.
3. Add the old QR image endpoint back as a small utility route.
4. Review the current frontend for any remaining legacy call sites that still expect the old route names.
5. Port only the useful UX pieces from the old landing page into the current template-based pages.
6. Revisit the old rule engine as a source of heuristics for fallback generation, not as a replacement for the current Groq flow.
7. Only then consider adding deeper dashboard or bulk actions if the current data model supports them cleanly.

## What was merged in this pass

- Added a compatibility `/api/auth/me` endpoint.
- Added a compatibility `/api/auth/logout` endpoint.
- Added a compatibility `/api/meals/generate` endpoint that forwards to the current meal generator.
- Added a QR image endpoint at `/api/plans/qr/{qr_code_string}`.
