// BOM Recipe seed data
// finishedProductSku  → must match a SKU in seedProducts.ts
// productSku          → must match a SKU in seedProducts.ts or seedAccessories.ts / seedDiscs.ts
// quantities are per 1 finished unit

export type SeedRecipe = {
  finishedProductSku: string;
  components: { productSku: string; quantity: number }[];
};

export const SEED_RECIPES: SeedRecipe[] = [
  // ── Crepe Pans ────────────────────────────────────────────────
  {
    finishedProductSku: 'JSM-1109N',
    components: [
      { productSku: 'DISC-180X27-N', quantity: 1 },
      { productSku: 'HCR-B-BK',     quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-1109C',
    components: [
      { productSku: 'DISC-180X27-N', quantity: 1 },
      { productSku: 'HCR-B-BK',     quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-0905N',
    components: [
      { productSku: 'DISC-220X27-N', quantity: 1 },
      { productSku: 'HCR-S-BK',     quantity: 1 },
      { productSku: 'RV-S',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-1405N',
    components: [
      { productSku: 'DISC-240X27-N', quantity: 1 },
      { productSku: 'HCR-B-BK',     quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },

  // ── Frypans ───────────────────────────────────────────────────
  {
    finishedProductSku: 'JSM-052N',
    components: [
      { productSku: 'DISC-200X27-N', quantity: 1 },
      { productSku: 'HFP-T-B-BK',   quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-052G',
    components: [
      { productSku: 'DISC-200X27-G', quantity: 1 },
      { productSku: 'HFP-T-B-GR',   quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-054N',
    components: [
      { productSku: 'DISC-240X27-N', quantity: 1 },
      { productSku: 'HFP-T-B-BK',   quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },
  {
    finishedProductSku: 'JSM-054G',
    components: [
      { productSku: 'DISC-240X27-G', quantity: 1 },
      { productSku: 'HFP-T-B-GR',   quantity: 1 },
      { productSku: 'RV-B',         quantity: 3 },
    ],
  },

  // ── Saucepots ─────────────────────────────────────────────────
  {
    finishedProductSku: 'JSM-055N-16',
    components: [
      { productSku: 'DISC-160X27-N', quantity: 1 },
      { productSku: 'HSP-T-S-BK',   quantity: 2 },
      { productSku: 'GL-16',        quantity: 1 },
      { productSku: 'GK-SS-ST',     quantity: 1 },
      { productSku: 'RV-S',         quantity: 4 },
    ],
  },
  {
    finishedProductSku: 'JSM-055N-18',
    components: [
      { productSku: 'DISC-180X27-N', quantity: 1 },
      { productSku: 'HSP-T-S-BK',   quantity: 2 },
      { productSku: 'GL-20',        quantity: 1 },
      { productSku: 'GK-SS-ST',     quantity: 1 },
      { productSku: 'RV-S',         quantity: 4 },
    ],
  },
  {
    finishedProductSku: 'JSM-055N-20',
    components: [
      { productSku: 'DISC-200X27-N', quantity: 1 },
      { productSku: 'HSP-T-B-BK',   quantity: 2 },
      { productSku: 'GL-20',        quantity: 1 },
      { productSku: 'GK-SS-ST',     quantity: 1 },
      { productSku: 'RV-B',         quantity: 4 },
    ],
  },

  // ── Marmites ──────────────────────────────────────────────────
  {
    finishedProductSku: 'JSM-1805N',
    components: [
      { productSku: 'DISC-240X27-N', quantity: 1 },
      { productSku: 'HSP-T-B-BK',   quantity: 2 },
      { productSku: 'GL-24',        quantity: 1 },
      { productSku: 'GK-SS-ST',     quantity: 1 },
      { productSku: 'RV-B',         quantity: 4 },
    ],
  },
  {
    finishedProductSku: 'JSM-1805G',
    components: [
      { productSku: 'DISC-240X27-G', quantity: 1 },
      { productSku: 'HSP-T-B-GR',   quantity: 2 },
      { productSku: 'GL-24',        quantity: 1 },
      { productSku: 'GK-T-ST-GR',   quantity: 1 },
      { productSku: 'RV-B',         quantity: 4 },
    ],
  },
];
