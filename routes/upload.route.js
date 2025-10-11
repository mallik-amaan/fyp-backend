const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
require("dotenv").config();

const router = express.Router();

// Configure multer for file uploads (store temporarily)
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Initialize OAuth2 client
    const authClient = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      "http://localhost:3000/oauth/oauth2callback"
    );

    // Replace these with the user's actual tokens
    authClient.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const drive = google.drive({ version: "v3", auth: authClient });

    // File metadata and upload stream
    const fileMetadata = {
      name: req.file.originalname,
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, name, webViewLink, webContentLink",
    });

    // Delete temp file after upload
    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      message: "✅ File uploaded successfully",
      file: response.data,
    });
  } catch (err) {
    console.error("❌ Upload failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
