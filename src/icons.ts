export function createBackupIcons(React: typeof import('react')) {
  const h = React.createElement
  // Inline Lucide-style SVG icons — a standalone plugin bundle can't import
  // `react-icons` (it would pull in a second React), so we hand-roll the glyphs
  // the core UI shows via `react-icons/lu`. Same pattern as todo/music icons.
  const svg = (
    children: Array<ReturnType<typeof h>>,
    style?: Record<string, unknown>
  ): ReturnType<typeof h> =>
    h(
      'svg',
      {
        width: '1em',
        height: '1em',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { flex: 'none', ...style }
      },
      ...children
    )

  const IconCheck = svg([h('path', { d: 'M20 6 9 17l-5-5' })])
  const IconX = svg([h('path', { d: 'M18 6 6 18M6 6l12 12' })])
  const IconBan = svg([h('circle', { cx: 12, cy: 12, r: 10 }), h('path', { d: 'm4.9 4.9 14.2 14.2' })])
  const IconLoader = svg([h('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' })], {
    animation: 'notes-backup-spin 0.8s linear infinite'
  })
  const IconChevronDown = svg([h('path', { d: 'm6 9 6 6 6-6' })])
  const IconChevronLeft = svg([h('path', { d: 'm15 18-6-6 6-6' })])
  const IconChevronRight = svg([h('path', { d: 'm9 18 6-6-6-6' })])
  const IconPlus = svg([h('path', { d: 'M12 5v14M5 12h14' })])
  const IconHardDrive = svg([
    h('path', { d: 'M22 12H2' }),
    h('path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }),
    h('path', { d: 'M6 16h.01M10 16h.01' })
  ])
  const IconList = svg([h('path', { d: 'M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13' })])
  const IconHistory = svg([
    h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
    h('path', { d: 'M3 3v5h5' }),
    h('path', { d: 'M12 7v5l4 2' })
  ])
  const IconArchive = svg([
    h('rect', { width: 20, height: 5, x: 2, y: 3, rx: 1 }),
    h('path', { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' }),
    h('path', { d: 'M10 12h4' })
  ])
  const IconSliders = svg([
    h('path', { d: 'M20 7h-9M14 17H5' }),
    h('circle', { cx: 17, cy: 17, r: 3 }),
    h('circle', { cx: 7, cy: 7, r: 3 })
  ])
  const IconAlert = svg([
    h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }),
    h('path', { d: 'M12 9v4M12 17h.01' })
  ])

  return { IconCheck, IconX, IconBan, IconLoader, IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconHardDrive, IconList, IconHistory, IconArchive, IconSliders, IconAlert }
}

export type BackupIcons = ReturnType<typeof createBackupIcons>
