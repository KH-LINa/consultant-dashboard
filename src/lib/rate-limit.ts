import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

/**
 * Rate-limiting basé sur Upstash Redis (store partagé, compatible serverless).
 *
 * Dégradation gracieuse : si UPSTASH_REDIS_REST_URL / _TOKEN ne sont pas définis,
 * la limite est désactivée (allow = true) — l'app fonctionne normalement.
 */

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Cache des limiteurs par "profil" pour ne pas les recréer à chaque appel
const limiters = new Map<string, Ratelimit>()

function getLimiter(prefix: string, max: number, windowSec: number): Ratelimit | null {
  if (!redis) return null
  const key = `${prefix}:${max}:${windowSec}`
  let lim = limiters.get(key)
  if (!lim) {
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${prefix}`,
      analytics: false,
    })
    limiters.set(key, lim)
  }
  return lim
}

/** Récupère une identité stable pour la requête (IP, ou user id si fourni). */
export function clientId(request: NextRequest, fallback?: string): string {
  if (fallback) return fallback
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'anonymous'
}

/**
 * Vérifie la limite. Retourne { success, remaining, reset }.
 * Si Upstash n'est pas configuré → success: true (no-op).
 */
export async function checkRateLimit(opts: {
  prefix: string
  identifier: string
  max: number
  windowSec: number
}): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = getLimiter(opts.prefix, opts.max, opts.windowSec)
  if (!limiter) {
    return { success: true, remaining: opts.max, reset: 0 }
  }
  const res = await limiter.limit(opts.identifier)
  return { success: res.success, remaining: res.remaining, reset: res.reset }
}
