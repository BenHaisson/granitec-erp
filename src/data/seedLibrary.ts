import type { LibraryItem } from '@/types';

export const LIBRARY_ITEMS: Omit<LibraryItem, 'id'>[] = [
  // ── SOPs ──────────────────────────────────────────────────────
  {
    title: 'Disc Pressing SOP',
    category: 'sop',
    subcategory: 'Pressing',
    content: `1. PREPARATION
- Verify disc blank dimensions match work order (diameter, thickness).
- Inspect tooling for wear or damage. Replace if nicks visible.
- Apply light lubricant (lanolin) to blank and die.

2. PRESSING
- Load blank onto lower die, centred.
- Set press stroke per product spec (see machine settings card).
- Press at 250T standard. Increase to 280T for deep-draw items.
- Remove part and inspect for cracks, thinning, or wrinkles.

3. POST-PRESS
- Stack finished blanks rim-down. Max 30 per stack.
- Tag with batch number and date.
- Reject any piece with visible cracks — do not pass to coating.`,
    tags: ['pressing', 'disc', 'aluminium', 'production'],
    sort_order: 1,
  },
  {
    title: 'Coating Application SOP',
    category: 'sop',
    subcategory: 'Coating',
    content: `1. SURFACE PREP
- Sand blast all surfaces (see Sand Blasting Cabinet settings).
- Degrease immediately after blasting. Do not touch bare surfaces with bare hands.
- Dry in air for minimum 10 min before coating.

2. FIRST COAT (PRIMER)
- Stir granite paint thoroughly for 3 min before use.
- Spray at 2.5 bar, 25cm distance, single pass.
- Target thickness: 30–35μm wet.
- Flash off 5 min at room temperature.

3. SECOND COAT (TOPCOAT)
- Same settings as first coat.
- Target 30–40μm wet. Total target: 60–80μm cured.
- Check colour uniformity — no bare patches.

4. CURING
- Load into oven immediately. Max 15 min between spray and oven.
- Cure at 420°C for 25 min.
- Cool to below 60°C before stacking.
- Measure coating thickness on 1 piece per 20 (min 5 points).`,
    tags: ['coating', 'granite', 'spray', 'production'],
    sort_order: 2,
  },
  {
    title: 'Handle & Lid Assembly SOP',
    category: 'sop',
    subcategory: 'Assembly',
    content: `1. HANDLE RIVETING
- Verify handle type matches product BOM (see BOM Recipes page).
- Pre-drill rivet holes Ø 4.2mm if not already pressed in.
- Insert rivet through handle bracket and disc hole.
- Press at 3T (big rivet) or 2T (small rivet).
- Check both sides: rivet must be flush — no proud face, no cracks around hole.

2. LID KNOB (screw-type)
- Thread knob bolt through lid centre hole.
- Apply 1 drop Loctite 243 (medium strength) to threads.
- Torque to 1.5 Nm (glass knobs) or 2.0 Nm (SS knobs).
- Wait 15 min before handling lid.

3. FINAL INSPECTION
- Wiggle handle — no movement allowed.
- Inspect coating for chips at rivet area.
- Stack completed pieces nested, separated by foam pads.`,
    tags: ['assembly', 'handle', 'rivet', 'lid'],
    sort_order: 3,
  },

  // ── Guides ────────────────────────────────────────────────────
  {
    title: 'Raw Material Receiving Guide',
    category: 'guide',
    subcategory: 'Inventory',
    content: `When a delivery of raw materials arrives:

1. Check delivery note against purchase order — quantity and SKU must match.
2. Inspect packaging for damage. Photograph any damaged items before accepting.
3. For aluminium discs: measure 5 random samples per pallet (diameter, thickness). Reject batch if >2% out of tolerance.
4. For handles/accessories: check colour matches order. Count per box.
5. Enter quantities into Inventory → New Supply Receipt with the correct reference number.
6. Store per material type:
   - Discs: flat on pallets, max 3 pallets high, dry area.
   - Handles: in original boxes, labelled, on shelves.
   - Chemicals (coating): locked cabinet, ventilated, <25°C.`,
    tags: ['receiving', 'inventory', 'raw materials', 'quality'],
    sort_order: 4,
  },
  {
    title: 'Safety & PPE Guide',
    category: 'guide',
    subcategory: 'Safety',
    content: `MANDATORY PPE BY AREA:

Pressing area:
- Safety glasses (EN166)
- Steel-toe boots
- Hearing protection (>85dB)
- Cut-resistant gloves when handling blanks

Coating area:
- Full face respirator (P3 + organic vapour)
- Chemical splash goggles
- Nitrile gloves (double layer)
- Flame-retardant coverall

Oven/curing area:
- Heat-resistant gloves (min 300°C rating)
- Face shield
- Safety glasses underneath

Assembly area:
- Safety glasses
- Finger guards when feeding rivet press

EMERGENCY:
- Eye wash station: near degreasing tank and spray booth
- Fire extinguisher: CO2 type near oven and spray booth
- First aid kit: production office`,
    tags: ['safety', 'PPE', 'health', 'compliance'],
    sort_order: 5,
  },

  // ── Standards ─────────────────────────────────────────────────
  {
    title: 'Production Targets',
    category: 'standard',
    subcategory: 'Output',
    content: `DAILY SHIFT TARGETS (8h shift, 1 operator per station):

Pressing:
- Frypans (Ø 200–280mm): 350 pcs/shift
- Saucepots (deep draw): 200 pcs/shift
- Marmites (Ø 240–300mm): 180 pcs/shift

Coating (spray line):
- All categories: 600 pcs/shift (2 coats + oven)
- Reject rate target: <2%

Assembly:
- Frypans/Crepe pans (1 handle): 400 pcs/shift
- Saucepots (2 side handles + lid): 250 pcs/shift
- Marmites (2 side handles + lid): 200 pcs/shift

Packaging:
- Individual pcs: 500/shift
- Sets (3-pc, 5-pc): 150/shift

WEEKLY CAPACITY (5 shifts):
- Total output target: 2000–2500 pcs depending on product mix`,
    tags: ['targets', 'capacity', 'output', 'KPI'],
    sort_order: 6,
  },
  {
    title: 'Quality Acceptance Criteria',
    category: 'standard',
    subcategory: 'Quality',
    content: `COATING:
- Thickness: 60–80μm cured total (reject <55μm, rework >90μm)
- Adhesion: cross-hatch test — 0% peel allowed
- Colour: match reference swatch ±ΔE 2.0
- Defects allowed: 0 bare patches, 0 blisters. Max 2 micro-pinholes <0.5mm per piece (non-visible area only)

DIMENSIONS (post-pressing):
- Diameter: drawing spec ±0.5mm
- Wall thickness: drawing spec ±0.1mm
- Height: drawing spec ±1.0mm
- Base flatness: <0.5mm deviation over full diameter

ASSEMBLY:
- Handle torque: verified per assembly SOP
- Rivet: flush ±0.2mm. Zero cracks around hole.
- Lid fit: must sit level, gap <1mm all around

FINAL:
- No visible scratches on exterior coating
- Interior coating fully intact
- Handle alignment: ±3° from centreline`,
    tags: ['quality', 'inspection', 'tolerances', 'standards'],
    sort_order: 7,
  },

  // ── Specs ─────────────────────────────────────────────────────
  {
    title: 'Aluminium Disc Specifications',
    category: 'spec',
    subcategory: 'Materials',
    content: `ALLOY: 1050A / 3003 (food-grade aluminium)

STANDARD THICKNESSES:
- 2.0mm: light frypans (Ø 200–220mm)
- 2.7mm: standard frypans, saucepots, crepe pans (Ø 160–295mm)
- 3.0mm: heavy marmites, stockpots (Ø 240–305mm)
- 2.0mm Teflon-spec (TF): soft-coat surface finish, for PTFE coating line

DIAMETER RANGE STOCKED: 160mm – 305mm (see Inventory → Aluminium Disc)

SURFACE FINISH SUPPLIED:
- N (Black/Granite): standard mill finish — ready for blasting + granite coat
- G (Gray/Granite): same as N — colour difference from coating only
- TF (Teflon): smoother finish — do not sand blast before PTFE coating

STORAGE:
- Keep dry, away from salt and acids
- Stack horizontal on wooden pallets
- FIFO rotation — use oldest stock first`,
    tags: ['aluminium', 'disc', 'spec', 'material', 'raw material'],
    sort_order: 8,
  },
  {
    title: 'Granite Coating Paint Spec',
    category: 'spec',
    subcategory: 'Materials',
    content: `PRODUCT: Granite effect PTFE-free non-stick coating (water-based)

COLOURS: Black (N), Gray (G) — same base, different pigment batch

APPLICATION:
- Method: airless spray or HVLP gun
- Dilution: ready to use (do not add water — reduces adhesion)
- Viscosity: 40–50 sec (DIN4 cup at 20°C). Add max 2% water if too thick.
- Pot life: 8h after opening. Discard unused opened paint after shift.

CURE CYCLE:
- Temperature: 420°C (substrate temperature, not oven air)
- Time: 25 min minimum
- Ramp: preheat oven to full temperature before loading

STORAGE:
- Temperature: 5–25°C
- Shelf life: 12 months sealed, 3 months opened
- Keep from freezing — frozen paint is unusable, do not thaw and use

SAFETY: Contains surfactants. PPE as per Safety Guide. VOC compliant.`,
    tags: ['coating', 'paint', 'granite', 'spec', 'material'],
    sort_order: 9,
  },
];
