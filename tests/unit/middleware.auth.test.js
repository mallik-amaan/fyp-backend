/**
 * Unit Tests — Auth Middleware
 * Covers: valid JWT, missing token, invalid/expired/tampered tokens
 */
const jwt = require('jsonwebtoken');
const authenticateToken = require('../../config/middleware/auth.middleware');

const SECRET = process.env.ACCESS_SECRET;

function mockContext(authHeader) {
  return {
    req: { headers: authHeader ? { authorization: authHeader } : {} },
    res: { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() },
    next: jest.fn(),
  };
}

describe('Auth Middleware — authenticateToken()', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────
  it('TC-MW-01: calls next() and attaches decoded user for a valid token', () => {
    const token = jwt.sign({ email: 'alice@example.com' }, SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockContext(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('alice@example.com');
  });

  // ── Missing / malformed header ──────────────────────────────────────────────
  it('TC-MW-02: returns 401 when Authorization header is absent', () => {
    const { req, res, next } = mockContext(undefined);

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access token missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-MW-03: returns 401 when header has "Bearer " with no token', () => {
    const { req, res, next } = mockContext('Bearer ');

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Invalid tokens ──────────────────────────────────────────────────────────
  it('TC-MW-04: returns 403 for a completely invalid token string', () => {
    const { req, res, next } = mockContext('Bearer not-a-real-jwt');

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-MW-05: returns 403 for a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ email: 'hacker@evil.com' }, 'wrong-secret');
    const { req, res, next } = mockContext(`Bearer ${badToken}`);

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-MW-06: returns 403 for a structurally valid JWT with tampered payload', () => {
    const validToken = jwt.sign({ email: 'alice@example.com' }, SECRET);
    const [header, , sig] = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ email: 'admin@example.com' })).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    const { req, res, next } = mockContext(`Bearer ${tamperedToken}`);

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Expired token ───────────────────────────────────────────────────────────
  it('TC-MW-07: returns 403 for an expired token', done => {
    const token = jwt.sign({ email: 'alice@example.com' }, SECRET, { expiresIn: '1ms' });

    setTimeout(() => {
      const { req, res, next } = mockContext(`Bearer ${token}`);
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
      done();
    }, 20);
  });

  it('TC-MW-08: attaches full decoded payload (not just email) to req.user', () => {
    const payload = { email: 'alice@example.com', role: 'admin' };
    const token = jwt.sign(payload, SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockContext(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(req.user.email).toBe(payload.email);
    expect(req.user.role).toBe(payload.role);
  });
});
