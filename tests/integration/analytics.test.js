/**
 * Integration Tests — Analytics Tracking
 * Verifies that successful/failed requests are logged and aggregated correctly.
 */
jest.mock('../../config/supabase.config');

const request  = require('supertest');
const express  = require('express');
const supabase = require('../../config/supabase.config');

const app = express();
app.use(express.json());
app.use('/analytics', require('../../routes/analytics.route'));
app.use('/user',      require('../../routes/user.route'));

// ── Shared fixture data ───────────────────────────────────────────────────────
const COMPLETED_REQ = {
  id: 'req-1', status: 'completed', created_at: new Date().toISOString(),
  metadata: { documentName: 'Report A', documentType: 'Report', numSolutions: 3 },
};
const FAILED_REQ = {
  id: 'req-2', status: 'failed', created_at: new Date().toISOString(),
  metadata: { documentName: 'Report B', documentType: 'Invoice', numSolutions: 1 },
};
const FLAGGED_REQ = {
  id: 'req-3', status: 'flagged', created_at: new Date().toISOString(),
  metadata: { documentName: 'Report C', documentType: 'Report', numSolutions: 2 },
};
const REDACTION_REQ = {
  id: 'req-red', status: 'redacted', created_at: new Date().toISOString(),
  metadata: { request_type: 'redaction_only' },
};

describe('Analytics — Aggregated Stats (GET /user/get-dashboard-stats)', () => {
  it('TC-AN-01: correctly counts completed, failed, flagged requests', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [COMPLETED_REQ, FAILED_REQ, FLAGGED_REQ, REDACTION_REQ],
          error: null,
        }),
      }),
    });

    const res = await request(app)
      .post('/user/get-dashboard-stats')
      .send({ id: 'uid-1' });

    expect(res.status).toBe(200);
    expect(res.body.generatedDocs).toBe(3);   // excludes redaction-only
    expect(res.body.flaggedDocs).toBe(1);
    expect(res.body.successRatio).toBe('33%'); // 1 completed out of 3 finalized (completed+flagged+failed)
  });

  it('TC-AN-02: excludes redaction-only requests from generation stats', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [REDACTION_REQ],
          error: null,
        }),
      }),
    });

    const res = await request(app)
      .post('/user/get-dashboard-stats')
      .send({ id: 'uid-1' });

    expect(res.body.generatedDocs).toBe(0);
    expect(res.body.flaggedDocs).toBe(0);
    expect(res.body.redactionsCompleted).toBe(1);
  });

  it('TC-AN-03: returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/user/get-dashboard-stats')
      .send({});

    expect(res.status).toBe(400);
  });

  it('TC-AN-04: returns successRatio=0% when no requests are finalized', async () => {
    const pendingReq = { ...COMPLETED_REQ, status: 'processing' };
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [pendingReq], error: null }),
      }),
    });

    const res = await request(app)
      .post('/user/get-dashboard-stats')
      .send({ id: 'uid-1' });

    expect(res.body.successRatio).toBe('0%');
  });
});

describe('Analytics — Document Pairs (GET /analytics/pairs/:requestId)', () => {
  const PAIR = {
    id: 'pair-1', doc_index: 0, flagged: false,
    flag_reason: null, doc_storage_path: 'req-1/doc_0.pdf', gt_storage_path: 'req-1/gt_0.json',
  };

  beforeEach(() => {
    supabase.storage = {
      from: jest.fn().mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed' },
        }),
      }),
    };
  });

  it('TC-AN-05: returns 200 with pairs and signed URLs', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [PAIR], error: null }),
        }),
      }),
    });

    const res = await request(app).get('/analytics/pairs/req-1');

    expect(res.status).toBe(200);
    expect(res.body.pairs).toHaveLength(1);
    expect(res.body.pairs[0].doc_url).toBeDefined();
  });

  it('TC-AN-06: returns 404 when no pairs found for a request', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });

    const res = await request(app).get('/analytics/pairs/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('Analytics — Submit Review (POST /analytics/submit-review)', () => {
  it('TC-AN-07: sets status=completed when no pairs are flagged', async () => {
    supabase.from.mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });

    const res = await request(app)
      .post('/analytics/submit-review')
      .send({ sessionId: 'req-1', flagged: [] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('TC-AN-08: sets status=flagged when at least one pair is flagged', async () => {
    supabase.from.mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });

    const res = await request(app)
      .post('/analytics/submit-review')
      .send({ sessionId: 'req-1', flagged: ['pair-2', 'pair-5'] });

    expect(res.body.status).toBe('flagged');
  });

  it('TC-AN-09: returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/analytics/submit-review')
      .send({ flagged: [] });

    expect(res.status).toBe(400);
  });

  it('TC-AN-10: returns 500 when DB update fails', async () => {
    supabase.from.mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: { message: 'constraint violation', code: '23514' } }),
      }),
    });

    const res = await request(app)
      .post('/analytics/submit-review')
      .send({ sessionId: 'req-1', flagged: [] });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
  });
});

describe('Analytics — Flag Pair (PATCH /analytics/pairs/:pairId/flag)', () => {
  it('TC-AN-11: returns 200 when flag update succeeds', async () => {
    supabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    const res = await request(app)
      .patch('/analytics/pairs/pair-1/flag')
      .send({ flagged: true, flag_reason: 'Low quality' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-AN-12: returns 400 when flagged field is not a boolean', async () => {
    const res = await request(app)
      .patch('/analytics/pairs/pair-1/flag')
      .send({ flagged: 'yes' });

    expect(res.status).toBe(400);
  });
});
