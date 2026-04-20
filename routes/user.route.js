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

    const documents = data || [];
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const flagged = documents.filter(d => d.status === 'flagged').length;
    const processing = documents.filter(d => !['completed', 'failed', 'flagged'].includes(d.status)).length;
    const pendingReview = documents.filter(d => ['redacted', 'review'].includes(d.status)).length;

    const totalDocsGenerated = documents
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (d.metadata?.numSolutions || 1), 0);

    const successRatio = total > 0 ? Math.round((completed / total) * 100) : 0;

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
      recentGenerations
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ result: false, message: 'Failed to fetch stats' });
  }
});

module.exports = router;
