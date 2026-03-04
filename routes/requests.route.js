const crypto = require('crypto');
const express = require('express');
const supabase = require('../config/supabase.config');
const { type } = require('os');
const { http } = require("http")
const fs = require("fs");
const path = require("path");

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
      console.log("sending redaction request")
      const redactionServiceUrl = process.env.REDACTION_SERVICE_URL;
      const redactionResponse = await fetch(
        `${redactionServiceUrl}/redact_by_request/${requestId}`,
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

router.post('/:request_id/reject', async (req, res) => {
  const { request_id } = req.params;
  console.log(`request for rejection ${request_id} `)

  //------------Approve the request and start document generation------

  //First update the request_id to "Generation"
  const { response, error } = await supabase.from("document_requests")
    .update({
      "status": "failed"
    }).eq('id', request_id)

  if (error) {
    console.log(error)

  }
  //Start Generation Process
  //when API is deployed, send request for generation
  console.log(`database resposne ${response}`)
  res.send({
    "success": true
  })
})


router.post('/:requestId/approve', async (req, res) => {

  const GENERATION_URL = process.env.GENERATION_SERVICE_URL
  console.log(`GENERATION_URL: ${GENERATION_URL}`)
  const { requestId } = req.params;

  try {
    // ---------- Fetch request metadata ----------
    const { data: requestData, error: requestError } = await supabase
      .from('document_requests')
      .select('metadata')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    if (!requestData) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const metadata = requestData.metadata || {};

    // ---------- Fetch all seed documents for this request ----------
    const { data: seedFiles, error: filesError } = await supabase
      .from('request_files')
      .select('storage_path, file_role')
      .eq('request_id', requestId)
      .eq('file_role', 'seed');

    if (filesError) throw filesError;

    if (!seedFiles || seedFiles.length === 0) {
      return res.status(400).json({ error: 'No seed documents found for this request' });
    }

    // ---------- Generate public URLs for seed documents ----------
    const seedImageUrls = [];
    for (const file of seedFiles) {
      const { data } = supabase.storage
        .from('doc_storage')
        .getPublicUrl(file.storage_path);

      if (data && data.publicUrl) {
        seedImageUrls.push(data.publicUrl);
        console.log('Generated URL for seed doc:', data.publicUrl);
      }
    }

    // ---------- Update request status to approved ----------
    const { error: updateError } = await supabase.from("document_requests")
      .update({
        "status": "approved"
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // ---------- Respond immediately after approval ----------
    res.send({
      "success": true,
      message: 'Request approved. Generation started in background.'
    });

    // ---------- Continue generation steps asynchronously ----------
    (async () => {
      try {
        // ---------- Prepare request body with metadata mapped values ----------
        const body = {
          "request_id": requestId,
          "google_drive_token": process.env.GOOGLE_DRIVE_TOKEN,
          "google_drive_refresh_token": process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
          "seed_images": seedImageUrls,
          "prompt_params": {
            "language": metadata.language || "English",
            "doc_type": metadata.documentType || "business and administrative",
            "gt_type": metadata.gt_type || "Multiple questions about each document, with their answers taken **verbatim** from the document.",
            "gt_format": metadata.gt_format || "{\"<Text of question 1>\": \"<Answer to question 1>\", \"<Text of question 2>\": \"<Answer to question 2>\", ...}",
            "num_solutions": metadata.numSolutions || 1,
            "enable_handwriting": metadata.enable_handwriting !== undefined ? metadata.enable_handwriting : false,
            "handwriting_ratio": metadata.handwriting_ratio || 0.3,
            "enable_visual_elements": metadata.barcodeEnabled !== undefined ? metadata.barcodeEnabled : true,
            "visual_element_types": [
              "stamp",
              "logo",
              "figure",
              "barcode",
              "photo"
            ],
            "seed": null,
            "enable_ocr": metadata.enable_ocr !== undefined ? metadata.enable_ocr : true,
            "ocr_language": metadata.ocr_language || "en",
            "enable_bbox_normalization": metadata.enable_bbox_normalization !== undefined ? metadata.enable_bbox_normalization : true,
            "enable_gt_verification": metadata.enable_gt_verification !== undefined ? metadata.enable_gt_verification : true,
            "enable_analysis": metadata.enable_analysis !== undefined ? metadata.enable_analysis : true,
            "enable_debug_visualization": metadata.enable_debug_visualization !== undefined ? metadata.enable_debug_visualization : true,
            "enable_dataset_export": metadata.enable_dataset_export !== undefined ? metadata.enable_dataset_export : true,
            "dataset_export_format": metadata.dataset_export_format || "msgpack",
            "output_detail": metadata.output_detail || "dataset"
          }
        };

        // ---------- Send request to generation service ----------
        const generate_response = await fetch(GENERATION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!generate_response.ok) {
          console.error('Generation service error:', generate_response.status);
          throw new Error(`Generation service returned status ${generate_response.status}`);
        }

        // ---------- Handle response (ArrayBuffer for ZIP file) ----------
        const arrayBuffer = await generate_response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ---------- Upload ZIP to Supabase Storage under requestId folder ----------
        const bucket = 'doc_storage';
        const zipFileName = `output_${Date.now()}.zip`;
        const zipStoragePath = `${requestId}/${zipFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(zipStoragePath, buffer, {
            contentType: 'application/zip',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // ---------- Create downloadable link ----------
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(zipStoragePath, 60 * 60 * 24); // 24 hours

        if (signedUrlError) throw signedUrlError;

        console.log('Generation completed and ZIP uploaded', {
          requestId,
          file_path: zipStoragePath,
          download_url: signedUrlData?.signedUrl
        });
      } catch (backgroundError) {
        console.error('Background generation failed:', backgroundError);
      }
    })();

  } catch (err) {
    console.error('Failed to approve request:', err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
})
module.exports = router;
router.post('/:requestId/get-download-link', async (req, res) => {
  const { requestId } = req.params;

  try {
    console.log(requestId)
    const { data, error } = await supabase
      .from("generated_documents")
      .select("file_url")
      .eq("request_id", requestId)

      console.log(`data: ${data}`)
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No file found for this request"
      });
    }

    const fileUrl = data[0]['file_url'];
    console.log(`url: ${fileUrl}`);

    // ---------- Convert Google Drive view link to download link ----------
    let downloadUrl = fileUrl;
    
    // Check if it's a Google Drive link
    if (fileUrl.includes('drive.google.com')) {
      // Extract file ID from URL patterns:
      // https://drive.google.com/file/d/{FILE_ID}/view?usp=drivesdk
      // https://drive.google.com/open?id={FILE_ID}
      let fileId = null;
      
      const fileMatch = fileUrl.match(/\/file\/d\/([^\/]+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      } else {
        const idMatch = fileUrl.match(/[?&]id=([^&]+)/);
        if (idMatch) {
          fileId = idMatch[1];
        }
      }

      if (fileId) {
        // Convert to direct download link
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    return res.json({
      success: true,
      url: downloadUrl
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// ---------- POLLING ENDPOINT FOR REAL-TIME STATUS UPDATES ----------
router.get('/:requestId/poll-status', async (req, res) => {
  const { requestId } = req.params;

  try {
    // ---------- Fetch request from database ----------
    const { data: requestData, error: queryError } = await supabase
      .from('document_requests')
      .select('id, status, metadata, created_at, updated_at')
      .eq('id', requestId)
      .single();

    if (queryError) {
      console.error('Query error:', queryError);
      return res.status(200).json({
        status: 'failed',
        message: 'Request not found'
      });
    }

    if (!requestData) {
      return res.status(200).json({
        status: 'failed',
        message: 'Request does not exist'
      });
    }

    const currentStatus = requestData.status;
    const metadata = requestData.metadata || {};

    // ---------- Check if files are available (for completed requests) ----------
    let files = [];
    if (currentStatus === 'completed') {
      // Fetch the generated ZIP file path
      const { data: outputFiles } = await supabase.storage
        .from('doc_storage')
        .list(requestId, { limit: 100 });

      if (outputFiles && outputFiles.length > 0) {
        // Generate signed URLs for all files
        for (const file of outputFiles) {
          const { data: signedUrlData } = await supabase.storage
            .from('doc_storage')
            .createSignedUrl(`${requestId}/${file.name}`, 60 * 60 * 24); // 24 hours

          if (signedUrlData?.signedUrl) {
            files.push({
              name: file.name,
              url: signedUrlData.signedUrl,
              size: file.metadata?.size || 0
            });
          }
        }
      }
    }

    // ---------- Map status to user-friendly message ----------
    const statusMessages = {
      'pending': 'Request created, awaiting approval',
      'approved': 'Request approved, generation starting',
      'processing': 'Processing files and preparing for generation',
      'generating': 'Generating document structure from seed documents',
      'downloading': 'Downloading and processing seed images',
      'ocr': 'Running OCR on documents',
      'handwriting': 'Generating handwritten text variants',
      'validation': 'Validating ground truth data',
      'zipping': 'Creating ZIP archive with generated documents',
      'uploading': 'Uploading generated files to cloud storage',
      'completed': 'Document generation completed successfully',
      'failed': 'Document generation failed',
      'redacting': 'Redacting sensitive information',
      'redacted': 'Redaction completed'
    };

    // ---------- Build progress object (optional) ----------
    const progress = {
      current: 0,
      total: 14, // Total number of states in progression
      currentStep: statusMessages[currentStatus] || 'Processing'
    };

    // Calculate progress percentage based on status
    const statusProgression = [
      'pending', 'approved', 'processing', 'generating', 'downloading',
      'ocr', 'handwriting', 'validation', 'zipping', 'uploading', 'completed'
    ];
    const statusIndex = statusProgression.indexOf(currentStatus);
    if (statusIndex !== -1) {
      progress.current = Math.round((statusIndex / statusProgression.length) * 100);
    }

    // ---------- Build response ----------
    const response = {
      status: currentStatus,
      message: statusMessages[currentStatus] || 'Processing request',
      progress,
      files: files.length > 0 ? files : undefined,
      lastUpdated: requestData.updated_at,
      requestId
    };

    // Remove undefined fields
    Object.keys(response).forEach(key => response[key] === undefined && delete response[key]);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Polling endpoint error:', error);
    return res.status(200).json({
      status: 'failed',
      message: 'Error fetching request status',
      error: error.message
    });
  }
});

