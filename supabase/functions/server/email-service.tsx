// Email service using Resend API
import * as kv from "./kv_store.tsx";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface OrderEmailData {
  orderId: string;
  orderDate: string;
  requestorName: string;
  requestorEmail: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  status?: string;
  notes?: string;
  approverName?: string;
}

// Check if email notifications are enabled globally
export async function isEmailEnabled(): Promise<boolean> {
  const settings = await kv.get('settings:email');
  return settings?.enabled === true;
}

// Check if user wants to receive a specific type of email
export async function shouldSendEmail(userId: string, emailType: string): Promise<boolean> {
  // Check global setting first
  const globalEnabled = await isEmailEnabled();
  if (!globalEnabled) {
    return false;
  }

  // Check user preferences
  const userPrefs = await kv.get(`user:${userId}:email-prefs`);
  if (!userPrefs) {
    // Default to true if no preferences set
    return true;
  }

  // Check specific email type preference
  return userPrefs[emailType] !== false;
}

// Get user email address
export async function getUserEmail(userId: string): Promise<string | null> {
  const userData = await kv.get(`user:${userId}`);
  return userData?.email || null;
}

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send email via Resend API with retry logic for rate limiting
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  if (!to || !to.includes('@')) {
    console.error('Invalid email address:', to);
    return false;
  }

  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${backoffMs}ms delay...`);
        await delay(backoffMs);
      }

      console.log(`Sending email to ${to}: ${subject} (attempt ${attempt + 1})`);
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Inventory System <notifications@resend.dev>',
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`Rate limited by Resend API (429): ${errorText}`);
        if (attempt < maxRetries) {
          continue; // Will retry after backoff
        }
        console.error('Resend API rate limit exceeded after all retries');
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resend API error:', response.status, errorText);
        return false;
      }

      const result = await response.json();
      console.log('Email sent successfully:', result.id);
      return true;
    } catch (error) {
      console.error(`Error sending email (attempt ${attempt + 1}):`, error);
      if (attempt >= maxRetries) {
        return false;
      }
    }
  }

  return false;
}

// Email Templates

export function getOrderSubmittedTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#128276; New Order Requires Approval</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello,</p>
      <p style="color: #333333;">A new inventory order has been submitted and requires your approval.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="color: #333333;"><strong>Submitted by:</strong> ${data.requestorName}</p>
        <p style="color: #333333;"><strong>Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Requested:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/approvals" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">Review Order</a>
      </p>
      
      <p style="color: #333333;">Please review and approve or deny this request at your earliest convenience.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
New Order Requires Approval

Order ID: ${data.orderId}
Submitted by: ${data.requestorName}
Date: ${new Date(data.orderDate).toLocaleDateString()}

Items Requested:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

Please review this order in the system: ${getBaseUrl()}/approvals
  `;

  return {
    subject: `New Order #${data.orderId} Requires Approval`,
    html,
    text,
  };
}

export function getOrderApprovedTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #15803d; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#9989; Your Order Has Been Approved</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello ${data.requestorName},</p>
      <p style="color: #333333;">Good news! Your inventory order has been approved and is now being processed.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        ${data.approverName ? `<p style="color: #333333;"><strong>Approved by:</strong> ${data.approverName}</p>` : ''}
        <p style="color: #333333;"><strong>Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Approved:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
        
        ${data.notes ? `<p style="color: #333333;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background-color: #15803d; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">View Order Details</a>
      </p>
      
      <p style="color: #333333;">Your order will be fulfilled shortly and you'll receive another notification when it's ready.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Your Order Has Been Approved

Order ID: ${data.orderId}
${data.approverName ? `Approved by: ${data.approverName}` : ''}
Date: ${new Date(data.orderDate).toLocaleDateString()}

Items Approved:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

${data.notes ? `Notes: ${data.notes}` : ''}

Your order will be fulfilled shortly.
View details: ${getBaseUrl()}/orders/${data.orderId}
  `;

  return {
    subject: `Order #${data.orderId} Approved ✅`,
    html,
    text,
  };
}

export function getOrderDeniedTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
    .note { background-color: #fef2f2; border-left: 4px solid #b91c1c; padding: 12px; margin: 20px 0; color: #333333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#10060; Order Not Approved</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello ${data.requestorName},</p>
      <p style="color: #333333;">We regret to inform you that your inventory order was not approved.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        ${data.approverName ? `<p style="color: #333333;"><strong>Reviewed by:</strong> ${data.approverName}</p>` : ''}
        <p style="color: #333333;"><strong>Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Requested:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
      </div>
      
      ${data.notes ? `
      <div class="note" style="background-color: #fef2f2; border-left: 4px solid #b91c1c; padding: 12px; margin: 20px 0; color: #333333;">
        <strong>Reason for denial:</strong><br>
        ${data.notes}
      </div>
      ` : ''}
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background-color: #b91c1c; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">View Order Details</a>
      </p>
      
      <p style="color: #333333;">If you have questions about this decision, please contact the approver or your manager.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Order Not Approved

Order ID: ${data.orderId}
${data.approverName ? `Reviewed by: ${data.approverName}` : ''}
Date: ${new Date(data.orderDate).toLocaleDateString()}

Items Requested:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

${data.notes ? `Reason for denial: ${data.notes}` : ''}

View details: ${getBaseUrl()}/orders/${data.orderId}
  `;

  return {
    subject: `Order #${data.orderId} Not Approved ❌`,
    html,
    text,
  };
}

