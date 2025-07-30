import nodemailer from "nodemailer"
import { query } from "@/lib/database/connection"

interface EmailData {
  to: string
  subject: string
  template: string
  data: Record<string, any>
  from?: string
}

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Email templates
const emailTemplates = {
  welcome: {
    subject: "Welcome to our store!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome {{firstName}}!</h1>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        <p>Start exploring our products and enjoy exclusive member benefits.</p>
        <a href="{{siteUrl}}/products" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Shop Now</a>
      </div>
    `,
  },

  abandoned_cart_1: {
    subject: "You left something in your cart",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Don't forget your items!</h1>
        <p>Hi {{firstName}}, you left some great items in your cart.</p>
        <div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
          {{#each items}}
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <img src="{{images.[0]}}" alt="{{en_name}}" style="width: 80px; height: 80px; object-fit: cover; margin-right: 15px;">
            <div>
              <h3>{{en_name}}</h3>
              <p>Quantity: {{quantity}}</p>
              <p>Price: ${{ price }}</p>
            </div>
          </div>
          {{/each}}
        </div>
        <p><strong>Total: ${{ totalAmount }}</strong></p>
        <a href="{{recoveryUrl}}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Complete Your Purchase</a>
      </div>
    `,
  },

  abandoned_cart_2: {
    subject: "Still thinking about your cart?",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Still interested?</h1>
        <p>Hi {{firstName}}, your items are still waiting for you!</p>
        <p>Don't miss out on these great products. Complete your purchase now.</p>
        <a href="{{recoveryUrl}}" style="background: #ffc107; color: black; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Return to Cart</a>
      </div>
    `,
  },

  abandoned_cart_3: {
    subject: "Last chance - 10% off your cart!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Last chance - Special offer inside!</h1>
        <p>Hi {{firstName}}, we don't want you to miss out!</p>
        <p>Use code <strong>{{discountCode}}</strong> for 10% off your cart.</p>
        <a href="{{recoveryUrl}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Claim Your Discount</a>
        <p><small>This offer expires in 24 hours.</small></p>
      </div>
    `,
  },

  order_confirmation: {
    subject: "Order Confirmation - #{{orderNumber}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Order Confirmed!</h1>
        <p>Hi {{firstName}}, thank you for your order!</p>
        <p><strong>Order Number:</strong> #{{orderNumber}}</p>
        <p><strong>Total:</strong> ${{ totalAmount }}</p>
        <p>We'll send you another email when your order ships.</p>
        <a href="{{siteUrl}}/orders/{{orderId}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Order</a>
      </div>
    `,
  },

  product_recommendations: {
    subject: "Products we think you'll love",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Recommended for you</h1>
        <p>Hi {{firstName}}, check out these products we think you'll love!</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
          {{#each recommendations}}
          <div style="border: 1px solid #ddd; padding: 15px; text-align: center;">
            <img src="{{images.[0]}}" alt="{{en_name}}" style="width: 100%; height: 200px; object-fit: cover; margin-bottom: 10px;">
            <h3>{{en_name}}</h3>
            <p>${{ price }}</p>
            <a href="{{../siteUrl}}/products/{{slug}}" style="background: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Product</a>
          </div>
          {{/each}}
        </div>
      </div>
    `,
  },
}

// Send email
export async function sendEmail(emailData: EmailData) {
  try {
    const template = emailTemplates[emailData.template as keyof typeof emailTemplates]
    if (!template) {
      throw new Error(`Email template '${emailData.template}' not found`)
    }

    // Compile template with data
    let html = template.html
    let subject = emailData.subject || template.subject

    // Replace placeholders
    const allData = {
      ...emailData.data,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    }

    for (const [key, value] of Object.entries(allData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
      html = html.replace(regex, String(value))
      subject = subject.replace(regex, String(value))
    }

    // Handle Handlebars-style loops for arrays
    html = html.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, template) => {
      const array = allData[arrayName]
      if (!Array.isArray(array)) return ""

      return array
        .map((item) => {
          let itemTemplate = template
          for (const [key, value] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
            itemTemplate = itemTemplate.replace(regex, String(value))
          }
          return itemTemplate
        })
        .join("")
    })

    const mailOptions = {
      from: emailData.from || process.env.SMTP_FROM,
      to: emailData.to,
      subject: subject,
      html: html,
    }

    const result = await transporter.sendMail(mailOptions)

    // Log email send
    await query(
      `
      INSERT INTO email_logs (
        recipient, subject, template, status, message_id, sent_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `,
      [emailData.to, subject, emailData.template, "sent", result.messageId],
    )

    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error("Email send error:", error)

    // Log failed email
    await query(
      `
      INSERT INTO email_logs (
        recipient, subject, template, status, error_message, sent_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `,
      [
        emailData.to,
        emailData.subject,
        emailData.template,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
      ],
    )

    throw error
  }
}

// Send bulk emails
export async function sendBulkEmails(emails: EmailData[]) {
  const results = []

  for (const email of emails) {
    try {
      const result = await sendEmail(email)
      results.push({ email: email.to, status: "sent", messageId: result.messageId })
    } catch (error) {
      results.push({
        email: email.to,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return results
}

// Verify email configuration
export async function verifyEmailConfig() {
  try {
    await transporter.verify()
    return { status: "healthy", timestamp: new Date().toISOString() }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
