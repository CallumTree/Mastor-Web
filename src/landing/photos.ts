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
  // a London build photographed as it went, by one photographer: real UK work, one consistent look
  planned: { id: 'jEP4vsHrSM8', src: `${U}photo-1593786267440-550458cc882a`, alt: 'Brickwork going up on a house extension on a sunny day', by: 'Brett Jordan', profile: `https://unsplash.com/@brett_jordan${ref}`, page: `https://unsplash.com/photos/jEP4vsHrSM8${ref}`, w: 4608, h: 3456 },
  repairs: { id: 'PFr50OBMowU', src: `${U}photo-1593012672015-4fabc32c67aa`, alt: 'A wooden ladder against a part-built wall, with props holding up a new opening', by: 'Brett Jordan', profile: `https://unsplash.com/@brett_jordan${ref}`, page: `https://unsplash.com/photos/PFr50OBMowU${ref}`, w: 4608, h: 3456 },
  voids: { id: 'gmWlel2kNJ8', src: `${U}photo-1740677833866-a767cee8ce06`, alt: 'A room stripped back mid-renovation, with a fridge and a table left in it', by: 'Brett Jordan', profile: `https://unsplash.com/@brett_jordan${ref}`, page: `https://unsplash.com/photos/gmWlel2kNJ8${ref}`, w: 3456, h: 4608 },
  kitchen: { id: 'OCFgfOu_6Ko', src: `${U}photo-1732552933796-114fa6b7de4e`, alt: 'A kitchen being rebuilt, with a cooker against bare brick', by: 'Brett Jordan', profile: `https://unsplash.com/@brett_jordan${ref}`, page: `https://unsplash.com/photos/OCFgfOu_6Ko${ref}`, w: 4608, h: 3456 },
  roof: { id: 'G2J41LRaKkE', src: `${U}photo-1726589004565-bedfba94d3a2`, alt: 'A roofer at work on a pitched roof', by: 'Christer Lässman', profile: `https://unsplash.com/@lassman${ref}`, page: `https://unsplash.com/photos/G2J41LRaKkE${ref}`, w: 6240, h: 4160 },
} satisfies Record<string, Photo>

/** Unsplash's own resizing: the width asked for, cropped to the ratio, in the browser's best format. */
export const sized = (p: Photo, w: number, ratio?: number) => `${p.src}?auto=format&fit=crop&q=72&w=${w}${ratio ? `&h=${Math.round(w / ratio)}` : ''}`
export const srcSet = (p: Photo, ratio?: number) => [640, 960, 1400, 1920].map(w => `${sized(p, w, ratio)} ${w}w`).join(', ')
