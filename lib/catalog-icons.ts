/**
 * Stroke icons for period and genre tiles. Each slug has its own mark;
 * unknown slugs fall back to a note so new forms never show a letter.
 */

export type IconMark =
  | { kind: "path"; d: string; fill?: boolean }
  | { kind: "circle"; cx: number; cy: number; r: number; fill?: boolean }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number; fill?: boolean }

function n(value: number): number {
  return Math.round(value * 100) / 100
}

/** Standing concert figure: round head and an open robe. */
function person(cx: number, headY: number, scale: number, hem = 20.6): IconMark[] {
  const r = n(1.55 * scale)
  const neck = n(headY + r - 0.2)
  const half = n(2.15 * scale)
  const shoulder = n(neck + 1.45 * scale)
  const x = n(cx)
  return [
    { kind: "circle", cx: x, cy: n(headY), r },
    {
      kind: "path",
      d: `M${n(x - half)} ${n(hem)}V${n(shoulder + 0.7)}C${n(x - half)} ${n(shoulder - 0.55)} ${n(x - 0.45 * scale)} ${n(neck + 0.08)} ${x} ${n(neck + 0.08)}C${n(x + 0.45 * scale)} ${n(neck + 0.08)} ${n(x + half)} ${n(shoulder - 0.55)} ${n(x + half)} ${n(shoulder + 0.7)}V${n(hem)}`,
    },
  ]
}

function ensemble(count: number, scale: number, headY = 6.2, hem = 20.6): IconMark[] {
  const left = 3.3
  const right = 20.7
  const step = count === 1 ? 0 : (right - left) / (count - 1)
  const marks: IconMark[] = []
  for (let index = 0; index < count; index++) {
    marks.push(...person(count === 1 ? 12 : left + step * index, headY, scale, hem))
  }
  return marks
}

function noteHead(cx: number, cy: number, r = 1.25): IconMark {
  return { kind: "circle", cx, cy, r, fill: true }
}

function book(x: number, y: number, width: number, height: number): IconMark[] {
  const mid = n(x + width / 2)
  const right = n(x + width)
  const bottom = n(y + height)
  const top = n(y)
  return [
    {
      kind: "path",
      d: `M${mid} ${top}L${n(x)} ${n(top + 1.15)}V${bottom}L${mid} ${n(bottom - 1.15)}L${right} ${bottom}V${n(top + 1.15)}Z`,
    },
    { kind: "path", d: `M${mid} ${top}V${n(bottom - 1.15)}` },
    { kind: "path", d: `M${n(x + 1.35)} ${n(top + height * 0.4)}H${n(mid - 1.05)}` },
    { kind: "path", d: `M${n(x + 1.35)} ${n(top + height * 0.64)}H${n(mid - 1.05)}` },
    { kind: "path", d: `M${n(mid + 1.05)} ${n(top + height * 0.4)}H${n(right - 1.35)}` },
    { kind: "path", d: `M${n(mid + 1.05)} ${n(top + height * 0.64)}H${n(right - 1.35)}` },
  ]
}

function mask(x: number, smile: boolean): IconMark[] {
  const width = 9.1
  const cx = n(x + width / 2)
  const right = n(x + width)
  return [
    {
      kind: "path",
      d: `M${n(x)} 8.4C${n(x)} 5.3 ${n(x + 1.7)} 3.5 ${cx} 3.5C${n(right - 1.7)} 3.5 ${right} 5.3 ${right} 8.4V12.6C${right} 15.8 ${n(right - 1.7)} 17.6 ${cx} 17.6C${n(x + 1.7)} 17.6 ${n(x)} 15.8 ${n(x)} 12.6Z`,
    },
    { kind: "circle", cx: n(cx - 1.55), cy: 9.3, r: 0.55, fill: true },
    { kind: "circle", cx: n(cx + 1.55), cy: 9.3, r: 0.55, fill: true },
    {
      kind: "path",
      d: smile
        ? `M${n(cx - 2)} 12.7Q${cx} 15.2 ${n(cx + 2)} 12.7`
        : `M${n(cx - 2)} 14.3Q${cx} 11.9 ${n(cx + 2)} 14.3`,
    },
  ]
}

