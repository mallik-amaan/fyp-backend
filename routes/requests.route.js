const crypto = require('crypto');
const express = require('express');
const supabase = require('../config/supabase.config');

const router = express.Router();

router.post('/create-with-urls', async (req, res) => {
  try {
    const {
      userId,
      seedFiles = [],
      visualFiles = [],
      metadata = {}
    } = req.body;

    // ---------- validation ----------
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!Array.isArray(seedFiles) || seedFiles.length === 0) {
      return res.status(400).json({ error: 'At least 1 seed doc required' });
    }

    // ---------- generate requestId ----------
    const requestId = crypto.randomUUID();
    const bucket = 'doc_storage';

    // ---------- create request record ----------
    const { error: requestError } = await supabase
      .from('document_requests')
      .insert({
        id: requestId,
        user_id: userId,
        status: 'pending',
        metadata,
        created_at: new Date().toISOString()
      });

    if (requestError) throw requestError;

    // ---------- helper ----------
    async function createSignedUpload(path) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path, 300); // 5 min

      if (error) throw error;

      return {
        uploadUrl: data.signedUrl,
        path
      };
    }

    // ---------- seed docs (mandatory) ----------
const seedDocs = [];
for (const fileName of seedFiles) {
  const safeName = `${crypto.randomUUID()}_${fileName}`;
  const path = `${userId}/${requestId}/seeddocs/${safeName}`;

  // Generate presigned upload URL
  const signed = await createSignedUpload(path);

  // Insert file row in request_files table
  const { error: insertError } = await supabase
    .from('request_files')
    .insert([{
      request_id: requestId,
      storage_path: path,      // actual path in storage
      file_role: 'seed',       // mandatory seed doc
      upload_status: 'PENDING', 
      created_at: new Date(),
      updated_at: new Date()
    }]);

  if (insertError) {
    throw insertError;
  }

  seedDocs.push({
    fileName,
    path: signed.path,
    uploadUrl: signed.uploadUrl
  });
}

// ---------- visual assets (optional) ----------
const visualAssets = [];
for (const fileName of visualFiles) {
  const safeName = `${crypto.randomUUID()}_${fileName}`;
  const path = `${userId}/${requestId}/assets/${safeName}`;

  // Generate presigned upload URL
  const signed = await createSignedUpload(path);

  // Insert file row in request_files table
  const { error: insertError } = await supabase
    .from('request_files')
    .insert([{
      request_id: requestId,
      storage_path: path,
      file_role: 'asset',      // optional visual asset
      upload_status: 'PENDING',
      created_at: new Date(),
      updated_at: new Date()
    }]);

  if (insertError) {
    throw insertError;
  }

  visualAssets.push({
    fileName,
    path: signed.path,
    uploadUrl: signed.uploadUrl
  });
}

    // ---------- respond ----------
    return res.status(201).json({
      requestId,
      uploads: {
        seedDocs,
        visualAssets
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create request' });
  }
});

router.post('/:requestId/complete', async (req, res) => {
  try {
    const { requestId } = req.params;

    // 1️⃣ Get all files for this request
    const { data: files, error } = await supabase
      .from('request_files')
      .select('id, storage_path, file_role, upload_status')
      .eq('request_id', requestId);

    if (error) throw error;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files registered for this request' });
    }

    // 2️⃣ Track any missing mandatory files
    const missingFiles = [];

    // 3️⃣ Loop through files and check storage
    for (const file of files) {
      if (!file.storage_path) {
        missingFiles.push(file);
        continue;
      }

      const parts = file.storage_path.split('/');
      const folder = parts.slice(0, -1).join('/');
      const fileName = parts[parts.length - 1];

      const { data: listData, error: listError } = await supabase.storage
        .from('doc_storage') // your bucket name
        .list(folder, { search: fileName, limit: 1 });

      if (listError) {
        console.error(listError);
        return res.status(500).json({ error: 'Storage verification failed' });
      }

      if (!listData || listData.length === 0) {
        // If seed doc is missing, track it
        if (file.file_role === 'seed') missingFiles.push(file);
        continue; // skip update for missing file
      }

      // 4️⃣ File exists → update upload_status
      const { error: updateError } = await supabase
        .from('request_files')
        .update({ upload_status: 'UPLOADED', updated_at: new Date() })
        .eq('id', file.id);

      if (updateError) throw updateError;
    }

    // 5️⃣ If any mandatory seed file is missing, stop
    if (missingFiles.length > 0) {
      return res.status(400).json({
        error: 'Some mandatory seed files are missing',
        files: missingFiles.map(f => f.storage_path)
      });
    }

    // 6️⃣ All mandatory files uploaded → mark request as UPLOADED
    const { error: reqUpdateError } = await supabase
      .from('document_requests')
      .update({ status: 'processing', updated_at: new Date() })
      .eq('id', requestId);

    if (reqUpdateError) throw reqUpdateError;

    // 7️⃣ Send redaction request to Python backend
    try {
      const redactionServiceUrl = process.env.REDACTION_SERVICE_URL || 'http://localhost:8000';
      const redactionResponse = await fetch(
        `https://312f713d9009.ngrok-free.app/redact_by_request/${requestId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!redactionResponse.ok) {
        console.error('Redaction service error:', redactionResponse.status);
        throw new Error(`Redaction service returned status ${redactionResponse.status}`);
      }

      const redactionData = await redactionResponse.json();
      console.log('Redaction process started:', redactionData);
    } catch (redactionError) {
      console.error('Failed to send redaction request:', redactionError);
      // Continue anyway - files are verified, request is marked for processing
      // Redaction can be retried later if needed
    }

    res.json({ success: true, message: 'All files verified and request marked UPLOADED' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;


