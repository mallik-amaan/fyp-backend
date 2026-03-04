const express = require("express")
const fs = require("fs");
const supabaseClient = require("../config/supabase.config");
const { time } = require("console");
const router = express.Router();
router.post("/get-generated-docs", async (req, res) => {
  try {
    console.log("Received request for getting generated documents");

    const { id } = req.body;

    // Validate user ID
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required in request body" 
      });
    }

    console.log("Fetching generated documents for user:", id);

    const { data, error } = await supabaseClient
      .from("document_requests")
      .select("*")
      .eq("user_id", id);

    // Handle Supabase errors
    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch documents from database",
        details: error.message 
      });
    }

    // Handle case when no documents found
    if (!data || data.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No documents found for this user",
        documents: [] 
      });
    }

    console.log("Fetched documents:", data.length);
      res.status(200).json({
      success: true,
      documents: data
    });

  } catch (err) {
    console.error("Unexpected server error:", err);
    res.status(500).json({
      success: false,
      message: "Unexpected server error",
      details: err.message
    });
  }
});

router.post('download-generated-docs', (req, res) => {
    const { docIds } = req.body;
    /**
     * Step 1: Fetch the generated Documents zip file links from the database using the docIds
     * Step 2: Return the document zip file links to the frontend for downloading
     */
    res.send({
        downloadLinks: docIds.map(id => ({
            id: id,
            link: `http://example.com/download/doc${id}.zip`
        }))
    })
});

router.post('/download-gt-files', (req, res) => {
    const { docIds } = req.body;
    /**
     * Step 1: Fetch the generated Ground Truth file links from the database using the docIds
     * Step 2: Return the Ground Truth file links to the frontend for downloading
     */
    res.send({
        downloadLinks: docIds.map(id => ({
            id: id,
            link: `http://example.com/download/gt_doc${id}.txt`
        }))
    })
});
        
router.get('/get-next-docs/:id', (req, res) => {
    const docId = req.params.id;
    /**
     * Step 1: Fetch the required document content from the drive using the docId
     * Step 2: Return the document content to the frontend for downloading
     */
    res.send({
        id: docId,
        title: "Document " + docId,
        content: "This is the content of document " + docId
    })
});
router.get('/get-next-gt/:id', (req, res) => {
    const docId = req.params.id;
    /**
     * Step 1: Fetch the generated Ground Truth file link from the database using the docId
     * Step 2: Return the Ground Truth file link to the frontend for downloading
     */
    res.send({
        id: docId,
        title: "Google Transcript for Document " + docId,
        link: "http://example.com/gt/doc" + docId + ".txt"
    })
});

module.exports = router
