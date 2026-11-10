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
  // FaRegFolderOpen from react-icons/fa6.
  const IconFolderOpen = h(
    'svg',
    { width: '1em', height: '1em', viewBox: '0 0 576 512', fill: 'currentColor', 'aria-hidden': true, style: { flex: 'none' } },
    h('path', { d: 'M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z' })
  )
  const IconSliders = svg([
    h('path', { d: 'M20 7h-9M14 17H5' }),
    h('circle', { cx: 17, cy: 17, r: 3 }),
    h('circle', { cx: 7, cy: 7, r: 3 })
  ])
  const IconAlert = svg([
    h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }),
    h('path', { d: 'M12 9v4M12 17h.01' })
  ])

  return { IconCheck, IconX, IconBan, IconLoader, IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconHardDrive, IconList, IconHistory, IconFolderOpen, IconSliders, IconAlert }
}

export type BackupIcons = ReturnType<typeof createBackupIcons>
