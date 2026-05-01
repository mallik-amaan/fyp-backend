# Test Plan Report - FYP Backend System

**Project Name:** FYP Backend  
**Version:** 1.0.0  
**Author:** Malik Muhammad Aman  
**Date:** March 4, 2026  
**Scope:** Comprehensive Testing Strategy for Express.js Backend API

---

## 1. Executive Summary

This document outlines a comprehensive testing plan for the FYP Backend system, which is an Express.js application that provides REST API endpoints for user authentication, document generation, file uploads, and data analytics. The testing plan covers both functional and non-functional testing aspects to ensure reliability, security, and performance.

---

## 2. Project Overview

### Technology Stack
- **Framework:** Express.js v5.1.0
- **Authentication:** JWT (jsonwebtoken)
- **Database:** Supabase
- **File Handling:** Multer
- **External APIs:** Google OAuth 2.0, Supabase
- **Environment:** Node.js with nodemon for development

### Key Features
- User authentication (signup, login)
- OAuth2 integration with Google
- Document upload and processing
- Document generation with multiple parameters
- User profile management
- Analytics tracking
- Request management

### API Endpoints
- `/auth` - Authentication endpoints (signup, login)
- `/user` - User profile management
- `/oauth` - OAuth2 integration
- `/upload` - File upload handling
- `/docs` - Document management
- `/generate` - Document generation
- `/requests` - Request tracking and management
- `/analytics` - Analytics data

---

## 3. Testing Strategy Overview

### Testing Levels
1. **Unit Testing** - Individual functions and middleware
2. **Integration Testing** - Component interactions and API endpoints
3. **System Testing** - End-to-end workflows and business processes

### Testing Approach
- Black-box and white-box testing methodologies
- Positive and negative test scenarios
- Boundary value analysis
- Equivalence partitioning

---

## 4. Functional Testing Plan

### 4.1 Unit Testing

#### 4.1.1 Authentication Module (`auth.route.js`)
- **Test Scope:** Individual authentication functions
- **Coverage Areas:**
  - Signup function with valid/invalid credentials
  - Email validation (format, duplicates)
  - Password hashing and storage
  - JWT token generation and validation
  - Login function with correct/incorrect passwords
  - Email verification logic (if applicable)
  - Password reset functionality
  - Input sanitization and validation

- **Key Test Scenarios:**
  - Valid signup with unique email
  - Duplicate email registration attempt
  - Signup with invalid email format
  - Signup with weak password
  - Login with correct credentials
  - Login with incorrect password
  - Login with non-existent user
  - JWT token expiration handling
  - Refresh token validation

#### 4.1.2 File Upload Module (`upload.route.js`)
- **Test Scope:** File upload and handling functions
- **Coverage Areas:**
  - File type validation
  - File size validation
  - File storage mechanism
  - Multer middleware configuration
  - File path handling
  - Error handling for upload failures

- **Key Test Scenarios:**
  - Upload valid document file
  - Upload file exceeding size limit
  - Upload unsupported file type
  - Upload with missing authentication
  - Upload with corrupted file
  - Concurrent file uploads
  - File naming and conflict handling
  - Temporary file cleanup

#### 4.1.3 Document Generation Module (`generate.route.js`)
- **Test Scope:** Document generation logic
- **Coverage Areas:**
  - Parameter validation
  - Request metadata creation
  - Language parameter handling
  - Document type validation
  - Solution generation logic
  - Redaction functionality
  - UUID generation

- **Key Test Scenarios:**
  - Generate with all required parameters
  - Generate with missing required fields
  - Generate with invalid language code
  - Generate with invalid document type
  - Generate with numSolutions = 0
  - Generate with seed documents
  - Generate with visual assets
  - Ground truth field handling

#### 4.1.4 User Management Module (`user.route.js`)
- **Test Scope:** User profile operations
- **Coverage Areas:**
  - Retrieve user profile
  - Update user information
  - User data validation
  - User deletion/deactivation

- **Key Test Scenarios:**
  - Fetch existing user profile
  - Fetch non-existent user
  - Update user with valid data
  - Update with invalid data
  - Update with duplicate email
  - Delete user account
  - Profile authorization checks

#### 4.1.5 Middleware Testing (`auth.middleware.js`)
- **Test Scope:** Authentication middleware functions
- **Coverage Areas:**
  - Token verification
  - User authorization
  - Permission checking
  - Error handling

