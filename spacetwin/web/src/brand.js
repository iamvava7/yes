// Everything brand-specific in one place. To rebrand, change these values,
// the colour tokens at the top of styles.css, and the icons in web/public/.
export const brand = {
  name: 'VerifiCasa',
  site: 'https://verificasa.ro',
  siteLabel: 'verificasa.ro',
  tagline: 'Walk any home from anywhere',
  pitch: 'Capture each room with your phone and get a 3D tour with a floor plan and true measurements, ready to share with buyers.',
};

/** The VerifiCasa "VC" mark: ink on paper, white in dark mode (official artwork, not redrawn). */
export function brandMark() {
  const img = (src, cls) => Object.assign(document.createElement('img'), { src, alt: '', className: `brand-mark ${cls}` });
  const frag = document.createDocumentFragment();
  frag.append(img('/brand/verificasa-mark.svg', 'dark'), img('/brand/verificasa-mark-white.svg', 'light'));
  return frag;
}
