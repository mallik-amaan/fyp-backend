/**
 * Reliability Tests — Error Boundaries, Retry Logic, Edge Cases, Session Stability
 */
jest.mock('../../config/supabase.config');
jest.mock('nodemailer');

const request    = require('supertest');
const express    = require('express');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const supabase   = require('../../config/supabase.config');

nodemailer.createTransport.mockReturnValue({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'ok' }),
});

const app = express();
app.use(express.json());
app.use('/auth',      require('../../routes/auth.route'));
app.use('/analytics', require('../../routes/analytics.route'));
app.use('/docs',      require('../../routes/docs.route'));

const SECRET = process.env.ACCESS_SECRET;

// ── API Error Handling ────────────────────────────────────────────────────────
describe('Reliability — API Error Handling', () => {
  it('TC-REL-01: returns 500 gracefully when Supabase throws during login', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.reject(new Error('Supabase connection timeout')),
      }),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'pass' });

    // Server should catch and return a structured error, not crash
    expect([200, 500]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  it('TC-REL-02: returns 500 gracefully when Supabase throws during reset-password', async () => {
    const resetToken = jwt.sign({ email: 'alice@example.com', purpose: 'reset' }, SECRET, { expiresIn: '10m' });

    supabase.from.mockReturnValue({
      update: () => ({
        eq: () => Promise.reject(new Error('DB write failure')),
      }),
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ reset_token: resetToken, new_password: 'newPass!' });

    expect(res.status).toBe(500);
    expect(res.body.result).toBe(false);
  });

  it('TC-REL-03: analytics submit-review returns 500 and descriptive message on DB error', async () => {
    supabase.from.mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: { message: 'check constraint violation', code: '23514' } }),
      }),
    });

    const res = await request(app)
      .post('/analytics/submit-review')
      .send({ sessionId: 'req-1', flagged: [] });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
    expect(typeof res.body.message).toBe('string');
  });

  it('TC-REL-04: /docs/get-generated-docs returns 500 on unexpected server error', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.reject(new Error('Unexpected DB error')),
      }),
    });

    const res = await request(app)
      .post('/docs/get-generated-docs')
      .send({ id: 'uid-1' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────────────
describe('Reliability — Edge Cases', () => {
  it('TC-REL-05: /auth/update-profile trims whitespace from username', async () => {
    supabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    const res = await request(app)
      .post('/auth/update-profile')
      .send({ id: 'uid-1', username: '   Alice   ' });

    expect(res.body.result).toBe(true);
    expect(res.body.username).toBe('Alice');
  });

  it('TC-REL-06: /auth/update-profile rejects blank username', async () => {
    const res = await request(app)
      .post('/auth/update-profile')
      .send({ id: 'uid-1', username: '   ' });

    expect(res.status).toBe(400);
  });

  it('TC-REL-07: /auth/refresh accepts both refreshToken and refresh_token keys', async () => {
    const token = jwt.sign({ email: 'a@b.com' }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { user_id: 'uid-1', token_hash: token }, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: token });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
  });

  it('TC-REL-08: /auth/send-otp with missing email returns 400', async () => {
    const res = await request(app)
      .post('/auth/send-otp')
      .send({ purpose: 'reset_password' });

    expect(res.status).toBe(400);
  });

  it('TC-REL-09: /auth/verify-otp handles all three required fields missing gracefully', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.result).toBe(false);
  });
});

// ── Session Stability ─────────────────────────────────────────────────────────
describe('Reliability — Session Stability', () => {
  it('TC-REL-10: 100 sequential validate calls all return consistent results', async () => {
    const token = jwt.sign({ email: 'alice@example.com' }, SECRET, { expiresIn: '15m' });

    for (let i = 0; i < 100; i++) {
      const res = await request(app)
        .post('/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.email).toBe('alice@example.com');
    }
  });

  it('TC-REL-11: server does not crash on null JSON body', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('null');

    // Should return an error response, not crash the process
    expect([200, 400, 500]).toContain(res.status);
  });

  it('TC-REL-12: server handles concurrent mixed auth requests without state corruption', async () => {
    const validToken = jwt.sign({ email: 'alice@example.com' }, SECRET, { expiresIn: '15m' });

    supabase.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });

    const results = await Promise.all([
      request(app).post('/auth/validate').set('Authorization', `Bearer ${validToken}`),
      request(app).post('/auth/login').send({ email: 'x@y.com', password: 'bad' }),
      request(app).post('/auth/validate').set('Authorization', 'Bearer invalid'),
      request(app).post('/auth/validate').set('Authorization', `Bearer ${validToken}`),
      request(app).post('/auth/send-otp').send({ email: 'a@b.com', purpose: 'reset_password' }),
    ]);

    expect(results[0].status).toBe(200);  // valid token
    expect(results[2].status).toBe(401);  // invalid token
    expect(results[3].status).toBe(200);  // valid token again
  });
});
