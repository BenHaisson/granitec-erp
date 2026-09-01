// Receipt rows — the shape the BL Receipts list and the report both read.
//
// A receipt reaches the document trail two ways: as a shipment receipt recorded
// against a shipping order, or as a shipped supply logged in one step. They are
// normalised here so both render, filter and export identically.

import type { ShippingOrder, ShippedSupply } from '@/types';

/** One received article, normalised across BL receipts and shipped supply. */
export type ReceiptLine = { productName: string; sku: string; qty: number };

export type BLRow = {
  kind: 'bl';
  key: string;          // orderId + receipt/legacy discriminator
  orderId: string;
  orderRef: string;
  supplier?: string;
  blNumber: string;     // '' when the receipt carries no BL number
  status?: string;      // parent order status (PARTIAL / RECEIVED)
  date: string;
  description?: string; // the receipt's remarks
  lines: ReceiptLine[];
  totalQty: number;
  lineCount: number;
  addedToInventory?: boolean;
  documentUrl?: string;
  documentName?: string;
  documentKey?: string;
  storageProvider?: 'r2';
};

export type SupplyRow = {
  kind: 'supply';
  key: string;
  ref: string;
  supplier?: string;
  date: string;
  description?: string;
  lines: ReceiptLine[];
  totalQty: number;
  lineCount: number;
  addedToInventory: boolean;
  documentUrl?: string;
  documentName?: string;
  documentKey?: string;
  storageProvider?: 'r2';
  supply: ShippedSupply;
};

export type ReceiptRow = BLRow | SupplyRow;

// Surface EVERY recorded shipment receipt in the document trail — including
// those without a BL number or an attached document (they show up flagged as
// "No BL" / "without document" so nothing recorded on the Shipping page is lost).
export function extractBLRecords(orders: ShippingOrder[]): BLRow[] {
  const records: BLRow[] = [];
  for (const order of orders) {
    const receipts = order.receipts ?? [];
    if (receipts.length > 0) {
      // New flow — one row per recorded shipment receipt.
      for (const r of receipts) {
        const lines: ReceiptLine[] = (r.lines ?? []).map(l => ({
          productName: l.productName, sku: l.sku, qty: l.receivedQty,
        }));
        records.push({
          kind: 'bl',
          key: `${order.id}__rcpt__${r.id}`,
          orderId: order.id,
          orderRef: order.ref,
          supplier: order.supplier,
          blNumber: r.blNumber ?? '',
          status: order.status,
          date: r.date,
          description: r.remarks,
          lines,
          totalQty: lines.reduce((sum, l) => sum + l.qty, 0),
          lineCount: lines.length,
          addedToInventory: r.addedToInventory,
          documentUrl: r.documentUrl,
          documentName: r.documentName,
          documentKey: r.documentKey,
          storageProvider: r.storageProvider,
        });
      }
    } else if (order.status === 'RECEIVED') {
      // Legacy flow — received order marked done without a receipts array.
      // Its ordered lines are the best record of what came in.
      const lines: ReceiptLine[] = (order.lines ?? []).map(l => ({
        productName: l.productName, sku: l.sku, qty: l.qty,
      }));
      records.push({
        kind: 'bl',
        key: `${order.id}__legacy`,
        orderId: order.id,
        orderRef: order.ref,
        supplier: order.supplier,
        blNumber: order.blNumber ?? '',
        status: order.status,
        date: order.receivedAt ? new Date(order.receivedAt as unknown as string).toISOString().split('T')[0] : order.date,
        description: order.remarks,
        lines,
        totalQty: lines.reduce((sum, l) => sum + l.qty, 0),
        lineCount: lines.length,
        addedToInventory: order.addedToInventory,
        documentUrl: order.documentUrl,
        documentName: order.documentName,
        documentKey: order.documentKey,
        storageProvider: order.storageProvider,
      });
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildSupplyRows(supplies: ShippedSupply[]): SupplyRow[] {
  return supplies.map(s => ({
    kind: 'supply',
    key: `supply__${s.id}`,
    ref: s.ref,
    supplier: s.supplier,
    date: s.date,
    description: s.description,
    lines: s.lines.map(l => ({ productName: l.productName, sku: l.sku, qty: l.qty })),
    totalQty: s.lines.reduce((sum, l) => sum + l.qty, 0),
    lineCount: s.lines.length,
    addedToInventory: s.addedToInventory,
    documentUrl: s.documentUrl,
    documentName: s.documentName,
    documentKey: s.documentKey,
    storageProvider: s.storageProvider,
    supply: s,
  }));
}
