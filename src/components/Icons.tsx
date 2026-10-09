/**
 * Mastor icon set — "construction drawing" family.
 * Rules: 24-unit grid, 1.6 stroke, square caps, mitred joins, no rounded corners,
 * one solid copper accent per icon. Line colour follows currentColor.
 */
const COPPER = '#C97B3F'
type P = { size?: number }
const S = ({ size = 24, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="square" strokeLinejoin="miter">{children}</svg>
)

export const IconHome = (p: P) => <S {...p}><path d="M3 12 12 4l9 8" /><rect x="6" y="12" width="12" height="8" /><path d="M10.5 20v-5h3v5" /><circle cx="17" cy="8.4" r="1" fill={COPPER} stroke="none" /></S>
export const IconDiary = (p: P) => <S {...p}><rect x="9" y="4" width="6" height="13" /><path d="M9 10.5h6M7 21h10M12 17v4" /><circle cx="12" cy="10.5" r="1.1" fill={COPPER} stroke="none" /></S>
export const IconScope = (p: P) => <S {...p}><rect x="7" y="3" width="14" height="17" /><path d="M4 6v17h14" opacity=".7" /><path d="M10 8h8M10 11h8M10 14h5" strokeWidth={1.2} /><circle cx="9" cy="4.6" r="1" fill={COPPER} stroke="none" /></S>
export const IconMarkup = (p: P) => <S {...p}><path d="M3 19h12" opacity=".55" /><path d="M9 15l8-8 3 3-8 8-4 1z" /><path d="M16 8l3 3" strokeWidth={1.2} /><circle cx="19.5" cy="5.5" r="1.1" fill={COPPER} stroke="none" /></S>
export const IconValuation = (p: P) => <S {...p}><path d="M5 3h14v15l-3.5 3-3.5-3-3.5 3L5 18z" /><path d="M8 8h8M8 11h8M8 14h5" strokeWidth={1.2} /><circle cx="16.5" cy="14.2" r="1.1" fill={COPPER} stroke="none" /></S>
export const IconFlag = (p: P) => <S {...p}><path d="M12 3l9 9-9 9-9-9z" /><path d="M12 8v8M8 12h8" /><circle cx="12" cy="12" r="1.2" fill={COPPER} stroke="none" /></S>
export const IconCamera = (p: P) => <S {...p}><rect x="3" y="7" width="18" height="13" /><path d="M8 7l1.5-3h5L16 7" /><rect x="8.5" y="10" width="7" height="7" /><circle cx="5.5" cy="9.5" r="1" fill={COPPER} stroke="none" /></S>
export const IconSettings = (p: P) => <S {...p}><path d="M13 15l-2-3.5h-4L5 15l2 3.5h4z" /><path d="M13 11L21 3" strokeWidth={2} /><circle cx="20" cy="4" r="1.1" fill={COPPER} stroke="none" /></S>
export const IconBack = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const IconChart = (p: P) => <S {...p}><path d="M3 21h18" /><rect x="5" y="12" width="3" height="9" /><rect x="10.5" y="7" width="3" height="14" /><rect x="16" y="10" width="3" height="11" /><circle cx="12" cy="4" r="1.1" fill={COPPER} stroke="none" /></S>
export const IconCog = (p: P) => <S {...p}><path d="M18.9 10.1 L21.4 10.5 L21.4 13.5 L18.9 13.9 L18.3 15.5 L19.7 17.5 L17.5 19.7 L15.5 18.3 L13.9 18.9 L13.5 21.4 L10.5 21.4 L10.1 18.9 L8.5 18.3 L6.5 19.7 L4.3 17.5 L5.7 15.5 L5.1 13.9 L2.6 13.5 L2.6 10.5 L5.1 10.1 L5.7 8.5 L4.3 6.5 L6.5 4.3 L8.5 5.7 L10.1 5.1 L10.5 2.6 L13.5 2.6 L13.9 5.1 L15.5 5.7 L17.5 4.3 L19.7 6.5 L18.3 8.5z" /><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="1" fill={COPPER} stroke="none" /></S>
export const IconLock = (p: P) => <S {...p}><rect x="5" y="11" width="14" height="10" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.2" fill={COPPER} stroke="none" /></S>
export const IconPin = (p: P) => <S {...p}><path d="M8 3h8M10 3v6l-3 4h10l-3-4V3" /><path d="M12 13v8" /><circle cx="12" cy="9" r="1" fill={COPPER} stroke="none" /></S>
export const IconDoc = (p: P) => <S {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 15h7M9 18h4" strokeWidth={1.2} /><circle cx="9" cy="8" r="1" fill={COPPER} stroke="none" /></S>
export const IconVideo = (p: P) => <S {...p}><rect x="3" y="7" width="13" height="11" /><path d="M16 11l5-3v9l-5-3" /><circle cx="6" cy="10" r="1" fill={COPPER} stroke="none" /></S>
