/**
 * GET /.well-known/oauth-protected-resource (rewritten here, see vercel.json) — tells Claude that /api/mcp
 * is protected by Mastor's sign-in, run by Supabase Auth's OAuth server. Claude reads the server's own
 * metadata from there, registers itself, and sends the person to Mastor's consent page (/oauth/consent).
 */
import { SB_URL } from './_guard.js'

export default function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'mastor-web.vercel.app').split(',')[0].trim()
  res.setHeader('cache-control', 'public, max-age=300')
  res.setHeader('access-control-allow-origin', '*')
  res.status(200).json({
    resource: `https://${host}/api/mcp`,
    authorization_servers: [`${SB_URL}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'Mastor',
  })
}
