// Receipt report — the same model rendered two ways: an Excel workbook the
// accountant works in, and a printable French report on the GRANITEC
// letterhead (matching the Shipping and Inventory reports).
//
// What goes in is the user's choice: every block below is a toggle, so the
// report ranges from "N° BL et dates seuls" to full article detail.

import type { Invoice } from '@/types';
import type { ReceiptRow } from './receipts';
import type { CellValue, SheetSpec } from '@/lib/xlsx';
import { fmtDate } from '@/utils/dates';

export type ReportScope = 'all' | 'invoiced' | 'uninvoiced';

export interface ReportOptions {
  scope: ReportScope;
  supplier: boolean;
  quantities: boolean;
  invoiceStatus: boolean;
  invoiceDetails: boolean;
  document: boolean;
  description: boolean;
  lines: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  scope: 'all',
  supplier: true,
  quantities: true,
  invoiceStatus: true,
  invoiceDetails: true,
  document: true,
  description: false,
  lines: false,
};

/** Preset combinations offered as one-click buttons in the dialog. */
export const REPORT_PRESETS: { id: string; label: string; options: Partial<ReportOptions> }[] = [
  {
    id: 'minimal',
    label: 'N° BL et dates seuls',
    options: { supplier: false, quantities: false, invoiceStatus: false, invoiceDetails: false, document: false, description: false, lines: false },
  },
  {
    id: 'invoicing',
    label: 'Suivi facturation',
    options: { supplier: true, quantities: false, invoiceStatus: true, invoiceDetails: true, document: true, description: false, lines: false },
  },
  {
    id: 'full',
    label: 'Complet',
    options: { supplier: true, quantities: true, invoiceStatus: true, invoiceDetails: true, document: true, description: true, lines: true },
  },
];

/** A receipt paired with the invoices linked to it. */
export interface ReportEntry {
  row: ReceiptRow;
  invoices: Invoice[];
}

export interface ReportInput {
  entries: ReportEntry[];
  options: ReportOptions;
  /** Plain-language recap of the filters the screen had applied. */
  filterSummary: string;
  generatedAt: Date;
}

export const SCOPE_LABEL: Record<ReportScope, string> = {
  all: 'Toutes les réceptions',
  invoiced: 'Réceptions facturées',
  uninvoiced: 'Réceptions non facturées',
};

const SCOPE_SLUG: Record<ReportScope, string> = {
  all: 'toutes', invoiced: 'facturees', uninvoiced: 'non-facturees',
};

export const applyScope = (entries: ReportEntry[], scope: ReportScope): ReportEntry[] =>
  scope === 'all' ? entries
    : scope === 'invoiced' ? entries.filter(e => e.invoices.length > 0)
    : entries.filter(e => e.invoices.length === 0);

// ── Shared field helpers ──────────────────────────────────────────
const rowRef = (r: ReceiptRow) => (r.kind === 'bl' ? r.orderRef : r.ref);
const rowBL = (r: ReceiptRow) => (r.kind === 'bl' ? r.blNumber : r.ref);
const rowType = (r: ReceiptRow) => (r.kind === 'bl' ? 'Commande' : 'Approvisionnement');
const hasDoc = (r: ReceiptRow) => !!(r.documentKey || r.documentUrl);

const invoiceAmount = (invoices: Invoice[]): number =>
  invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0);

/** Parses YYYY-MM-DD as a local date so Excel shows the day that was recorded. */
const toDate = (iso: string): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return Number.isFinite(y) ? new Date(y, (m ?? 1) - 1, d ?? 1) : null;
};

const num = (n: number) => n.toLocaleString('fr-FR');

export function reportFileName(scope: ReportScope, at: Date): string {
  return `granitec-receptions-${SCOPE_SLUG[scope]}-${at.toISOString().slice(0, 10)}.xlsx`;
}

// ── Column model ──────────────────────────────────────────────────
// One definition per column drives the Excel sheet and the HTML table, so the
// two can never drift apart.
interface Column {
  header: string;
  width: number;
  /** Right-aligned in the printed report and summed in the TOTAL row. */
  numeric?: boolean;
  cell: (e: ReportEntry) => CellValue;
}

