const express = require('express');
const supabase = require('../config/supabase.config');
const router = express.Router();

// GET /analytics/pairs/:requestId
// Returns all document pairs for a request with signed URLs for each file
router.get('/pairs/:requestId', async (req, res) => {
  const { requestId } = req.params;

  try {
    const { data: pairs, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('request_id', requestId)
      .order('doc_index', { ascending: true });

    if (error) throw error;

    if (!pairs || pairs.length === 0) {
      return res.status(404).json({ success: false, message: 'No document pairs found for this request' });
    }

    const pairsWithUrls = await Promise.all(pairs.map(async (pair) => {
      const [docResult, gtResult] = await Promise.all([
        pair.doc_storage_path
          ? supabase.storage.from('doc_storage').createSignedUrl(pair.doc_storage_path, 3600)
          : Promise.resolve({ data: null }),
        pair.gt_storage_path
          ? supabase.storage.from('doc_storage').createSignedUrl(pair.gt_storage_path, 3600)
          : Promise.resolve({ data: null }),
      ]);

      return {
        id: pair.id,
        doc_index: pair.doc_index,
        flagged: pair.flagged,
        flag_reason: pair.flag_reason,
        doc_url: docResult.data?.signedUrl || null,
        gt_url: gtResult.data?.signedUrl || null,
      };
    }));

    res.json({ success: true, pairs: pairsWithUrls });
  } catch (err) {
    console.error('Error fetching pairs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch document pairs' });
  }
});

// PATCH /analytics/pairs/:pairId/flag
// Flags or unflags a specific document pair immediately
router.patch('/pairs/:pairId/flag', async (req, res) => {
  const { pairId } = req.params;
  const { flagged, flag_reason } = req.body;

  if (typeof flagged !== 'boolean') {
    return res.status(400).json({ success: false, message: 'flagged (boolean) is required' });
  }

  try {
    const { error } = await supabase
      .from('generated_documents')
      .update({
        flagged: flagged,
        flag_reason: flag_reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', pairId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Flag error:', err);
    res.status(500).json({ success: false, message: 'Failed to update flag' });
  }
});

// POST /analytics/submit-review
// Finalises review for a session — uses flagged indices sent by frontend to set request status
router.post('/submit-review', async (req, res) => {
  const { sessionId, flagged } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'sessionId is required' });
  }

  try {
    // Use flagged array sent by frontend directly (non-empty = has flagged docs)
    const hasFlagged = Array.isArray(flagged) ? flagged.length > 0 : false;
    const newStatus = hasFlagged ? 'flagged' : 'reviewed';

    console.log(`[submit-review] sessionId=${sessionId} flagged=${JSON.stringify(flagged)} → status=${newStatus}`)

    const { error } = await supabase
      .from('document_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('[submit-review] DB update error:', error.message, 'code:', error.code)
      throw error;
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('[submit-review] error:', err?.message || err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to submit review' });
  }
});

// GET /analytics/flagged-docs
// Returns all flagged requests for a user
router.get('/flagged-docs', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    const { data, error } = await supabase
      .from('document_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'flagged');

    if (error) throw error;

    res.json({ success: true, documents: data || [] });
  } catch (err) {
    console.error('Error fetching flagged docs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch flagged documents' });
  }
});

module.exports = router;
