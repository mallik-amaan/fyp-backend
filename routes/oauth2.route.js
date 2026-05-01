const express = require("express")
const google = require("googleapis")
const router = express.Router();
const supabaseClient = require("../config/supabase.config");
const authenticateToken = require("../config/middleware/auth.middleware");

const OAUTH_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/oauth2callback";

const oauth2Client = new google.Auth.OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  OAUTH_REDIRECT_URI
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

    const tokenData = {
      user_id: userId,
      provider: "google_drive",
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      is_connected: true,
      updated_at: new Date().toISOString(),
    };

    // Check if a row already exists for this user + provider
    const { data: existing } = await supabaseClient
      .from("user_integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "google_drive")
      .single();

    if (existing?.id) {
      const { error } = await supabaseClient
        .from("user_integrations")
        .update(tokenData)
        .eq("id", existing.id);
      if (error) console.error("Error updating tokens:", error);
    } else {
      const { error } = await supabaseClient
        .from("user_integrations")
        .insert(tokenData);
      if (error) console.error("Error inserting tokens:", error);
    }
  } catch (err) {
    console.error("OAuth callback error:", err);
  }

  res.redirect(`${frontendRedirect}?oauth=success`);
});

// 3. Check Google Drive connection status
router.get("/google/status", authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  console.log('[status] checking for email:', userEmail);

  const { data: userData, error: userError } = await supabaseClient
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  console.log('[status] user lookup:', userData?.id, userError?.message);

  if (userError || !userData) {
    return res.json({ connected: false });
  }

  const { data, error } = await supabaseClient
    .from("user_integrations")
    .select("is_connected")
    .eq("user_id", userData.id)
    .eq("provider", "google_drive")
    .single();

  console.log('[status] integration lookup:', data, error?.message);
  res.json({ connected: !error && data?.is_connected === true });
});

// 4. Disconnect Google Drive
router.post("/google/disconnect", authenticateToken, async (req, res) => {
  const userEmail = req.user.email;

  const { data: userData, error: userError } = await supabaseClient
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (userError || !userData) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { error } = await supabaseClient
    .from("user_integrations")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      is_connected: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userData.id)
    .eq("provider", "google_drive");

  if (error) {
    return res.status(500).json({ success: false, message: "Failed to disconnect Google Drive" });
  }

  res.json({ success: true, message: "Google Drive disconnected successfully" });
});

module.exports = router;
