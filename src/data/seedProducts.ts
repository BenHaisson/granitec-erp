import type { Product } from '@/types';

type SeedProduct = Omit<Product, 'id'>;

export const SEED_PRODUCTS: SeedProduct[] = [
  // ── 1. Sets & Packs ───────────────────────────────────────────
  { sort_order: 1,  name: '3-Piece Frypan Set — Granite Black',   sku: 'JSM-2102N',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 1,  name: '3-Piece Frypan Set — Granite Gray',    sku: 'JSM-2102G',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 2,  name: '3-Piece Frypan Set — Ceramic Black',   sku: 'JSM-2104N',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 3,  name: '5-Piece Saucepot Set — Granite Black', sku: 'JSM-1407N',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 3,  name: '5-Piece Saucepot Set — Granite Gray',  sku: 'JSM-1407G',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 4,  name: '3-Piece Saucepot Set — Granite Black', sku: 'JSM-1408N',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 4,  name: '3-Piece Saucepot Set — Granite Gray',  sku: 'JSM-1408G',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 5,  name: '3-Piece Saucepot Set — Ceramic Black', sku: 'JSM-1406N',    type: 'FINISHED', category: 'Sets & Packs', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },

  // ── 2. Marmite & Faitouts ─────────────────────────────────────
  { sort_order: 6,  name: 'Marmite 30cm — Granite Black',           sku: 'JSM-1611N',    type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 6,  name: 'Marmite 30cm — Granite Gray',            sku: 'JSM-1611G',    type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 7,  name: 'Marmite 28cm — Granite Black',           sku: 'JSM-2901N',    type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 7,  name: 'Marmite 28cm — Granite Gray',            sku: 'JSM-2901G',    type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 8,  name: 'Marmite 26cm — Granite Black',           sku: 'JSM-1806N-LG', type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 8,  name: 'Marmite 26cm — Granite Gray',            sku: 'JSM-1806G-LG', type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 9,  name: 'Marmite 24cm — Granite Black',           sku: 'JSM-1805N-MD', type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 9,  name: 'Marmite 24cm — Granite Gray',            sku: 'JSM-1806G-MD', type: 'FINISHED', category: 'Marmite', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 10, name: '7-Piece Stock Pot Set (Tanjara) — Black', sku: 'JSM-0707N',    type: 'FINISHED', category: 'Marmite', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 10, name: '7-Piece Stock Pot Set (Tanjara) — Gray',  sku: 'JSM-0707G',    type: 'FINISHED', category: 'Marmite', unit: 'set', stock_level: 0, min_stock: 10, cost: 0 },

  // ── 3. Crepe Pans & Specialty ─────────────────────────────────
  { sort_order: 11, name: 'Crepe Pan 24cm — Granite Black', sku: 'JSM-1405N',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 11, name: 'Crepe Pan 24cm — Granite Cream', sku: 'JSM-1405C',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 12, name: 'Crepe Pan 22cm — Granite Black', sku: 'JSM-0905N',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 12, name: 'Crepe Pan 22cm — Granite Cream', sku: 'JSM-0905C',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 13, name: 'Crepe Pan 18cm — Granite Black', sku: 'JSM-1109N',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 13, name: 'Crepe Pan 18cm — Granite Cream', sku: 'JSM-1109C',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 14, name: 'Egg Pan 14cm — Ceramic Blue',    sku: 'JSM-1954B',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 14, name: 'Egg Pan 14cm — Ceramic Red',     sku: 'JSM-1954R',  type: 'FINISHED', category: 'Crepe & Specialty', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },

  // ── 4. Individual Frypans ─────────────────────────────────────
  { sort_order: 15, name: 'Frypan with Lid 26cm — Granite Black', sku: 'JSM-19090N', type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 15, name: 'Frypan with Lid 26cm — Granite Gray',  sku: 'JSM-19090G', type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 16, name: 'Frypan with Lid 24cm — Granite Black', sku: 'JSM-21024N', type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 16, name: 'Frypan with Lid 24cm — Granite Gray',  sku: 'JSM-21024G', type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 17, name: 'Frypan 28cm — Granite Black',          sku: 'JSM-058N',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 17, name: 'Frypan 28cm — Granite Gray',           sku: 'JSM-058G',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 18, name: 'Frypan 26cm — Granite Black',          sku: 'JSM-056N',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 18, name: 'Frypan 26cm — Granite Gray',           sku: 'JSM-056G',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 19, name: 'Frypan 24cm — Granite Black',          sku: 'JSM-054N',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 19, name: 'Frypan 24cm — Granite Gray',           sku: 'JSM-054G',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 20, name: 'Frypan 20cm — Granite Black',          sku: 'JSM-052N',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 20, name: 'Frypan 20cm — Granite Gray',           sku: 'JSM-052G',   type: 'FINISHED', category: 'Frypans', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },

  // ── 5. Individual Saucepots ───────────────────────────────────
  { sort_order: 21, name: 'Saucepot 20cm — Granite Black', sku: 'JSM-055N-20', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 21, name: 'Saucepot 20cm — Granite Gray',  sku: 'JSM-055G-20', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 22, name: 'Saucepot 18cm — Granite Black', sku: 'JSM-055N-18', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 22, name: 'Saucepot 18cm — Granite Gray',  sku: 'JSM-055G-18', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 23, name: 'Saucepot 16cm — Granite Black', sku: 'JSM-055N-16', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 23, name: 'Saucepot 16cm — Granite Gray',  sku: 'JSM-055G-16', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 24, name: 'Saucepot 14cm — Granite Black', sku: 'JSM-055N-14', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 24, name: 'Saucepot 14cm — Granite Gray',  sku: 'JSM-055G-14', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 25, name: 'Saucepot 12cm — Granite Black', sku: 'JSM-055N-12', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },
  { sort_order: 25, name: 'Saucepot 12cm — Granite Gray',  sku: 'JSM-055G-12', type: 'FINISHED', category: 'Saucepots', unit: 'pcs', stock_level: 0, min_stock: 10, cost: 0 },

  // ── 6. Cake & Molds ───────────────────────────────────────────
  { sort_order: 26, name: 'Cake Mold — Ceramic Red',   sku: 'JSM-1295R', type: 'FINISHED', category: 'Cake & Molds', unit: 'pcs', stock_level: 0, min_stock: 5, cost: 0 },
  { sort_order: 26, name: 'Cake Mold — Ceramic Black', sku: 'JSM-1295N', type: 'FINISHED', category: 'Cake & Molds', unit: 'pcs', stock_level: 0, min_stock: 5, cost: 0 },
];
