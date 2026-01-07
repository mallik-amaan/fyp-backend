const express = require("express")
const google = require("googleapis")
const fs = require("fs");
const { time } = require("console");
const router = express.Router();
router.post("/get-generated-docs", (req, res) => {
    /**
     * Step 1: Fetch the generated Documents ID from the database for the specific user
     * Step 2: Use DocID to get the documents metadata 
     * Step 3: Return the document project metadata to the frontend 
     */
    //ST, not GET.
    console.log("got request for getting generated documents");
    console.log("Fetching generated documents for user");

    const {id} = req.body;

    res.send({
        documents: [
            // {
            //     id: '1',
            //     name: 'Research Paper Batch #101',
            //     documentType: 'Research Paper',
            //     language: 'English',
            //     numDocs: 15,
            //     createdAt: '2024-01-15T10:30:00',
            //     status: 'completed',
            // },
            {
                id: '2',
                name: 'Invoice Set #202',
                documentType: 'Invoice',
                language: 'English',
                numDocs: 10,
                createdAt: '2024-02-20T14:45:00',
                status: 'processing',
            },
            {
                id: '3',
                name: 'Legal Documents #303',
                documentType: 'Legal',
                language: 'English',
                numDocs: 8,
                createdAt: '2024-03-05T09:15:00',
                status: 'failed',
            },
        ]
    })
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
