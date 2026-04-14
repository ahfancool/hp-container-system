# HP Container School System

## Engineering Milestone Plan (Free-Tier Scalable Architecture)

Version: 1.0
Target Users: 1500–2000 students
Target Cost: $0 (Free tier infrastructure)

System references:

* HP Container System Project Resume
* SOP rapat kedisiplinan sekolah

---

# 1. System Target

## Operational Scenario

Peak operations:

Morning HP Deposit
07:00 – 07:30
≈1500–2000 scans

Afternoon HP Retrieval
12:30 – 13:00
≈1500–2000 scans

Peak Load Estimate:

2000 requests / 30 minutes
≈ 66 requests / minute
≈ 1.1 request / second

This load is extremely safe for serverless architecture.

---

# 2. Final Architecture (Free Tier Optimized)

Frontend
Cloudflare Pages

API Backend
Cloudflare Workers

Database
Supabase PostgreSQL

Authentication
Supabase Auth

QR Scanner
Browser Camera API

Caching
Cloudflare Edge Cache

Monitoring
Supabase logs + Worker analytics

---

# 3. High Level System Components

Core modules:

1. Authentication System
2. Student Data System
3. Container Management
4. QR Scan System
5. Transaction Engine
6. Teacher Control Panel
7. Monitoring Dashboard
8. Validation Engine
9. Audit Log System

---

# 4. Development Milestone

---

# Milestone 0 — Project Foundation (COMPLETED)

Objective
Prepare infrastructure and repository.

---

# Milestone 1 — Database Core (COMPLETED)

Objective
Create stable data structure.

---

# Milestone 2 — Authentication System (COMPLETED)

Objective
User login system.

---

# Milestone 3 — Container Management (COMPLETED)

Objective
Create container registry.

---

# Milestone 4 — QR Scan Engine (COMPLETED)

Objective
Allow students to scan container.

Delivered flow
Camera or manual payload -> preview -> user confirms transaction.

---

# Milestone 5 — Transaction Engine (COMPLETED)

Objective
Record HP movements.

Delivered flow
`POST /scan` validates and previews, `POST /transaction` commits the movement.

---

# Milestone 6 — Teacher Control Panel (COMPLETED)

Objective
Teacher can override rules.

Delivered flow
Staff creates pending approval, student scan consumes it on the next confirmed `OUT`.

---

# Milestone 7 — Monitoring Dashboard (COMPLETED)

Objective
Real-time monitoring.

Delivered flow
Dashboard shows school-wide summary, filtered student view, and approvals waiting for scan.

---

# Milestone 8 — Concurrency Optimization

Objective
Handle 2000 scans safely.

Strategies

Edge computing

Cloudflare Workers handle requests near user.

Stateless backend

Workers process request instantly.

Database indexes

student_id
container_id
timestamp

Batch caching

Container validation cached at edge.

Optional queue

Cloudflare Queue for burst traffic.

Expected capacity

> 50 requests/sec safe

Peak system requirement

~1 request/sec

System extremely safe.

Estimated time

1 day

---

# Milestone 9 — Security Layer

Objective
Prevent misuse.

Security features

JWT validation

Role based access

Student cannot modify transactions.

Audit log

All actions recorded.

Rate limit

Prevent spam scanning.

Deliverables

Secure system

Estimated time

1 day

---

# Milestone 10 — Deployment

Objective
System accessible to users.

Deploy frontend

Cloudflare Pages

Deploy backend

Cloudflare Workers

Connect database

Supabase

Create domain

hp.sekolah.sch.id

Deliverables

Production system
Environment-specific frontend build flow for staging and production
Post-deploy smoke check for `/`, `/login`, and `/scan`

Estimated time

1 day

---

# Milestone 11 — Pilot Test

Objective
Test real school usage.

Test scenario

1 class
≈30 students

Test cases

Morning deposit

Afternoon retrieval

Teacher override

Dashboard monitoring

Collect feedback

Deliverables

Bug list

Estimated time

3 days

---

# Milestone 12 — Full School Deployment

Objective
Activate entire system.

Steps

Import all students

≈1500–2000

Generate containers

Teacher training

5 minute training

Start operation

Deliverables

System operational

Estimated time

2 days

---

# 5. Estimated Development Timeline

Total development time

≈ 14 – 18 days

Breakdown

Infrastructure setup
1 day

Database + Auth
3 days

Core system
6 days

Dashboard + optimization
4 days

Testing + deployment
3–4 days

---

# 6. Expected System Capacity

Using serverless architecture

Cloudflare Workers

100k requests/day free

Supabase

500MB database free

Expected usage

Transactions/day
≈ 4000

Transactions/month
≈ 120k

Still within safe range.

---

# 7. Future Expansion

Potential features

Parent notification

SMS or WhatsApp alerts

Discipline point system

Student behavior analytics

Multi-school support

Regional education monitoring

---

# 8. Final Result

The system provides

Automated HP storage tracking
Real-time monitoring
Teacher control over phone access
Historical data for discipline policy

All with near zero infrastructure cost.
