/**
 * The front page's photographs: real ones from Unsplash (free licence), loaded from Unsplash itself as
 * its guidelines ask, each credited in the footer. Swap any of them for the firm's own site photos by
 * changing `src` to a file in /public/landing and dropping its credit.
 */
export interface Photo { id: string; src: string; alt: string; by: string; profile: string; page: string; w: number; h: number }

const U = 'https://images.unsplash.com/'
const ref = '?utm_source=mastor&utm_medium=referral'

export const PHOTOS = {
  // behind the headline, tinted like a blueprint print (landing.css .lead-bg)
  terrace: { id: 'aoaaiTXisDI', src: `${U}photo-1768383235703-116d3ca7e2c3`, alt: 'A row of brick terraced houses with chimneys against the sky', by: 'T', profile: `https://unsplash.com/@tanyabarrow${ref}`, page: `https://unsplash.com/photos/aoaaiTXisDI${ref}`, w: 2976, h: 1984 },
  // beside the headline, with the app over it: a kitchen mid-refit, the work the example job's voice note is about
  kitchen: { id: 'OCFgfOu_6Ko', src: `${U}photo-1732552933796-114fa6b7de4e`, alt: 'A kitchen being rebuilt, with a cooker against bare brick', by: 'Brett Jordan', profile: `https://unsplash.com/@brett_jordan${ref}`, page: `https://unsplash.com/photos/OCFgfOu_6Ko${ref}`, w: 4608, h: 3456 },
} satisfies Record<string, Photo>

/** Unsplash's own resizing: the width asked for, cropped to the ratio, in the browser's best format. */
export const sized = (p: Photo, w: number, ratio?: number) => `${p.src}?auto=format&fit=crop&q=72&w=${w}${ratio ? `&h=${Math.round(w / ratio)}` : ''}`
export const srcSet = (p: Photo, ratio?: number) => [640, 960, 1400, 1920].map(w => `${sized(p, w, ratio)} ${w}w`).join(', ')