- **Key Test Scenarios:**
  - Valid JWT in request header
  - Missing JWT token
  - Invalid JWT token
  - Expired JWT token
  - Malformed token format
  - Token tampering detection

### 4.2 Integration Testing

#### 4.2.1 Authentication Flow Integration
- **Test Scope:** Signup → Login → Session Management
- **Coverage Areas:**
  - Complete user registration workflow
  - Complete user login workflow
  - Session persistence
  - Token lifecycle management

- **Key Test Scenarios:**
  - End-to-end signup and login flow
  - Login after successful signup
  - Multiple login attempts tracking
  - Token refresh mechanism
  - Logout and token invalidation
  - Concurrent user sessions

#### 4.2.2 OAuth2 Integration (`oauth2.route.js`)
- **Test Scope:** Google OAuth integration
- **Coverage Areas:**
  - Google OAuth callback handling
  - User creation from OAuth
  - Account linking with existing users
  - Token exchange mechanism

- **Key Test Scenarios:**
  - Valid OAuth authorization code
  - Invalid authorization code
  - OAuth user creation
  - OAuth login for existing user
  - Expired OAuth credentials
  - Failed token exchange

#### 4.2.3 File Upload and Document Generation Flow
- **Test Scope:** Upload → Process → Generate
- **Coverage Areas:**
  - File upload to document generation workflow
  - Document metadata storage
  - File retrieval for generation

- **Key Test Scenarios:**
  - Upload file → Generate from uploaded file
  - Verify uploaded file integrity
  - Generate with multiple uploaded files
  - Document processing status tracking
  - File cleanup after processing

#### 4.2.4 User to Document Relationship
- **Test Scope:** User-Document association
- **Coverage Areas:**
  - User document ownership
  - User-specific document queries
  - Document permission management

- **Key Test Scenarios:**
  - User accessing own documents
  - User attempting to access other's documents
  - Document ownership validation
  - Batch document operations by user

#### 4.2.5 Analytics and Request Tracking
- **Test Scope:** Analytics data collection and requests management
- **Coverage Areas:**
  - Request logging
  - Analytics data aggregation
  - Request status tracking

- **Key Test Scenarios:**
  - Track successful requests
  - Track failed requests
  - Query analytics by date range
  - Query analytics by user
  - Analytics data accuracy

### 4.3 System Testing

#### 4.3.1 End-to-End User Journey
- **Test Scope:** Complete user workflow from signup to document generation
- **Coverage Areas:**
  - User signup → Login → Upload document → Generate variations
  - User profile management throughout workflow
  - Session management across operations

- **Key Test Scenarios:**
  - New user complete workflow
  - Returning user workflow
  - Multiple document processing
  - Cross-platform user access
  - Workflow interruption and recovery

#### 4.3.2 Data Consistency Testing
- **Test Scope:** Data integrity across database operations
- **Coverage Areas:**
  - Database transaction consistency
  - Data synchronization between services
  - ACID properties compliance

- **Key Test Scenarios:**
  - Concurrent user modifications
  - Database transaction rollback
  - Data corruption recovery
  - Backup and restoration
  - Data consistency after system failures

#### 4.3.3 API Contract Testing
- **Test Scope:** API response format and structure validation
- **Coverage Areas:**
  - Response JSON structure
  - HTTP status codes
  - Error message format
  - Response headers

- **Key Test Scenarios:**
  - Validate response structure for all endpoints
  - Verify correct HTTP status codes
  - Check response time consistency
  - Validate error response format
  - Header validation (CORS, Content-Type)

#### 4.3.4 Workflow State Machine Testing
- **Test Scope:** Complex workflow state transitions
- **Coverage Areas:**
  - Document generation state transitions
  - Request status changes
  - User state management

- **Key Test Scenarios:**
  - Valid state transitions
  - Invalid state transition attempts
  - State persistence
  - Concurrent state modifications

---

## 5. Non-Functional Testing Plan

### 5.1 Performance Testing

#### 5.1.1 Load Testing
- **Test Scope:** System behavior under expected load
- **Coverage Areas:**
  - Concurrent user handling
  - Request throughput
  - Response time metrics

- **Key Test Scenarios:**
  - 10 concurrent users
  - 50 concurrent users
  - 100 concurrent users
  - Sustained load for 30 minutes
  - Spike testing (sudden load increase)

- **Metrics to Track:**
  - Average response time (target: <500ms)
  - Peak response time (target: <2000ms)
  - Requests per second (RPS)
  - Error rate percentage
  - CPU utilization
  - Memory consumption
  - Database connection pool usage

