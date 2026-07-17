# Bean & Brew OS — Enterprise Backend System Design & Implementation Specification

## 1. Executive Summary

### 1.1 Purpose
The Bean & Brew OS Backend is a mission-critical infrastructure designed to power a luxury, real-time artisanal coffee management ecosystem. It serves as the central orchestration layer for customer ordering, barista operations, and administrative oversight.

### 1.2 Goals
- **Unified State:** Single source of truth for all artisanal assets and operational states.
- **Micro-latency Sync:** Real-time event propagation across all roles.
- **Enterprise Scale:** Architecture capable of supporting 10,000+ locations and millions of users.
- **Rigorous Security:** Tier-1 data protection and transaction integrity.

### 1.3 Architecture Overview
A layered, modular monolith transitionable to microservices, utilizing Node.js/TypeScript, PostgreSQL (ACID), Redis (State/Speed), and Socket.IO (Event Mesh).

---

## 2. Flutter Application Analysis

### 2.1 Screen-to-Backend Mapping
- **Splash/Onboarding:** Session validation and initial feature flag retrieval.
- **Auth (Login/Reg/OTP):** JWT issuance, MFA orchestration, and role-based onboarding.
- **Customer Home:** Aggregated personalized data, loyalty points, and featured catalog.
- **Catalog/Search:** Optimized read-heavy API with complex filtering/sorting.
- **Product Details:** Customization engine supporting complex nested price logic.
- **Cart/Checkout:** Multi-step transactional flow with inventory locking.
- **Order Tracking:** Subscription to live status events.
- **Barista Dashboard:** Real-time table grid and brewing task queue.
- **Admin Suite:** Aggregated KPIs, personnel shifts, and supply chain management.

---

## 3. Complete Functional Requirement Specification (FRS)

### 3.1 Core Domain
- **FRS-CORE-01:** System shall manage hierarchical menu structures (Categories -> Products -> Variants -> Customizations).
- **FRS-CORE-02:** System shall enforce atomic inventory deductions.

### 3.2 Real-time Sync
- **FRS-RT-01:** Every order state change must broadcast to the respective customer and branch staff within < 100ms.

### 3.3 Administrative
- **FRS-ADM-01:** Financial reports must support date-range aggregation and branch-level filtering.

---

## 4. System Architecture

### 4.1 Layered Design
1. **Presentation Layer:** REST Controllers & Socket Handlers.
2. **Domain Layer:** Pure business services (OrderService, InventoryManager).
3. **Infrastructure Layer:** Repositories (Prisma), Cache (Redis), Queue (BullMQ), Storage (S3).

### 4.2 Deployment Architecture
- **Environment:** AWS EC2 (Auto-scaling Groups).
- **Load Balancing:** Nginx / AWS ALB with SSL termination.
- **Service Mesh:** Socket.IO with Redis Adapter for multi-node event sync.

---

## 5. Folder Structure

```text
/src
  /api                  # Entry points
    /v1
      /controllers      # Request handling
      /routes           # Route definitions
      /middlewares      # Auth, Validation, Rate Limits
  /domain               # Business Heart
    /services           # Domain Logic
    /entities           # Type definitions
    /value-objects      # Domain-specific logic types
  /infrastructure       # External World
    /database           # Prisma Client & Repos
    /cache              # Redis Wrappers
    /queue              # BullMQ Workers
    /storage            # S3 Service
    /notifications      # FCM/Email providers
  /lib                  # Shared Helpers
  /app.ts               # Express Config
  /server.ts            # Entry & Sockets
```

---

## 6. Database Design (PostgreSQL)

### 6.1 Schema Highlights
- **Users:** UUID primary key, RBAC role enum.
- **Products:** JSONB for dynamic attributes (tasting notes, origin).
- **Orders:** Transactional state machine via Enums.
- **Inventory:** Atomic locking via `SELECT ... FOR UPDATE`.
- **AuditLogs:** Global tracking of all administrative mutations.

---

## 7. User Roles (RBAC)

- **SUPER_ADMIN:** Global configuration, multi-tenant access.
- **ADMIN:** Store-wide data, financial reports, user management.
- **MANAGER:** Branch operations, inventory thresholds, shift scheduling.
- **BARISTA:** Queue management, extraction tasks, table status.
- **CUSTOMER:** Ordering, profile management, loyalty tracking.

---

## 8. Authentication & Security

- **JWT Strategy:** Access (15m) + Refresh (7d) with rotation.
- **Session:** Redis-backed session store for instant revocation.
- **Verification:** Multi-channel OTP (Email/SMS).

---

## 9. Cafe & Menu Management

