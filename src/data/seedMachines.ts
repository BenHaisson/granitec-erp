import type { Machine } from '@/types';

export const MACHINES: Omit<Machine, 'id'>[] = [
  // ── Pressing ─────────────────────────────────────────────────
  {
    name: 'Hydraulic Press',
    type: 'machine',
    category: 'Pressing',
    capacity: '200–400 tonnes',
    settings: 'Pressure: 250T standard · Stroke: 180mm · Cycle: 8–12 sec',
    notes: 'Used for disc blanking and deep-drawing. Change tooling per diameter.',
    sort_order: 1,
  },
  {
    name: 'CNC Spinning Lathe',
    type: 'machine',
    category: 'Pressing',
    capacity: 'Ø 100–400mm',
    settings: 'RPM: 800–1200 · Feed: 0.3mm/rev · Depth: 0.5mm max per pass',
    notes: 'Aluminium disc spinning for bowl/pot profiles. Coolant required.',
    sort_order: 2,
  },

  // ── Surface Preparation ───────────────────────────────────────
  {
    name: 'Sand Blasting Cabinet',
    type: 'machine',
    category: 'Surface Prep',
    capacity: 'Up to Ø 350mm',
    settings: 'Pressure: 4–6 bar · Media: aluminium oxide 80 grit · Time: 30–60 sec',
    notes: 'Clean all surfaces before coating. Inspect for pitting after blasting.',
    sort_order: 3,
  },
  {
    name: 'Degreasing Tank',
    type: 'machine',
    category: 'Surface Prep',
    capacity: '200L bath',
    settings: 'Temperature: 60°C · Immersion: 2–3 min · Change solution every 500 pcs',
    notes: 'Alkaline degreaser. Rinse with clean water immediately after.',
    sort_order: 4,
  },

  // ── Coating ───────────────────────────────────────────────────
  {
    name: 'Spray Coating Robot',
    type: 'machine',
    category: 'Coating',
    capacity: '200–400 pcs/hr',
    settings: 'Pressure: 2.5 bar · Distance: 25cm · Thickness: 30–40μm per coat · 2 coats',
    notes: 'Granite coating application. Stir paint every 30 min. Clean gun after shift.',
    sort_order: 5,
  },
  {
    name: 'Curing Oven',
    type: 'machine',
    category: 'Coating',
    capacity: '3 shelves · 60 pcs per shelf',
    settings: 'Temperature: 420°C · Cure time: 25 min · Cool-down: 15 min before handling',
    notes: 'Do not open door during cure cycle. Check temperature log every batch.',
    sort_order: 6,
  },

  // ── Assembly ──────────────────────────────────────────────────
  {
    name: 'Riveting Press',
    type: 'machine',
    category: 'Assembly',
    capacity: '5 tonnes',
    settings: 'Force: 3T for big rivets · 2T for small rivets · Pre-drill: Ø 4.2mm',
    notes: 'Handle attachment. Check rivet flush after pressing — no proud faces.',
    sort_order: 7,
  },
  {
    name: 'Lid Knob Screwdriver (Pneumatic)',
    type: 'tool',
    category: 'Assembly',
    capacity: 'M4–M6 screws',
    settings: 'Torque: 1.5 Nm for glass knobs · 2.0 Nm for SS knobs',
    notes: 'Do not overtighten — cracks glass lid. Verify torque wrench calibration weekly.',
    sort_order: 8,
  },

  // ── Quality Control ───────────────────────────────────────────
  {
    name: 'Coating Thickness Gauge',
    type: 'tool',
    category: 'Quality Control',
    capacity: '0–2000μm range',
    settings: 'Target: 60–80μm total (2 coats). Reject below 55μm.',
    notes: 'Calibrate on bare aluminium before each batch. Measure 5 points per piece.',
    sort_order: 9,
  },
  {
    name: 'Hardness Tester (Shore D)',
    type: 'tool',
    category: 'Quality Control',
    capacity: 'Shore D scale',
    settings: 'Minimum: Shore D 60 after cure. Test at room temperature only.',
    notes: 'Apply steady pressure for 15 sec. Record result on batch card.',
    sort_order: 10,
  },
  {
    name: 'Digital Calliper',
    type: 'tool',
    category: 'Quality Control',
    capacity: '0–200mm · ±0.02mm',
    settings: 'Zero before each use. Calibrate weekly against gauge block.',
    notes: 'Check disc diameter, wall thickness, and height per drawing spec.',
    sort_order: 11,
  },
];
