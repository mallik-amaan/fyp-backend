const express = require("express")
const google = require("googleapis")
const fs = require("fs")
const router = express.Router();
const supabaseClient = require("../config/supabase.config");

const oauth2Client = new google.Auth.OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/oauth/oauth2callback"
);

// 1. Redirect user to Google consent screen
router.get("/google", (req, res) => {
    const redirectAfterAuth = req.query.redirect; // ✅ DEFINE IT
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state: redirectAfterAuth, // <-- critical
  });
  res.send({url:url});
});

// 2. Google redirects here with a code
router.get("/oauth2callback", async (req, res) => {
  const { code , state} = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  //saving tokens to the database
  const {data,error} = await supabaseClient.
  from("user_integrations").
  insert([{
    user_id:"",
    refresh_token:tokens.refresh_token,
    access_token:tokens.access_token,
    is_connected:true,
    provider:"Google",

  }])


  console.log("Tokens:", tokens);
   const frontendRedirect = state || "http://localhost:8080";
  res.redirect(`${frontendRedirect}`);
  res.send({
    result:true,
  })
});

router.get("/oauth/google/status", async (req, res) => {
  const userId = req.user.id; // from session / JWT

  const token = await getGoogleTokenForUser(userId);

  res.json({
    connected: Boolean(token),
  });
});

module.exports = router