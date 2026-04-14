# SYSTEM_PROMPT_CODEX.md

## AI Development Rules for HP Container School System

Version: 1.0
Project: School HP Container Management System

This document defines the strict development rules that AI coding agents must follow when contributing to this repository.

The goal is to ensure consistent architecture, scalable performance, and compatibility with free-tier infrastructure.

AI agents must follow these rules strictly and must not invent alternative architectures.

---

# 1. System Purpose

This system manages student phone storage using container boxes with QR scanning.

Main objectives:

• Track phone deposit and retrieval
• Allow teacher-controlled phone access
• Provide real-time monitoring
• Maintain transaction logs

The system must support:

1500–2000 students
Concurrent scanning during peak periods

Peak operation windows:

07:00 – 07:30
12:30 – 13:00

Expected load:

~1–5 requests per second

The architecture must remain compatible with free-tier cloud services.

---

# 2. Required Architecture

AI agents must follow this architecture exactly.

Frontend
Cloudflare Pages (React / Next.js)

Backend
Cloudflare Workers

Database
Supabase PostgreSQL

Authentication
Supabase Auth

QR scanning
Browser Camera API

Caching
Cloudflare Edge Cache

Monitoring
Supabase logs + Worker analytics

AI must not replace these technologies unless explicitly instructed.

---

# 3. Project Folder Structure

AI must follow this folder structure.

```
hp-container-system

docs/
SYSTEM_PROMPT_CODEX.md
milestone.md

frontend/
pages/
components/
scanner/

backend/
workers/
routes/
services/
middleware/

database/
schema.sql
seed.sql

scripts/

README.md
```

Rules:

Frontend and backend must be separated.

Database schema must be version controlled.

No business logic inside frontend.

---

# 4. Coding Principles

AI agents must follow these principles.

1. Stateless backend

All API endpoints must be stateless.

No session storage inside Workers.

2. Edge-first architecture

Workers should process requests quickly and return responses immediately.

3. Database-driven state

All phone status must be derived from database transactions.

4. Atomic operations

Transaction writes must be atomic.

5. Idempotent API design

Repeated requests must not break system state.

---

# 5. Core Entities

The system uses these primary entities.

Students
Containers
Users
PhoneTransactions

AI must not invent additional primary entities without justification.

---

# 6. Database Schema Rules

Database is PostgreSQL (Supabase).

All tables must use UUID primary keys.

Required tables:

students
containers
users
phone_transactions

Example schema rules:

classes

id UUID
grade INTEGER
major TEXT
class_name TEXT
homeroom_teacher UUID

students

id	 UUID
nis    TEXT
name   TEXT
class_id  UUID

containers

id UUID PK
name TEXT
location TEXT
qr_code TEXT

users

id UUID PK
name TEXT
role TEXT
email TEXT

phone_transactions

id UUID PK
student_id UUID
container_id UUID
action TEXT
type TEXT
timestamp TIMESTAMPTZ
operator_id UUID

---

# 7. Transaction Logic Rules

The system must enforce phone state consistency.

Valid state transitions:

OUT → IN
IN → OUT

Invalid transitions:

IN → IN
OUT → OUT

Rules:

A student cannot take phone out if it was not deposited.

A student cannot deposit phone twice consecutively.

All transactions must record timestamp.

---

# 8. API Design Standards

All APIs must be REST style.

Example endpoints:

GET /health
GET /auth/me
GET /containers
GET /students
GET /audit/logs
POST /scan
POST /transaction
POST /teacher/approve
GET /dashboard/status

Responses must be JSON.

Example response format:

{
"success": true,
"data": {}
}

Error format:

{
"success": false,
"error": "description"
}

---

# 9. QR Scan Workflow

Student workflow:

1 Login
2 Open scan page
3 Scan container QR
4 Send scan preview request
5 Review action, container, and schedule rule
6 Confirm transaction

Payload example:

{
student_id
container_id
timestamp
}

Server responsibilities:

Validate student identity

Validate container existence

Determine action (IN or OUT)

Return preview data without changing transaction history

Write transaction only after confirmation via `POST /transaction`

---

# 10. Teacher Override Logic

Teachers can override normal rules.

Override types:

PEMBELAJARAN
DARURAT

API endpoint:

POST /teacher/approve

Payload:

student_id
container_id
type

System must create or update a pending approval record, not an immediate phone transaction.

Student must later scan the same container.

The next confirmed student transaction must consume the active approval and write the `OUT` transaction with the approval type.

System must log teacher operator_id and approval lifecycle events.

---

# 11. Monitoring Dashboard

Dashboard must show real-time phone status.

Required information:

Phones inside container

Phones outside container

Students not scanned

Emergency releases

Pending approvals waiting for student scan

Global school summary separated from filtered class view

Dashboard must be optimized for quick loading.

---

# 12. Performance Requirements

System must support peak usage.

Target:

2000 scans within 30 minutes.

Design requirements:

Database indexes

student_id
container_id
timestamp

API execution time

<100ms preferred

Workers must avoid heavy computation.

---

# 13. Security Rules

All APIs must enforce authentication.

Students cannot modify transactions.

Teachers cannot edit past transactions.

Admins may audit logs.

Security features required:

JWT validation

Role-based access control

Audit logging

Rate limiting

---

# 14. Coding Style

Backend language

TypeScript preferred

Naming rules

camelCase for variables

PascalCase for types

snake_case for database columns

Functions must be small and modular.

Avoid large monolithic functions.

---

# 15. Error Handling

All APIs must return clear error messages.

Examples:

INVALID_CONTAINER

STUDENT_NOT_FOUND

INVALID_STATE_TRANSITION

UNAUTHORIZED_ACTION

---

# 16. Development Workflow

AI agents must follow milestone.md roadmap.

Steps:

1 Read SYSTEM_PROMPT_CODEX.md

2 Read milestone.md

3 Identify current milestone

4 Implement milestone requirements

5 Ensure compatibility with architecture

AI must not skip milestones unless instructed.

---

# 17. Deployment Rules

Frontend deployment

Cloudflare Pages

Backend deployment

Cloudflare Workers

Database

Supabase

Environment variables must never be hardcoded.

For frontend static export, AI must ensure valid `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_APP_ENV` are present at build time.

If frontend deploy is done manually from local workspace, AI should prefer `npm run build:frontend:staging` or `npm run build:frontend:production` instead of raw `next build`.

After frontend deployment, AI should smoke test `/`, `/login`, and `/scan` before declaring production or staging healthy.

---

# 18. Testing Rules

AI must generate basic tests when possible.

Test scenarios:

Deposit phone

Retrieve phone

Invalid transaction

Teacher override

---

# 19. Future Expansion Considerations

Code must remain modular for future features:

Parent notifications

Discipline scoring

Multi-school support

Advanced analytics

---

# 20. Final Rule

AI agents must prioritize:

System stability
Data integrity
Free-tier compatibility
Simple architecture

Do not introduce unnecessary complexity.
must remain modular for future features:

Parent notifications

Discipline scoring

Multi-school support

Advanced analytics

---

# 20. Final Rule

AI agents must prioritize:

System stability
Data integrity
Free-tier compatibility
Simple architecture

Do not introduce unnecessary complexity.
