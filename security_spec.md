# Security Specification — MASTER COMPUTERIZED LABORATORY

## 1. Data Invariants
1. **Authentication & Verification Gate**: Every read and write requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Role-Based Access Control (RBAC)**:
   - Bootstrap Admin (`arjunmaster1327@gmail.com` verified) and `/users/{uid}` documents with `role == 'admin'` and `status == 'active'` hold full administrative control.
   - Active laboratory personnel (`admin`, `manager`, `receptionist`, `technician`, `staff`) derive access from their verified `/users/{uid}` record stored in Firestore (never client-side claims).
   - Users cannot self-escalate `role`, `status`, or `permissions` during creation or update.
3. **PII Isolation**: Staff private contact details (`email`, `phone`, `address`) live in `/users/{userId}/private/{docId}` and are readable only by the owning user or an Admin.
4. **Immutable Audit Trail**: `/auditLogs/{logId}` entries allow creation by verified active staff with `actorUid == request.auth.uid` and `createdAt == request.time`, and forbid updates or deletes to prevent log tampering.
5. **Terminal State Locking**: Once a `labReports/{reportId}` reaches `status == 'approved'`, non-admin users cannot mutate test results or revert approval.
6. **Temporal Integrity**: `createdAt` is pinned to `request.time` on create and immutable on update; `updatedAt` is pinned to `request.time` on update.
7. **Path & Size Hardening**: Every document ID parameter matches `^[a-zA-Z0-9_-]{1,128}$` and every string/array field enforces strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Patient Read**: `GET /patients/p1` with `auth == null`.
2. **Unverified Email Write**: `CREATE /patients/p1` with `auth.token.email_verified == false`.
3. **Self-Role Escalation on Create**: Non-admin user creates `/users/{uid}` with `role: 'admin'`.
4. **Self-Role Escalation on Update**: Non-admin user updates `/users/{uid}` changing `role` from `'staff'` to `'admin'`.
5. **PII Cross-User Read**: Staff user A attempts `GET /users/userB/private/contact`.
6. **Shadow Ghost Field Injection**: Staff creates `/patients/p1` with extra unexpected key `isBypassed: true`.
7. **Timestamp Forgery**: Staff creates `/patients/p1` with `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time`.
8. **ID Poisoning**: Staff writes `/patients/AAA... (200 chars)` exceeding 128-char ID limit.
9. **Audit Log Tampering**: Non-admin attempts `UPDATE` or `DELETE` on `/auditLogs/log1`.
10. **Approved Report Alteration**: Technician attempts `UPDATE` on `/labReports/rep1` where `existing().status == 'approved'`.
11. **Financial Ledger Deletion by Non-Admin**: Receptionist attempts `DELETE` on `/payments/pay1` or `/cashbook/cb1`.
12. **Creator UID Spoofing**: Staff A creates `/bookings/b1` with `createdBy: "someone_else_uid"`.
