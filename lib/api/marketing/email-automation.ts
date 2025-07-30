import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"
import { sendEmail } from "@/lib/email/sender"

interface EmailCampaign {
  id: string
  name: string
  type: "welcome" | "abandoned_cart" | "post_purchase" | "win_back" | "birthday" | "product_recommendation"
  trigger: "user_registration" | "cart_abandonment" | "order_completed" | "last_purchase" | "birthday" | "product_view"
  delay: number // in hours
  isActive: boolean
  subject: Record<string, string>
  content: Record<string, string>
  conditions?: any
}

// Create email automation campaign
export async function createEmailCampaign(campaignData: Omit<EmailCampaign, "id">) {
  try {
    const result = await query(
      `
      INSERT INTO email_campaigns (
        name, type, trigger_event, delay_hours, is_active,
        subject, content, conditions, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING id
    `,
      [
        campaignData.name,
        campaignData.type,
        campaignData.trigger,
        campaignData.delay,
        campaignData.isActive,
        JSON.stringify(campaignData.subject),
        JSON.stringify(campaignData.content),
        JSON.stringify(campaignData.conditions || {}),
      ],
    )

    const campaignId = result.rows[0].id

    await sendWebhook("email_campaign.created", {
      campaignId,
      name: campaignData.name,
      type: campaignData.type,
      trigger: campaignData.trigger,
    })

    return { campaignId, success: true }
  } catch (error) {
    console.error("Email campaign creation error:", error)
    throw error
  }
}

// Process email automation triggers
export async function processEmailTriggers() {
  try {
    // Get all active campaigns
    const campaignsResult = await query(`
      SELECT * FROM email_campaigns 
      WHERE is_active = true
    `)

    const campaigns = campaignsResult.rows

    for (const campaign of campaigns) {
      await processCampaignTriggers(campaign)
    }

    return { processedCampaigns: campaigns.length }
  } catch (error) {
    console.error("Email trigger processing error:", error)
    throw error
  }
}

// Process triggers for a specific campaign
async function processCampaignTriggers(campaign: any) {
  try {
    const now = new Date()
    const triggerTime = new Date(now.getTime() - campaign.delay_hours * 60 * 60 * 1000)

    let triggerQuery = ""
    let params: any[] = []

    switch (campaign.trigger_event) {
      case "user_registration":
        triggerQuery = `
          SELECT u.id as user_id, u.email, u.first_name, u.last_name, u.created_at
          FROM users u
          WHERE u.created_at <= $1
            AND u.created_at > $1 - INTERVAL '1 hour'
            AND NOT EXISTS (
              SELECT 1 FROM email_sends es 
              WHERE es.user_id = u.id AND es.campaign_id = $2
            )
        `
        params = [triggerTime, campaign.id]
        break

      case "cart_abandonment":
        triggerQuery = `
          SELECT ac.user_id, ac.email, ac.cart_id, ac.abandoned_at, ac.items, ac.total_amount
          FROM abandoned_carts ac
          WHERE ac.abandoned_at <= $1
            AND ac.abandoned_at > $1 - INTERVAL '1 hour'
            AND ac.recovered_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM email_sends es 
              WHERE (es.user_id = ac.user_id OR es.email = ac.email) 
                AND es.campaign_id = $2
                AND es.reference_id = ac.cart_id
            )
        `
        params = [triggerTime, campaign.id]
        break

      case "order_completed":
        triggerQuery = `
          SELECT o.user_id, u.email, u.first_name, u.last_name, o.id as order_id, 
                 o.total_amount, o.created_at
          FROM orders o
          JOIN users u ON o.user_id = u.id
          WHERE o.created_at <= $1
            AND o.created_at > $1 - INTERVAL '1 hour'
            AND o.status = 'completed'
            AND NOT EXISTS (
              SELECT 1 FROM email_sends es 
              WHERE es.user_id = o.user_id AND es.campaign_id = $2 AND es.reference_id = o.id
            )
        `
        params = [triggerTime, campaign.id]
        break

      case "last_purchase":
        // Win-back campaign for customers who haven't purchased in X days
        const daysSinceLastPurchase = campaign.conditions?.days_since_last_purchase || 30
        triggerQuery = `
          SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name,
                 MAX(o.created_at) as last_purchase_date
          FROM users u
          JOIN orders o ON u.id = o.user_id
          WHERE o.created_at <= $1 - INTERVAL '${daysSinceLastPurchase} days'
            AND NOT EXISTS (
              SELECT 1 FROM orders o2 
              WHERE o2.user_id = u.id AND o2.created_at > $1 - INTERVAL '${daysSinceLastPurchase} days'
            )
            AND NOT EXISTS (
              SELECT 1 FROM email_sends es 
              WHERE es.user_id = u.id AND es.campaign_id = $2 
                AND es.sent_at > CURRENT_DATE - INTERVAL '30 days'
            )
          GROUP BY u.id, u.email, u.first_name, u.last_name
        `
        params = [now, campaign.id]
        break

      case "birthday":
        triggerQuery = `
          SELECT u.id as user_id, u.email, u.first_name, u.last_name, u.birth_date
          FROM users u
          WHERE EXTRACT(MONTH FROM u.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM u.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
            AND NOT EXISTS (
              SELECT 1 FROM email_sends es 
              WHERE es.user_id = u.id AND es.campaign_id = $1 
                AND EXTRACT(YEAR FROM es.sent_at) = EXTRACT(YEAR FROM CURRENT_DATE)
            )
        `
        params = [campaign.id]
        break

      default:
        return
    }

    const triggersResult = await query(triggerQuery, params)
    const triggers = triggersResult.rows

    for (const trigger of triggers) {
      await sendCampaignEmail(campaign, trigger)
    }
  } catch (error) {
    console.error(`Campaign trigger processing error for ${campaign.name}:`, error)
  }
}

