/** Shared color helpers used by SalesPage, WarehousePage, BOMPage */

export const COLOR_NAMES = ['Black', 'Gray', 'Cream', 'Blue', 'Red'] as const;
export type ColorName = typeof COLOR_NAMES[number];

export const COLOR_DOT: Record<ColorName, string> = {
  Black: 'bg-gray-900',
  Gray:  'bg-gray-400',
  Cream: 'bg-amber-100 border border-amber-300',
  Blue:  'bg-blue-500',
  Red:   'bg-red-500',
};

/** Splits a product name like "Marmite Black" into { base: "Marmite", color: "Black" } */
export function extractColor(name: string): { base: string; color: ColorName } | null {
  for (const color of COLOR_NAMES) {
    if (name.endsWith(color)) {
      const base = name.slice(0, name.length - color.length).replace(/[\s—\-]+$/, '').trim();
      return { base, color };
    }
  }
  return null;
}
