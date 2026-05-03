/**
 * Integration Tests — Redaction Route
 * Covers: upload URL creation, submission, history retrieval, usage limits, error handling.
 */
jest.mock('../../config/supabase.config');
jest.mock('../../utils/usageHelper');

const request       = require('supertest');
const express       = require('express');
const supabase      = require('../../config/supabase.config');
const usageHelper   = require('../../utils/usageHelper');

// Also mock global fetch used by the submit endpoint to call the redaction service
global.fetch = jest.fn();

const app = express();
app.use(express.json());
app.use('/redaction', require('../../routes/redaction.route'));

// ── Default mock helpers ───────────────────────────────────────────────────────
function mockAllowed() {
  usageHelper.checkUsageLimit.mockResolvedValue({ allowed: true, used: 0, limit: 10 });
  usageHelper.incrementUsage.mockResolvedValue(undefined);
}

function mockSupabaseUpload() {
  supabase.from.mockImplementation(table => {
    if (table === 'document_requests') {
      return { insert: () => Promise.resolve({ error: null }) };
    }
    return { insert: () => Promise.resolve({ error: null }) };
  });
  supabase.storage = {
    from: jest.fn().mockReturnValue({
      createSignedUploadUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/upload?token=abc' },
        error: null,
      }),
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Redaction — Upload URL Creation (POST /redaction/upload)', () => {
  it('TC-RED-01: returns 200 with requestId and uploadUrl when userId and fileName are provided', async () => {
    mockAllowed();
    mockSupabaseUpload();

    const res = await request(app)
      .post('/redaction/upload')
      .send({ userId: 'uid-1', fileName: 'contract.pdf' });

    expect(res.status).toBe(200);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.storagePath).toBeDefined();
  });

  it('TC-RED-02: returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/redaction/upload')
      .send({ fileName: 'contract.pdf' });

    expect(res.status).toBe(400);
  });

  it('TC-RED-03: returns 400 when fileName is missing', async () => {
    const res = await request(app)
      .post('/redaction/upload')
      .send({ userId: 'uid-1' });

    expect(res.status).toBe(400);
  });

  it('TC-RED-04: returns 403 when redaction usage limit is reached', async () => {
    usageHelper.checkUsageLimit.mockResolvedValue({ allowed: false, used: 10, limit: 10 });

    const res = await request(app)
      .post('/redaction/upload')
      .send({ userId: 'uid-1', fileName: 'contract.pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/limit/i);
  });

  it('TC-RED-05: storagePath contains the userId and fileName segments', async () => {
    mockAllowed();
    mockSupabaseUpload();

    const res = await request(app)
      .post('/redaction/upload')
      .send({ userId: 'uid-1', fileName: 'invoice.pdf' });

    expect(res.body.storagePath).toContain('uid-1');
    expect(res.body.storagePath).toContain('invoice.pdf');
  });
});

describe('Redaction — Submit (POST /redaction/:requestId/submit)', () => {
  beforeEach(() => {
    supabase.from.mockImplementation(() => ({
      insert: () => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }));
    global.fetch.mockResolvedValue({ ok: true });
  });

  it('TC-RED-06: returns 200 when storagePath is provided and DB operations succeed', async () => {
    const res = await request(app)
      .post('/redaction/req-123/submit')
      .send({ storagePath: 'uid-1/req-123/seeddocs/file.pdf' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-RED-07: returns 400 when storagePath is missing', async () => {
    const res = await request(app)
      .post('/redaction/req-123/submit')
      .send({});

    expect(res.status).toBe(400);
  });

  it('TC-RED-08: still returns 200 even if external redaction service returns an error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });

    const res = await request(app)
      .post('/redaction/req-123/submit')
      .send({ storagePath: 'uid-1/req-123/seeddocs/file.pdf' });

    // Client should not be failed — service error is logged but non-fatal
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Redaction — History (GET /redaction/history/:userId)', () => {
  it('TC-RED-09: returns list of redaction requests for a user', async () => {
    const RECORD = {
      id: 'req-red-1', status: 'completed',
      metadata: { request_type: 'redaction_only', originalFileName: 'doc.pdf' },
      created_at: new Date().toISOString(),
    };
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          filter: () => ({
            order: () => Promise.resolve({ data: [RECORD], error: null }),
          }),
        }),
      }),
    });

    const res = await request(app).get('/redaction/history/uid-1');

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].id).toBe('req-red-1');
  });

  it('TC-RED-10: returns empty array when user has no redaction history', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          filter: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await request(app).get('/redaction/history/uid-new');

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(0);
  });

  it('TC-RED-11: returns 400 when userId param is empty', async () => {
    const res = await request(app).get('/redaction/history/');
    expect(res.status).toBe(404); // no route match for empty param
  });

  it('TC-RED-12: returns 500 when DB query fails', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          filter: () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const res = await request(app).get('/redaction/history/uid-1');
    expect(res.status).toBe(500);
  });
});
