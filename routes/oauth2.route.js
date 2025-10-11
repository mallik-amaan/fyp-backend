const express = require("express")
const google = require("googleapis")
const fs = require("fs")
const router = express.Router();

const oauth2Client = new google.Auth.OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/oauth/oauth2callback"
);

// 1. Redirect user to Google consent screen
router.get("/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
  res.redirect(url);
});

// 2. Google redirects here with a code
router.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  // Save tokens in DB (associated with this user)
  console.log("Tokens:", tokens);
  res.send("Access granted! You can now upload files.");
});

module.exports = router