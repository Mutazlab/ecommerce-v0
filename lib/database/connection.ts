import { Pool } from "pg"
import Redis from "ioredis"

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Redis connection for caching
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
})

// Elasticsearch connection
import { Client } from "@elastic/elasticsearch"

const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: process.env.ELASTICSEARCH_AUTH
    ? {
        username: process.env.ELASTICSEARCH_USERNAME!,
        password: process.env.ELASTICSEARCH_PASSWORD!,
      }
    : undefined,
})

export { pool, redis, elasticsearch }

// Database query helper with caching
export async function query(text: string, params?: any[], cacheKey?: string, cacheTTL = 300) {
  try {
    // Try cache first if cacheKey provided
    if (cacheKey) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    }

    const start = Date.now()
    const result = await pool.query(text, params)
    const duration = Date.now() - start

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${duration}ms`, { text, params })
    }

    // Cache result if cacheKey provided
    if (cacheKey && result.rows) {
      await redis.setex(cacheKey, cacheTTL, JSON.stringify(result))
    }

    return result
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// Cache invalidation helper
export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