#### 5.1.2 Stress Testing
- **Test Scope:** System behavior at maximum capacity
- **Coverage Areas:**
  - Breaking point identification
  - Recovery capabilities
  - Resource exhaustion handling

- **Key Test Scenarios:**
  - Gradual load increase until failure
  - Sudden spike testing
  - Sustained maximum load
  - Multiple endpoint stress
  - Database stress with large datasets

- **Metrics to Track:**
  - Maximum RPS before degradation
  - System recovery time
  - Data loss during overload
  - Error rate at breaking point

#### 5.1.3 Spike Testing
- **Test Scope:** System response to sudden traffic spikes
- **Coverage Areas:**
  - Rapid user increase handling
  - Auto-scaling response (if applicable)
  - Queue management

- **Key Test Scenarios:**
  - Jump from 10 to 100 users
  - Flash sale scenario
  - Viral content spike

#### 5.1.4 Endurance Testing
- **Test Scope:** System stability over extended periods
- **Coverage Areas:**
  - Memory leak detection
  - Connection pool stability
  - Cache effectiveness

- **Key Test Scenarios:**
  - 8-hour continuous operation
  - Normal load (20 RPS) sustained
  - Identify resource degradation
  - Monitor garbage collection

#### 5.1.5 File Upload Performance
- **Test Scope:** Large file handling performance
- **Coverage Areas:**
  - Large file upload speed
  - Concurrent file uploads
  - Storage performance

- **Key Test Scenarios:**
  - Upload 100MB file
  - Concurrent 10x50MB files
  - Upload with varying network speeds
  - Timeout handling for slow uploads

#### 5.1.6 Document Generation Performance
- **Test Scope:** Generation request processing speed
- **Coverage Areas:**
  - Single document generation time
  - Batch generation performance
  - Language-specific performance variations

- **Key Test Scenarios:**
  - Generate 1 solution (baseline)
  - Generate 10 solutions
  - Generate 100 solutions
  - Complex document generation
  - Multiple concurrent generations

### 5.2 Security Testing

#### 5.2.1 Authentication Security
- **Test Scope:** Authentication mechanism vulnerabilities
- **Coverage Areas:**
  - Password security
  - Token security
  - Credential transmission

- **Key Test Scenarios:**
  - Weak password acceptance
  - SQL injection in credentials
  - Credential exposure in logs
  - Brute force attack resistance
  - Rate limiting on login attempts
  - Session hijacking prevention
  - CSRF token validation
  - XSS prevention in auth forms

#### 5.2.2 Authorization Testing
- **Test Scope:** Access control and permission enforcement
- **Coverage Areas:**
  - Role-based access control
  - User-level data isolation
  - API endpoint authorization

- **Key Test Scenarios:**
  - User accessing without authentication
  - User accessing other user's resources
  - Admin-only endpoint access
  - Token tampering attempts
  - Missing permission headers
  - Privilege escalation attempts

#### 5.2.3 Data Protection
- **Test Scope:** Sensitive data handling
- **Coverage Areas:**
  - Password hashing algorithm strength
  - Sensitive data in logs
  - Data in transit encryption
  - Database encryption

- **Key Test Scenarios:**
  - Password hashing verification
  - Verify no plaintext passwords in logs
  - HTTPS enforcement
  - Database field encryption verification
  - PII (Personally Identifiable Information) handling
  - Secure password reset

#### 5.2.4 API Security
- **Test Scope:** API-level security vulnerabilities
- **Coverage Areas:**
  - Input validation
  - Output encoding
  - API rate limiting
  - Request validation

- **Key Test Scenarios:**
  - SQL Injection attempts
  - Command Injection attempts
  - Path Traversal attempts
  - Malformed JSON payloads
  - Oversized payloads
  - Missing Content-Type validation
  - API key/token exposure
  - Unencrypted data transmission

#### 5.2.5 File Upload Security
- **Test Scope:** File upload vulnerability prevention
- **Coverage Areas:**
  - File type validation
  - File content validation
  - Malicious file detection
  - Path traversal prevention

- **Key Test Scenarios:**
  - Upload executable files
  - Upload scripts (.js, .py)
  - Upload files with malicious content
  - Upload with path traversal attempts (../)
  - Filename injection attacks
  - MIME type mismatch
  - Double extension attacks (.pdf.exe)
  - Verify virus scanning (if applicable)

