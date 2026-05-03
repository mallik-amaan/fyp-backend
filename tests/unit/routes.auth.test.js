/**
 * Unit Tests — Auth Routes
 * Supabase and nodemailer are fully mocked; no real DB or SMTP calls are made.
 */
jest.mock('../../config/supabase.config');
jest.mock('nodemailer');

const request    = require('supertest');
const express    = require('express');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const supabase   = require('../../config/supabase.config');

// Build chainable Supabase mock helper
function buildChain(resolve) {
  const chain = {
    select:  () => chain,
    insert:  () => chain,
    update:  () => chain,
    delete:  () => chain,
    eq:      () => chain,
    order:   () => chain,
    limit:   () => chain,
    single:  () => Promise.resolve(resolve),
  };
  return chain;
}

// nodemailer stub — sendMail always succeeds
const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

// Build Express app for route testing
const app = express();
app.use(express.json());
app.use('/auth', require('../../routes/auth.route'));

const SECRET  = process.env.ACCESS_SECRET;
const RSECRET = process.env.REFRESH_SECRET;

// ── Helper: valid JWT ─────────────────────────────────────────────────────────
const makeToken = (payload = { email: 'user@example.com' }, expiresIn = '15m') =>
  jwt.sign(payload, SECRET, { expiresIn });

describe('POST /auth/login', () => {
  it('TC-AUTH-01: returns tokens for valid credentials and verified email', async () => {
    const user = { id: 'uid-1', username: 'alice', email: 'alice@example.com', password_hash: 'pass123', email_verified: true };

    supabase.from.mockImplementation(table => {
      if (table === 'users') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [user], error: null }) }) };
      }
      if (table === 'refresh_tokens') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      return buildChain({ data: null, error: null });
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe(true);
    expect(res.body.access).toBeDefined();
    expect(res.body.refresh).toBeDefined();
    expect(res.body.email).toBe('alice@example.com');
  });

  it('TC-AUTH-02: returns result=false for wrong password', async () => {
    const user = { id: 'uid-1', password_hash: 'correct', email_verified: true };
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [user], error: null }) }),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong' });

    expect(res.body.result).toBe('false');
    expect(res.body.message).toMatch(/incorrect/i);
  });

  it('TC-AUTH-03: returns requiresVerification=true for unverified email', async () => {
    const user = { id: 'uid-1', password_hash: 'pass', email_verified: false };
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [user], error: null }) }),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'pass' });

    expect(res.body.result).toBe(false);
    expect(res.body.requiresVerification).toBe(true);
  });

  it('TC-AUTH-04: returns error message when user not found', async () => {
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass' });

    expect(res.body.result).toBe('false');
  });
});

describe('POST /auth/validate', () => {
  it('TC-AUTH-05: returns result=true with email for valid token', async () => {
    const token = makeToken({ email: 'alice@example.com' });

    const res = await request(app)
      .post('/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe(true);
    expect(res.body.email).toBe('alice@example.com');
  });

  it('TC-AUTH-06: returns 401 when Authorization header missing', async () => {
    const res = await request(app).post('/auth/validate');

    expect(res.status).toBe(401);
    expect(res.body.result).toBe(false);
  });

  it('TC-AUTH-07: returns 401 for expired token', async () => {
    const token = jwt.sign({ email: 'alice@example.com' }, SECRET, { expiresIn: '1ms' });
    await new Promise(r => setTimeout(r, 20));

    const res = await request(app)
      .post('/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.result).toBe(false);
  });

  it('TC-AUTH-08: returns 401 for malformed token', async () => {
    const res = await request(app)
      .post('/auth/validate')
      .set('Authorization', 'Bearer garbage.token.here');

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('TC-AUTH-09: issues new tokens for a valid refresh token', async () => {
    const refreshToken = jwt.sign({ email: 'alice@example.com' }, RSECRET, { expiresIn: '7d' });

    supabase.from.mockImplementation(table => {
      if (table === 'refresh_tokens') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { user_id: 'uid-1', token_hash: refreshToken }, error: null }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return buildChain({ data: null, error: null });
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
  });

  it('TC-AUTH-10: returns 401 when refresh token is missing', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('TC-AUTH-11: returns 401 for expired refresh token', async () => {
    const expiredToken = jwt.sign({ email: 'alice@example.com' }, RSECRET, { expiresIn: '1ms' });
    await new Promise(r => setTimeout(r, 20));

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: expiredToken });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/send-otp', () => {
  it('TC-AUTH-12: returns 400 for missing email or invalid purpose', async () => {
    const res = await request(app)
      .post('/auth/send-otp')
      .send({ email: 'alice@example.com', purpose: 'hack_system' });

    expect(res.status).toBe(400);
  });

  it('TC-AUTH-13: returns result=true (silent success) for unknown email', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    const res = await request(app)
      .post('/auth/send-otp')
      .send({ email: 'nobody@example.com', purpose: 'reset_password' });

    expect(res.body.result).toBe(true);
  });

  it('TC-AUTH-14: returns error for already-verified email with verify_email purpose', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'uid-1', email_verified: true }, error: null }),
        }),
      }),
    });

    const res = await request(app)
      .post('/auth/send-otp')
      .send({ email: 'verified@example.com', purpose: 'verify_email' });

    expect(res.body.result).toBe(false);
    expect(res.body.message).toMatch(/already verified/i);
  });
});

