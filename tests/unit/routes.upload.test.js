/**
 * Unit Tests — Upload Routes
 * Tests file type validation, userId guard, Supabase storage upload, and temp-file cleanup.
 */
jest.mock('../../config/supabase.config');

const request   = require('supertest');
const express   = require('express');
const path      = require('path');
const supabase  = require('../../config/supabase.config');

const app = express();
app.use(express.json());
app.use('/upload', require('../../routes/upload.route'));

// Minimal PDF magic bytes so Multer accepts the file
const MINIMAL_PDF = Buffer.from('%PDF-1.4 minimal');
const PNG_BYTES   = Buffer.from('\x89PNG\r\n\x1a\n');

describe('POST /upload/storage', () => {
  beforeEach(() => {
    // Default Supabase storage stub — success
    supabase.storage = {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'uid/file.pdf' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/uid/file.pdf' },
        }),
      }),
    };
  });

  it('TC-UP-01: returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });

  it('TC-UP-02: returns 400 when file is not a PDF (PNG submitted)', async () => {
    const res = await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1')
      .attach('file', PNG_BYTES, { filename: 'image.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pdf/i);
  });

  it('TC-UP-03: returns 400 when PDF is uploaded but userId is missing', async () => {
    const res = await request(app)
      .post('/upload/storage')
      .attach('file', MINIMAL_PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/user id/i);
  });

  it('TC-UP-04: returns 200 and storage path for a valid PDF with userId', async () => {
    const res = await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1')
      .attach('file', MINIMAL_PDF, { filename: 'report.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe(true);
    expect(res.body.storagePath).toBeDefined();
    expect(res.body.publicUrl).toBeDefined();
  });

  it('TC-UP-05: returns 500 when Supabase storage upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: { message: 'bucket full' } }),
      getPublicUrl: jest.fn(),
    });

    const res = await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1')
      .attach('file', MINIMAL_PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(res.body.result).toBe(false);
    expect(res.body.message).toMatch(/failed to upload/i);
  });

  it('TC-UP-06: does not leave a temp file in uploads/ after rejection', async () => {
    const fs = require('fs');
    const originalUnlink = fs.unlinkSync;
    const unlinkCalls = [];
    jest.spyOn(fs, 'unlinkSync').mockImplementation(p => unlinkCalls.push(p));

    await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1')
      .attach('file', PNG_BYTES, { filename: 'bad.png', contentType: 'image/png' });

    expect(unlinkCalls.length).toBeGreaterThan(0);

    fs.unlinkSync = originalUnlink;
    jest.restoreAllMocks();
  });

  it('TC-UP-07: rejects a .js file regardless of Content-Type claim', async () => {
    const jsBytes = Buffer.from('console.log("xss")');

    const res = await request(app)
      .post('/upload/storage')
      .field('userId', 'uid-1')
      .attach('file', jsBytes, { filename: 'exploit.js', contentType: 'application/pdf' });

    // Multer sends the file with the claimed MIME; server must validate via mimetype field
    // If mimetype check is not fooled, it should still reject
    expect([400, 500]).toContain(res.status);
  });
});
