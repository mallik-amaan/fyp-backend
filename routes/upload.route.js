const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
require("dotenv").config();
const supabaseClient = require("../config/supabase.config");

const router = express.Router();

// Configure multer for file uploads (store temporarily)
const upload = multer({ dest: "uploads/" });

router.post("/drive", upload.single("file"), async (req, res) => {
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


router.post("/storage",upload.single("file"),async (req,res) => {
  try {
    console.log(req.file)
    if (!req.file) {
      return res.status(400).json({ result: false, message: "No file uploaded" });
    }

    // Validate file type - only allow PDF
    if (req.file.mimetype !== "application/pdf") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ result: false, message: "Only PDF files are allowed" });
    }

    const { userId } = req.body;

    if (!userId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ result: false, message: "User ID is required" });
    }

    // Read file from temporary location
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = `${userId}/${Date.now()}_${req.file.originalname}`;

    // Upload to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from("doc_storage")
      .upload(fileName, fileBuffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    // Delete temporary file
    fs.unlinkSync(req.file.path);

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ result: false, message: "Failed to upload file to storage" });
    }

    // Get public URL
    const { data: publicUrl } = supabaseClient.storage
      .from("documents")
      .getPublicUrl(fileName);

    return res.status(200).json({
      result: true,
      message: "PDF uploaded successfully",
      fileName: req.file.originalname,
      storagePath: fileName,
      publicUrl: publicUrl.publicUrl,
    });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ result: false, message: err.message });
  }
});

module.exports = router;
