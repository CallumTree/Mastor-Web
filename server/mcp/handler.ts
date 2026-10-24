/**
 * POST /api/mcp — Mastor as a Claude connector (Model Context Protocol, streamable HTTP, stateless).
 * Claude signs in through Supabase Auth's OAuth server and sends that sign-in on every request; a missing
 * or expired one gets the standard challenge pointing at /.well-known/oauth-protected-resource, which tells
 * Claude where to sign in. Everything is then read as that person (see data.ts).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { signIn } from './data'
import { mastorServer } from './tools'

type Req = IncomingMessage & { body?: unknown }
type Res = ServerResponse & { status: (n: number) => Res; json: (b: unknown) => void }

const origin = (req: Req) => `https://${String(req.headers['x-forwarded-host'] || req.headers.host || 'mastor-web.vercel.app').split(',')[0].trim()}`

export const config = { maxDuration: 300 }   // a video read can take a while

export default async function handler(req: Req, res: Res) {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const ctx = token ? await signIn(token).catch(() => null) : null
  if (!ctx) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${origin(req)}/.well-known/oauth-protected-resource"`)
    return res.status(401).json({ error: token ? 'Your Mastor sign-in has expired or isn’t linked to a company — connect again.' : 'Sign in to Mastor to use it from Claude.' })
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }) }

  const server = mastorServer(ctx)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => { transport.close(); server.close() })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
}