/** Five round petals around a center. The caller draws the center and stem. */
function rose(cx: number, cy: number, radius: number): IconMark[] {
  const marks: IconMark[] = []
  const orbit = radius * 1.05
  for (let petal = 0; petal < 5; petal++) {
    const angle = ((-90 + petal * 72) * Math.PI) / 180
    marks.push({
      kind: "circle",
      cx: n(cx + Math.cos(angle) * orbit),
      cy: n(cy + Math.sin(angle) * orbit),
      r: radius,
    })
  }
  return marks
}

function keyboard(y: number): IconMark[] {
  const bottom = n(y + 8.6)
  return [
    { kind: "rect", x: 3, y, width: 18, height: 8.6, rx: 1 },
    { kind: "path", d: `M7.5 ${n(y)}V${bottom}` },
    { kind: "path", d: `M12 ${n(y)}V${bottom}` },
    { kind: "path", d: `M16.5 ${n(y)}V${bottom}` },
    { kind: "rect", x: 6.35, y, width: 2.15, height: 4.5, fill: true },
    { kind: "rect", x: 10.85, y, width: 2.15, height: 4.5, fill: true },
  ]
}

const NOTE: IconMark[] = [
  noteHead(9.2, 16.2, 2),
  { kind: "path", d: "M11.2 16.2V5.2" },
  { kind: "path", d: "M11.2 5.2c2.4 1.2 3.6 3.2.6 4.6" },
]

export const PERIOD_ICONS: Record<string, IconMark[]> = {
  medieval: [
    { kind: "path", d: "M7 20.5V11.2C7 8.2 9.1 5.4 12 3.6 14.9 5.4 17 8.2 17 11.2V20.5Z" },
    { kind: "path", d: "M12 20.5V8.4" },
    { kind: "path", d: "M9.3 20.5V12.4c0-1.6 1.2-2.7 2.7-2.7" },
    { kind: "path", d: "M14.7 20.5V12.4c0-1.6-1.2-2.7-2.7-2.7" },
  ],
  renaissance: [
    { kind: "path", d: "M7.7 15.8c0 3 1.9 5.2 4.3 5.2s4.3-2.2 4.3-5.2c0-2.3-1.5-4.1-3.3-4.9h-2c-1.8.8-3.3 2.6-3.3 4.9z" },
    { kind: "path", d: "M10.8 11.2V6.6L7.2 4.2 8.2 3.3 13.2 6.4V11.2" },
    { kind: "path", d: "M8.5 4.5 7.6 5.4" },
    { kind: "path", d: "M10.1 5.1 9.2 6" },
    { kind: "circle", cx: 12, cy: 15.8, r: 1.15 },
    { kind: "path", d: "M10.4 18.5h3.2" },
  ],
  baroque: [
    { kind: "path", d: "M17.4 8.6c.6-3.6-3.2-5.8-6-3.6C8.8 7.2 9.6 11 13 10.8c2.2-.1 3-2 1.6-2.8" },
    { kind: "path", d: "M11.4 5C7.6 6.6 5.4 10.8 7.2 15c1.4 3.2 5 4.8 8.2 3.6 1.7-.6 2.5-2.2 1.4-3.2" },
    { kind: "path", d: "M8.6 16.4c-1.2 1.4-.6 2.8.8 3.2" },
  ],
  classical: [
    { kind: "path", d: "M8.2 5.2h7.6" },
    { kind: "path", d: "M9 5.2v1.7h6V5.2" },
    { kind: "path", d: "M6.6 6.9h10.8" },
    { kind: "path", d: "M7.4 8.4h9.2" },
    { kind: "path", d: "M8.5 8.4v9.8" },
    { kind: "path", d: "M15.5 8.4v9.8" },
    { kind: "path", d: "M12 8.4v9.8" },
    { kind: "path", d: "M7.2 18.2h9.6" },
    { kind: "path", d: "M6.1 20.2h11.8" },
  ],
  romantic: [
    ...rose(12, 8.8, 2.15),
    { kind: "circle", cx: 12, cy: 8.8, r: 1, fill: true },
    { kind: "path", d: "M12 13.4V20.7" },
    { kind: "path", d: "M12 16.8C9.7 16 8.3 17.2 8.8 18.6" },
  ],
  modern: [
    { kind: "rect", x: 3.2, y: 3.2, width: 9.4, height: 9.4 },
    { kind: "circle", cx: 15.8, cy: 7.8, r: 4.35 },
    { kind: "path", d: "M7.6 20.8 13.2 12.2 20.6 20.8Z" },
  ],
}

