const express = require("express")
const google = require("googleapis")
const router = express.Router();
const supabaseClient = require("../config/supabase.config");
const authenticateToken = require("../config/middleware/auth.middleware");

const oauth2Client = new google.Auth.OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/oauth/oauth2callback"
);

// 1. Redirect user to Google consent screen
router.get("/google", (req, res) => {
  const redirectAfterAuth = req.query.redirect;
  const userId = req.query.userId;
  // Encode both redirect URL and userId in state so callback can use them
  const state = Buffer.from(JSON.stringify({ redirect: redirectAfterAuth, userId })).toString('base64');
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state,
  });
  res.send({ url });
});

// 2. Google redirects here with a code
router.get("/oauth2callback", async (req, res) => {
  const { code, state } = req.query;

  let frontendRedirect = 'http://localhost:5173';
  let userId = null;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    frontendRedirect = stateData.redirect || frontendRedirect;
    userId = stateData.userId;
  } catch (e) {
    frontendRedirect = state || frontendRedirect;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const { error } = await supabaseClient
      .from("user_integrations")
      .upsert([{
        user_id: userId,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        is_connected: true,
        provider: "Google",
      }], { onConflict: 'user_id,provider' });

    if (error) console.error("Error saving tokens:", error);
  } catch (err) {
    console.error("OAuth callback error:", err);
  }

  res.redirect(`${frontendRedirect}?oauth=success`);
});

// 3. Check Google Drive connection status
router.get("/google/status", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabaseClient
    .from("user_integrations")
    .select("is_connected")
    .eq("user_id", userId)
    .eq("provider", "Google")
    .single();

  res.json({ connected: !error && data?.is_connected === true });
});

module.exports = router;