function columns(o: ReportOptions): Column[] {
  const cols: Column[] = [
    { header: 'Type',      width: 18, cell: e => rowType(e.row) },
    { header: 'Référence', width: 20, cell: e => rowRef(e.row) },
    { header: 'N° BL',     width: 18, cell: e => rowBL(e.row) || '' },
    { header: 'Date',      width: 12, cell: e => toDate(e.row.date) },
  ];

  if (o.supplier) cols.push({ header: 'Fournisseur', width: 22, cell: e => e.row.supplier ?? '' });

  if (o.quantities) {
    cols.push({ header: 'Pièces', width: 12, numeric: true, cell: e => e.row.totalQty });
    cols.push({ header: 'Références', width: 12, numeric: true, cell: e => e.row.lineCount });
  }

  if (o.invoiceStatus) {
    cols.push({
      header: 'Statut facture', width: 16,
      cell: e => (e.invoices.length > 0 ? 'Facturée' : 'Non facturée'),
    });
  }

  if (o.invoiceDetails) {
    cols.push({ header: 'N° facture', width: 20, cell: e => e.invoices.map(i => i.invoiceNumber).join(', ') });
    cols.push({ header: 'Date facture', width: 13, cell: e => (e.invoices[0] ? toDate(e.invoices[0].date) : null) });
    cols.push({ header: 'Montant', width: 14, numeric: true, cell: e => (e.invoices.length ? invoiceAmount(e.invoices) : null) });
    cols.push({ header: 'Devise', width: 9, cell: e => e.invoices[0]?.currency ?? '' });
  }

  if (o.document) {
    cols.push({ header: 'Document BL', width: 14, cell: e => (hasDoc(e.row) ? 'Disponible' : 'Manquant') });
    cols.push({ header: 'Nom du document', width: 26, cell: e => e.row.documentName ?? '' });
  }

  if (o.description) {
    cols.push({ header: 'Description', width: 40, cell: e => e.row.description ?? '' });
  }

  return cols;
}

const LINE_COLUMNS = [
  { header: 'Référence', width: 20 }, { header: 'N° BL', width: 18 },
  { header: 'Date', width: 12 }, { header: 'Fournisseur', width: 22 },
  { header: 'Désignation', width: 34 }, { header: 'Référence article', width: 20 },
  { header: 'Quantité', width: 12 },
];

// ── Totals ────────────────────────────────────────────────────────
export interface ReportTotals {
  receipts: number;
  pieces: number;
  invoiced: number;
  uninvoiced: number;
  amount: number;
  currency: string;
  withoutDocument: number;
}

export function reportTotals(entries: ReportEntry[]): ReportTotals {
  return {
    receipts: entries.length,
    pieces: entries.reduce((s, e) => s + e.row.totalQty, 0),
    invoiced: entries.filter(e => e.invoices.length > 0).length,
    uninvoiced: entries.filter(e => e.invoices.length === 0).length,
    amount: entries.reduce((s, e) => s + invoiceAmount(e.invoices), 0),
    currency: entries.find(e => e.invoices[0])?.invoices[0]?.currency ?? 'MAD',
    withoutDocument: entries.filter(e => !hasDoc(e.row)).length,
  };
}

// ── Excel ─────────────────────────────────────────────────────────
export function buildReceiptSheets(input: ReportInput): SheetSpec[] {
  const { entries, options } = input;
  const cols = columns(options);

  const rows: CellValue[][] = entries.map(e => cols.map(c => c.cell(e)));

  // A TOTAL line over the numeric columns, so the sheet footers itself.
  if (entries.length > 0) {
    const total: CellValue[] = cols.map((c, i) => {
      if (i === 0) return 'TOTAL';
      if (!c.numeric) return null;
      return entries.reduce((sum, e) => {
        const v = c.cell(e);
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);
    });
    rows.push(total);
  }

  const sheets: SheetSpec[] = [{
    name: 'Réceptions',
    columns: cols.map(c => ({ header: c.header, width: c.width })),
    rows,
    boldLastRow: entries.length > 0,
  }];

  if (options.lines) {
    const lineRows: CellValue[][] = [];
    for (const e of entries) {
      for (const l of e.row.lines) {
        lineRows.push([
          rowRef(e.row), rowBL(e.row) || '', toDate(e.row.date), e.row.supplier ?? '',
          l.productName, l.sku, l.qty,
        ]);
      }
    }
    if (lineRows.length > 0) {
      lineRows.push(['TOTAL', null, null, null, null, null,
        lineRows.reduce((s, r) => s + (typeof r[6] === 'number' ? r[6] : 0), 0)]);
    }
    sheets.push({
      name: 'Articles',
      columns: LINE_COLUMNS,
      rows: lineRows,
      boldLastRow: lineRows.length > 0,
    });
  }

  return sheets;
}

// ── Printable report ──────────────────────────────────────────────
const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cellText = (c: Column, e: ReportEntry): string => {
  const v = c.cell(e);
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === 'number') return num(v);
  return esc(v);
};

