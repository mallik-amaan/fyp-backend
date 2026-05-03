# DocSynth Backend — Test Report

**Total Tests:** 114 | **Passed:** 114 | **Failed:** 0  
**Test Suites:** 10 | **Framework:** Jest + Supertest  
**Run Date:** 2026-05-03

---

## 1. Auth Middleware Unit Tests

**File:** `tests/unit/middleware.auth.test.js`  
**Tests:** 8 | **Passed:** 8

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-MW-01 | Calls next() and attaches decoded user for a valid token | PASS |
| TC-MW-02 | Returns 401 when Authorization header is absent | PASS |
| TC-MW-03 | Returns 401 when header has "Bearer " with no token | PASS |
| TC-MW-04 | Returns 403 for a completely invalid token string | PASS |
| TC-MW-05 | Returns 403 for a token signed with the wrong secret | PASS |
| TC-MW-06 | Returns 403 for a structurally valid JWT with tampered payload | PASS |
| TC-MW-07 | Returns 403 for an expired token | PASS |
| TC-MW-08 | Attaches full decoded payload (not just email) to req.user | PASS |

---

## 2. Auth Routes Unit Tests

**File:** `tests/unit/routes.auth.test.js`  
**Tests:** 23 | **Passed:** 23

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-AUTH-01 | Returns tokens for valid credentials and verified email | PASS |
| TC-AUTH-02 | Returns result=false for wrong password | PASS |
| TC-AUTH-03 | Returns requiresVerification=true for unverified email | PASS |
| TC-AUTH-04 | Returns error message when user not found | PASS |
| TC-AUTH-05 | Returns result=true with email for valid token | PASS |
| TC-AUTH-06 | Returns 401 when Authorization header is missing | PASS |
| TC-AUTH-07 | Returns 401 for expired token | PASS |
| TC-AUTH-08 | Returns 401 for malformed token | PASS |
| TC-AUTH-09 | Issues new tokens for a valid refresh token | PASS |
| TC-AUTH-10 | Returns 401 when refresh token is missing | PASS |
| TC-AUTH-11 | Returns 401 for expired refresh token | PASS |
| TC-AUTH-12 | Returns 400 for missing email or invalid purpose | PASS |
| TC-AUTH-13 | Returns result=true (silent success) for unknown email | PASS |
| TC-AUTH-14 | Returns error for already-verified email with verify_email purpose | PASS |
| TC-AUTH-15 | Returns 400 when required fields are missing | PASS |
| TC-AUTH-16 | Returns result=true and issues reset_token on valid reset_password OTP | PASS |
| TC-AUTH-17 | Returns result=false for invalid OTP | PASS |
| TC-AUTH-18 | Returns 400 when reset_token or new_password is missing | PASS |
| TC-AUTH-19 | Updates password and returns result=true for valid reset token | PASS |
| TC-AUTH-20 | Returns 400 for an expired reset token | PASS |
| TC-AUTH-21 | Returns 400 for token with wrong purpose field | PASS |
| TC-AUTH-22 | Returns 400 when id or username is missing | PASS |
| TC-AUTH-23 | Returns updated username on success | PASS |

---

## 3. Upload Routes Unit Tests

**File:** `tests/unit/routes.upload.test.js`  
**Tests:** 7 | **Passed:** 7

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-UP-01 | Returns 400 when no file is attached | PASS |
| TC-UP-02 | Returns 400 when file is not a PDF (PNG submitted) | PASS |
| TC-UP-03 | Returns 400 when PDF is uploaded but userId is missing | PASS |
| TC-UP-04 | Returns 200 and storage path for a valid PDF with userId | PASS |
| TC-UP-05 | Returns 500 when Supabase storage upload fails | PASS |
| TC-UP-06 | Does not leave a temp file in uploads/ after rejection | PASS |
| TC-UP-07 | Rejects a .js file regardless of Content-Type claim | PASS |

---

## 4. Generate Route Unit Tests

