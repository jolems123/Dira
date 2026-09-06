# Dira

Dira is a local-first B2B procurement platform designed for modern buying teams and supplier workflows. It brings together buyer dashboards, purchase requests, RFQ management, supplier visibility, and approval-driven purchasing in a single monorepo.

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

1. Copy `.env.example` to `.env` and update the local values.
2. Start PostgreSQL and pgAdmin:
   `docker compose up -d`
3. Generate the Prisma client:
   `npm exec prisma generate --workspace apps/api`
4. Run the database migration:
   `npm exec prisma migrate dev --workspace apps/api -- --name init`
5. Seed development data:
   `npm run db:seed`
6. Start the API:
   `npm run dev:api`
7. Start the frontend:
   `npm run dev:web`

## Default local URLs

- Frontend: http://localhost:3000
- API: http://localhost:4000
- pgAdmin: http://localhost:5050

## Demo login

The seeded demo buyer account is:

- Email: `buyer@dira.local`
- Password: `Password123!`

## Notes

- The local database is configured for a Docker-backed PostgreSQL setup and is intended for rapid development.
- The repository is intentionally kept focused on a functional local procurement foundation rather than a fully generic enterprise platform.
- The app currently covers the core buyer-side flow: request submission, approval, RFQ issuance, supplier selection, quote handling, and award-to-PO progression.
