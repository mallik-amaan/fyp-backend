/**
 * Performance Tests — API Response Time Thresholds
 * Each test asserts that the endpoint responds within the defined budget.
 * These run against the test app (mocked DB), so they measure server processing
 * time only — not real network or Supabase latency.
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
app.use('/auth', require('../../routes/auth.route'));
app.use('/user', require('../../routes/user.route'));

const SECRET = process.env.ACCESS_SECRET;

// ── Supabase default stubs ────────────────────────────────────────────────────
beforeEach(() => {
  supabase.from.mockReturnValue({
    select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    insert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  });
});

function elapsed(start) {
  return Date.now() - start;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────
describe('Performance — Auth Endpoints (< 500 ms target)', () => {
  it('TC-PERF-01: POST /auth/validate responds in < 500 ms', async () => {
    const token = jwt.sign({ email: 'a@b.com' }, SECRET, { expiresIn: '15m' });
    const start = Date.now();

    await request(app)
      .post('/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(elapsed(start)).toBeLessThan(500);
  });

  it('TC-PERF-02: POST /auth/login (user not found path) responds in < 500 ms', async () => {
    const start = Date.now();

    await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'x' });

    expect(elapsed(start)).toBeLessThan(500);
  });

  it('TC-PERF-03: POST /auth/send-otp (unknown email silent path) responds in < 500 ms', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    const start = Date.now();

    await request(app)
      .post('/auth/send-otp')
      .send({ email: 'nobody@example.com', purpose: 'reset_password' });

    expect(elapsed(start)).toBeLessThan(500);
  });

  it('TC-PERF-04: POST /auth/update-profile responds in < 500 ms', async () => {
    const start = Date.now();

    await request(app)
      .post('/auth/update-profile')
      .send({ id: 'uid-1', username: 'Alice' });

    expect(elapsed(start)).toBeLessThan(500);
  });
});

// ── Dashboard stats ───────────────────────────────────────────────────────────
describe('Performance — Dashboard Stats (< 1000 ms target)', () => {
  it('TC-PERF-05: POST /user/get-dashboard-stats responds in < 1000 ms', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    });

    const start = Date.now();

    await request(app)
      .post('/user/get-dashboard-stats')
      .send({ id: 'uid-1' });

    expect(elapsed(start)).toBeLessThan(1000);
  });
});

// ── Concurrent requests ───────────────────────────────────────────────────────
describe('Performance — Concurrent Load (10 simultaneous users)', () => {
  it('TC-PERF-06: 10 simultaneous /auth/validate requests all succeed within 2 s', async () => {
    const token = jwt.sign({ email: 'a@b.com' }, SECRET, { expiresIn: '15m' });

    const start    = Date.now();
    const requests = Array.from({ length: 10 }, () =>
      request(app)
        .post('/auth/validate')
        .set('Authorization', `Bearer ${token}`)
    );

    const results = await Promise.all(requests);

    expect(elapsed(start)).toBeLessThan(2000);
    results.forEach(res => expect(res.status).toBe(200));
  });

  it('TC-PERF-07: 50 simultaneous /auth/validate requests complete without error', async () => {
    const token = jwt.sign({ email: 'a@b.com' }, SECRET, { expiresIn: '15m' });

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        request(app)
          .post('/auth/validate')
          .set('Authorization', `Bearer ${token}`)
      )
    );

    const failures = results.filter(r => r.status !== 200);
    expect(failures.length).toBe(0);
  });
});

// ── Response-time regression guard ───────────────────────────────────────────
describe('Performance — Repeated calls must not degrade', () => {
  it('TC-PERF-08: 5 sequential validate calls all stay under 300 ms each', async () => {
    const token = jwt.sign({ email: 'a@b.com' }, SECRET, { expiresIn: '15m' });

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await request(app)
        .post('/auth/validate')
        .set('Authorization', `Bearer ${token}`);
      expect(elapsed(start)).toBeLessThan(300);
    }
  });
});
