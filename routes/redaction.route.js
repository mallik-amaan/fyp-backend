const express = require('express');
const crypto  = require('crypto');
const supabase = require('../config/supabase.config');

const router = express.Router();

// POST /redaction/upload
// Creates a standalone redaction request and returns a signed upload URL for the client
router.post('/upload', async (req, res) => {
  const { userId, fileName } = req.body;
  if (!userId || !fileName) {
    return res.status(400).json({ error: 'userId and fileName are required' });
  }

  try {
    const requestId  = crypto.randomUUID();
    const safeName   = `${crypto.randomUUID()}_${fileName}`;
    const storagePath = `${userId}/${requestId}/seeddocs/${safeName}`;

    const { error: reqError } = await supabase
      .from('document_requests')
      .insert({
        id:         requestId,
        user_id:    userId,
        status:     'pending',
        metadata:   { request_type: 'redaction_only', originalFileName: fileName },
        created_at: new Date().toISOString(),
      });

    if (reqError) throw reqError;

    const { data: signedData, error: signError } = await supabase.storage
      .from('doc_storage')
      .createSignedUploadUrl(storagePath, 300);

    if (signError) throw signError;

    res.json({
      requestId,
      uploadUrl:   signedData.signedUrl,
      storagePath,
    });
  } catch (err) {
    console.error('redaction/upload error:', err);
    res.status(500).json({ error: 'Failed to create redaction request' });
  }
});

// POST /redaction/:requestId/submit
// Called after the client uploads the file — records the file and triggers the redaction service
router.post('/:requestId/submit', async (req, res) => {
  const { requestId } = req.params;
  const { storagePath } = req.body;

  if (!storagePath) {
    return res.status(400).json({ error: 'storagePath is required' });
  }

  try {
    // Insert file record so the redaction service can find it
    const { error: fileError } = await supabase.from('request_files').insert({
      request_id:    requestId,
      storage_path:  storagePath,
      file_role:     'seed',
      upload_status: 'UPLOADED',
      created_at:    new Date(),
      updated_at:    new Date(),
    });
    if (fileError) throw fileError;

    // Mark request as processing
    const { error: statusError } = await supabase
      .from('document_requests')
      .update({ status: 'processing' })
      .eq('id', requestId);
    if (statusError) throw statusError;

    // Call external redaction service
    const redactionServiceUrl = process.env.REDACTION_SERVICE_URL;
    const redactRes = await fetch(
      `${redactionServiceUrl}/redact_by_request/${requestId}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );

    if (!redactRes.ok) {
      console.error('Redaction service error:', redactRes.status);
      // Don't fail the response — client will poll and see status
    }

    res.json({ success: true });
  } catch (err) {
    console.error('redaction/submit error:', err);
    res.status(500).json({ error: 'Failed to start redaction' });
  }
});

// GET /redaction/history/:userId
// Returns all standalone redaction requests for a user
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const { data, error } = await supabase
      .from('document_requests')
      .select('id, status, metadata, created_at')
      .eq('user_id', userId)
      .filter('metadata->>request_type', 'eq', 'redaction_only')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ requests: data || [] });
  } catch (err) {
    console.error('redaction/history error:', err);
    res.status(500).json({ error: 'Failed to fetch redaction history' });
  }
});

module.exports = router;