#### 5.2.6 OAuth2 Security
- **Test Scope:** OAuth integration security
- **Coverage Areas:**
  - Authorization code validation
  - Token exchange security
  - PKCE implementation (if applicable)
  - State parameter validation

- **Key Test Scenarios:**
  - Invalid authorization codes
  - Replay attacks with old codes
  - Missing state parameter
  - State parameter tampering
  - Token expiration validation
  - Redirect URI validation

#### 5.2.7 CORS & Headers Security
- **Test Scope:** Cross-Origin Resource Sharing security
- **Coverage Areas:**
  - CORS origin validation
  - Allowed headers verification
  - Credential handling

- **Key Test Scenarios:**
  - Request from unauthorized origin
  - Preflight request handling
  - Wildcard origin risks
  - Credentials with CORS
  - Missing security headers

#### 5.2.8 Environment Security
- **Test Scope:** Configuration and environment security
- **Coverage Areas:**
  - Environment variable exposure
  - Hardcoded credentials
  - Debug mode in production

- **Key Test Scenarios:**
  - Check for exposed .env files
  - Verify no hardcoded API keys
  - Verify debug mode disabled
  - Check error message verbosity
  - Sensitive information in responses

### 5.3 Reliability & Availability Testing

#### 5.3.1 Error Handling
- **Test Scope:** Application behavior on errors
- **Coverage Areas:**
  - Graceful error handling
  - Error message clarity
  - Error logging

- **Key Test Scenarios:**
  - Database connection failure
  - External API timeout
  - Invalid request handling
  - Server internal errors
  - Partial service failures

#### 5.3.2 Recovery Testing
- **Test Scope:** System recovery capabilities
- **Coverage Areas:**
  - Automatic retry mechanisms
  - Fallback procedures
  - Data recovery

- **Key Test Scenarios:**
  - Service restart recovery
  - Database failover
  - Connection pool recovery
  - Incomplete transaction recovery

#### 5.3.3 Failover Testing
- **Test Scope:** System continuity during failures
- **Coverage Areas:**
  - Database failover
  - Load balancer failover
  - Graceful degradation

- **Key Test Scenarios:**
  - Primary database failure
  - Secondary service unavailability
  - Partial network failure

### 5.4 Maintainability & Compatibility Testing

#### 5.4.1 Compatibility Testing
- **Test Scope:** Cross-platform compatibility
- **Coverage Areas:**
  - Node.js version compatibility
  - Different operating systems
  - Browser compatibility (for API consumers)
  - Database version compatibility

- **Key Test Scenarios:**
  - Test on Node.js LTS versions
  - Test on Windows, Linux, macOS
  - Test with different Supabase versions
  - Test with various Express.js middleware

#### 5.4.2 Configuration Testing
- **Test Scope:** Configuration flexibility
- **Coverage Areas:**
  - Environment-specific configurations
  - Default configuration fallbacks
  - Configuration validation

- **Key Test Scenarios:**
  - Missing PORT environment variable
  - Invalid database credentials
  - Missing OAuth credentials
  - Custom CORS origins

### 5.5 Usability Testing (API)

#### 5.5.1 API Documentation Accuracy
- **Test Scope:** API documentation completeness and accuracy
- **Coverage Areas:**
  - Endpoint parameter documentation
  - Response format documentation
  - Error code documentation

- **Key Test Scenarios:**
  - Verify all endpoints documented
  - Verify parameter requirements match implementation
  - Verify response examples are accurate
  - Verify error codes match actual responses

#### 5.5.2 API Consistency
- **Test Scope:** API naming and response consistency
- **Coverage Areas:**
  - Consistent endpoint naming patterns
  - Consistent response structure
  - Consistent error handling

- **Key Test Scenarios:**
  - Check naming conventions across endpoints
  - Verify response structure consistency
  - Verify error response consistency

### 5.6 Compliance Testing

#### 5.6.1 Data Privacy
- **Test Scope:** GDPR, privacy regulations compliance
- **Coverage Areas:**
  - User data collection consent
  - Data retention policies
  - User data deletion

- **Key Test Scenarios:**
  - Verify user consent handling
  - Verify data deletion completeness
  - Verify data export functionality

#### 5.6.2 Audit & Logging
- **Test Scope:** Audit trail completeness
- **Coverage Areas:**
  - Authentication event logging
  - Data modification logging
  - Security event logging

- **Key Test Scenarios:**
  - Verify login attempts logged
  - Verify file uploads logged
  - Verify sensitive operation logging
  - Verify log integrity

---

## 6. Testing Tools & Framework

