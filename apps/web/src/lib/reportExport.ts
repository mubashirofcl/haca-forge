/**
 * Report exports (Phase 7). A table is described once by its columns; the screen and the
 * CSV both use the same `text` of each cell, so an exported file matches what is shown.
 * PDF export is the browser's Save as PDF from the print layout (no extra dependencies).
 */
export interface ReportColumn<Row> {
  key: string;
  header: string;
  text: (row: Row) => string;
  align?: 'left' | 'right';
}

const needsQuotes = /[",\r\n]/;

export function csvCell(value: string): string {
  const v = value ?? '';
  // Guard against spreadsheet formula injection from user-written text.
  const safe = /^[=+\-@]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
  return needsQuotes.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<Row>(columns: ReportColumn<Row>[], rows: Row[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.text(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function csvFileName(report: string, table: string, filters: { month: string; calendar: string; stepType: string }): string {
  const part = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ['haca', part(report), part(table), filters.month, filters.calendar !== 'all' ? part(filters.calendar) : '', filters.stepType !== 'all' ? part(filters.stepType) : '']
    .filter(Boolean)
    .join('_') + '.csv';
}

export function downloadCsv(fileName: string, csv: string): void {
  // A byte-order mark so spreadsheet apps read the file as UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shared cell formats, so screen and CSV agree.
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export const fmtDate = (iso?: string | null) => (iso ? IST_DAY.format(new Date(iso)) : '');
export const fmtHours = (ms?: number | null) => (ms === null || ms === undefined ? '' : `${(ms / 3600000).toFixed(1)} h`);
export const fmtPct = (rate?: number | null) => (rate === null || rate === undefined ? 'No data' : `${rate}%`);
export const fmtWeek = (week: string) => `Week of ${week}`;
