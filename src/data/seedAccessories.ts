import type { Product } from '@/types';

export const ACCESSORIES: Omit<Product, 'id'>[] = [
  // ── Frypan Handles ──────────────────────────────────────────── #01–04
  { name: 'Frypan Soft-Touch Handle Big Black',  sku: 'HFP-T-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 1 },
  { name: 'Frypan Soft-Touch Handle Big Gray',   sku: 'HFP-T-B-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 2 },
  { name: 'Frypan Handle Big Black',             sku: 'HFP-B-BK',   type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 3 },
  { name: 'Frypan Handle Small Black',           sku: 'HFP-S-BK',   type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 4 },

  // ── Saucepot Handles ────────────────────────────────────────── #05–09
  { name: 'Saucepot Soft-Touch Handle Big Black',   sku: 'HSP-T-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 5 },
  { name: 'Saucepot Soft-Touch Handle Big Gray',    sku: 'HSP-T-B-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 6 },
  { name: 'Saucepot Soft-Touch Handle Small Black', sku: 'HSP-T-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 7 },
  { name: 'Saucepot Soft-Touch Handle Small Gray',  sku: 'HSP-T-S-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 8 },
  { name: 'Saucepot Handle Small Black',            sku: 'HSP-S-BK',   type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 9 },

  // ── Crepe Handles ───────────────────────────────────────────── #10–11
  { name: 'Crepe Handle Big Black',   sku: 'HCR-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 10 },
  { name: 'Crepe Handle Small Black', sku: 'HCR-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 11 },

  // ── Side Handles ────────────────────────────────────────────── #12–15
  { name: 'Side Handle Soft-Touch Standard Black',       sku: 'HSH-T-ST-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 12 },
  { name: 'Side Handle Soft-Touch Standard Gray',        sku: 'HSH-T-ST-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 13 },
  { name: 'Side Handle Stainless Steel Big Stainless',   sku: 'HSH-B-SS',    type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 14 },
  { name: 'Side Handle Stainless Steel Small Stainless', sku: 'HSH-S-SS',    type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 15 },

  // ── Glass Lids ──────────────────────────────────────────────── #16–20
  { name: 'Glass Lid 20cm', sku: 'GL-20', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 16 },
  { name: 'Glass Lid 24cm', sku: 'GL-24', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 17 },
  { name: 'Glass Lid 26cm', sku: 'GL-26', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 18 },
  { name: 'Glass Lid 28cm', sku: 'GL-28', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 19 },
  { name: 'Glass Lid 30cm', sku: 'GL-30', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 20 },

  // ── Glass Lid Knobs ─────────────────────────────────────────── #21–23
  { name: 'Glass Lid Knob Stainless Steel Standard Metallic', sku: 'GK-SS-ST',   type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 21 },
  { name: 'Glass Lid Knob Soft-Touch Standard Black',         sku: 'GK-T-ST-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 22 },
  { name: 'Glass Lid Knob Soft-Touch Standard Gray',          sku: 'GK-T-ST-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 23 },

  // ── Matcha ──────────────────────────────────────────────────── #24–26
  { name: 'Matcha 14mm 90°', sku: 'MT-14-90', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 24 },
  { name: 'Matcha 14mm 45°', sku: 'MT-14-45', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 25 },
  { name: 'Matcha 17mm 35°', sku: 'MT-17-35', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 26 },

  // ── Rivets ──────────────────────────────────────────────────── #27–28
  { name: 'Rivet Big',   sku: 'RV-B', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 27 },
  { name: 'Rivet Small', sku: 'RV-S', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 28 },

  // ── Screws ──────────────────────────────────────────────────── #29–31
  { name: 'Screw 13mm', sku: 'SC-13', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 29 },
  { name: 'Screw 14mm', sku: 'SC-14', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 30 },
  { name: 'Screw 16mm', sku: 'SC-16', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 31 },

  // ── Egg Pan Handle ──────────────────────────────────────────── #32
  { name: 'Egg Pan Handle Black Small',                                       sku: 'HEP-S-BK',     type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 32 },

  // ── Packaging — Individual ───────────────────────────────────── #33–37
  { name: 'Egg Pan 14cm (Ceramic) — Color Box',                               sku: 'PKG-EGG-BOX',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 33 },
  { name: 'Crepe Pan 18cm (Granite) — Sticker',                               sku: 'PKG-CR-18',    type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 34 },
  { name: 'Crepe Pan 22cm (Granite) — Sticker',                               sku: 'PKG-CR-22',    type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 35 },
  { name: 'Crepe Pan 24cm (Granite) — Sticker',                               sku: 'PKG-CR-24',    type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 36 },
  { name: '5-Piece Saucepot Set (Granite) — Color Box',                       sku: 'PKG-SP-1407',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 37 },

  // ── Packaging — American Master Box ─────────────────────────── #38–42
  { name: 'Egg Pan 14cm (Ceramic) — American Master Box (20 pcs)',            sku: 'PKG-AMB-EGG',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 38 },
  { name: 'Crepe Pan 18cm (Granite) — American Master Box (20 pcs)',          sku: 'PKG-AMB-CR18', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 39 },
  { name: 'Crepe Pan 22cm (Granite) — American Master Box (20 pcs)',          sku: 'PKG-AMB-CR22', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 40 },
  { name: 'Crepe Pan 24cm (Granite) — American Master Box (20 pcs)',          sku: 'PKG-AMB-CR24', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 41 },
  { name: '5-Piece Saucepot Set (Granite) — American Master Box (6 sets)',    sku: 'PKG-AMB-SP',   type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 42 },
];
