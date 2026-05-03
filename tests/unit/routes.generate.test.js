/**
 * Unit Tests — Generate Route (POST /generate/generate)
 * Verifies input validation, request ID generation, and module selection.
 */
jest.mock('../../config/supabase.config');

const request  = require('supertest');
const express  = require('express');
const supabase = require('../../config/supabase.config');

const app = express();
app.use(express.json());
app.use('/generate', require('../../routes/generate.route'));

const BASE_BODY = {
  userId:        'uid-1',
  documentName:  'Annual Report',
  language:      'English',
  documentType:  'Report',
  groundTruth:   'false',
  numSolutions:  3,
  redaction:     false,
  seedDocumentIds: [],
  visualAssetIds:  [],
};

describe('POST /generate/generate — Input Validation', () => {
  it('TC-GEN-01: returns 202 with requestId when all required fields are present', async () => {
    const res = await request(app)
      .post('/generate/generate')
      .send(BASE_BODY);

    expect(res.status).toBe(202);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.status).toBe('processing');
  });

  it('TC-GEN-02: returns 400 when language is missing', async () => {
    const { language, ...body } = BASE_BODY;
    const res = await request(app).post('/generate/generate').send(body);
    expect(res.status).toBe(400);
  });

  it('TC-GEN-03: returns 400 when documentType is missing', async () => {
    const { documentType, ...body } = BASE_BODY;
    const res = await request(app).post('/generate/generate').send(body);
    expect(res.status).toBe(400);
  });

  it('TC-GEN-04: returns 400 when numSolutions is missing', async () => {
    const { numSolutions, ...body } = BASE_BODY;
    const res = await request(app).post('/generate/generate').send(body);
    expect(res.status).toBe(400);
  });
});

describe('POST /generate/generate — Response Shape', () => {
  it('TC-GEN-05: requestId is a valid UUID v4', async () => {
    const res = await request(app).post('/generate/generate').send(BASE_BODY);
    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('TC-GEN-06: module is "generation" when redaction flag is false', async () => {
    const res = await request(app)
      .post('/generate/generate')
      .send({ ...BASE_BODY, redaction: false });

    expect(res.body.module).toBe('generation');
  });

  it('TC-GEN-07: module is "redaction" when redaction flag is true', async () => {
    const res = await request(app)
      .post('/generate/generate')
      .send({ ...BASE_BODY, redaction: true });

    expect(res.body.module).toBe('redaction');
  });

  it('TC-GEN-08: each request gets a unique requestId', async () => {
    const res1 = await request(app).post('/generate/generate').send(BASE_BODY);
    const res2 = await request(app).post('/generate/generate').send(BASE_BODY);
    expect(res1.body.requestId).not.toBe(res2.body.requestId);
  });
});