### Unit & Integration Testing
- **Framework:** Jest or Mocha
- **Assertion Library:** Chai or Node.js assert
- **Mocking Library:** Sinon or Jest mocks
- **HTTP Testing:** Supertest for Express endpoints

### Performance Testing
- **Load Testing:** Apache JMeter, k6, or Artillery
- **Profiling:** Node.js built-in profiler, clinic.js
- **Monitoring:** New Relic or Datadog

### Security Testing
- **SAST:** ESLint with security plugins, SonarQube
- **Dependency Scanning:** OWASP Dependency-Check, npm audit
- **API Security:** Postman, Burp Suite
- **Penetration Testing:** OWASP ZAP, Burp Suite

### End-to-End Testing
- **Framework:** Cypress or Playwright (for frontend integration)
- **API Testing:** REST Client, Postman

---

## 7. Test Data Management

### Data Requirements
- Test user accounts with various roles
- Sample documents in different formats and sizes
- Test OAuth credentials (sandbox)
- Test files for upload scenarios
- Production-like dataset sample

### Data Preparation
- Database seeding scripts
- Mock data factories
- Test data cleanup procedures

---

## 8. Test Execution Strategy

### Phase 1: Unit Testing (Week 1)
- Develop unit tests for all modules
- Target 80%+ code coverage
- Parallel execution

### Phase 2: Integration Testing (Week 2)
- Test module interactions
- Test API endpoints
- Database integration

### Phase 3: System Testing (Week 3)
- End-to-end workflow testing
- Performance baseline establishment
- Security testing

### Phase 4: Non-Functional Testing (Week 4)
- Load and stress testing
- Security penetration testing
- Compliance validation

### Phase 5: Regression Testing (Ongoing)
- Automated regression suite
- CI/CD pipeline integration

---

## 9. Defect Management

### Defect Severity Classification
- **Critical:** System crash, data loss, authentication bypass
- **High:** Major feature failure, security vulnerability
- **Medium:** Feature partially works, performance degradation
- **Low:** Minor UI/UX issues, non-critical errors

### Defect Tracking
- Use GitHub Issues or dedicated issue tracking system
- Include reproduction steps, expected vs actual behavior
- Assign priority and severity

---

## 10. Test Reporting & Metrics

### Key Metrics
- Code Coverage Percentage (Target: >80%)
- Test Pass/Fail Ratio
- Defect Density (Defects per KLOC)
- Test Execution Time
- Performance Metrics (Response time, throughput)
- Security Vulnerability Count

### Reports
- Daily test execution summary
- Weekly quality metrics dashboard
- Release readiness report
- Performance trending report

---

## 11. Entry & Exit Criteria

### Entry Criteria
- Development complete for testing phase
- Test environment setup complete
- Test data prepared
- Tools and infrastructure ready

### Exit Criteria
- All critical defects fixed
- Code coverage >80%
- Performance metrics met
- Security testing passed
- No open high-priority defects
- Test report approved

---

## 12. Risk Assessment & Mitigation

### Identified Risks
1. **Database Performance** - Risk: Slow queries under load
   - *Mitigation:* Early performance testing, query optimization

2. **OAuth Integration Failures** - Risk: Google API changes or outages
   - *Mitigation:* Fallback authentication, API version locking

3. **File Upload Vulnerabilities** - Risk: Malicious file uploads
   - *Mitigation:* Strict file validation, security scanning

4. **Concurrent Request Issues** - Risk: Race conditions in document generation
   - *Mitigation:* Lock mechanisms, queue system testing

5. **Data Privacy Issues** - Risk: Accidental data exposure
   - *Mitigation:* Data protection testing, audit logging

---

## 13. Sign-Off & Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Lead | | | |
| QA Manager | | | |
| Development Lead | | | |
| Security Officer | | | |

---

## Appendix A: Test Case Template

*To be used when creating individual test cases in follow-up documents*

```
Test Case ID: TC_[Module]_[Number]
Title: [Brief description]
Module: [Auth/Upload/Generate/etc]
Type: [Unit/Integration/System/Performance/Security]
Priority: [Critical/High/Medium/Low]
Status: [Draft/Ready/Executed]

Preconditions:
- [Setup required before test]

Test Steps:
1. [First action]
2. [Second action]
3. [Expected result]

Expected Results:
- [What should happen]

Actual Results:
- [What actually happened - fill during execution]

Pass/Fail:
- [PASS/FAIL with notes]

```

---

**End of Test Plan Report**
