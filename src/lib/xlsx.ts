/**
 * Minimal .xlsx writer.
 *
 * The app exports reports the accountant treats as a reference, so they have to
 * open in Excel without the "file format doesn't match extension" warning the
 * app's older `.xls` HTML-table exports produce, with dates typed as dates,
 * quantities typed as numbers, and references like `045/0726` left as text
 * rather than auto-converted to a date.
 *
 * Only what those reports need is implemented — several sheets, typed cells, a
 * bold header row, column widths — a small enough slice of OOXML to write
 * directly instead of pulling in a ~300 KB (gzipped) spreadsheet library.
 * Strings are written inline, so there is no shared-string table.
 */

import { zipSync, strToU8 } from 'fflate';

export type CellValue = string | number | Date | null | undefined;

export interface SheetSpec {
  /** Sheet tab name. Sanitised and truncated to Excel's 31-character limit. */
  name: string;
  columns: { header: string; width?: number }[];
  rows: CellValue[][];
  /** Renders the final row bold — used for the TOTAL line. */
  boldLastRow?: boolean;
}

// Style indices into the cellXfs table written by `stylesXml()`.
const STYLE_DEFAULT = 0;
const STYLE_BOLD    = 1;
const STYLE_DATE    = 2;
const STYLE_NUMBER  = 3;

// Control characters are illegal in XML 1.0 and make Excel repair the file.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(CONTROL_CHARS, '');

/** Excel serial date: days since 1899-12-30, read in the workbook's local frame. */
function toExcelSerial(d: Date): number {
  const utcDays = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  const dayFraction = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86_400;
  return utcDays + 25_569 + dayFraction;
}

/** A1-style column reference for a zero-based index. */
function colName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function cellXml(ref: string, value: CellValue, style: number): string {
  if (value === null || value === undefined || value === '') {
    return style === STYLE_DEFAULT ? '' : `<c r="${ref}" s="${style}"/>`;
  }
  if (value instanceof Date) {
    return `<c r="${ref}" s="${STYLE_DATE}"><v>${toExcelSerial(value)}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style === STYLE_BOLD ? STYLE_BOLD : STYLE_NUMBER}"><v>${value}</v></c>`;
  }
  // Everything else is text — this is what keeps `045/0726` a reference rather
  // than a date, and stops Excel trimming the leading zero off a BL number.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`;
}

function sheetXml(sheet: SheetSpec): string {
  const cols = sheet.columns.length
    ? `<cols>${sheet.columns.map((c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 16}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const headerCells = sheet.columns
    .map((c, i) => cellXml(`${colName(i)}1`, c.header, STYLE_BOLD)).join('');
  const header = sheet.columns.length ? `<row r="1">${headerCells}</row>` : '';

  const lastIndex = sheet.rows.length - 1;
  const body = sheet.rows.map((row, r) => {
    const bold = sheet.boldLastRow && r === lastIndex;
    const cells = row
      .map((v, i) => cellXml(`${colName(i)}${r + 2}`, v, bold ? STYLE_BOLD : STYLE_DEFAULT))
      .join('');
    return `<row r="${r + 2}">${cells}</row>`;
  }).join('');

  // Freezing the header keeps long receipt lists readable while scrolling.
  const freeze = sheet.columns.length
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${header}${body}</sheetData></worksheet>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/** Excel rejects some characters in a tab name, and duplicate names collide. */
function sheetName(name: string, index: number, taken: Set<string>): string {
  let clean = (name || `Feuille${index + 1}`).replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31);
  if (!clean) clean = `Feuille${index + 1}`;
  let unique = clean;
  let n = 2;
  while (taken.has(unique.toLowerCase())) unique = `${clean.slice(0, 28)} ${n++}`;
  taken.add(unique.toLowerCase());
  return unique;
}

/** Builds the workbook. Exported separately from the download so it can be tested. */
export function buildXlsxBlob(sheets: SheetSpec[]): Blob {
  const list = sheets.length ? sheets : [{ name: 'Feuille1', columns: [], rows: [] }];
  const taken = new Set<string>();
  const names = list.map((s, i) => sheetName(s.name, i, taken));

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`),

    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),

    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),

    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),

    'xl/styles.xml': strToU8(stylesXml()),
  };

  list.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
  });

  const zipped = zipSync(files, { level: 6 });
  // Copy into a fresh buffer — fflate may return a view over a larger pool.
  return new Blob([new Uint8Array(zipped)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadXlsx(filename: string, sheets: SheetSpec[]): void {
  const url = URL.createObjectURL(buildXlsxBlob(sheets));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
