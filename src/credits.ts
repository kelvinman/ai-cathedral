// Who made AI Cathedral, for the Credits page (Settings → Save and credits → Credits).
// Fill in the names: empty sections are simply left out.

export const CREDITS: { heading: string; lines: string[] }[] = [
  // The friends the game was first made with, and where.
  { heading: 'Original concept', lines: ['Jon, Danny and Vic', 'Made at the Friends of Figma Los Angeles AI Impact Workshop'] },
  // Everything since.
  { heading: 'Design and development', lines: [] },
  {
    heading: 'Built with',
    lines: ['First prototyped in Figma Make', 'Claude (Anthropic): code, pixel art generation, writing', 'React, Vite and TypeScript'],
  },
  {
    heading: 'Fonts',
    lines: ['Pixelify Sans by Stefie Justprince', 'Silkscreen by Jason Kottke', 'VT323 by Peter Hull', 'All under the SIL Open Font License'],
  },
  { heading: 'Palette', lines: ['Endesga 32 by ENDESGA'] },
  { heading: 'Sound', lines: ['Original synthesized sound effects and generative organ music'] },
]
