/**
 * Integration Tests — Full Auth Flow
 * Simulates: Signup → OTP verify → Login → Token refresh → Validate → Logout
 * Supabase and nodemailer are mocked; JWT uses real crypto with test secrets.
 */
jest.mock('../../config/supabase.config');
jest.mock('nodemailer');

const request    = require('supertest');
const express    = require('express');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const supabase   = require('../../config/supabase.config');

// Must be configured before auth.route is required, because the route calls
// nodemailer.createTransport() at module load time.
nodemailer.createTransport.mockReturnValue({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-msg' }),
});

const app = express();
app.use(express.json());
app.use('/auth', require('../../routes/auth.route'));

const SECRET  = process.env.ACCESS_SECRET;
const RSECRET = process.env.REFRESH_SECRET;

// ── Shared state across the integration flow ──────────────────────────────────
let capturedAccessToken;
let capturedRefreshToken;
const TEST_EMAIL    = 'integration@example.com';
const TEST_PASSWORD = 'SecurePass1!';
const TEST_USERNAME = 'integrationUser';

describe('Auth Integration Flow', () => {
  describe('Step 1 — Signup', () => {
    it('TC-INT-AUTH-01: POST /auth/signup creates user and sends OTP', async () => {
      supabase.from.mockImplementation(table => {
        if (table === 'users') {
          return {
            select: () => ({
              eq:     () => ({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }),
            }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'plans') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { id: 'plan-basic' }, error: null }) }),
            }),
          };
        }
        if (table === 'user_usage') {
          return { insert: () => Promise.resolve({ error: null }) };
        }
        if (table === 'apis') {
          return {
            insert: () => ({
              select: () => Promise.resolve({ data: [{ id: 'api-id-1' }], error: null }),
            }),
          };
        }
        if (table === 'otps') {
          return {
            update: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        return { insert: () => Promise.resolve({ error: null }) };
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: TEST_EMAIL, username: TEST_USERNAME, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.requiresVerification).toBe(true);
    });

    it('TC-INT-AUTH-02: POST /auth/signup rejects duplicate email', async () => {
      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { id: 'uid-existing' }, error: null }),
          }),
        }),
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: TEST_EMAIL, username: 'other', password: 'pass' });

      expect(res.body.result).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe('Step 2 — OTP Verification', () => {
    it('TC-INT-AUTH-03: POST /auth/verify-otp verifies email successfully', async () => {
      const futureExpiry = new Date(Date.now() + 600_000).toISOString();
      supabase.from.mockImplementation(table => {
        if (table === 'otps') {
          const chain = {
            select: () => chain,
            eq:     () => chain,
            order:  () => chain,
            limit:  () => chain,
            single: () => Promise.resolve({ data: { id: 'otp-1', expires_at: futureExpiry, used: false }, error: null }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
          return chain;
        }
        if (table === 'users') {
          return {
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
      });

      const res = await request(app)
        .post('/auth/verify-otp')
        .send({ email: TEST_EMAIL, otp: '123456', purpose: 'verify_email' });

      expect(res.body.result).toBe(true);
    });

    it('TC-INT-AUTH-04: POST /auth/verify-otp rejects with 400 for wrong OTP', async () => {
      supabase.from.mockImplementation(table => {
        if (table === 'otps') {
          const chain = {
            select: () => chain,
            eq:     () => chain,
            order:  () => chain,
            limit:  () => chain,
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
          };
          return chain;
        }
        return {};
      });

      const res = await request(app)
        .post('/auth/verify-otp')
        .send({ email: TEST_EMAIL, otp: '000000', purpose: 'verify_email' });

      expect(res.status).toBe(400);
      expect(res.body.result).toBe(false);
    });
  });

  describe('Step 3 — Login', () => {
    it('TC-INT-AUTH-05: POST /auth/login returns JWT tokens after successful login', async () => {
      const userRecord = {
        id: 'uid-1',
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password_hash: TEST_PASSWORD,
        email_verified: true,
      };

      supabase.from.mockImplementation(table => {
        if (table === 'users') {
          return { select: () => ({ eq: () => Promise.resolve({ data: [userRecord], error: null }) }) };
        }
        if (table === 'refresh_tokens') {
          return { insert: () => Promise.resolve({ error: null }) };
        }
        return { insert: () => Promise.resolve({ error: null }) };
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);

      capturedAccessToken  = res.body.access;
      capturedRefreshToken = res.body.refresh;

      expect(capturedAccessToken).toBeDefined();
      expect(capturedRefreshToken).toBeDefined();
    });
  });

  describe('Step 4 — Token Validation', () => {
    it('TC-INT-AUTH-06: POST /auth/validate accepts the token received at login', async () => {
      expect(capturedAccessToken).toBeDefined();

      const res = await request(app)
        .post('/auth/validate')
        .set('Authorization', `Bearer ${capturedAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.email).toBe(TEST_EMAIL);
    });
  });

  describe('Step 5 — Token Refresh', () => {
    it('TC-INT-AUTH-07: POST /auth/refresh issues new token pair from refresh token', async () => {
      expect(capturedRefreshToken).toBeDefined();

      supabase.from.mockImplementation(table => {
        if (table === 'refresh_tokens') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { user_id: 'uid-1', token_hash: capturedRefreshToken },
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: capturedRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });
  });

  describe('Protected route — Dashboard redirect', () => {
    it('TC-INT-AUTH-08: GET /dashboard redirects unauthenticated users (middleware returns 401)', async () => {
      const authMiddleware = require('../../config/middleware/auth.middleware');
      const protectedApp = express();
      protectedApp.use(express.json());
      protectedApp.get('/dashboard', authMiddleware, (req, res) => res.json({ ok: true }));

      const res = await request(protectedApp).get('/dashboard');
      expect(res.status).toBe(401);
    });
  });
});
