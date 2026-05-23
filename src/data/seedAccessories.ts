import type { Product } from '@/types';

export const ACCESSORIES: Omit<Product, 'id'>[] = [
  // ── Frypan Handles ──────────────────────────────────────────── #01–04
  { name: 'Frypan Soft-Touch Handle (Big/Black)',    sku: 'HFP-ST-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 1 },
  { name: 'Frypan Soft-Touch Handle (Big/Gray)',     sku: 'HFP-ST-B-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 2 },
  { name: 'Frypan Normal-Touch Handle (Big/Black)',  sku: 'HFP-NT-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 3 },
  { name: 'Frypan Normal-Touch Handle (Small/Black)',sku: 'HFP-NT-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 4 },

  // ── Saucepot Handles ────────────────────────────────────────── #05–09
  { name: 'Saucepot Soft-Touch Handle (Big/Black)',   sku: 'HSP-ST-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 5 },
  { name: 'Saucepot Soft-Touch Handle (Small/Black)', sku: 'HSP-ST-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 6 },
  { name: 'Saucepot Soft-Touch Handle (Big/Gray)',    sku: 'HSP-ST-B-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 7 },
  { name: 'Saucepot Soft-Touch Handle (Small/Gray)',  sku: 'HSP-ST-S-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 8 },
  { name: 'Saucepot Normal-Touch Handle (Small/Black)',sku: 'HSP-NT-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 9 },

  // ── Crepe Handles ───────────────────────────────────────────── #10–11
  { name: 'Crepe Handle Big Black',   sku: 'HCR-B-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 10 },
  { name: 'Crepe Handle Small Black', sku: 'HCR-S-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 11 },

  // ── Egg Pan Handle ──────────────────────────────────────────── #12
  { name: 'Egg Pan Handle Black Small', sku: 'HEGG-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 12 },

  // ── Side Handles ────────────────────────────────────────────── #13–16
  { name: 'Side Handle Soft-Touch Black',      sku: 'SH-ST-N', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 13 },
  { name: 'Side Handle Soft-Touch Gray',       sku: 'SH-ST-G', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 14 },
  { name: 'Side Handle Stainless Steel Big',   sku: 'SH-SS-L', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 15 },
  { name: 'Side Handle Stainless Steel Small', sku: 'SH-SS-S', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 16 },

  // ── Glass Lids ──────────────────────────────────────────────── #17–21
  { name: 'Glass Lid 20cm', sku: 'GL-20', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 17 },
  { name: 'Glass Lid 24cm', sku: 'GL-24', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 18 },
  { name: 'Glass Lid 26cm', sku: 'GL-26', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 19 },
  { name: 'Glass Lid 28cm', sku: 'GL-28', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 20 },
  { name: 'Glass Lid 30cm', sku: 'GL-30', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 21 },

  // ── Glass Lid Knobs ─────────────────────────────────────────── #22–24
  { name: 'Glass Lid Knob Stainless Steel Metallic', sku: 'GLK-SS',    type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 22 },
  { name: 'Glass Lid Knob Soft-Touch Black',         sku: 'GLK-ST-BK', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 23 },
  { name: 'Glass Lid Knob Soft-Touch Gray',          sku: 'GLK-ST-GR', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 24 },

  // ── Matcha ──────────────────────────────────────────────────── #25–27
  { name: 'Matcha 14mm 90°', sku: 'MT-14-90', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 25 },
  { name: 'Matcha 14mm 45°', sku: 'MT-14-45', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 26 },
  { name: 'Matcha 17mm 35°', sku: 'MT-17-35', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 27 },

  // ── Rivets ──────────────────────────────────────────────────── #28–29
  { name: 'Rivet Big',   sku: 'RV-B', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 28 },
  { name: 'Rivet Small', sku: 'RV-S', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 29 },

  // ── Screws ──────────────────────────────────────────────────── #30–32
  { name: 'Screw 13mm', sku: 'SC-13', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 30 },
  { name: 'Screw 14mm', sku: 'SC-14', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 31 },
  { name: 'Screw 16mm', sku: 'SC-16', type: 'RAW', category: 'Accessories', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 32 },

];

export const PACKAGING: Omit<import('@/types').Product, 'id'>[] = [
  // ── Package Boxes & Stickers ────────────────────────────────── #01–14
  { name: 'Egg Pan 14cm – Package Box',         sku: 'PKG-EGG-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 33 },
  { name: 'Crepe Pan 18cm – Sticker',           sku: 'PKG-CR18-ST', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 34 },
  { name: 'Crepe Pan 22cm – Sticker',           sku: 'PKG-CR22-ST', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 35 },
  { name: 'Crepe Pan 24cm – Sticker',           sku: 'PKG-CR24-ST', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 36 },
  { name: '5-Piece Saucepot Set – Package Box', sku: 'PKG-5SP-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 37 },
  { name: '3-Piece Saucepot Set – Package Box', sku: 'PKG-3SP-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 38 },
  { name: '3-Piece Frypan Set – Package Box',   sku: 'PKG-3FP-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 39 },
  { name: 'Marmite 30cm – Package Box',         sku: 'PKG-M30-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 40 },
  { name: 'Marmite 28cm – Package Box',         sku: 'PKG-M28-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 41 },
  { name: 'Marmite 26cm – Package Box',         sku: 'PKG-M26-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 42 },
  { name: 'Marmite 24cm – Package Box',         sku: 'PKG-M24-PB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 43 },
  { name: 'Frypan 26cm with Lid – Sticker',     sku: 'PKG-M26-ST',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 44 },
  { name: 'Frypan 24cm with Lid – Sticker',     sku: 'PKG-M24-ST',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 45 },
  { name: '7-Piece Stock Pot – Package Box',    sku: 'PKG-7P-PB',   type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 46 },

  // ── Master Boxes & Interlayers ──────────────────────────────── #15–28
  { name: 'Egg Pan 14cm Master Box',            sku: 'PKG-EGG-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 47 },
  { name: 'Crepe Pan 18cm Master Box',          sku: 'PKG-CR18-MB', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 48 },
  { name: 'Crepe Pan 22cm Master Box',          sku: 'PKG-CR22-MB', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 49 },
  { name: 'Crepe Pan 24cm – Master Box',        sku: 'PKG-CR24-MB', type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 50 },
  { name: '5-Piece Saucepot Set Master Box',    sku: 'PKG-AMB-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 51 },
  { name: '3-Piece Saucepot Set – Master Box',  sku: 'PKG-3SP-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 52 },
  { name: '3-Piece Frypan Set – Master Box',    sku: 'PKG-3FP-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 53 },
  { name: 'Marmite 30cm – Master Box',          sku: 'PKG-M30-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 54 },
  { name: 'Marmite 28cm – Master Box',          sku: 'PKG-M28-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 55 },
  { name: 'Marmite 26cm – Master Box',          sku: 'PKG-M26-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 56 },
  { name: 'Marmite 24cm – Master Box',          sku: 'PKG-M24-MB',  type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 57 },
  { name: 'Interlayer Saucepot PF',             sku: 'PKG-SP-PF',   type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 58 },
  { name: 'Interlayer Saucepot GF',             sku: 'PKG-SP-GF',   type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 59 },
  { name: 'Interlayer Frypan SV',               sku: 'PKG-FP-SV',   type: 'RAW', category: 'Packaging', unit: 'pcs', stock_level: 0, min_stock: 0, cost: 0, sort_order: 60 },
];
