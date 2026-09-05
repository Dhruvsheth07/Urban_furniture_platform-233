import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'xlsx';

/**
 * Download an array of plain objects as a CSV or XLSX file.
 * @param rows     Array of flat objects (each key becomes a column header)
 * @param filename Base file name without extension, e.g. "invoices-2024"
 * @param format   'csv' or 'xlsx'
 */
export function exportData(rows: Record<string, unknown>[], filename: string, format: ExportFormat = 'xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const bookType = format === 'csv' ? 'csv' : 'xlsx';
  XLSX.writeFile(wb, `${filename}.${ext}`, { bookType });
}
