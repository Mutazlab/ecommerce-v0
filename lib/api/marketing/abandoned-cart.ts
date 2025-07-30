import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"
import { sendEmail } from "@/lib/email/sender"

interface AbandonedCart {
  id: string
  userId?: string
  sessionId?: string
  email?: string
  items: any[]
  totalAmount: number
  currency: string
  abandonedAt: Date
  lastReminderSent?: Date
  reminderCount: number
}

// Identify abandoned carts
export async function identifyAbandonedCarts() {
  try {
    // Find carts that haven't been updated in the last 30 minutes
    // and don't have a corresponding completed order
    const result = await query(`
      SELECT 
        c.id,
        c.user_id,
        c.session_id,
        u.email,
        c.updated_at as abandoned_at,
        COALESCE(ac.reminder_count, 0) as reminder_count,
        ac.last_reminder_sent
      FROM carts c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN abandoned_carts ac ON c.id = ac.cart_id
      WHERE c.updated_at < NOW() - INTERVAL '30 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM orders o 
          WHERE (o.user_id = c.user_id OR o.session_id = c.session_id)
            AND o.created_at > c.updated_at
        )
        AND (ac.id IS NULL OR ac.last_reminder_sent < NOW() - INTERVAL '24 hours')
    `)

    const abandonedCarts = result.rows

    for (const cart of abandonedCarts) {
      await processAbandonedCart(cart)
    }

    return abandonedCarts.length
  } catch (error) {
    console.error("Abandoned cart identification error:", error)
    throw error
  }
}

// Process individual abandoned cart
async function processAbandonedCart(cart: any) {
  try {
    // Get cart items
    const itemsResult = await query(
      `
      SELECT 
        ci.quantity,
        ci.product_id,
        p.translations,
        p.price,
        p.images,
        p.slug
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = $1
    `,
      [cart.id],
    )

    const items = itemsResult.rows
    if (items.length === 0) return

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    // Create or update abandoned cart record
    await query(
      `
      INSERT INTO abandoned_carts (
        cart_id, user_id, session_id, email, items, total_amount, 
        currency, abandoned_at, reminder_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (cart_id) 
      DO UPDATE SET 
        reminder_count = abandoned_carts.reminder_count + 1,
        last_reminder_sent = CURRENT_TIMESTAMP
    `,
      [
        cart.id,
        cart.user_id,
        cart.session_id,
        cart.email,
        JSON.stringify(items),
        totalAmount,
        "USD",
        cart.abandoned_at,
        cart.reminder_count + 1,
      ],
    )

    // Send appropriate reminder based on reminder count
    if (cart.email) {
      await sendAbandonedCartEmail(cart.email, {
        cartId: cart.id,
        items,
        totalAmount,
        reminderCount: cart.reminder_count + 1,
      })
    }

    // Send webhook notification
    await sendWebhook("cart.abandoned", {
      cartId: cart.id,
      userId: cart.user_id,
      sessionId: cart.session_id,
      email: cart.email,
      items,
      totalAmount,
      currency: "USD",
      reminderCount: cart.reminder_count + 1,
    })
  } catch (error) {
    console.error("Abandoned cart processing error:", error)
  }
}