export const GENRE_ICONS: Record<string, IconMark[]> = {
  symphony: [
    { kind: "path", d: "M3.6 11.6c2.8-4.2 13.9-4.2 16.8 0" },
    { kind: "circle", cx: 5.1, cy: 10.7, r: 1.05 },
    { kind: "circle", cx: 8.5, cy: 8.5, r: 1.05 },
    { kind: "circle", cx: 12, cy: 7.7, r: 1.05 },
    { kind: "circle", cx: 15.5, cy: 8.5, r: 1.05 },
    { kind: "circle", cx: 18.9, cy: 10.7, r: 1.05 },
    ...person(12, 14.8, 0.78, 20.8),
    { kind: "path", d: "M13.3 17.2 18.2 13.4" },
  ],
  concerto: [
    { kind: "circle", cx: 5.2, cy: 7.6, r: 1.15 },
    { kind: "path", d: "M3.8 10.2q1.4-1.1 2.8 0" },
    { kind: "circle", cx: 12, cy: 6.2, r: 1.15 },
    { kind: "path", d: "M10.6 8.8q1.4-1.1 2.8 0" },
    { kind: "circle", cx: 18.8, cy: 7.6, r: 1.15 },
    { kind: "path", d: "M17.4 10.2q1.4-1.1 2.8 0" },
    ...person(12, 13.2, 1.05, 20.8),
  ],
  opera: [...mask(1.7, true), ...mask(13.2, false)],
  sonata: [
    { kind: "path", d: "M2.8 13.2h10.6c2.8 0 5.2-1.4 7.4-3l.6 1.5c-2.3 1.6-4.8 3.1-8 3.1H2.8Z" },
    { kind: "path", d: "M2.8 14.8H13v2.2H2.8Z" },
    { kind: "path", d: "M5.1 17V20.6" },
    { kind: "path", d: "M11.2 17V20.6" },
    { kind: "path", d: "M5.1 19.4h6.1" },
  ],
  quartet: ensemble(4, 0.84),
  quintet: ensemble(5, 0.7),
  sextet: ensemble(6, 0.58),
  trio: ensemble(3, 1),
  chamber: [
    ...person(6.6, 4.8, 0.62, 11.6),
    ...person(17.4, 4.8, 0.62, 11.6),
    ...person(6.6, 13.4, 0.62, 20.6),
    ...person(17.4, 13.4, 0.62, 20.6),
    { kind: "path", d: "M8.7 8.5h6.6" },
    { kind: "path", d: "M9.5 8.5 12 10.3 14.5 8.5" },
    { kind: "path", d: "M12 10.3v5.2" },
    { kind: "path", d: "M10.3 17.2 12 15.5 13.7 17.2" },
  ],
  choral: [
    ...ensemble(3, 0.72, 4.6, 13.2),
    { kind: "path", d: "M4.6 15.4h14.8" },
    { kind: "path", d: "M5.6 15.4v5h12.8v-5" },
    { kind: "path", d: "M12 15.4v5" },
    { kind: "path", d: "M7 17.2h3.1" },
    { kind: "path", d: "M7 18.7h3.1" },
    { kind: "path", d: "M13.9 17.2h3.1" },
    { kind: "path", d: "M13.9 18.7h3.1" },
  ],
  piano: [
    { kind: "path", d: "M3.4 15.2 7.6 7.2h8.8l4.2 8" },
    { kind: "path", d: "M3.2 15.2h17.6v2.8c0 .7-.5 1.2-1.2 1.2H4.4c-.7 0-1.2-.5-1.2-1.2Z" },
    { kind: "path", d: "M6.6 15.2v2.8" },
    { kind: "path", d: "M9.6 15.2v2.8" },
    { kind: "path", d: "M12.6 15.2v2.8" },
    { kind: "path", d: "M15.6 15.2v2.8" },
    { kind: "rect", x: 6.1, y: 15.2, width: 1.5, height: 1.6, fill: true },
    { kind: "rect", x: 9.1, y: 15.2, width: 1.5, height: 1.6, fill: true },
    { kind: "rect", x: 12.1, y: 15.2, width: 1.5, height: 1.6, fill: true },
    { kind: "path", d: "M6.2 19.2v1.6" },
    { kind: "path", d: "M17.8 19.2v1.6" },
  ],
  harpsichord: [
    { kind: "path", d: "M2.6 9.2h18.8v5.4H2.6Z" },
    { kind: "path", d: "M4.4 9.2V6.2" },
    { kind: "path", d: "M8.2 9.2V5" },
    { kind: "path", d: "M12 9.2V4.2" },
    { kind: "path", d: "M15.8 9.2V5.4" },
    { kind: "path", d: "M19.2 9.2V7" },
    { kind: "rect", x: 3.6, y: 14.6, width: 12.2, height: 1.8, rx: 0.2 },
    { kind: "path", d: "M5.6 16.4v4" },
    { kind: "path", d: "M13.4 16.4v4" },
    { kind: "path", d: "M5.6 18.6h7.8" },
  ],
  organ: [
    { kind: "rect", x: 4.2, y: 3.2, width: 2.4, height: 11.2, rx: 1.2 },
    { kind: "rect", x: 8.2, y: 1.8, width: 2.4, height: 12.6, rx: 1.2 },
    { kind: "rect", x: 12.2, y: 4.4, width: 2.4, height: 10, rx: 1.2 },
    { kind: "rect", x: 16.2, y: 6.2, width: 2.4, height: 8.2, rx: 1.2 },
    { kind: "path", d: "M3.2 14.4h17.6v3.2c0 .6-.5 1.1-1.1 1.1H4.3c-.6 0-1.1-.5-1.1-1.1Z" },
    { kind: "path", d: "M6.4 14.4v3.2" },
    { kind: "path", d: "M10.2 14.4v3.2" },
    { kind: "path", d: "M14 14.4v3.2" },
    { kind: "rect", x: 7.6, y: 14.4, width: 1.3, height: 1.7, fill: true },
    { kind: "rect", x: 11.4, y: 14.4, width: 1.3, height: 1.7, fill: true },
    { kind: "path", d: "M7.2 18.7v1.8" },
    { kind: "path", d: "M16.8 18.7v1.8" },
  ],
  stage: [
    { kind: "path", d: "M3.4 20.4V9.2C3.4 5.4 7.2 3.2 12 3.2s8.6 2.2 8.6 6v11.2" },
    { kind: "path", d: "M3.4 20.4h17.2" },
    { kind: "path", d: "M6.6 20.4V11.2c0-2 2.2-3.4 5.4-3.4s5.4 1.4 5.4 3.4v9.2" },
    { kind: "path", d: "M8.4 13.6c1.2 1.4 5.8 1.4 7.2 0" },
  ],
  orchestral: [
    { kind: "path", d: "M4 9.2c2.4-3.2 13.6-3.2 16 0" },
    { kind: "rect", x: 5.2, y: 9.6, width: 2.2, height: 3.2, rx: 0.3 },
    { kind: "rect", x: 10.9, y: 7.4, width: 2.2, height: 3.2, rx: 0.3 },
    { kind: "rect", x: 16.6, y: 9.6, width: 2.2, height: 3.2, rx: 0.3 },
    { kind: "path", d: "M10.2 16.2h3.6v4.4h-3.6Z" },
    { kind: "path", d: "M8.4 20.6h7.2" },
  ],
  keyboard: [
    { kind: "path", d: "M7.2 3.8C5.2 4.2 4.4 5.6 5.2 6.8" },
    { kind: "path", d: "M5.6 6.6h13.2" },
    { kind: "rect", x: 3.6, y: 7.4, width: 16.8, height: 4.4, rx: 0.7 },
    { kind: "rect", x: 5.6, y: 7.4, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 8.8, y: 7.4, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 12, y: 7.4, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 15.2, y: 7.4, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 3.6, y: 13.2, width: 16.8, height: 4.4, rx: 0.7 },
    { kind: "rect", x: 7.2, y: 13.2, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 10.4, y: 13.2, width: 1.35, height: 2.3, fill: true },
    { kind: "rect", x: 13.6, y: 13.2, width: 1.35, height: 2.3, fill: true },
    { kind: "path", d: "M6.4 17.6v2.8" },
    { kind: "path", d: "M17.6 17.6v2.8" },
  ],
  ballet: [
    { kind: "circle", cx: 10.4, cy: 4.2, r: 1.45 },
    { kind: "path", d: "M10.4 5.7 12.4 12" },
    { kind: "path", d: "M11 8.2C13.4 6.4 16.4 5.4 18.6 6.6" },
    { kind: "path", d: "M10.8 8.4C8.6 9.6 6.6 11.4 5.4 13.4" },
    { kind: "path", d: "M8.2 12.2c1.6 1.6 4 1.8 7.2 0" },
    { kind: "path", d: "M12.4 12.2 11 20.6" },
    { kind: "path", d: "M12.4 12.2C14.6 12.8 17.2 13.6 19.4 15.2" },
  ],
  cantata: [
    ...book(2.8, 10.4, 15.2, 8.4),
    noteHead(18.6, 6.2, 1.3),
    { kind: "path", d: "M19.9 6.2V2.6" },
    { kind: "path", d: "M19.9 2.6c1.4.8 2 1.8.2 2.6" },
  ],
  oratorio: [
    ...book(4, 3.6, 16, 8.4),
    { kind: "path", d: "M12 12.2V18.6" },
    { kind: "path", d: "M8.4 20.4h7.2" },
    { kind: "path", d: "M10.6 18.6h2.8V20.4" },
  ],
  mass: [
    { kind: "path", d: "M12 3.2v15.2" },
    { kind: "path", d: "M6.3 8.2h11.4" },
    { kind: "path", d: "M10.2 18.4h3.6V20.6H10.2Z" },
  ],
  motet: [
    { kind: "path", d: "M3.5 8.2c3.2 0 3.2 7.6 8.5 7.6s5.3-7.6 8.5-7.6" },
    { kind: "path", d: "M3.5 15.8c3.2 0 3.2-7.6 8.5-7.6s5.3 7.6 8.5 7.6" },
  ],
  requiem: [
    { kind: "path", d: "M12 3.3c-1.6 2.2-2.4 3.8-1.8 5.4.4 1 1.1 1.6 1.8 1.6s1.4-.6 1.8-1.6c.6-1.6-.2-3.2-1.8-5.4z" },
    { kind: "path", d: "M12 6.4c-.5.8-.6 1.6 0 2.4" },
    { kind: "rect", x: 10.3, y: 11.2, width: 3.4, height: 7.6, rx: 0.3 },
    { kind: "path", d: "M8.7 18.8h6.6v1.8H8.7Z" },
  ],
  nocturne: [
    { kind: "path", d: "M15.2 4.2C10.4 5.6 7.2 9.2 7.2 13.4 7.2 17.6 10.4 20.6 15 20.8 10.8 19.2 8.6 16.4 8.6 13.2 8.6 9.4 11.4 6.4 15.2 4.2Z" },
    { kind: "path", d: "M18.4 6.4v2.8" },
    { kind: "path", d: "M17 7.8h2.8" },
  ],
  etude: keyboard(8.2),
  mazurka: [
    { kind: "circle", cx: 12, cy: 4.2, r: 1.5 },
    { kind: "path", d: "M12 5.8v6" },
    { kind: "path", d: "M7.4 8.6h9.2" },
    { kind: "path", d: "M12 11.8 9.2 20.6" },
    { kind: "path", d: "M12 11.8 16.4 13.6 15.2 10.4" },
    { kind: "path", d: "M15.2 10.4 17.4 9.6" },
  ],
  waltz: [
    { kind: "circle", cx: 9.6, cy: 5.6, r: 1.45 },
    { kind: "circle", cx: 14.2, cy: 5.6, r: 1.45 },
    { kind: "path", d: "M7.2 20.6C7.2 14.8 9 11.4 12 11.4c3 0 4.8 3.4 4.8 9.2" },
    { kind: "path", d: "M6.2 17.6c2.4-2.6 9.2-2.6 11.6 0" },
    { kind: "path", d: "M8.2 14.6c1.4-1.4 6.2-1.4 7.6 0" },
  ],
  polonaise: [
    { kind: "path", d: "M4.6 15.2 6.8 7.2 9.6 11.4 12 4.8 14.4 11.4 17.2 7.2 19.4 15.2Z" },
    { kind: "path", d: "M5.2 15.2h13.6v3.2H5.2Z" },
    { kind: "circle", cx: 8.6, cy: 16.8, r: 0.55, fill: true },
    { kind: "circle", cx: 12, cy: 16.8, r: 0.55, fill: true },
    { kind: "circle", cx: 15.4, cy: 16.8, r: 0.55, fill: true },
  ],
  impromptu: [
    { kind: "path", d: "M17.2 3.8 7.4 15.2 5.2 19.2 9 17.4 18.8 6c.8-1-.2-2.6-1.6-2.2z" },
    { kind: "path", d: "M15.2 6.2 8.8 14.2" },
    { kind: "path", d: "M5.4 8.2v2.6" },
    { kind: "path", d: "M4.1 9.5h2.6" },
  ],
  ballade: [
    { kind: "path", d: "M7.2 6.2h9.2c1.8 0 2.8 1 2.8 2.6v7.2c0 1.6-1 2.6-2.8 2.6H8.4" },
    { kind: "path", d: "M7.2 6.2c0-1.6 1.3-2.2 2.4-1.2" },
    { kind: "path", d: "M8.4 18.6c-1.6 0-2.6.8-2 2" },
    { kind: "path", d: "M8.4 6.2v12.4" },
    { kind: "path", d: "M10.4 9.4h6.4" },
    { kind: "path", d: "M10.4 12.4h6.4" },
    { kind: "path", d: "M10.4 15.4h4.2" },
  ],
  rhapsody: [
    noteHead(6.2, 17.2, 1.35),
    noteHead(11.4, 12.2, 1.35),
    noteHead(16.2, 7.6, 1.35),
    { kind: "path", d: "M7.55 17.2V11.4" },
    { kind: "path", d: "M12.75 12.2V6.6" },
    { kind: "path", d: "M17.55 7.6V3.4" },
    { kind: "path", d: "M7.55 11.4C10 10.2 12.2 7.4 17.55 3.4" },
  ],
  suite: [
    { kind: "path", d: "M5.2 3.6C3.4 4 3.4 7.6 5.2 8.4 3.4 9.2 3.6 11.2 4.6 12 3.6 12.8 3.4 14.8 5.2 15.6 3.4 16.4 3.4 20 5.2 20.4" },
    { kind: "rect", x: 7.2, y: 3.4, width: 13.4, height: 3.2, rx: 1 },
    { kind: "rect", x: 7.2, y: 8.1, width: 13.4, height: 3.2, rx: 1 },
    { kind: "rect", x: 7.2, y: 12.8, width: 13.4, height: 3.2, rx: 1 },
    { kind: "rect", x: 7.2, y: 17.5, width: 13.4, height: 3.2, rx: 1 },
  ],
  overture: [
    { kind: "path", d: "M3.2 4.2H10c-2.6 2.4-2.6 6.2 0 8.6-2.4 1.4-2.4 4.4 0 6.4H3.2Z" },
    { kind: "path", d: "M20.8 4.2H14c2.6 2.4 2.6 6.2 0 8.6 2.4 1.4 2.4 4.4 0 6.4h6.8Z" },
    { kind: "path", d: "M9.2 20.8h5.6" },
  ],
  prelude: [
    { kind: "path", d: "M5 4.4v15.4" },
    { kind: "path", d: "M7.2 4.4v15.4" },
    noteHead(11, 15.4),
    noteHead(15, 11.2),
    noteHead(19, 7.2),
    { kind: "path", d: "M12.25 15.4V9.6" },
    { kind: "path", d: "M16.25 11.2V5.6" },
    { kind: "path", d: "M20.25 7.2V3.4" },
  ],
  fugue: [
    noteHead(4, 7.4, 1.15),
    { kind: "path", d: "M5.2 7.4c3.2 0 3.4-2 6.4.2 2.4 1.6 3.2.4 5.8.4" },
    noteHead(7.6, 12.2, 1.15),
    { kind: "path", d: "M8.8 12.2c3 0 3.2-2 6 .2 2.2 1.6 3 .6 4.8.4" },
    noteHead(11.2, 17, 1.15),
    { kind: "path", d: "M12.4 17c2.6 0 2.8-1.8 5.2.2 1.4 1.2 2 .4 2.6.2" },
  ],
  toccata: [
    { kind: "path", d: "M3.2 8.2 6.4 4.4 9.6 8.2 12.8 4.4 16 8.2 19.2 4.4 21.2 7" },
    ...keyboard(12.2),
  ],
  partita: [
    { kind: "path", d: "M8 4.6h8" },
    { kind: "path", d: "M12 4.6V8" },
    { kind: "rect", x: 3.2, y: 8, width: 17.6, height: 11.4, rx: 1 },
    { kind: "path", d: "M3.2 13.6h17.6" },
    { kind: "rect", x: 6.1, y: 8, width: 1.45, height: 2.8, fill: true },
    { kind: "rect", x: 10.5, y: 8, width: 1.45, height: 2.8, fill: true },
    { kind: "rect", x: 15.4, y: 8, width: 1.45, height: 2.8, fill: true },
    { kind: "rect", x: 6.1, y: 13.6, width: 1.45, height: 2.8, fill: true },
    { kind: "rect", x: 10.5, y: 13.6, width: 1.45, height: 2.8, fill: true },
    { kind: "rect", x: 15.4, y: 13.6, width: 1.45, height: 2.8, fill: true },
  ],
  fantasia: [
    { kind: "path", d: "M12 13.2c2.1 0 3.4-1.4 3.4-3.1 0-2-1.7-3.2-3.5-2.8-2.1.4-3.3 2.2-2.7 4 .7 2 3 3.2 5.3 2.5 2.6-.8 3.8-3.4 3-5.8-.7-2.2-3-3.6-5.2-2.8" },
    { kind: "path", d: "M12.2 3.2v2.4" },
    { kind: "path", d: "M11 4.4h2.4" },
  ],
  variations: [
    { kind: "rect", x: 2.8, y: 4.2, width: 5.2, height: 15.6, rx: 1.1 },
    { kind: "path", d: "M4 12h2.8" },
    { kind: "rect", x: 9.4, y: 4.2, width: 5.2, height: 15.6, rx: 1.1 },
    { kind: "path", d: "M10.6 9.4h2.8" },
    { kind: "path", d: "M10.6 12h2.8" },
    { kind: "path", d: "M10.6 14.6h2.8" },
    { kind: "rect", x: 16, y: 4.2, width: 5.2, height: 15.6, rx: 1.1 },
    { kind: "path", d: "M17.2 8.2h2.8" },
    { kind: "path", d: "M17.2 10.6h2.8" },
    { kind: "path", d: "M17.2 13h2.8" },
    { kind: "path", d: "M17.2 15.4h2.8" },
  ],
  serenade: [
    { kind: "path", d: "M9.2 16.8c0 2.2 1.2 3.8 2.8 3.8s2.8-1.6 2.8-3.8c0-1.4-.8-2.4-1.8-2.8.8-.4 1.4-1.2 1.4-2.1 0-1.4-1.1-2.4-2.4-2.4s-2.4 1-2.4 2.4c0 .9.6 1.7 1.4 2.1-1 .4-1.8 1.4-1.8 2.8z" },
    { kind: "path", d: "M12 9.5V4.4" },
    { kind: "path", d: "M10.2 4.4h3.6" },
    { kind: "circle", cx: 12, cy: 15.6, r: 0.8 },
    { kind: "path", d: "M17.6 6.2c-1.3.6-2 1.8-1.6 2.8.8-.2 1.8-.4 2.4 0 .2-1.2-.1-2.2-.8-2.8z" },
  ],
  divertimento: [
    noteHead(6.4, 14.6, 1.35),
    noteHead(12, 16.6, 1.35),
    noteHead(17.6, 13.4, 1.35),
    { kind: "path", d: "M7.75 14.6C8.6 9.6 15.2 8.8 18.9 13.2" },
    { kind: "path", d: "M12 5.2v2.4" },
    { kind: "path", d: "M10.8 6.4h2.4" },
    { kind: "path", d: "M18.4 6.6v2" },
    { kind: "path", d: "M17.4 7.6h2" },
  ],
  scherzo: [
    noteHead(8.2, 15.8, 1.7),
    { kind: "path", d: "M9.9 15.8V6.4" },
    { kind: "path", d: "M9.9 6.4c2.2 1.1 3.2 2.8.4 4" },
    { kind: "path", d: "M13.2 16.4c1.4-2.2 3.6-2.4 5.2 0" },
    { kind: "path", d: "M16.6 14.8 18.4 16.6 16.4 17.6" },
  ],
  song: [
    ...person(8.2, 6.4, 1, 20.6),
    noteHead(16.8, 14.8, 1.55),
    { kind: "path", d: "M18.35 14.8V7.2" },
    { kind: "path", d: "M18.35 7.2c2 1.1 2.8 2.8.2 4" },
  ],
  "symphonic-poem": [
    { kind: "path", d: "M6.2 4.2h11.6v15.6H6.2Z" },
    { kind: "path", d: "M8.4 7.4h7.2" },
    { kind: "path", d: "M8.4 10h7.2" },
    { kind: "path", d: "M8.4 12.6h4.6" },
    noteHead(15.2, 16.2, 1.15),
    { kind: "path", d: "M16.35 16.2V13.2" },
  ],
  passion: [
    { kind: "path", d: "M12 3.4v17.2" },
    { kind: "path", d: "M7.2 8.6h9.6" },
    { kind: "circle", cx: 12, cy: 12.4, r: 2.15 },
  ],
  "stabat-mater": [
    { kind: "path", d: "M12 3.6 7.2 20.4h9.6Z" },
    { kind: "path", d: "M9.4 14.2h5.2" },
    { kind: "path", d: "M12 3.6V20.4" },
  ],
  magnificat: [
    { kind: "path", d: "M4.2 16.4c2.2-6.4 13.4-6.4 15.6 0" },
    { kind: "path", d: "M8.2 16.4V8.8" },
    { kind: "path", d: "M12 16.4V6.2" },
    { kind: "path", d: "M15.8 16.4V9.4" },
    { kind: "path", d: "M6.4 19.6h11.2" },
  ],
  "te-deum": [
    { kind: "path", d: "M5.2 6.2h13.6v12.4H5.2Z" },
    { kind: "path", d: "M5.2 10.2h13.6" },
    { kind: "path", d: "M9.4 6.2v12.4" },
    { kind: "path", d: "M14.6 6.2v12.4" },
  ],
  septet: ensemble(7, 0.5, 7.4, 20.4),
  octet: ensemble(8, 0.44, 8.2, 20.6),
  nonet: ensemble(9, 0.39, 8.8, 20.6),
  duo: ensemble(2, 1.15, 6.4, 20.6),
}

const FALLBACK: IconMark[] = NOTE

export function iconKey(marks: IconMark[]): string {
  return JSON.stringify(marks)
}

export function periodIcon(slug: string): IconMark[] {
  return PERIOD_ICONS[slug] ?? FALLBACK
}

export function genreIcon(slug: string): IconMark[] {
  return GENRE_ICONS[slug] ?? FALLBACK
}
