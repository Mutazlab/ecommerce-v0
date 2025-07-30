import { Pool } from "pg"
import { Client } from "@elastic/elasticsearch"
import Redis from "ioredis"

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log("Executed query", { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// Elasticsearch connection
export const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: process.env.ELASTICSEARCH_AUTH
    ? {
        username: process.env.ELASTICSEARCH_USERNAME!,
        password: process.env.ELASTICSEARCH_PASSWORD!,
      }
    : undefined,
})

// Redis connection
export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
})

// Health check functions
export const checkDatabaseHealth = async () => {
  try {
    await query("SELECT 1")
    return { status: "healthy", timestamp: new Date().toISOString() }
  } catch (error) {
    return { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export const checkElasticsearchHealth = async () => {
  try {
    await elasticsearch.ping()
    return { status: "healthy", timestamp: new Date().toISOString() }
  } catch (error) {
    return { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export const checkRedisHealth = async () => {
  try {
    await redis.ping()
    return { status: "healthy", timestamp: new Date().toISOString() }
  } catch (error) {
    return { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" }
  }
}
