const express = require('express');
const crypto = require('crypto');

const router = express.Router();
router.post('/generate', (req, res) => {
  try {
    const {
      userId,
      documentName,
      language,
      documentType,
      groundTruth,
      numSolutions,
      redaction,
      seedDocumentIds,   // array of file IDs or paths
      visualAssetIds     // array of file IDs or paths
    } = req.body;

    if (!language || !documentType || !numSolutions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const requestId = crypto.randomUUID();

    const requestMetadata = {
      id: requestId,
      userId,
      documentName,
      language,
      documentType,
      groundTruth,
      numSolutions: Number(numSolutions),
      redaction: Boolean(redaction),
      seedDocumentIds: seedDocumentIds || [],
      visualAssetIds: visualAssetIds || [],
      status: 'processing',
      createdAt: new Date()
    };

    // save to DB here

    res.status(202).json({
      requestId,
      status: 'processing',
      module: redaction ? 'redaction' : 'generation'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router