const REPORT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;padding:40px 56px;background:#fff}
.rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #1a1a2e}
.brand{font-size:28px;font-weight:900;letter-spacing:2px}.brand span{color:#4f46e5}
.rm{text-align:right}.rm .title{font-size:16px;font-weight:700}.rm .sub{font-size:11px;color:#888;margin-top:3px}
.kpi{display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap}
.kpi-box{flex:1;min-width:120px;border:1px solid #e8eaf0;border-radius:8px;padding:12px 14px}
.kpi-box .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
.kpi-box .val{font-size:20px;font-weight:800;color:#1a1a2e;margin-top:4px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e8eaf0;display:flex;align-items:center;gap:8px}
.acc{display:inline-block;width:4px;height:14px;background:#4f46e5;border-radius:2px}
table{width:100%;border-collapse:collapse;font-size:11px}
thead tr{background:#1a1a2e;color:#fff}
thead th{padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
thead th.r{text-align:right}
tbody td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}
tbody tr:nth-child(even){background:#f7f8fc}
td.r{text-align:right;font-variant-numeric:tabular-nums}
td.mono{font-family:monospace;font-size:10px}
tfoot tr{background:#1a1a2e;color:#fff}
tfoot td{padding:8px 10px;font-weight:700}
tfoot td.r{text-align:right}
.fields{display:flex;flex-wrap:wrap;gap:8px 22px;padding:9px 12px;background:#fff;border:1px solid #e8eaf0;border-bottom:0}
.fields .f label{display:block;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#999}
.fields .f span{font-size:11px;font-weight:600;color:#1a1a2e}
.lines{margin:0 0 16px 0;padding:8px 10px 10px;background:#f7f8fc;border:1px solid #e8eaf0;border-left:3px solid #4f46e5}
.grand{margin-top:8px}
.lines .cap{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px}
.lines table{font-size:10px;background:#fff}
.lines thead tr{background:#4b5563}
.grp{margin-bottom:6px;font-weight:700;font-size:12px}
.grp .meta{font-weight:400;color:#888;font-size:10px;margin-left:8px}
.foot{margin-top:40px;padding-top:14px;border-top:1px solid #e8eaf0;text-align:center;font-size:10px;color:#bbb}
@media print{body{padding:20px 30px}tr{break-inside:avoid}.lines{break-inside:avoid}}
@page{margin:1cm}`;

export function buildReceiptReportHtml(input: ReportInput): string {
  const { entries, options, filterSummary, generatedAt } = input;
  const cols = columns(options);
  const totals = reportTotals(entries);
  const dateStr = fmtDate(generatedAt);

  const head = cols.map(c => `<th${c.numeric ? ' class="r"' : ''}>${esc(c.header)}</th>`).join('');

  const totalRow = cols.map((c, i) => {
    if (i === 0) return '<td>TOTAL</td>';
    if (!c.numeric) return '<td></td>';
    const sum = entries.reduce((s, e) => {
      const v = c.cell(e);
      return s + (typeof v === 'number' ? v : 0);
    }, 0);
    return `<td class="r">${num(sum)}</td>`;
  }).join('');

  // Without article detail the report is one flat table; with it, each receipt
  // is followed by its own lines table, which reads far better on paper.
  const hasNumeric = cols.some(c => c.numeric);

  let body: string;
  if (options.lines) {
    // Repeating a wide header above every receipt wastes the page, so each one
    // becomes a compact field block followed by its own lines table.
    const blocks = entries.map(e => {
      const fields = cols
        // Reference, BL and date are already in the block's heading.
        .filter(c => !['Référence', 'N° BL', 'Date'].includes(c.header))
        .map(c => `<div class="f"><label>${esc(c.header)}</label><span>${cellText(c, e)}</span></div>`)
        .join('');
      const lines = e.row.lines.length
        ? `<div class="lines"><div class="cap">Détail des articles — ${e.row.lines.length} référence${e.row.lines.length !== 1 ? 's' : ''}</div>
<table><thead><tr><th>Désignation</th><th>Référence</th><th class="r">Quantité</th></tr></thead>
<tbody>${e.row.lines.map(l => `<tr><td>${esc(l.productName)}</td><td class="mono">${esc(l.sku) || '—'}</td><td class="r">${num(l.qty)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="2">TOTAL</td><td class="r">${num(e.row.totalQty)}</td></tr></tfoot></table></div>`
        : '<div class="lines"><div class="cap">Aucun article enregistré sur cette réception</div></div>';
      return `<div class="grp">${esc(rowBL(e.row) || rowRef(e.row))}
  <span class="meta">${fmtDate(e.row.date)}${e.row.supplier ? ` · ${esc(e.row.supplier)}` : ''}</span></div>
<div class="fields">${fields}</div>${lines}`;
    }).join('');

    // Per-receipt totals don't add up on their own — close with the grand total.
    const grand = `<table class="grand"><tfoot><tr>
<td>TOTAL GÉNÉRAL — ${entries.length} réception${entries.length !== 1 ? 's' : ''}</td>
<td class="r">${num(totals.pieces)} pièces</td>
${options.invoiceDetails ? `<td class="r">${num(totals.amount)} ${esc(totals.currency)}</td>` : ''}
</tr></tfoot></table>`;
    body = blocks + grand;
  } else {
    const rows = entries.map(e =>
      `<tr>${cols.map(c => `<td${c.numeric ? ' class="r"' : ''}>${cellText(c, e)}</td>`).join('')}</tr>`
    ).join('');
    // With no numeric column there is nothing to total — an empty footer bar
    // would just be a black stripe across the page.
    const foot = hasNumeric ? `<tfoot><tr>${totalRow}</tr></tfoot>` : '';
    body = `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody>${foot}</table>`;
  }

  const empty = '<p style="padding:30px;text-align:center;color:#999;font-size:12px">Aucune réception ne correspond à la sélection.</p>';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Granitec — ${esc(SCOPE_LABEL[options.scope])} ${generatedAt.toISOString().slice(0, 10)}</title>
<style>${REPORT_CSS}</style></head><body>
<div class="rh">
  <div class="brand">GRANITE<span>C</span></div>
  <div class="rm">
    <div class="title">Rapport Réceptions — ${esc(SCOPE_LABEL[options.scope])}</div>
    <div class="sub">${esc(filterSummary)}</div>
    <div class="sub">Généré le ${dateStr}</div>
  </div>
</div>
<div class="kpi">
  <div class="kpi-box"><div class="lbl">Réceptions</div><div class="val">${num(totals.receipts)}</div></div>
  ${options.quantities ? `<div class="kpi-box"><div class="lbl">Total pièces</div><div class="val">${num(totals.pieces)}</div></div>` : ''}
  ${options.invoiceStatus || options.invoiceDetails ? `
  <div class="kpi-box"><div class="lbl">Facturées</div><div class="val">${num(totals.invoiced)}</div></div>
  <div class="kpi-box"><div class="lbl">Non facturées</div><div class="val">${num(totals.uninvoiced)}</div></div>` : ''}
  ${options.invoiceDetails ? `<div class="kpi-box"><div class="lbl">Montant facturé</div><div class="val">${num(totals.amount)} <span style="font-size:11px;font-weight:600;color:#888">${esc(totals.currency)}</span></div></div>` : ''}
  ${options.document ? `<div class="kpi-box"><div class="lbl">Sans document</div><div class="val">${num(totals.withoutDocument)}</div></div>` : ''}
</div>
<div class="sec-title"><span class="acc"></span>${entries.length} réception${entries.length !== 1 ? 's' : ''}${options.lines ? ' — détail des articles' : ''}</div>
${entries.length === 0 ? empty : body}
<div class="foot">Confidentiel — Document généré par Granitec ERP · ${generatedAt.toLocaleDateString('fr-FR')}</div>
</body></html>`;
}
