const express = require("express")
const supabaseClient = require("../config/supabase.config")
const router = express.Router()

router.post('/get-dashboard-stats', async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ result: false, message: 'User ID is required' });
  }

  try {
    const { data, error } = await supabaseClient
      .from('document_requests')
      .select('id, status, metadata, created_at')
      .eq('user_id', id);

    if (error) throw error;

    const all = data || [];

    // Split into generation vs standalone-redaction requests
    const documents = all.filter(d => d.metadata?.request_type !== 'redaction_only');
    const redactionDocs = all.filter(d => d.metadata?.request_type === 'redaction_only');

    const COMPLETED_STATUSES = ['completed', 'completed_no_gdrive', 'completed_gdrive_failed', 'reviewed'];

    const total = documents.length;
    const completed = documents.filter(d => COMPLETED_STATUSES.includes(d.status)).length;
    const flagged = documents.filter(d => d.status === 'flagged').length;
    const failed = documents.filter(d => d.status === 'failed').length;
    const processing = documents.filter(d => !COMPLETED_STATUSES.includes(d.status) && !['failed', 'flagged'].includes(d.status)).length;
    const pendingReview = documents.filter(d => ['redacted', 'review'].includes(d.status)).length;

    const totalDocsGenerated = documents
      .filter(d => COMPLETED_STATUSES.includes(d.status) || d.status === 'flagged')
      .reduce((sum, d) => sum + (d.metadata?.numSolutions || 1), 0);

    // Success ratio = completed (all variants incl. reviewed) out of all finalized
    const finalized = completed + flagged + failed;
    const successRatio = finalized > 0 ? Math.round((completed / finalized) * 100) : 0;

    // Count standalone redactions that finished successfully
    const redactionsCompleted = redactionDocs.filter(d => d.status === 'redacted').length;

    const recentGenerations = [...documents]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(d => ({
        docName: d.metadata?.documentName || 'Unnamed',
        status: d.status,
        date: new Date(d.created_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        })
      }));

    res.json({
      generatedDocs: total,
      requestedDocs: totalDocsGenerated,
      flaggedDocs: flagged,
      successRatio: `${successRatio}%`,
      processingQueue: processing,
      pendingReview,
      redactionsCompleted,
      recentGenerations
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ result: false, message: 'Failed to fetch stats' });
  }
});

module.exports = router;