- **Multi-Branch:** All entities scoped by `branch_id`.
- **Menu Hierarchy:** Support for combos and variant-based pricing.
- **Operating Hours:** Global gatekeeper middleware for branch status.

---

## 10. Customer Module Backend

- **Loyalty Engine:** Point ledger system with tier-calculation logic.
- **Preferences:** JSONB storage for personalized "Artisanal Brew" defaults.

---

## 11. Barista Module Backend

- **Queue Orchestration:** Priority-based sorting (Express vs. Standard).
- **Extraction Logging:** DB tracking for average brew times per product.

---

## 12. Admin Module Backend

- **Analytics Engine:** Pre-aggregated materialized views for rapid dashboard loading.
- **Roster Sync:** Real-time shift status propagation via Sockets.

---

## 13. Order Management (Most Critical)

### 13.1 Lifecycle
1. **Creation:** Zod validation + Inventory check + Price calculation.
2. **Payment:** Webhook reception -> Order status = `PAID`.
3. **Queueing:** Injection into `BaristaQueue`.
4. **Execution:** `PREPARING` -> `READY` -> `DELIVERED`.
5. **Closure:** Point accrual + Inventory decrement finalization + Invoice S3 upload.

---

## 14. Socket.IO Realtime Architecture

### 14.1 Connection Lifecycle
- **Handshake:** JWT verification in `auth` header.
- **Persistence:** Heartbeat (25s) with automatic room re-joining on reconnection.

### 14.2 Namespace/Room Logic
- `/ops`: Admins join `branch_{id}_ops`.
- `/live`: Customers join `user_{id}` and `order_{id}`.

### 14.3 Event Catalog
- `ORDER_UPDATE`: Emitted on any state change.
- `TABLE_STATUS`: Broadcast to all branch staff.
- `SYSTEM_ALERT`: Emergency maintenance or security broadcast.

---

## 15. REST APIs

- **v1/auth:** Login, Refresh, Logout, Verify.
- **v1/products:** Paginated catalog, Search, Details.
- **v1/orders:** Create, List, Detail, History.
- **v1/admin:** Inventory, Employees, Reports, Settings.

---

## 16. Background Jobs (BullMQ)

- **Invoice Generator:** PDF generation and S3 upload.
- **Cleanup:** Expiring unused OTPs and blacklisted tokens.
- **Notifications:** Retrying failed FCM pushes.

---

## 17. Redis Strategy

- **Caching:** API response cache for static artisanal menu.
- **Rate Limiting:** Sliding window counter per IP/User.
- **Message Bus:** Redis Pub/Sub for horizontal socket scaling.

---

## 18. Notifications (FCM)

- **Order Status:** Real-time push for `READY` and `OUT_FOR_DELIVERY`.
- **Marketing:** Scheduled broadcasts for loyalty members.

---

## 19. File Storage (AWS S3)

- **Public:** Product images, user avatars.
- **Private:** Signed URLs for invoices and financial reports.

---

## 20. Security Standards

- **OWASP Compliance:** Global protection against SQLi, XSS, and CSRF.
- **Secrets:** HashiCorp Vault or AWS Secrets Manager.

---

## 21. Logging & Observability

- **Structured Logs:** Winston JSON format.
- **Tracing:** Correlation IDs injected at Nginx and carried through every service call.

---

## 22. Monitoring

- **Stack:** Prometheus (Metrics) + Grafana (Dashboards).
- **Health:** `/health` endpoints checking DB, Redis, and Queue status.

---

## 23. DevOps & CI/CD

- **Tools:** GitHub Actions, Docker, PM2.
- **Strategy:** Blue-Green deployments for zero downtime.

---

## 24. Testing Strategy

- **Unit:** Domain logic (Services).
- **Integration:** API flow (Supertest) + Database state.
- **Load:** K6 or Locust for high-concurrency order testing.

---

## 25. Scalability

- **Horizontal:** Auto-scaling server nodes based on CPU/Socket load.
- **Database:** Read-replicas for analytics and report generation.

---

## 26. Performance Optimization

- **Indexing:** GIN and B-Tree indexes for artisanal searches.
- **Compression:** Gzip/Brotli for all JSON payloads.

---

## 27. Production Readiness Checklist

- [ ] SSL/TLS Hardening.
- [ ] Database point-in-time recovery (PITR).
- [ ] Redis Persistence configuration.
- [ ] Error boundary logging for all Socket events.

---

## 28. Future Expansion

- **POS Bridge:** Direct integration with physical store hardware.
- **AI Upselling:** ML-based recommendation service.

---
* End of System Design Document *
