# DocGenie Dataset: docgenie_documents

Generated using DocGenie API - Synthetic Document Generation Pipeline

## Dataset Structure

This dataset follows the original pipeline's organized structure with categorized folders:

```
docgenie_documents/
├── dataset.msgpack                    # Aggregated dataset (all documents)
├── metadata.json                      # Dataset metadata
├── README.md                          # This file
│
├── html/                              # HTML and CSS files
│   ├── document_1.html
│   ├── document_1.css
│   └── ...
│
├── pdf/                               # PDF files at different stages
│   ├── pdf_initial/                  # Before synthesis
│   ├── pdf_with_handwriting/         # With handwriting only
│   ├── pdf_with_visual_elements/     # With visual elements only
│   └── pdf_final/                    # With both features
│
├── img/                               # Final rendered images
│   ├── document_1.png
│   └── ...
│
├── bbox/                              # Bounding boxes
│   ├── bbox_pdf/                     # Extracted from PDF (ground truth positions)
│   │   ├── word/                     # Word-level from PDF
│   │   └── char/                     # Character-level from PDF
│   ├── bbox_final/                   # Final bboxes (OCR if modified, else PDF)
│   │   ├── word/                     # Word-level (unnormalized)
│   │   └── segment/                  # Segment-level (unnormalized)
│   └── bbox_final_normalized/        # Normalized (0-1 range)
│       ├── word/                     # Word-level normalized
│       └── segment/                  # Segment-level normalized
│
├── annotations/                       # Ground truth and mappings
│   ├── raw_annotations/              # Raw layout boxes (before normalization)
│   ├── gt/                           # Ground truth annotations
│   ├── gt_verification/              # Verification results
│   └── token_mapping/                # Token-to-bbox mappings
│
├── handwriting/                       # Handwriting data
│   ├── handwriting_regions/          # Region definitions
│   └── handwriting_tokens/           # Token images (subfolders per document)
│       ├── document_1/
│       │   ├── hw1_b3_l1_w0.png
│       │   └── ...
│       └── ...
│
├── visual_elements/                   # Visual element data
│   ├── visual_element_definitions/   # Element definitions
│   └── visual_element_images/        # Element images (subfolders per document)
│       ├── document_1/
│       │   ├── ve0.png
│       │   └── ...
│       └── ...
│
├── layout/                            # Layout element definitions
├── geometries/                        # Extracted geometries
├── ocr_results/                       # OCR results
├── analysis/                          # Analysis statistics
└── debug/                             # Debug visualizations
```

## Dataset Statistics

- **Total Documents**: 1
- **Documents with Handwriting**: 0
- **Documents with Visual Elements**: 0
- **Documents with OCR**: 1

## Usage

This dataset is designed for document understanding and OCR tasks. Files are organized by category for easy access and processing.

### Loading the Entire Dataset (Msgpack)

The easiest way to load all documents for ML training:

```python
from datadings.reader import MsgpackReader

# Load the aggregated dataset
reader = MsgpackReader('dataset.msgpack')

# Iterate through all documents
for sample in reader:
    doc_id = sample['sample_id']
    words = sample['words']
    word_bboxes = sample['word_bboxes']  # Normalized [x0, y0, x2, y2]
    image_path = sample['image_file_path']
    # Ground truth annotations are included in the sample
```

For more information on msgpack format, see: https://github.com/mweiss/datadings

### Loading Individual Documents

Each document is identified by its `document_id` (e.g., "document_1"). To load a document:

1. **HTML/CSS**: `html/document_1.html`, `html/document_1.css`
2. **PDF stages**: Check `pdf/pdf_initial/`, `pdf/pdf_final/`, etc.
3. **Images**: `img/document_1.png`
4. **Annotations**: `annotations/gt/document_1.json`, `annotations/raw_annotations/document_1.json`
5. **Bounding boxes**: 
   - PDF-extracted (ground truth): `bbox/bbox_pdf/word/document_1.json`, `bbox/bbox_pdf/char/document_1.json`
   - Final bboxes: `bbox/bbox_final/word/document_1.json` (OCR or PDF)
   - Normalized: `bbox/bbox_final_normalized/word/document_1.json`
6. **Tokens**: `handwriting/handwriting_tokens/document_1/`, `visual_elements/visual_element_images/document_1/`

### Notes

- Bounding boxes in `bbox_pdf` are extracted from PDF and represent ground truth text positions
- Bounding boxes in `bbox_final` are from OCR (if document has handwriting/visual elements) or PDF (otherwise)
- Bounding boxes in `bbox_final_normalized` are normalized to [0, 1] range for ML training
- Character-level bboxes (`bbox_pdf/char/`) provide fine-grained text localization
- Raw annotations show the original layout boxes before normalization
- Token images are organized in per-document subfolders
- OCR results and analysis are only present if those features were enabled

---
Generated by DocGenie API v2.0
