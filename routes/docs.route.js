const express = require("express")
const supabaseClient = require("../config/supabase.config");
const router = express.Router();

router.post("/get-generated-docs", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const { data, error } = await supabaseClient
      .from("document_requests")
      .select("*")
      .eq("user_id", id);

    if (error) throw error;

    const filtered = (data || []).filter(d => d.metadata?.request_type !== 'redaction_only');
    return res.status(200).json({ success: true, documents: filtered });
  } catch (err) {
    console.error("Unexpected server error:", err);
    res.status(500).json({ success: false, message: "Unexpected server error", details: err.message });
  }
});

// Download generated docs ZIP for a request
router.post('/download-generated-docs', async (req, res) => {
  const { docId } = req.body;

  if (!docId) {
    return res.status(400).json({ success: false, message: 'docId is required' });
  }

  try {
    // First check generated_documents table (populated by generation service)
    const { data: genData } = await supabaseClient
      .from('generated_documents')
      .select('file_url')
      .eq('request_id', docId)
      .limit(1)
      .single();

    if (genData?.file_url) {
      let downloadUrl = genData.file_url;
      if (downloadUrl.includes('drive.google.com')) {
        const fileMatch = downloadUrl.match(/\/file\/d\/([^/]+)/);
        const idMatch = downloadUrl.match(/[?&]id=([^&]+)/);
        const fileId = fileMatch?.[1] || idMatch?.[1];
        if (fileId) downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
      return res.json({ success: true, url: downloadUrl });
    }

    // Fall back: find ZIP in storage under requestId folder
    const { data: files, error: listError } = await supabaseClient.storage
      .from('doc_storage')
      .list(docId, { limit: 20 });

    if (listError) throw listError;

    const zipFile = (files || [])
      .filter(f => f.name.endsWith('.zip'))
      .sort((a, b) => (b.metadata?.lastModified || 0) - (a.metadata?.lastModified || 0))[0];

    if (!zipFile) {
      return res.status(404).json({ success: false, message: 'No generated files found yet' });
    }

    const { data: signedData, error: signedError } = await supabaseClient.storage
      .from('doc_storage')
      .createSignedUrl(`${docId}/${zipFile.name}`, 3600);

    if (signedError) throw signedError;

    res.json({ success: true, url: signedData.signedUrl, fileName: zipFile.name });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ success: false, message: 'Failed to get download link' });
  }
});

// Download ground truth files for a request (same ZIP approach)
router.post('/download-gt-files', async (req, res) => {
  const { docId } = req.body;

  if (!docId) {
    return res.status(400).json({ success: false, message: 'docId is required' });
  }

  try {
    const { data: files, error: listError } = await supabaseClient.storage
      .from('doc_storage')
      .list(docId, { limit: 20 });

    if (listError) throw listError;

    const zipFile = (files || [])
      .filter(f => f.name.endsWith('.zip'))
      .sort((a, b) => (b.metadata?.lastModified || 0) - (a.metadata?.lastModified || 0))[0];

    if (!zipFile) {
      return res.status(404).json({ success: false, message: 'No generated files found yet' });
    }

    const { data: signedData, error: signedError } = await supabaseClient.storage
      .from('doc_storage')
      .createSignedUrl(`${docId}/${zipFile.name}`, 3600);

    if (signedError) throw signedError;

    res.json({ success: true, url: signedData.signedUrl, fileName: zipFile.name });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ success: false, message: 'Failed to get download link' });
  }
});

// Delete a document request and all associated files
router.delete('/delete-doc/:requestId', async (req, res) => {
  const { requestId } = req.params;

  try {
    // Get all file paths for this request
    const { data: files } = await supabaseClient
      .from('request_files')
      .select('storage_path')
      .eq('request_id', requestId);

    // Delete seed/asset files from storage
    if (files && files.length > 0) {
      const paths = files.map(f => f.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabaseClient.storage.from('doc_storage').remove(paths);
      }
    }

    // Delete output files (ZIPs) from storage
    const { data: outputFiles } = await supabaseClient.storage
      .from('doc_storage')
      .list(requestId, { limit: 100 });

    if (outputFiles && outputFiles.length > 0) {
      const outputPaths = outputFiles.map(f => `${requestId}/${f.name}`);
      await supabaseClient.storage.from('doc_storage').remove(outputPaths);
    }

    // Delete DB records
    await supabaseClient.from('request_files').delete().eq('request_id', requestId);
    await supabaseClient.from('generated_documents').delete().eq('request_id', requestId);

    const { error: deleteError } = await supabaseClient
      .from('document_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

module.exports = router;
