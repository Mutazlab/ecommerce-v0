import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database/connection"
import { WEBHOOK_EVENTS } from "@/lib/webhooks/sender"

/**
 * @swagger
 * /api/developer/webhooks:
 *   get:
 *     summary: List all webhooks
 *     description: Get all registered webhooks for the authenticated user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhooks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Webhook'
 */
export async function GET(request: NextRequest) {
  try {
    // Verify API key (implement proper authentication)
    const apiKey = request.headers.get("authorization")?.replace("Bearer ", "")
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 })
    }

    const result = await query(
      "SELECT id, name, url, events, is_active, created_at FROM webhooks ORDER BY created_at DESC",
    )

    return NextResponse.json({
      webhooks: result.rows,
      availableEvents: Object.keys(WEBHOOK_EVENTS),
    })
  } catch (error) {
    console.error("Webhooks list error:", error)
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 })
  }
}

/**
 * @swagger
 * /api/developer/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     description: Register a new webhook endpoint
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - events
 *             properties:
 *               name:
 *                 type: string
 *                 description: Webhook name
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook endpoint URL
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of events to subscribe to
 *               secret:
 *                 type: string
 *                 description: Secret for signature verification
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *       400:
 *         description: Invalid request data
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("authorization")?.replace("Bearer ", "")
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 })
    }

    const { name, url, events, secret } = await request.json()

    // Validate required fields
    if (!name || !url || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate events
    const validEvents = Object.keys(WEBHOOK_EVENTS)
    const invalidEvents = events.filter((event: string) => !validEvents.includes(event))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid events: ${invalidEvents.join(", ")}`,
          validEvents,
        },
        { status: 400 },
      )
    }

    // Create webhook
    const result = await query("INSERT INTO webhooks (name, url, events, secret) VALUES ($1, $2, $3, $4) RETURNING *", [
      name,
      url,
      events,
      secret || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error("Webhook creation error:", error)
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}
