/**
 * Sample content for Mend March. The Mending Commons, its cafés, every entry and every count are fictional.
 * The gallery and the leaderboard show last year's (2026) sample entries; 2027 has not started yet, which is said
 * plainly on the page instead of being dressed up as a countdown.
 */
export type Category = 'Textiles' | 'Ceramics' | 'Wood' | 'Electronics' | 'Bikes';
export type Motif = 'jumper' | 'jeans' | 'mug' | 'lamp' | 'tube' | 'chair' | 'tote' | 'teapot' | 'radio' | 'drawer' | 'wheel' | 'sock';

export const CATEGORIES: readonly Category[] = ['Textiles', 'Ceramics', 'Wood', 'Electronics', 'Bikes'];

export interface Entry { id: string; title: string; who: string; where: string; category: Category; motif: Motif; alt: string; before: string }

export const ENTRIES: readonly Entry[] = [
  { id: 'e1', title: 'Darned elbow, grey wool jumper', who: 'Ama', where: 'Canal Street café', category: 'Textiles', motif: 'jumper', alt: 'A jumper sleeve with a woven saffron darn over the elbow.', before: 'Before: the same sleeve with a hole worn through the elbow.' },
  { id: 'e2', title: 'Seam line on a blue mug', who: 'Rosalind', where: 'Northgate Library café', category: 'Ceramics', motif: 'mug', alt: 'A blue mug with a gold seam where the crack was filled.', before: 'Before: the blue mug with a dark crack running down its side.' },
  { id: 'e3', title: 'New flex for a desk lamp', who: 'Kofi', where: 'Canal Street café', category: 'Electronics', motif: 'lamp', alt: 'An angled desk lamp with a new saffron cable.', before: 'Before: the desk lamp with a frayed cable and bare wire showing.' },
  { id: 'e4', title: 'Patched knee, work jeans', who: 'Dov', where: 'At home', category: 'Textiles', motif: 'jeans', alt: 'A jeans leg with a square patch held on by white running stitches.', before: 'Before: the jeans with a tear across the knee.' },
  { id: 'e5', title: 'Two punctures, one inner tube', who: 'Bo', where: 'Riverside Works café', category: 'Bikes', motif: 'tube', alt: 'A bicycle inner tube with two saffron patches.', before: 'Before: the inner tube with two small punctures.' },
  { id: 'e6', title: 'Glued and clamped chair rung', who: 'Marguerite', where: 'At home', category: 'Wood', motif: 'chair', alt: 'A wooden chair with a saffron band around a re-glued rung.', before: 'Before: the chair with its lower rung snapped in two.' },
  { id: 'e7', title: 'Riveted teapot lid', who: 'Hal', where: 'Riverside Works café', category: 'Ceramics', motif: 'teapot', alt: 'A teapot whose cracked lid is held by a row of small rivets.', before: 'Before: the teapot lid with a crack and no rivets.' },
  { id: 'e8', title: 'Restitched tote strap', who: 'Yusuf', where: 'Northgate Library café', category: 'Textiles', motif: 'tote', alt: 'A canvas tote bag with its strap sewn back on in saffron thread.', before: 'Before: the tote bag with one end of the strap torn away.' },
  { id: 'e9', title: 'Replaced a radio’s tuning cord', who: 'Priya', where: 'St Anne’s Hall café', category: 'Electronics', motif: 'radio', alt: 'A small radio with a new saffron tuning cord visible behind the dial.', before: 'Before: the radio with its tuning cord snapped.' },
  { id: 'e10', title: 'Re-glued drawer corner', who: 'Femi', where: 'St Anne’s Hall café', category: 'Wood', motif: 'drawer', alt: 'A drawer with a saffron line along its re-glued corner joint.', before: 'Before: the drawer with its corner joint split open.' },
  { id: 'e11', title: 'Trued a buckled wheel', who: 'Lotte', where: 'Riverside Works café', category: 'Bikes', motif: 'wheel', alt: 'A bicycle wheel with straight spokes and a saffron rim.', before: 'Before: the bicycle wheel with a buckled rim.' },
  { id: 'e12', title: 'Heel darn, hand-knit sock', who: 'Sunniva', where: 'At home', category: 'Textiles', motif: 'sock', alt: 'A knitted sock with a saffron woven darn on the heel.', before: 'Before: the sock with a hole worn through the heel.' },
];

export const CAFES = ['Canal Street café', 'Northgate Library café', 'Riverside Works café', 'St Anne’s Hall café', 'Market Hall café', 'Allotment Shed café'] as const;

/** Items brought in per café, cumulative by week of March 2026 (sample data). */
export const WEEKLY: Record<(typeof CAFES)[number], readonly [number, number, number, number]> = {
  'Canal Street café': [22, 51, 78, 104],
  'Northgate Library café': [30, 49, 71, 97],
  'Riverside Works café': [14, 40, 69, 101],
  'St Anne’s Hall café': [19, 37, 52, 76],
  'Market Hall café': [25, 44, 58, 83],
  'Allotment Shed café': [8, 21, 39, 55],
};
