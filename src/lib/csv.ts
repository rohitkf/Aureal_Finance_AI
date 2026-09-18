/**
 * CSV export.
 *
 * Two screens hand people a file, and a spreadsheet is unforgiving about the
 * details — a merchant called `Dunn, Baker & Co` or a note with a line break
 * in it will split a row in half unless every field is quoted properly. One
 * implementation, so neither screen has to remember that.
 */

/** A single field, quoted only where a quote is actually needed. */
const cell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Rows to CSV text. CRLF, because that is what Excel expects. */
export const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((row) => row.map(cell).join(',')).join('\r\n');

/**
 * Hands the file to the browser.
 *
 * The byte-order mark is not decoration: without it Excel reads the file as
 * the local codepage and every pound sign becomes `Â£`.
 */
export const downloadCsv = (filename: string, rows: Array<Array<unknown>>): void => {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
