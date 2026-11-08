# Dira

Dira is being developed as a global B2B procurement platform for organisations with 20–500 staff, multiple buyers and approvers, and operations in any country. The current code is an early procurement foundation, **not yet production-launch-ready**. See [product positioning](docs/POSITIONING.md) and the [release gap tracker](docs/reviews/gap-tracker.md). It brings together buyer dashboards, purchase requests, RFQ management, supplier visibility, and approval-driven purchasing in a single monorepo.

## Product overview

Dira helps organizations manage the core procurement lifecycle without depending on a large enterprise suite:

- Buyer dashboard with live operational metrics
- Purchase request creation and submission workflow
- Approval and rejection steps for submitted requests
- RFQ creation, supplier invitation, and publication flow
- Quote intake and viewing for invited suppliers
- Awarding and purchase-order generation from selected quotations
- Supplier directory and verification-focused organization visibility
- Local PostgreSQL and Prisma-backed persistence for development

## Architecture

The app is structured as a monorepo:

- `apps/web` — Next.js buyer-facing frontend
- `apps/api` — Express API with Prisma and PostgreSQL
- `docker-compose.yml` — local PostgreSQL + pgAdmin setup
- `apps/api/prisma/schema.prisma` — procurement domain model and relational schema

## Tech stack

- Next.js 14
- React + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Docker Compose
- JWT authentication
- Zod validation

## Local development setup

1. Copy `.env.example` to `.env`, replace every placeholder with your own private credentials, and set matching `DIRA_DEV_DB_PASSWORD`, `DATABASE_URL` and `DIRA_DEV_PGADMIN_PASSWORD` values. Never use example credentials in production.
2. Start PostgreSQL and pgAdmin:
   `docker compose up -d`
3. Generate the Prisma client:
   `npm exec prisma generate --workspace apps/api`
4. Run the database migration:
   `npm exec prisma migrate dev --workspace apps/api -- --name init`
5. Optional **development-only** seed (never runs in production):
   `DIRA_ALLOW_DEV_SEED=1 npm run db:seed`
6. Start the API:
   `npm run dev:api`
7. Start the frontend:
   `npm run dev:web`

## Default local URLs

- Frontend: http://localhost:3000
- API: http://localhost:4000
- pgAdmin: http://localhost:5050

## Development accounts

There are no production demo accounts. The optional development seed is explicitly opt-in and must never run in production. Do not rely on documented shared credentials; create private local test identities when needed.

## Payment recording, not payment processing

Dira records payment details and references for audit and reconciliation. It does **not** hold, transfer or disburse supplier funds.

## Notes

- The local database is configured for a Docker-backed PostgreSQL setup and is intended for rapid development.
- The current implementation is a procurement foundation; global enterprise functionality is planned and must be verified against the release gap tracker before launch.
- The app currently covers the core buyer-side flow: request submission, approval, RFQ issuance, supplier selection, quote handling, and award-to-PO progression.
