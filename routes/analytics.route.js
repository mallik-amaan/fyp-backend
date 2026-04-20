const express = require('express');
const supabase = require('../config/supabase.config');
const router = express.Router();

router.post('/submit-review', async (req, res) => {
  const { sessionId, flagged } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'sessionId is required' });
  }

  try {
    const hasFlagged = Array.isArray(flagged) && flagged.length > 0;
    const newStatus = hasFlagged ? 'flagged' : 'completed';

    const { error } = await supabase
      .from('document_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Review submission error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

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