**File:** `tests/unit/routes.generate.test.js`  
**Tests:** 8 | **Passed:** 8

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-GEN-01 | Returns 202 with requestId when all required fields are present | PASS |
| TC-GEN-02 | Returns 400 when language is missing | PASS |
| TC-GEN-03 | Returns 400 when documentType is missing | PASS |
| TC-GEN-04 | Returns 400 when numSolutions is missing | PASS |
| TC-GEN-05 | requestId is a valid UUID v4 | PASS |
| TC-GEN-06 | Module is "generation" when redaction flag is false | PASS |
| TC-GEN-07 | Module is "redaction" when redaction flag is true | PASS |
| TC-GEN-08 | Each request gets a unique requestId | PASS |

---

## 5. Auth Integration Flow Tests

**File:** `tests/integration/auth.flow.test.js`  
**Tests:** 8 | **Passed:** 8

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-INT-AUTH-01 | POST /auth/signup creates user and sends OTP | PASS |
| TC-INT-AUTH-02 | POST /auth/signup rejects duplicate email | PASS |
| TC-INT-AUTH-03 | POST /auth/verify-otp verifies email successfully | PASS |
| TC-INT-AUTH-04 | POST /auth/verify-otp rejects with 400 for wrong OTP | PASS |
| TC-INT-AUTH-05 | POST /auth/login returns JWT tokens after successful login | PASS |
| TC-INT-AUTH-06 | POST /auth/validate accepts the token received at login | PASS |
| TC-INT-AUTH-07 | POST /auth/refresh issues new token pair from refresh token | PASS |
| TC-INT-AUTH-08 | GET /dashboard redirects unauthenticated users (middleware returns 401) | PASS |

---

## 6. Analytics Integration Tests

**File:** `tests/integration/analytics.test.js`  
**Tests:** 12 | **Passed:** 12

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-AN-01 | Correctly counts completed, failed, flagged requests | PASS |
| TC-AN-02 | Excludes redaction-only requests from generation stats | PASS |
| TC-AN-03 | Returns 400 when userId is missing | PASS |
| TC-AN-04 | Returns successRatio=0% when no requests are finalized | PASS |
| TC-AN-05 | Returns 200 with pairs and signed URLs | PASS |
| TC-AN-06 | Returns 404 when no pairs found for a request | PASS |
| TC-AN-07 | Sets status=completed when no pairs are flagged | PASS |
| TC-AN-08 | Sets status=flagged when at least one pair is flagged | PASS |
| TC-AN-09 | Returns 400 when sessionId is missing | PASS |
| TC-AN-10 | Returns 500 when DB update fails | PASS |
| TC-AN-11 | Returns 200 when flag update succeeds | PASS |
| TC-AN-12 | Returns 400 when flagged field is not a boolean | PASS |

---

## 7. Redaction API Integration Tests

**File:** `tests/integration/redaction.test.js`  
**Tests:** 12 | **Passed:** 12

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-RED-01 | Returns 200 with requestId and uploadUrl when userId and fileName are provided | PASS |
| TC-RED-02 | Returns 400 when userId is missing | PASS |
| TC-RED-03 | Returns 400 when fileName is missing | PASS |
| TC-RED-04 | Returns 403 when redaction usage limit is reached | PASS |
| TC-RED-05 | storagePath contains the userId and fileName segments | PASS |
| TC-RED-06 | Returns 200 when storagePath is provided and DB operations succeed | PASS |
| TC-RED-07 | Returns 400 when storagePath is missing | PASS |
| TC-RED-08 | Still returns 200 even if external redaction service returns an error | PASS |
| TC-RED-09 | Returns list of redaction requests for a user | PASS |
| TC-RED-10 | Returns empty array when user has no redaction history | PASS |
| TC-RED-11 | Returns 404 when userId param is empty (no route match) | PASS |
| TC-RED-12 | Returns 500 when DB query fails | PASS |

---

## 8. Security Tests

