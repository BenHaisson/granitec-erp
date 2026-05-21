// BOM Recipe seed data — verified from BOM image
// finishedProductSku → must match a SKU in seedProducts.ts
// productSku         → must match a SKU in seedProducts.ts, seedAccessories.ts, or seedDiscs.ts
// quantities are per 1 finished unit; American Master Boxes are NOT in recipes (managed at dispatch)

export type SeedRecipe = {
  finishedProductSku: string;
  components: { productSku: string; quantity: number }[];
};

export const SEED_RECIPES: SeedRecipe[] = [
  // ── Egg Pans 14cm ─────────────────────────────────────────────
  {
    finishedProductSku: 'JSM-1954B',
    components: [
      { productSku: 'DISC-175X2-B',  quantity: 1 },
      { productSku: 'HEP-S-BK',      quantity: 1 },
      { productSku: 'MT-17-35',      quantity: 1 },
      { productSku: 'SC-16',         quantity: 1 },
      { productSku: 'PKG-EGG-BOX',   quantity: 1 },
    ],
  },
  {
    finishedProductSku: 'JSM-1954R',
    components: [
      { productSku: 'DISC-175X2-R',  quantity: 1 },
      { productSku: 'HEP-S-BK',      quantity: 1 },
      { productSku: 'MT-17-35',      quantity: 1 },
      { productSku: 'SC-16',         quantity: 1 },
      { productSku: 'PKG-EGG-BOX',   quantity: 1 },
    ],
  },

  // ── Crepe Pans 18cm ───────────────────────────────────────────
  {
    finishedProductSku: 'JSM-1109C',
    components: [
      { productSku: 'DISC-200X2-CR', quantity: 1 },
      { productSku: 'HCR-S-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-18',     quantity: 1 },
    ],
  },
  {
    finishedProductSku: 'JSM-1109N',
    components: [
      { productSku: 'DISC-200X2-N',  quantity: 1 },
      { productSku: 'HCR-S-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-18',     quantity: 1 },
    ],
  },

  // ── Crepe Pans 22cm ───────────────────────────────────────────
  {
    finishedProductSku: 'JSM-0905C',
    components: [
      { productSku: 'DISC-240X2-CR', quantity: 1 },
      { productSku: 'HCR-B-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-22',     quantity: 1 },
    ],
  },
  {
    finishedProductSku: 'JSM-0905N',
    components: [
      { productSku: 'DISC-240X2-N',  quantity: 1 },
      { productSku: 'HCR-B-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-22',     quantity: 1 },
    ],
  },

  // ── Crepe Pans 24cm ───────────────────────────────────────────
  {
    finishedProductSku: 'JSM-1405C',
    components: [
      { productSku: 'DISC-260X2-CR', quantity: 1 },
      { productSku: 'HCR-B-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-24',     quantity: 1 },
    ],
  },
  {
    finishedProductSku: 'JSM-1405N',
    components: [
      { productSku: 'DISC-260X2-N',  quantity: 1 },
      { productSku: 'HCR-B-BK',      quantity: 1 },
      { productSku: 'RV-S',          quantity: 2 },
      { productSku: 'PKG-CR-24',     quantity: 1 },
    ],
  },

  // ── 5-Piece Saucepot Set ──────────────────────────────────────
  {
    finishedProductSku: 'JSM-1407G',
    components: [
      { productSku: 'DISC-220X27-G', quantity: 1 },
      { productSku: 'DISC-250X27-G', quantity: 1 },
      { productSku: 'DISC-280X27-G', quantity: 1 },
      { productSku: 'DISC-305X27-G', quantity: 1 },
      { productSku: 'DISC-335X27-G', quantity: 1 },
      { productSku: 'HSP-T-S-GR',    quantity: 3 },
      { productSku: 'HSP-T-B-GR',    quantity: 2 },
      { productSku: 'MT-17-35',      quantity: 5 },
      { productSku: 'SC-16',         quantity: 5 },
      { productSku: 'PKG-SP-1407',   quantity: 1 },
    ],
  },
  {
    finishedProductSku: 'JSM-1407N',
    components: [
      { productSku: 'DISC-220X27-N', quantity: 1 },
      { productSku: 'DISC-250X27-N', quantity: 1 },
      { productSku: 'DISC-280X27-N', quantity: 1 },
      { productSku: 'DISC-305X27-N', quantity: 1 },
      { productSku: 'DISC-335X27-N', quantity: 1 },
      { productSku: 'HSP-T-S-BK',    quantity: 3 },
      { productSku: 'HSP-T-B-BK',    quantity: 2 },
      { productSku: 'MT-17-35',      quantity: 5 },
      { productSku: 'SC-16',         quantity: 5 },
      { productSku: 'PKG-SP-1407',   quantity: 1 },
    ],
  },
];
