/* Synapse Reborn Apex brand mark as inline SVG. Ink follows currentColor so the
   logo stays legible on any theme; the S/R interior uses --logo-inner
   (defaults to the window ground colour). Proportions are fixed. */
(function () {
  'use strict';

  const S_PATH = 'M85 22C75 12 55 8 40 11C22 15 13 28 14 42C15 55 28 59 45 62C62 65 85 69 91 85C95 101 75 111 56 108C49 107 44 105 40 102';
  const TAIL = 'M42 103.5C39 101.5 36.5 99.5 34 97.5';
  const TAIL_IN = 'M42 103.5C39 101.5 36.5 99.5 35.2 98.4';
  const R_PATH = 'M1.5 15.5V1.5H7.2a4.2 4.2 0 0 1 0 8.4H1.5M7.6 9.9L12.4 15.5';
  const TRIANGLES = [
    ['54,3 40,20 69,20', '#b9b9b9'], ['21,14 7,39 39,33', '#8f8f8f'], ['30,26 27,35 39,33', '#7a7a7a'],
    ['97,28 88,35 110,43', '#a9a9a9'], ['106,51 92,60 115,69', '#545454'], ['2,70 14,106 33,80', '#454545'],
    ['5,109 21,129 29,102', '#666666'], ['44,116 28,125 55,139', '#353535'], ['106,82 97,102 115,111', '#c4c4c4'],
    ['88,112 77,130 104,140', '#6a6a6a'],
  ];

  const inner = 'var(--logo-inner, var(--bg-0, #0a0a0a))';

  function sBody(ink, w, wi, inn = inner) {
    return `<g fill="none" stroke-linejoin="round">
      <path d="${S_PATH}" stroke="${ink}" stroke-width="${w}" stroke-linecap="round"/>
      <path d="${TAIL}" stroke="${ink}" stroke-width="${w}" stroke-linecap="butt"/>
      <path d="${S_PATH}" stroke="${inn}" stroke-width="${wi}" stroke-linecap="round"/>
      <path d="${TAIL_IN}" stroke="${inn}" stroke-width="${wi}" stroke-linecap="butt"/>
    </g>`;
  }
  function rGlyph(ink, inn = inner) {
    return `<g transform="translate(89.5 8.5)" fill="none" stroke-linejoin="round" stroke-linecap="round">
      <path d="${R_PATH}" stroke="${ink}" stroke-width="4"/>
      <path d="${R_PATH}" stroke="${inn}" stroke-width="1.5"/>
    </g>`;
  }
  function triangles(opacity) {
    return `<g${opacity !== undefined ? ` opacity="${opacity}"` : ''}>${TRIANGLES.map(([p, f]) => `<polygon points="${p}" fill="${f}"/>`).join('')}</g>`;
  }

  /**
   * variant: 'full' (S + R + triangles) | 'mark' (S + R) | 'mono' (S only)
   * ink: CSS colour for the outline (default currentColor)
   * innerColor: colour of the S/R interior (default: the window ground via --logo-inner)
   */
  function svg({ variant = 'full', ink = 'currentColor', innerColor, cls = '', title = 'Synapse Reborn Apex' } = {}) {
    const inn = innerColor || inner;
    const parts = [];
    if (variant === 'full') parts.push(triangles());
    parts.push(sBody(ink, 13, 7, inn));
    if (variant !== 'mono') parts.push(rGlyph(ink, inn));
    return `<svg viewBox="0 0 120 144" role="img" aria-label="${title}" class="brand-svg ${cls}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }

  // Standalone file-safe markup (explicit colours, no CSS variables).
  function standalone({ variant = 'full', ink = '#0b0b0b', innerColor = '#ffffff', width = 120 } = {}) {
    const inn = innerColor;
    const body = `<g fill="none" stroke-linejoin="round">
      <path d="${S_PATH}" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>
      <path d="${TAIL}" stroke="${ink}" stroke-width="13" stroke-linecap="butt"/>
      <path d="${S_PATH}" stroke="${inn}" stroke-width="7" stroke-linecap="round"/>
      <path d="${TAIL_IN}" stroke="${inn}" stroke-width="7" stroke-linecap="butt"/>
    </g>`;
    const r = variant === 'mono' ? '' : `<g transform="translate(89.5 8.5)" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="${R_PATH}" stroke="${ink}" stroke-width="4"/><path d="${R_PATH}" stroke="${inn}" stroke-width="1.5"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 144" width="${width}" height="${Math.round(width * 1.2)}">${variant === 'full' ? triangles() : ''}${body}${r}</svg>`;
  }

  // Inner markup only (for embedding inside another SVG). Explicit colours.
  function markup({ variant = 'full', ink = '#ffffff', innerColor = '#0d0d0d' } = {}) {
    const inn = innerColor;
    return `${variant === 'full' ? triangles() : ''}<g fill="none" stroke-linejoin="round"><path d="${S_PATH}" stroke="${ink}" stroke-width="13" stroke-linecap="round"/><path d="${TAIL}" stroke="${ink}" stroke-width="13" stroke-linecap="butt"/><path d="${S_PATH}" stroke="${inn}" stroke-width="7" stroke-linecap="round"/><path d="${TAIL_IN}" stroke="${inn}" stroke-width="7" stroke-linecap="butt"/></g>${variant === 'mono' ? '' : `<g transform="translate(89.5 8.5)" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="${R_PATH}" stroke="${ink}" stroke-width="4"/><path d="${R_PATH}" stroke="${inn}" stroke-width="1.5"/></g>`}`;
  }

  const api = { svg, standalone, inner: markup, S_PATH, TRIANGLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Brand = api;
})();
