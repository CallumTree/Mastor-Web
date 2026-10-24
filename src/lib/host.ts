/**
 * Which web address Mastor runs at. The live app is mastor-web.vercel.app. Vercel also makes:
 *  - one-off deployment links (mastor-xxxx-callumtree-1200.vercel.app) → sent to the live address
 *  - branch previews (…-git-<branch>-….vercel.app) → allowed, so changes can be checked before merging.
 * A preview signs in to the same company and syncs the same jobs — changes made there are real.
 */
export const HOME = 'mastor-web.vercel.app'
export const isBranchPreview = (host: string) => host.endsWith('.vercel.app') && host.includes('-git-')
export const shouldGoHome = (host: string) => host.endsWith('.vercel.app') && host !== HOME && !isBranchPreview(host)
