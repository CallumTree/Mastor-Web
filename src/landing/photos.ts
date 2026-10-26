/**
 * The front page's photographs: real ones from Unsplash (free licence), loaded from Unsplash itself as
 * its guidelines ask, each credited in the footer. Swap any of them for the firm's own site photos by
 * changing `src` to a file in /public/landing and dropping its credit.
 */
export interface Photo { id: string; src: string; alt: string; by: string; profile: string; page: string; w: number; h: number }

const U = 'https://images.unsplash.com/'
const ref = '?utm_source=mastor&utm_medium=referral'

export const PHOTOS = {
  phone: { id: 'DzYT1tfcDq4', src: `${U}photo-1758876734777-dcc6981f3671`, alt: 'A construction worker in a hard hat sitting on a bucket on site, checking a phone', by: 'Albert Vinas', profile: `https://unsplash.com/@treb_vinas24${ref}`, page: `https://unsplash.com/photos/DzYT1tfcDq4${ref}`, w: 2942, h: 2318 },
  street: { id: 'Q2SSR9l4Ad0', src: `${U}photo-1671561550362-9b53a47a6cd6`, alt: 'A row of terraced houses under a cloudy sky', by: 'Winston Tjia', profile: `https://unsplash.com/@winstontjia${ref}`, page: `https://unsplash.com/photos/Q2SSR9l4Ad0${ref}`, w: 6439, h: 4293 },
  roof: { id: 'G2J41LRaKkE', src: `${U}photo-1726589004565-bedfba94d3a2`, alt: 'A roofer at work on a pitched roof', by: 'Christer Lässman', profile: `https://unsplash.com/@lassman${ref}`, page: `https://unsplash.com/photos/G2J41LRaKkE${ref}`, w: 6240, h: 4160 },
  scaffold: { id: 'v7SSzVL3fxo', src: `${U}photo-1711989798817-3b120f378d43`, alt: 'A brick house with scaffolding up the side', by: 'Marek Studzinski', profile: `https://unsplash.com/@jccards${ref}`, page: `https://unsplash.com/photos/v7SSzVL3fxo${ref}`, w: 6960, h: 4640 },
} satisfies Record<string, Photo>

/** Unsplash's own resizing: the width asked for, cropped to the ratio, in the browser's best format. */
export const sized = (p: Photo, w: number, ratio?: number) => `${p.src}?auto=format&fit=crop&q=72&w=${w}${ratio ? `&h=${Math.round(w / ratio)}` : ''}`
export const srcSet = (p: Photo, ratio?: number) => [640, 960, 1400, 1920].map(w => `${sized(p, w, ratio)} ${w}w`).join(', ')