// Send campaign email
async function sendCampaignEmail(campaign: any, triggerData: any) {
  try {
    const email = triggerData.email
    if (!email) return

    // Get user's preferred language
    const userLang = (await getUserPreferredLanguage(triggerData.user_id)) || "en"

    const subject = campaign.subject[userLang] || campaign.subject.en || "Special Offer"
    const content = campaign.content[userLang] || campaign.content.en || ""

    // Personalize content
    const personalizedContent = personalizeEmailContent(content, triggerData, campaign.type)
    const personalizedSubject = personalizeEmailContent(subject, triggerData, campaign.type)

    // Send email
    await sendEmail({
      to: email,
      subject: personalizedSubject,
      template: campaign.type,
      data: {
        ...triggerData,
        content: personalizedContent,
        unsubscribeUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}&campaign=${campaign.id}`,
      },
    })

    // Log email send
    await query(
      `
      INSERT INTO email_sends (
        campaign_id, user_id, email, reference_id, sent_at, status
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
    `,
      [campaign.id, triggerData.user_id, email, triggerData.cart_id || triggerData.order_id || null, "sent"],
    )

    await sendWebhook("email.sent", {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignType: campaign.type,
      userId: triggerData.user_id,
      email: email,
      subject: personalizedSubject,
    })
  } catch (error) {
    console.error("Campaign email send error:", error)

    // Log failed send
    await query(
      `
      INSERT INTO email_sends (
        campaign_id, user_id, email, reference_id, sent_at, status, error_message
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
    `,
      [
        campaign.id,
        triggerData.user_id,
        triggerData.email,
        triggerData.cart_id || triggerData.order_id || null,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
      ],
    )
  }
}

// Personalize email content
function personalizeEmailContent(content: string, data: any, campaignType: string): string {
  let personalized = content

  // Replace common placeholders
  personalized = personalized.replace(/\{\{first_name\}\}/g, data.first_name || "Valued Customer")
  personalized = personalized.replace(/\{\{last_name\}\}/g, data.last_name || "")
  personalized = personalized.replace(/\{\{email\}\}/g, data.email || "")

  // Campaign-specific personalizations
  switch (campaignType) {
    case "abandoned_cart":
      if (data.items) {
        const itemsList = JSON.parse(data.items)
          .map((item: any) => `${item.translations?.en_name || item.name} (${item.quantity}x)`)
          .join(", ")
        personalized = personalized.replace(/\{\{cart_items\}\}/g, itemsList)
      }
      personalized = personalized.replace(/\{\{cart_total\}\}/g, `$${data.total_amount?.toFixed(2) || "0.00"}`)
      break

    case "post_purchase":
      personalized = personalized.replace(/\{\{order_total\}\}/g, `$${data.total_amount?.toFixed(2) || "0.00"}`)
      break

    case "birthday":
      const age = data.birth_date ? new Date().getFullYear() - new Date(data.birth_date).getFullYear() : ""
      personalized = personalized.replace(/\{\{age\}\}/g, age.toString())
      break
  }

  return personalized
}

// Get user's preferred language
async function getUserPreferredLanguage(userId: string): Promise<string | null> {
  try {
    if (!userId) return null

    const result = await query("SELECT preferred_language FROM users WHERE id = $1", [userId])

    return result.rows[0]?.preferred_language || null
  } catch (error) {
    return null
  }
}

// Get email campaign analytics
export async function getEmailCampaignAnalytics(campaignId: string, startDate: string, endDate: string) {
  try {
    const result = await query(
      `
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_sends,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sends,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opens,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicks,
        COUNT(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 END) as unsubscribes
      FROM email_sends
      WHERE campaign_id = $1
        AND sent_at BETWEEN $2 AND $3
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `,
      [campaignId, startDate, endDate],
    )

    return result.rows
  } catch (error) {
    console.error("Email campaign analytics error:", error)
    throw error
  }
}

// Unsubscribe user from email campaigns
export async function unsubscribeFromEmails(email: string, campaignId?: string) {
  try {
    if (campaignId) {
      // Unsubscribe from specific campaign
      await query(
        `
        INSERT INTO email_unsubscribes (email, campaign_id, unsubscribed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (email, campaign_id) DO NOTHING
      `,
        [email, campaignId],
      )
    } else {
      // Unsubscribe from all campaigns
      await query(
        `
        INSERT INTO email_unsubscribes (email, unsubscribed_at)
        VALUES ($1, CURRENT_TIMESTAMP)
        ON CONFLICT (email) WHERE campaign_id IS NULL DO NOTHING
      `,
        [email],
      )
    }

    await sendWebhook("email.unsubscribed", {
      email,
      campaignId: campaignId || "all",
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  } catch (error) {
    console.error("Email unsubscribe error:", error)
    throw error
  }
}

// Product recommendation emails
export async function sendProductRecommendationEmails() {
  try {
    // Get users who haven't received recommendations in the last 7 days
    const usersResult = await query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
      FROM users u
      WHERE u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM email_unsubscribes eu 
          WHERE eu.email = u.email AND (eu.campaign_id IS NULL OR eu.campaign_id = 'product_recommendations')
        )
        AND NOT EXISTS (
          SELECT 1 FROM email_sends es 
          WHERE es.user_id = u.id 
            AND es.campaign_id = 'product_recommendations'
            AND es.sent_at > CURRENT_DATE - INTERVAL '7 days'
        )
      LIMIT 100
    `)

    const users = usersResult.rows

    for (const user of users) {
      // Get personalized product recommendations
      const recommendations = await getPersonalizedProductRecommendations(user.id)

      if (recommendations.length > 0) {
        await sendEmail({
          to: user.email,
          subject: `${user.first_name}, we found some products you might love!`,
          template: "product_recommendations",
          data: {
            firstName: user.first_name,
            recommendations: recommendations.slice(0, 4), // Send top 4 recommendations
            unsubscribeUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(user.email)}&campaign=product_recommendations`,
          },
        })

        // Log email send
        await query(
          `
          INSERT INTO email_sends (
            campaign_id, user_id, email, sent_at, status
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
        `,
          ["product_recommendations", user.id, user.email, "sent"],
        )
      }
    }

    return { sentCount: users.length }
  } catch (error) {
    console.error("Product recommendation emails error:", error)
    throw error
  }
}

// Get personalized product recommendations for a user
async function getPersonalizedProductRecommendations(userId: string) {
  try {
    // This would integrate with your recommendation engine
    // For now, we'll use a simple approach based on user's purchase history
    const result = await query(
      `
      SELECT DISTINCT p.id, p.slug, p.translations, p.price, p.images
      FROM products p
      JOIN order_items oi ON p.category_id = (
        SELECT p2.category_id FROM products p2 
        JOIN order_items oi2 ON p2.id = oi2.product_id
        JOIN orders o2 ON oi2.order_id = o2.id
        WHERE o2.user_id = $1
        GROUP BY p2.category_id
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
      WHERE p.is_active = true
        AND p.inventory_quantity > 0
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi3
          JOIN orders o3 ON oi3.order_id = o3.id
          WHERE o3.user_id = $1 AND oi3.product_id = p.id
        )
      ORDER BY p.created_at DESC
      LIMIT 10
    `,
      [userId],
    )

    return result.rows
  } catch (error) {
    console.error("Product recommendations error:", error)
    return []
  }
}
