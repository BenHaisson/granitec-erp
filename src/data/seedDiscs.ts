import type { Product } from '@/types';

export const DISC_SHIPPINGS: { ref: string; date: Date }[] = [
  { ref: 'DISC-2024-S1', date: new Date('2024-01-15') },
  { ref: 'DISC-2024-S2', date: new Date('2024-02-01') },
  { ref: 'DISC-2024-S3', date: new Date('2024-03-01') },
  { ref: 'DISC-2024-S4', date: new Date('2024-10-01') },
  { ref: 'DISC-2024-S5', date: new Date('2024-12-01') },
  { ref: 'DISC-2025-S1', date: new Date('2025-04-01') },
  { ref: 'DISC-2025-S2', date: new Date('2025-08-01') },
  { ref: 'DISC-2025-S3', date: new Date('2025-11-01') },
  { ref: 'DISC-2025-S4', date: new Date('2025-12-01') },
];

// [sku, name, s1, s2, s3, s4, s5, s6, s7, s8, s9]
const RAW: [string, string, number, number, number, number, number, number, number, number, number][] = [
  // ── 2 mm ────────────────────────────────────────────────────────────────────
  ['DISC-175X2-R',  'Disc 175×2mm — Red',         0, 3826, 3518,     0,     0,     0,     0,     0,     0],
  ['DISC-175X2-B',  'Disc 175×2mm — Blue',        0, 3825, 3518,     0,     0,     0,     0,     0,     0],
  ['DISC-200X2-CR', 'Disc 200×2mm — Cream',       0, 4491, 1544,     0, 12547,     0,     0,     0, 12500],
  ['DISC-200X2-N',  'Disc 200×2mm — Black',       0, 4491, 1543,     0, 12547,     0,     0,     0, 12500],
  ['DISC-240X2-CR', 'Disc 240×2mm — Cream',       0, 2965, 1661,     0,  7767,     0,     0,     0,  7500],
  ['DISC-240X2-N',  'Disc 240×2mm — Black',       0, 2964, 1661,     0,  7767,     0,     0,     0,  7500],
  ['DISC-260X2-CR', 'Disc 260×2mm — Cream',       0, 2842, 1588,     0,  5155,     0,     0,     0,  5000],
  ['DISC-260X2-N',  'Disc 260×2mm — Black',       0, 2841, 1587,     0,  5154,     0,     0,     0,  5000],
  ['DISC-335X2-R',  'Disc 335×2mm — Red',         0,    0, 3005,     0,     0,     0,     0,     0,     0],
  // ── 2 mm — Black-Tf finish ───────────────────────────────────────────────────
  ['DISC-230X2-TF', 'Disc 230×2mm — Black-Tf',   0,    0,    0,     0,     0,     0,     0,     0,  5000],
  ['DISC-260X2-TF', 'Disc 260×2mm — Black-Tf',   0,    0,    0,     0,     0,     0,     0,     0,  5000],
  ['DISC-295X2-TF', 'Disc 295×2mm — Black-Tf',   0,    0,    0,     0,     0,     0,     0,     0,  5000],
  // ── 2.0 mm — Black-Tf finish ─────────────────────────────────────────────────
  ['DISC-220X20-TF','Disc 220×2.0mm — Black-Tf', 0,    0,    0,     0,     0,     0,     0,     0,  5000],
  ['DISC-270X20-TF','Disc 270×2.0mm — Black-Tf', 0,    0,    0,     0,     0,     0,     0,     0,  5000],
  ['DISC-310X20-TF','Disc 310×2.0mm — Black-Tf', 0,    0,    0,     0,     0,     0,     0,     0,  5000],
  // ── 2.70 mm ──────────────────────────────────────────────────────────────────
  ['DISC-210X27-G', 'Disc 210×2.70mm — Gray',    0,    0,    0,     0,     0,     0,     0,  2500,     0],
  ['DISC-210X27-N', 'Disc 210×2.70mm — Black',   0,    0,    0,     0,     0,     0,     0,  2500,     0],
  ['DISC-220X27-G', 'Disc 220×2.70mm — Gray',  1955,    0, 1591,  1487,     0,  2233,  1071,     0,     0],
  ['DISC-220X27-N', 'Disc 220×2.70mm — Black', 1955,    0, 1590,  1487,     0,  2232,  1071,     0,     0],
  ['DISC-240X27-G', 'Disc 240×2.70mm — Gray',    0,    0,    0,     0,     0,     0,     0,  2500,     0],
  ['DISC-240X27-N', 'Disc 240×2.70mm — Black',   0,    0,    0,     0,     0,     0,     0,  2500,     0],
  ['DISC-250X27-G', 'Disc 250×2.70mm — Gray',  1459,    0, 1485,  1516,     0,  2235,  1088,     0,     0],
  ['DISC-250X27-N', 'Disc 250×2.70mm — Black', 1458,    0, 1485,  1516,     0,  2235,  1087,     0,     0],
  ['DISC-255X27-G', 'Disc 255×2.70mm — Gray',  1585,    0, 1531,  3188,  1511,  1560,  1549,  2500,     0],
  ['DISC-255X27-N', 'Disc 255×2.70mm — Black', 1585,    0, 1531,  3187,  1510,  1560,  1548,  2500,     0],
  ['DISC-270X27-G', 'Disc 270×2.70mm — Gray',    0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-270X27-N', 'Disc 270×2.70mm — Black',   0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-280X27-G', 'Disc 280×2.70mm — Gray',  1519,    0, 1529,  3066,     0,  3710,  2784,     0,     0],
  ['DISC-280X27-N', 'Disc 280×2.70mm — Black', 1518,    0, 1529,  3065,     0,  3709,  2783,     0,     0],
  ['DISC-295X27-G', 'Disc 295×2.70mm — Gray',    0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-295X27-N', 'Disc 295×2.70mm — Black',   0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-300X27-G', 'Disc 300×2.70mm — Gray',  1500,    0, 1481,  3194,  1238,  2373,  1549,  2500,     0],
  ['DISC-300X27-N', 'Disc 300×2.70mm — Black', 1499,    0, 1480,  3193,  1238,  2372,  1548,  2500,     0],
  ['DISC-305X27-G', 'Disc 305×2.70mm — Gray',  1548,    0, 1540,  3165,     0,  3728,  2802,  1000,     0],
  ['DISC-305X27-N', 'Disc 305×2.70mm — Black', 1547,    0, 1539,  3165,     0,  3728,  2802,  1000,     0],
  ['DISC-325X27-G', 'Disc 325×2.70mm — Gray',    0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-325X27-N', 'Disc 325×2.70mm — Black',   0,    0,    0,     0,     0,     0,     0,  3500,     0],
  ['DISC-335X27-G', 'Disc 335×2.70mm — Gray',  1543,    0, 1546,  3139,     0,  3743,  2794,     0,     0],
  ['DISC-335X27-N', 'Disc 335×2.70mm — Black', 1542,    0, 1546,  3138,     0,  3742,  2794,     0,     0],
  ['DISC-340X27-G', 'Disc 340×2.70mm — Gray',  1258,    0, 1554,  3169,  1334,  1647,  1538,  2500,     0],
  ['DISC-340X27-N', 'Disc 340×2.70mm — Black', 1258,    0, 1553,  3168,  1334,  1647,  1537,  2500,     0],
  ['DISC-345X27-G', 'Disc 345×2.70mm — Gray',   797, 1017,    0,  1542,  1758,  1054,     0,  1000,     0],
  ['DISC-345X27-N', 'Disc 345×2.70mm — Black',  797, 1016,    0,  1541,  1757,  1053,     0,  1000,     0],
  ['DISC-365X27-G', 'Disc 365×2.70mm — Gray',   774, 1016,    0,  1020,  1011,   825,     0,   750,     0],
  ['DISC-365X27-N', 'Disc 365×2.70mm — Black',  773, 1016,    0,  1020,  1010,   824,     0,   750,     0],
  ['DISC-385X27-G', 'Disc 385×2.70mm — Gray',   780, 1052,    0,   797,   834,   779,     0,   500,     0],
  ['DISC-385X27-N', 'Disc 385×2.70mm — Black',  779, 1052,    0,   797,   834,   779,     0,   500,     0],
  // ── 3.2 mm ───────────────────────────────────────────────────────────────────
  ['DISC-320X32-G', 'Disc 320×3.2mm — Gray',     0,    0, 1969,     0,     0,  1383,  1587,     0,     0],
  ['DISC-320X32-N', 'Disc 320×3.2mm — Black',    0,    0, 1969,     0,     0,  1383,  1587,     0,     0],
  ['DISC-335X32-G', 'Disc 335×3.2mm — Gray',     0,    0, 1043,     0,     0,     0,  1592,     0,     0],
  ['DISC-335X32-N', 'Disc 335×3.2mm — Black',    0,    0, 1042,     0,     0,     0,  1591,     0,     0],
  ['DISC-390X32-G', 'Disc 390×3.2mm — Gray',     0,    0, 1032,     0,     0,     0,  1588,     0,     0],
  ['DISC-390X32-N', 'Disc 390×3.2mm — Black',    0,    0, 1032,     0,     0,     0,  1587,     0,     0],
  ['DISC-420X32-G', 'Disc 420×3.2mm — Gray',     0,    0, 1000,     0,     0,     0,  1588,     0,     0],
  ['DISC-420X32-N', 'Disc 420×3.2mm — Black',    0,    0, 1000,     0,     0,     0,  1588,     0,     0],
];

// ── Derived exports ───────────────────────────────────────────────
export type DiscMovementEntry = { productSku: string; ref: string; date: Date; qty: number };

export const DISC_PRODUCTS: Omit<Product, 'id'>[] = RAW.map(([sku, name, ...qtys]) => ({
  sku,
  name,
  type: 'RAW' as const,
  category: 'Aluminium Disc',
  unit: 'pcs',
  stock_level: qtys.reduce((a, b) => a + b, 0),
  min_stock: 500,
  cost: 0,
}));

export const DISC_MOVEMENTS: DiscMovementEntry[] = RAW.flatMap(([sku, , ...qtys]) =>
  qtys.flatMap((qty, i) =>
    qty > 0 ? [{ productSku: sku, ref: DISC_SHIPPINGS[i].ref, date: DISC_SHIPPINGS[i].date, qty }] : []
  )
);