describe('POST /auth/verify-otp', () => {
  it('TC-AUTH-15: returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });

  it('TC-AUTH-16: returns result=true and issues reset_token on valid reset_password OTP', async () => {
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const otpRecord = { id: 'otp-1', expires_at: futureExpiry, used: false };

    supabase.from.mockImplementation(table => {
      if (table === 'otps') {
        const chain = {
          select: () => chain,
          eq:     () => chain,
          order:  () => chain,
          limit:  () => chain,
          single: () => Promise.resolve({ data: otpRecord, error: null }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
        return chain;
      }
      return buildChain({ data: null, error: null });
    });

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'alice@example.com', otp: '123456', purpose: 'reset_password' });

    expect(res.body.result).toBe(true);
    expect(res.body.reset_token).toBeDefined();
  });

  it('TC-AUTH-17: returns result=false for invalid OTP', async () => {
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
      return buildChain({ data: null, error: null });
    });

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'alice@example.com', otp: '000000', purpose: 'verify_email' });

    expect(res.status).toBe(400);
    expect(res.body.result).toBe(false);
  });
});

describe('POST /auth/reset-password', () => {
  it('TC-AUTH-18: returns 400 when reset_token or new_password is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ new_password: 'newpass' });

    expect(res.status).toBe(400);
  });

  it('TC-AUTH-19: updates password and returns result=true for valid reset token', async () => {
    const resetToken = jwt.sign({ email: 'alice@example.com', purpose: 'reset' }, SECRET, { expiresIn: '10m' });

    supabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ reset_token: resetToken, new_password: 'newPass123!' });

    expect(res.body.result).toBe(true);
  });

  it('TC-AUTH-20: returns 400 for an expired reset token', async () => {
    const expiredToken = jwt.sign({ email: 'alice@example.com', purpose: 'reset' }, SECRET, { expiresIn: '1ms' });
    await new Promise(r => setTimeout(r, 20));

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ reset_token: expiredToken, new_password: 'newPass!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('TC-AUTH-21: returns 400 for token with wrong purpose field', async () => {
    const wrongPurposeToken = jwt.sign({ email: 'alice@example.com', purpose: 'login' }, SECRET, { expiresIn: '10m' });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ reset_token: wrongPurposeToken, new_password: 'pass' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid reset token/i);
  });
});

describe('POST /auth/update-profile', () => {
  it('TC-AUTH-22: returns 400 when id or username is missing', async () => {
    const res = await request(app)
      .post('/auth/update-profile')
      .send({ id: 'uid-1' });

    expect(res.status).toBe(400);
  });

  it('TC-AUTH-23: returns updated username on success', async () => {
    supabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    const res = await request(app)
      .post('/auth/update-profile')
      .send({ id: 'uid-1', username: 'Alice New' });

    expect(res.body.result).toBe(true);
    expect(res.body.username).toBe('Alice New');
  });
});
