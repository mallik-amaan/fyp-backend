// Environment variables for testing — never use production secrets here
process.env.ACCESS_SECRET  = 'test-access-secret-32chars-padding!';
process.env.REFRESH_SECRET = 'test-refresh-secret-32chars-pad!!';
process.env.SUPABASE_URL   = 'http://localhost:54321';
process.env.SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
process.env.GMAIL_USER     = 'test@docsynth.com';
process.env.GMAIL_APP_PASSWORD = 'test-app-password';
process.env.CLIENT_ID      = 'test-client-id';
process.env.CLIENT_SECRET  = 'test-client-secret';
process.env.REDACTION_SERVICE_URL = 'http://localhost:7860';
process.env.PORT           = '3001';