**File:** `tests/security/security.test.js`  
**Tests:** 16 | **Passed:** 16

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-SEC-01 | Rejects expired access token — no access to protected route | PASS |
| TC-SEC-02 | Rejects token signed with algorithm=none (algorithm confusion) | PASS |
| TC-SEC-03 | Rejects token with tampered payload (signature mismatch) | PASS |
| TC-SEC-04 | Rejects token signed with wrong secret | PASS |
| TC-SEC-05 | Rejects completely missing Authorization header | PASS |
| TC-SEC-06 | Cannot access protected route with empty Bearer token | PASS |
| TC-SEC-07 | Cannot access protected route with non-Bearer auth scheme | PASS |
| TC-SEC-08 | Reset-password endpoint rejects token issued for a different purpose | PASS |
| TC-SEC-09 | Rejects HTML file with application/pdf Content-Type claim | PASS |
| TC-SEC-10 | Rejects request with no userId to prevent unauthorised upload | PASS |
| TC-SEC-11 | Non-PDF MIME type is rejected with 400 | PASS |
| TC-SEC-12 | /auth/validate does not echo back unsafe input in error messages | PASS |
| TC-SEC-13 | SQL-like input in email field does not crash the server | PASS |
| TC-SEC-14 | Extremely long email does not crash the server | PASS |
| TC-SEC-15 | Login response does not include password_hash | PASS |
| TC-SEC-16 | Validate endpoint does not expose the JWT secret in response | PASS |

---

## 9. Performance Tests

**File:** `tests/performance/performance.test.js`  
**Tests:** 8 | **Passed:** 8

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-PERF-01 | POST /auth/validate responds in < 500 ms | PASS |
| TC-PERF-02 | POST /auth/login (user not found path) responds in < 500 ms | PASS |
| TC-PERF-03 | POST /auth/send-otp (unknown email silent path) responds in < 500 ms | PASS |
| TC-PERF-04 | POST /auth/update-profile responds in < 500 ms | PASS |
| TC-PERF-05 | POST /user/get-dashboard-stats responds in < 1000 ms | PASS |
| TC-PERF-06 | 10 simultaneous /auth/validate requests all succeed within 2 s | PASS |
| TC-PERF-07 | 50 simultaneous /auth/validate requests complete without error | PASS |
| TC-PERF-08 | 5 sequential validate calls all stay under 300 ms each | PASS |

---

## 10. Reliability Tests

**File:** `tests/reliability/reliability.test.js`  
**Tests:** 12 | **Passed:** 12

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-REL-01 | Returns 500 gracefully when Supabase throws during login | PASS |
| TC-REL-02 | Returns 500 gracefully when Supabase throws during reset-password | PASS |
| TC-REL-03 | Analytics submit-review returns 500 and descriptive message on DB error | PASS |
| TC-REL-04 | /docs/get-generated-docs returns 500 on unexpected server error | PASS |
| TC-REL-05 | /auth/update-profile trims whitespace from username | PASS |
| TC-REL-06 | /auth/update-profile rejects blank username | PASS |
| TC-REL-07 | /auth/refresh accepts both refreshToken and refresh_token keys | PASS |
| TC-REL-08 | /auth/send-otp with missing email returns 400 | PASS |
| TC-REL-09 | /auth/verify-otp handles all three required fields missing gracefully | PASS |
| TC-REL-10 | 100 sequential validate calls all return consistent results | PASS |
| TC-REL-11 | Server does not crash on null JSON body | PASS |
| TC-REL-12 | Server handles concurrent mixed auth requests without state corruption | PASS |

---

## Summary

| Category | Suite | Tests | Passed | Failed |
|----------|-------|-------|--------|--------|
| Unit | Auth Middleware | 8 | 8 | 0 |
| Unit | Auth Routes | 23 | 23 | 0 |
| Unit | Upload Routes | 7 | 7 | 0 |
| Unit | Generate Route | 8 | 8 | 0 |
| Integration | Auth Flow | 8 | 8 | 0 |
| Integration | Analytics | 12 | 12 | 0 |
| Integration | Redaction API | 12 | 12 | 0 |
| Security | JWT & Input Attacks | 16 | 16 | 0 |
| Performance | Response Times & Load | 8 | 8 | 0 |
| Reliability | Fault Tolerance | 12 | 12 | 0 |
| **Total** | | **114** | **114** | **0** |
