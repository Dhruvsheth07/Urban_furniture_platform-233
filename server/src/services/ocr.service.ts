/**
 * ocr.service.ts
 * Offline OCR pipeline for vendor invoice PDFs.
 * Uses pdfjs-dist to render PDF pages → canvas buffers,
 * then Tesseract.js (WASM, no cloud) to extract text,
 * then deterministic regex to parse structured invoice fields.
 */

import { createWorker } from 'tesseract.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface ExtractedBill {
  vendorName: string;
  invoiceNumber: string;
  date: string;            // YYYY-MM-DD or ''
  dueDate: string | null;  // YYYY-MM-DD or null
  items: ExtractedLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── PDF → images → OCR text ─────────────────────────────────────────────────
export async function extractTextFromPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  // Dynamically import pdfjs-dist (ESM-only in v4+) and canvas
  // We use a try/catch so the server starts even if canvas native build fails
  let pdfjs: any;
  let Canvas: any;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
  } catch {
    pdfjs = await import('pdfjs-dist');
  }

  // Disable the worker — we're running server-side
  pdfjs.GlobalWorkerOptions.workerSrc = '';

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let fullText = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // First try native text extraction (fast, lossless for digital PDFs)
    try {
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (pageText.length > 50) {
        fullText += `\n--- PAGE ${pageNum} ---\n${pageText}`;
        continue; // skip OCR for this page
      }
    } catch {
      // fall through to OCR
    }

    // For image-based / scanned pages — render to canvas and OCR
    try {
      // Lazy-require canvas to avoid crash if native build is unavailable
      if (!Canvas) {
        Canvas = require('canvas');
      }
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR accuracy
      const canvas = Canvas.createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as any,
        viewport,
      }).promise;

      const imageBuffer = canvas.toBuffer('image/png');
      const ocrText = await runTesseract(imageBuffer);
      if (ocrText.trim()) {
        fullText += `\n--- PAGE ${pageNum} (OCR) ---\n${ocrText}`;
      }
    } catch (canvasErr: any) {
      // canvas native module not available — return whatever text we have
      console.warn('[OCR] Canvas not available, skipping image OCR for page', pageNum, canvasErr.message);
    }
  }

  return fullText;
}

// ─── Tesseract OCR ────────────────────────────────────────────────────────────
async function runTesseract(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // silence progress logs
  });
  try {
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

// ─── Regex-based structured extractor ────────────────────────────────────────
export function parseInvoiceText(text: string): { extracted: ExtractedBill; confidence: ConfidenceLevel } {
  const t = text.replace(/\r\n/g, '\n');

  // Invoice Number
  const invMatch = t.match(
    /(?:invoice|bill|inv|challan|voucher)\s*(?:no\.?|number|#|:)\s*[:\s]*([A-Z0-9\/\-]+)/i
  );
  const invoiceNumber = invMatch ? invMatch[1].trim() : '';

  // Vendor Name — try "From:", "Supplier:", or first bold-ish line at top
  const vendorMatch =
    t.match(/(?:from|supplier|vendor|sold by|billed by)[:\s]+([^\n]+)/i) ||
    t.match(/^([A-Z][A-Za-z\s&.,()-]{4,60})\n/m);
  const vendorName = vendorMatch ? vendorMatch[1].trim() : '';

  // Date helpers
  const toISO = (d: string, m: string, y: string): string => {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mm = months[m.toLowerCase().slice(0, 3)] || m.padStart(2, '0');
    return `${y.length === 2 ? '20' + y : y}-${mm}-${d.padStart(2, '0')}`;
  };

  const parseDateStr = (raw: string): string => {
    // DD/MM/YYYY or DD-MM-YYYY
    let m = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (m) return toISO(m[1], m[2], m[3]);
    // DD MMM YYYY
    m = raw.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (m) return toISO(m[1], m[2], m[3]);
    return '';
  };

  // Invoice date
  const dateMatch = t.match(
    /(?:invoice|bill|date|dated|dt\.?)[:\s]+(\d{1,2}[\s\/\-\.]\w+[\s\/\-\.]\d{2,4})/i
  ) || t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  const date = dateMatch ? parseDateStr(dateMatch[1]) : new Date().toISOString().slice(0, 10);

  // Due date
  const dueMatch = t.match(
    /(?:due\s*date|payment\s*due|pay\s*by)[:\s]+(\d{1,2}[\s\/\-\.]\w+[\s\/\-\.]\d{2,4})/i
  );
  const dueDate = dueMatch ? parseDateStr(dueMatch[1]) : null;

  // Amounts — handles formats: 1,23,456.78  or  123456.78
  const parseAmt = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;

  const totalMatch = t.match(
    /(?:grand\s*total|total\s*amount|amount\s*due|net\s*payable|total\s*payable)[:\s₹Rs.]*([0-9,]+\.?\d*)/i
  );
  const totalAmount = totalMatch ? parseAmt(totalMatch[1]) : 0;

  const subtotalMatch = t.match(
    /(?:subtotal|sub\s*total|taxable\s*value|net\s*amount|total\s*before)[:\s₹Rs.]*([0-9,]+\.?\d*)/i
  );

  const cgstMatch = t.match(/CGST[^0-9]*([0-9,]+\.?\d*)/i);
  const sgstMatch = t.match(/SGST[^0-9]*([0-9,]+\.?\d*)/i);
  const igstMatch = t.match(/IGST[^0-9]*([0-9,]+\.?\d*)/i);
  const taxAmount =
    (cgstMatch ? parseAmt(cgstMatch[1]) : 0) +
    (sgstMatch ? parseAmt(sgstMatch[1]) : 0) +
    (igstMatch ? parseAmt(igstMatch[1]) : 0);

  const subtotal = subtotalMatch
    ? parseAmt(subtotalMatch[1])
    : taxAmount > 0
    ? totalAmount - taxAmount
    : 0;

  // Line items — look for rows like: "Description   qty   rate   amount"
  const items: ExtractedLineItem[] = [];
  // Pattern: text word(s), then 2-4 numbers separated by spaces/tabs
  const lineItemRe = /^([A-Za-z][A-Za-z0-9 ,.\-()&/]{3,50})\s+(\d+(?:\.\d+)?)\s+([0-9,]+\.?\d+)\s+([0-9,]+\.?\d+)/gm;
  let lm: RegExpExecArray | null;
  while ((lm = lineItemRe.exec(t)) !== null) {
    const desc = lm[1].trim();
    // Filter out header rows
    if (/description|particulars|product|item|qty|rate|amount|total/i.test(desc)) continue;
    items.push({
      description: desc,
      quantity: parseFloat(lm[2]),
      unitPrice: parseAmt(lm[3]),
      taxRate: 18, // default GST rate; can't reliably detect per-line rate
    });
  }

  // Confidence scoring
  let score = 0;
  if (invoiceNumber) score++;
  if (vendorName) score++;
  if (date) score++;
  if (totalAmount > 0) score++;
  if (items.length > 0) score++;

  const confidence: ConfidenceLevel =
    score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';

  return {
    extracted: { vendorName, invoiceNumber, date, dueDate, items, subtotal, taxAmount, totalAmount },
    confidence,
  };
}
