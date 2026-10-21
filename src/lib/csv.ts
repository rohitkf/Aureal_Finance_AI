/**
 * CSV export.
 *
 * Two screens hand people a file, and a spreadsheet is unforgiving about the
 * details — a merchant called `Dunn, Baker & Co` or a note with a line break
 * in it will split a row in half unless every field is quoted properly. One
 * implementation, so neither screen has to remember that.
 */

/**
 * Text a spreadsheet would run rather than show.
 *
 * Excel, Sheets and LibreOffice read a cell beginning with `=`, `+`, `-` or
 * `@` as a formula — `=HYPERLINK(...)`, or a DDE call on older Excel — and
 * a tab or carriage return in front hides the sign from a naive check. A
 * merchant name is typed by a person today and will arrive from a bank feed
 * tomorrow; either way it is not a formula. A number is: `-12.40` is a
 * figure, and must stay one.
 */
const looksLikeFormula = (text: string): boolean =>
  /^[\t\r]*[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text);

/**
 * A single field, quoted only where a quote is actually needed.
 *
 * A field that reads as a formula is kept as text by a leading apostrophe,
 * which every spreadsheet treats as "this is literal" and does not show.
 */
const cell = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  const text = typeof value !== 'number' && looksLikeFormula(raw) ? `'${raw}` : raw;
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
