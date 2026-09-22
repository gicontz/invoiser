// Hand-sketched-style illustration for the login screen's right column —
// simple geometric primitives (arcs, rounded-cap lines, circles) rather
// than freehand bezier paths, with a slight rotation per shape and doubled
// stroke lines on a couple of elements to read as "doodled", not vector-
// perfect. Built from the app's own Ledgerline palette (DESIGN.md) so it
// stays on-brand rather than a generic stock illustration.
export default function AccountingDoodle() {
  return (
    <svg viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Doodle illustration of invoices, a calculator, and a growth chart">
      <circle cx="240" cy="240" r="220" fill="#E7E3FA" />

      {/* Invoice sheet */}
      <g transform="rotate(-6 180 220)">
        <rect x="90" y="90" width="180" height="240" rx="14" fill="#FFFFFF" stroke="#26263A" strokeWidth="3" />
        <line x1="115" y1="135" x2="245" y2="135" stroke="#26263A" strokeWidth="4" strokeLinecap="round" />
        <line x1="115" y1="160" x2="215" y2="160" stroke="#63607A" strokeWidth="3" strokeLinecap="round" />
        <line x1="115" y1="185" x2="245" y2="185" stroke="#63607A" strokeWidth="3" strokeLinecap="round" />
        <line x1="115" y1="205" x2="190" y2="205" stroke="#63607A" strokeWidth="3" strokeLinecap="round" />
        <line x1="115" y1="255" x2="245" y2="255" stroke="#E7E3FA" strokeWidth="10" strokeLinecap="round" />
        <line x1="115" y1="285" x2="200" y2="285" stroke="#26263A" strokeWidth="4" strokeLinecap="round" />
        <line x1="210" y1="285" x2="245" y2="285" stroke="#1F6E52" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* "PAID" stamp doodle */}
      <g transform="rotate(-18 330 150)">
        <circle cx="330" cy="150" r="38" stroke="#1F6E52" strokeWidth="3.5" fill="#EAF7F1" />
        <circle cx="330" cy="150" r="38" stroke="#1F6E52" strokeWidth="1.5" fill="none" opacity="0.5" />
        <text x="330" y="156" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="16" fill="#1F6E52">PAID</text>
      </g>

      {/* Coin stack */}
      <g transform="translate(310 260)">
        <ellipse cx="0" cy="40" rx="42" ry="14" fill="#FBEFD8" stroke="#26263A" strokeWidth="2.5" />
        <ellipse cx="0" cy="26" rx="42" ry="14" fill="#FBEFD8" stroke="#26263A" strokeWidth="2.5" />
        <ellipse cx="0" cy="12" rx="42" ry="14" fill="#FBEFD8" stroke="#26263A" strokeWidth="2.5" />
        <ellipse cx="0" cy="0" rx="42" ry="14" fill="#FDF4E3" stroke="#26263A" strokeWidth="2.5" />
        <text x="0" y="5" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="16" fill="#26263A">₱</text>
      </g>

      {/* Calculator */}
      <g transform="rotate(8 130 330)">
        <rect x="80" y="290" width="100" height="130" rx="12" fill="#1F3A5F" />
        <rect x="94" y="304" width="72" height="26" rx="6" fill="#DCE6F2" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={94 + col * 26}
              y={346 + row * 22}
              width="18"
              height="16"
              rx="4"
              fill={row === 2 && col === 2 ? '#F0B75B' : '#EFF3F8'}
            />
          )),
        )}
      </g>

      {/* Growth chart */}
      <g transform="translate(150 90)">
        <polyline points="0,70 35,45 70,55 105,15 140,25" fill="none" stroke="#1F3A5F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="0,70 35,45 70,55 105,15 140,25" fill="none" stroke="#1F3A5F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" transform="translate(1 -1)" />
        <circle cx="140" cy="25" r="5" fill="#1F3A5F" />
        <path d="M128 18 L142 12 L146 26 Z" fill="#1F3A5F" />
      </g>

      {/* Pencil crossing the invoice */}
      <g transform="rotate(38 210 340)">
        <rect x="195" y="250" width="14" height="110" rx="4" fill="#F0B75B" stroke="#26263A" strokeWidth="2.5" />
        <path d="M195 250 L209 250 L202 228 Z" fill="#EAD8B5" stroke="#26263A" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="195" y="352" width="14" height="14" fill="#E96A5C" stroke="#26263A" strokeWidth="2.5" />
      </g>

      {/* Loose sparkle accents */}
      <g stroke="#1F3A5F" strokeWidth="3" strokeLinecap="round">
        <path d="M80 200 L92 200 M86 194 L86 206" />
        <path d="M370 340 L382 340 M376 334 L376 346" opacity="0.6" />
      </g>
    </svg>
  )
}
