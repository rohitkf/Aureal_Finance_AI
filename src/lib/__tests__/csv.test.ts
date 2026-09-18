/**
 * CSV is a format that looks trivial and is not. A merchant called
 * `Dunn, Baker & Co`, a note containing a quotation, or a line break pasted in
 * from an email will each split one row into two unless the quoting is right —
 * and the person opening the file has no way to tell that happened.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { downloadCsv, toCsv } from '@/lib/csv';

/** Spelled as an escape so no editor or tool can silently normalise it away. */
const POUND = '\u00A3';

describe('toCsv', () => {
  it('writes plain values unquoted', () => {
    expect(toCsv([['Date', 'Amount'], ['2026-09-18', '12.50']])).toBe('Date,Amount\r\n2026-09-18,12.50');
  });

  it('quotes a field containing a comma', () => {
    expect(toCsv([['Dunn, Baker & Co']])).toBe('"Dunn, Baker & Co"');
  });

  it('doubles an embedded quote, and quotes the field', () => {
    expect(toCsv([['He said "hello"']])).toBe('"He said ""hello"""');
  });

  it('quotes a field containing a line break', () => {
    expect(toCsv([['line one\nline two']])).toBe('"line one\nline two"');
    expect(toCsv([['carriage\rreturn']])).toBe('"carriage\rreturn"');
  });

  it('renders null and undefined as empty rather than as the words', () => {
    expect(toCsv([[null, undefined, '']])).toBe(',,');
  });

  it('separates rows with CRLF, which is what a spreadsheet expects', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb');
  });

  it('survives a round trip through a naive splitter for unquoted data', () => {
    const rows = [['2026-09-18', 'Tesco', '43.20'], ['2026-09-17', 'Shell', '55.00']];
    expect(toCsv(rows).split('\r\n').map((r) => r.split(','))).toEqual(rows);
  });
});

describe('downloadCsv', () => {
  const clicks: string[] = [];

  afterEach(() => {
    clicks.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** jsdom's Blob cannot be read back, so the parts are recorded on the way in. */
  const capture = () => {
    const blobs: Array<{ text: string; type: string }> = [];
    const RealBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends RealBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          blobs.push({ text: parts.join(''), type: options?.type ?? '' });
        }
      },
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    return blobs;
  };

  it('names the file, adding the extension when it is missing', () => {
    capture();
    downloadCsv('aureal-transactions-2026-09', [['a']]);
    expect(clicks).toEqual(['aureal-transactions-2026-09.csv']);
  });

  it('does not double the extension when it is already there', () => {
    capture();
    downloadCsv('report.csv', [['a']]);
    expect(clicks).toEqual(['report.csv']);
  });

  it('leads with a byte-order mark, or Excel mangles every pound sign', () => {
    const blobs = capture();
    downloadCsv('x', [[`${POUND}43.20`]]);
    expect(blobs[0]!.text).toBe('\uFEFF' + POUND + '43.20');
    expect(blobs[0]!.type).toBe('text/csv;charset=utf-8');
  });
});