export function getOrderFulfilledTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #15803d; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
    .success-badge { background-color: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#128230; Your Order Is Ready!</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello ${data.requestorName},</p>
      <p style="text-align: center;">
        <span style="background-color: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold;">&#10003; ORDER FULFILLED</span>
      </p>
      <p style="color: #333333;">Great news! Your inventory order has been fulfilled and is ready for pickup.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="color: #333333;"><strong>Fulfilled Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Fulfilled:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
        
        ${data.notes ? `<p style="color: #333333;"><strong>Fulfillment Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background-color: #15803d; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">View Order Details</a>
      </p>
      
      <p style="color: #333333;">Please pick up your items at your earliest convenience.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Your Order Is Ready!

Order ID: ${data.orderId}
Fulfilled Date: ${new Date().toLocaleDateString()}

Items Fulfilled:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

${data.notes ? `Fulfillment Notes: ${data.notes}` : ''}

Please pick up your items at your earliest convenience.
View details: ${getBaseUrl()}/orders/${data.orderId}
  `;

  return {
    subject: `Order #${data.orderId} Ready for Pickup 📦`,
    html,
    text,
  };
}

export function getOrderSubmittedDirectTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#128230; New Order Ready for Fulfillment</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello,</p>
      <p style="color: #333333;">A new inventory order has been submitted and is ready for fulfillment.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="color: #333333;"><strong>Submitted by:</strong> ${data.requestorName}</p>
        <p style="color: #333333;"><strong>Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Requested:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
        
        ${data.notes ? `<p style="color: #333333;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/fulfillment" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">View in Fulfillment Dashboard</a>
      </p>
      
      <p style="color: #333333;">Please process this order at your earliest convenience.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
New Order Ready for Fulfillment

Order ID: ${data.orderId}
Submitted by: ${data.requestorName}
Date: ${new Date(data.orderDate).toLocaleDateString()}

Items Requested:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

${data.notes ? `Notes: ${data.notes}` : ''}

Please process this order in the system: ${getBaseUrl()}/fulfillment
  `;

  return {
    subject: `New Order #${data.orderId} Ready for Fulfillment`,
    html,
    text,
  };
}

export function getOrderSubmittedConfirmationTemplate(data: OrderEmailData): EmailTemplate {
  const itemsList = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #15803d; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .content p { color: #333333; }
    .order-info { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info p { color: #333333; }
    .order-info h3 { color: #111827; }
    .order-info h4 { color: #111827; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    ul { padding-left: 20px; color: #333333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">&#9989; Order Submitted Successfully</h1>
    </div>
    <div class="content">
      <p style="color: #333333;">Hello ${data.requestorName},</p>
      <p style="color: #333333;">Thank you for your order! We've received your request and it's being processed.</p>
      
      <div class="order-info">
        <h3 style="color: #111827;">Order Details</h3>
        <p style="color: #333333;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="color: #333333;"><strong>Submitted:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        
        <h4 style="color: #111827;">Items Requested:</h4>
        <ul style="color: #333333;">
          ${itemsList}
        </ul>
        
        ${data.notes ? `<p style="color: #333333;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p style="text-align: center;">
        <a href="${getBaseUrl()}/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background-color: #15803d; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px;">View Order Status</a>
      </p>
      
      <p style="color: #333333;">You'll receive another notification when your order status changes.</p>
    </div>
    <div class="footer">
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from your Inventory Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Order Submitted Successfully

Hello ${data.requestorName},

Thank you for your order! We've received your request and it's being processed.

Order ID: ${data.orderId}
Submitted: ${new Date(data.orderDate).toLocaleDateString()}

Items Requested:
${data.items.map(item => `- ${item.name}: ${item.quantity}`).join('\n')}

${data.notes ? `Notes: ${data.notes}` : ''}

You'll receive another notification when your order status changes.
View details: ${getBaseUrl()}/orders/${data.orderId}
  `;

  return {
    subject: `Order #${data.orderId} Submitted Successfully`,
    html,
    text,
  };
}

// Helper function to get base URL for links in emails
function getBaseUrl(): string {
  // Use the static Figma export site URL
  return 'https://export-dice-05753835.figma.site';
}

// Send order notification emails based on event type
export async function sendOrderEmail(
  eventType: 'submitted' | 'approved' | 'denied' | 'fulfilled' | 'submitted_direct' | 'submitted_confirmation',
  orderData: OrderEmailData,
  recipientUserId: string
): Promise<boolean> {
  console.log(`=== sendOrderEmail called ===`);
  console.log(`Event Type: ${eventType}`);
  console.log(`Order ID: ${orderData.orderId}`);
  console.log(`Recipient User ID: ${recipientUserId}`);

  // Check if user wants this type of email
  const emailTypeMap = {
    submitted: 'onOrderSubmitted',
    submitted_direct: 'onOrderSubmitted', // Use same preference as submitted
    approved: 'onOrderApproved',
    denied: 'onOrderDenied',
    fulfilled: 'onOrderFulfilled',
    submitted_confirmation: 'onOrderSubmitted',
  };

  // Check global setting first
  const globalEnabled = await isEmailEnabled();
  console.log(`Global email enabled: ${globalEnabled}`);
  
  if (!globalEnabled) {
    console.log(`⚠️ Email not sent: Global email notifications are DISABLED. Enable them in Admin Settings > Email Notifications.`);
    return false;
  }

  const shouldSend = await shouldSendEmail(recipientUserId, emailTypeMap[eventType]);
  console.log(`Should send to user ${recipientUserId}: ${shouldSend}`);
  
  if (!shouldSend) {
    console.log(`⚠️ Email not sent: User ${recipientUserId} has disabled ${eventType} emails in their preferences.`);
    return false;
  }

  const recipientEmail = await getUserEmail(recipientUserId);
  console.log(`Recipient email address: ${recipientEmail || 'NOT FOUND'}`);
  
  if (!recipientEmail) {
    console.log(`⚠️ Email not sent: No email address found for user ${recipientUserId}`);
    return false;
  }

  // Check for custom template first
  const customTemplate = await kv.get(`email-template:${eventType}`);
  
  let template: EmailTemplate;
  
  if (customTemplate) {
    console.log(`Using custom template for ${eventType}`);
    // Replace placeholders in custom template
    template = {
      subject: replacePlaceholders(customTemplate.subject, orderData),
      html: replacePlaceholders(customTemplate.htmlBody, orderData),
      text: replacePlaceholders(customTemplate.textBody, orderData),
    };
  } else {
    console.log(`Using default template for ${eventType}`);
    // Use default templates
    switch (eventType) {
      case 'submitted':
        template = getOrderSubmittedTemplate(orderData);
        break;
      case 'submitted_direct':
        template = getOrderSubmittedDirectTemplate(orderData);
        break;
      case 'approved':
        template = getOrderApprovedTemplate(orderData);
        break;
      case 'denied':
        template = getOrderDeniedTemplate(orderData);
        break;
      case 'fulfilled':
        template = getOrderFulfilledTemplate(orderData);
        break;
      case 'submitted_confirmation':
        template = getOrderSubmittedConfirmationTemplate(orderData);
        break;
      default:
        console.error('Unknown email event type:', eventType);
        return false;
    }
  }

  console.log(`Attempting to send email: "${template.subject}" to ${recipientEmail}`);
  const result = await sendEmail(recipientEmail, template.subject, template.html, template.text);
  console.log(`Email send result: ${result ? 'SUCCESS ✓' : 'FAILED ✗'}`);
  console.log(`=== sendOrderEmail complete ===`);
  
  return result;
}

// Helper function to replace placeholders in templates
function replacePlaceholders(template: string, data: OrderEmailData): string {
  const itemsList = data.items
    .map(item => `${item.name} - Quantity: ${item.quantity}`)
    .join('\n');
  
  const itemsListHtml = data.items
    .map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`)
    .join('');
  
  return template
    .replace(/\{\{orderId\}\}/g, data.orderId)
    .replace(/\{\{orderDate\}\}/g, new Date(data.orderDate).toLocaleDateString())
    .replace(/\{\{requestorName\}\}/g, data.requestorName)
    .replace(/\{\{requestorEmail\}\}/g, data.requestorEmail)
    .replace(/\{\{approverName\}\}/g, data.approverName || '')
    .replace(/\{\{status\}\}/g, data.status || '')
    .replace(/\{\{notes\}\}/g, data.notes || '')
    .replace(/\{\{itemsList\}\}/g, itemsList)
    .replace(/\{\{itemsListHtml\}\}/g, itemsListHtml)
    .replace(/\{\{baseUrl\}\}/g, getBaseUrl())
    .replace(/\{\{today\}\}/g, new Date().toLocaleDateString());
}