// Send abandoned cart email
async function sendAbandonedCartEmail(
  email: string,
  cartData: {
    cartId: string
    items: any[]
    totalAmount: number
    reminderCount: number
  },
) {
  try {
    let templateType = "abandoned_cart_1"
    let subject = "You left something in your cart"

    // Different templates based on reminder count
    switch (cartData.reminderCount) {
      case 1:
        templateType = "abandoned_cart_1"
        subject = "You left something in your cart"
        break
      case 2:
        templateType = "abandoned_cart_2"
        subject = "Still thinking about your cart?"
        break
      case 3:
        templateType = "abandoned_cart_3"
        subject = "Last chance - 10% off your cart!"
        break
      default:
        return // Don't send more than 3 reminders
    }

    // Generate recovery link
    const recoveryToken = generateRecoveryToken(cartData.cartId)
    const recoveryUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/cart/recover?token=${recoveryToken}`

    await sendEmail({
      to: email,
      subject,
      template: templateType,
      data: {
        items: cartData.items,
        totalAmount: cartData.totalAmount,
        recoveryUrl,
        discountCode: cartData.reminderCount === 3 ? "COMEBACK10" : null,
      },
    })
  } catch (error) {
    console.error("Abandoned cart email error:", error)
  }
}

// Generate secure recovery token
function generateRecoveryToken(cartId: string): string {
  const crypto = require("crypto")
  const payload = JSON.stringify({ cartId, timestamp: Date.now() })
  const secret = process.env.CART_RECOVERY_SECRET || "default-secret"

  return (
    crypto.createHmac("sha256", secret).update(payload).digest("hex") + "." + Buffer.from(payload).toString("base64")
  )
}

// Verify recovery token
export function verifyRecoveryToken(token: string): { cartId: string; timestamp: number } | null {
  try {
    const crypto = require("crypto")
    const [signature, payload] = token.split(".")
    const secret = process.env.CART_RECOVERY_SECRET || "default-secret"

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(payload, "base64").toString())
      .digest("hex")

    if (signature !== expectedSignature) {
      return null
    }

    const data = JSON.parse(Buffer.from(payload, "base64").toString())

    // Check if token is not older than 7 days
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null
    }

    return data
  } catch (error) {
    return null
  }
}

// Recover abandoned cart
export async function recoverAbandonedCart(token: string, userId?: string) {
  try {
    const tokenData = verifyRecoveryToken(token)
    if (!tokenData) {
      throw new Error("Invalid or expired recovery token")
    }

    // Get cart details
    const cartResult = await query("SELECT * FROM carts WHERE id = $1", [tokenData.cartId])

    if (cartResult.rows.length === 0) {
      throw new Error("Cart not found")
    }

    const cart = cartResult.rows[0]

    // If user is logged in, merge with their current cart
    if (userId && userId !== cart.user_id) {
      await mergeCartsForUser(userId, tokenData.cartId)
    }

    // Mark cart as recovered
    await query("UPDATE abandoned_carts SET recovered_at = CURRENT_TIMESTAMP WHERE cart_id = $1", [tokenData.cartId])

    await sendWebhook("cart.recovered", {
      cartId: tokenData.cartId,
      userId: userId || cart.user_id,
      recoveryMethod: "email_link",
    })

    return { cartId: tokenData.cartId, success: true }
  } catch (error) {
    console.error("Cart recovery error:", error)
    throw error
  }
}

// Merge carts for user
async function mergeCartsForUser(userId: string, recoveryCartId: string) {
  try {
    // Get user's current cart
    const currentCartResult = await query("SELECT id FROM carts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1", [
      userId,
    ])

    if (currentCartResult.rows.length === 0) {
      // No current cart, just assign the recovery cart to the user
      await query("UPDATE carts SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
        userId,
        recoveryCartId,
      ])
      return
    }

    const currentCartId = currentCartResult.rows[0].id

    // Get items from recovery cart
    const recoveryItemsResult = await query(
      "SELECT product_id, variation_id, quantity FROM cart_items WHERE cart_id = $1",
      [recoveryCartId],
    )

    // Merge items into current cart
    for (const item of recoveryItemsResult.rows) {
      await query(
        `
        INSERT INTO cart_items (cart_id, product_id, variation_id, quantity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (cart_id, product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'))
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
      `,
        [currentCartId, item.product_id, item.variation_id, item.quantity],
      )
    }

    // Delete recovery cart
    await query("DELETE FROM carts WHERE id = $1", [recoveryCartId])
  } catch (error) {
    console.error("Cart merge error:", error)
    throw error
  }
}

// Get abandoned cart analytics
export async function getAbandonedCartAnalytics(startDate: string, endDate: string) {
  try {
    const result = await query(
      `
      SELECT 
        DATE(abandoned_at) as date,
        COUNT(*) as total_abandoned,
        COUNT(CASE WHEN recovered_at IS NOT NULL THEN 1 END) as recovered,
        SUM(total_amount) as total_value,
        SUM(CASE WHEN recovered_at IS NOT NULL THEN total_amount ELSE 0 END) as recovered_value,
        AVG(reminder_count) as avg_reminders
      FROM abandoned_carts
      WHERE abandoned_at BETWEEN $1 AND $2
      GROUP BY DATE(abandoned_at)
      ORDER BY date DESC
    `,
      [startDate, endDate],
    )

    return result.rows
  } catch (error) {
    console.error("Abandoned cart analytics error:", error)
    throw error
  }
}

// Schedule abandoned cart job (to be called by cron)
export async function scheduleAbandonedCartJob() {
  try {
    const abandonedCount = await identifyAbandonedCarts()

    console.log(`Processed ${abandonedCount} abandoned carts`)

    return { processedCount: abandonedCount }
  } catch (error) {
    console.error("Abandoned cart job error:", error)
    throw error
  }
}
