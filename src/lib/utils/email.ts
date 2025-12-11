import { supabase } from '@/lib/supabase';

// Default sender email for Cactus Cup
export const DEFAULT_FROM_EMAIL = 'info@cactuscuphema.com';

// Cactus Cup brand colors
const COLORS = {
  turquoise: '#14b8a6',
  turquoiseDark: '#0d9488',
  orange: '#f97316',
  orangeHover: '#ea580c',
  yellow: '#eab308',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  grayDark: '#334155',
};

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
  content_type?: string;
}

export interface SendEmailRequest {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

export interface SendEmailResponse {
  success: boolean;
  data?: {
    id: string;
  };
  error?: string;
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject: string;
  html_content: string;
  text_content: string;
  available_variables: string[];
}

/**
 * Fetch an email template from the database
 */
async function fetchEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .single();

    if (error || !data) {
      console.warn(`Email template '${templateKey}' not found in database, using fallback`);
      return null;
    }

    return data as EmailTemplate;
  } catch (err) {
    console.error('Error fetching email template:', err);
    return null;
  }
}

/**
 * Replace template variables with actual values
 * Variables are in the format {{variableName}}
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value ?? '');
  }
  // Remove any remaining unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

/**
 * Email template wrapper with Cactus Cup branding
 */
function emailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cactus Cup</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Georgia', 'Times New Roman', serif; background-color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: ${COLORS.white}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.turquoise} 0%, ${COLORS.turquoiseDark} 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: ${COLORS.white}; font-size: 36px; font-weight: bold; letter-spacing: 2px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                ⚔️ CACTUS CUP ⚔️
              </h1>
              <p style="margin: 10px 0 0 0; color: ${COLORS.white}; font-size: 14px; opacity: 0.9; letter-spacing: 1px;">
                MESA, ARIZONA • JULY 17-19, 2026
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.grayLight}; padding: 30px; border-radius: 0 0 12px 12px; border-top: 3px solid ${COLORS.orange};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="text-align: center; padding-bottom: 15px;">
                    <p style="margin: 0 0 10px 0; color: ${COLORS.grayDark}; font-size: 14px; font-weight: bold;">
                      Arizona's hottest summer HEMA Tournament
                    </p>
                    <p style="margin: 0; color: ${COLORS.gray}; font-size: 12px; line-height: 1.6;">
                      Bringing together sword nerds from across the region for competition, learning, and community.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 15px; border-top: 1px solid #cbd5e1;">
                    <p style="margin: 0; color: ${COLORS.gray}; font-size: 11px;">
                      <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
                    </p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.gray}; font-size: 11px;">
                      © 2026 Cactus Cup. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send an email via Resend through Supabase Edge Function
 */
export async function sendEmail(
  request: SendEmailRequest
): Promise<SendEmailResponse> {
  try {
    if (!request.to || !request.from || !request.subject) {
      throw new Error('Missing required fields: to, from, subject');
    }

    if (!request.html && !request.text) {
      throw new Error('Either html or text content is required');
    }

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: request,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    if (!data || !data.success) {
      throw new Error('Invalid response from email service');
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err) {
    console.error('Email sending failed:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to send email';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send a welcome email to a new user
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const variables: Record<string, string> = {
    userName,
    userEmail,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('welcome_email');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: userEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.turquoise}; font-size: 28px; font-weight: bold;">
      Welcome to Cactus Cup 2026!
    </h2>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Greetings, <strong>${userName}</strong>!
    </p>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Thank you for creating your account for Cactus Cup 2026. We're thrilled to have you join Arizona's hottest summer HEMA tournament event!
    </p>

    <div style="background: linear-gradient(135deg, ${COLORS.turquoise}15 0%, ${COLORS.orange}15 100%); border-left: 4px solid ${COLORS.orange}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        Save the Date
      </h3>
      <p style="margin: 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
        <strong>July 17-19, 2026</strong><br>
        Mesa, Arizona
      </p>
    </div>

    <h3 style="margin: 30px 0 15px 0; color: ${COLORS.turquoiseDark}; font-size: 20px;">
      What's Next?
    </h3>

    <ul style="margin: 0; padding-left: 20px; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.8;">
      <li style="margin-bottom: 10px;">Browse available tournaments and workshops</li>
      <li style="margin-bottom: 10px;">Complete your registration for your chosen events</li>
      <li style="margin-bottom: 10px;">Review hotel partner information for accommodations</li>
      <li style="margin-bottom: 10px;">Join us for an unforgettable HEMA experience!</li>
    </ul>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/dashboard" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3);">
        Go to Dashboard
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 14px; line-height: 1.6;">
      If you have any questions, please don't hesitate to reach out to us at <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
    </p>

    <p style="margin: 25px 0 0 0; color: ${COLORS.grayDark}; font-size: 16px;">
      <strong>Stay Cool!</strong><br>
      The Cactus Cup Team
    </p>
  `;

  const text = `
WELCOME TO CACTUS CUP 2026!

Greetings, ${userName}!

Thank you for creating your account for Cactus Cup 2026. We're thrilled to have you join Arizona's hottest summer HEMA tournament event!

SAVE THE DATE
July 17-19, 2026
Mesa, Arizona

WHAT'S NEXT?
• Browse available tournaments and workshops
• Complete your registration for your chosen events
• Review hotel partner information for accommodations
• Join us for an unforgettable HEMA experience!

Visit your dashboard: https://cactuscuphema.com/dashboard

If you have any questions, please reach out to us at ${DEFAULT_FROM_EMAIL}

Stay Cool!
The Cactus Cup Team
  `;

  return sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: '⚔️ Welcome to Cactus Cup 2026!',
    html: emailTemplate(content),
    text,
  });
}

/**
 * Generate order items table HTML for email templates
 */
function generateOrderItemsTableHtml(
  orderItems: Array<{ name: string; quantity: number; price: number }> | undefined,
  formattedTotal: string,
  discountCode?: string,
  discountAmount?: number
): string {
  const discountRow = discountCode && discountAmount ? `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${COLORS.turquoise};">
        Discount (${discountCode})
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${COLORS.turquoise}; text-align: right;">
        -$${(discountAmount / 100).toFixed(2)}
      </td>
    </tr>
  ` : '';

  if (orderItems && orderItems.length > 0) {
    const itemsList = orderItems.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${COLORS.grayDark};">
          ${item.name} ${item.quantity > 1 ? `(×${item.quantity})` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${COLORS.grayDark}; text-align: right;">
          $${(item.price / 100).toFixed(2)}
        </td>
      </tr>
    `).join('');

    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: ${COLORS.turquoise};">
          <th style="padding: 15px 12px; text-align: left; color: ${COLORS.white}; font-size: 14px; font-weight: bold;">
            Item
          </th>
          <th style="padding: 15px 12px; text-align: right; color: ${COLORS.white}; font-size: 14px; font-weight: bold;">
            Price
          </th>
        </tr>
      </thead>
      <tbody>
        ${itemsList}
        ${discountRow}
      </tbody>
      <tfoot>
        <tr style="background-color: ${COLORS.grayLight};">
          <td style="padding: 15px 12px; font-weight: bold; color: ${COLORS.grayDark};">
            Total
          </td>
          <td style="padding: 15px 12px; text-align: right; font-weight: bold; color: ${COLORS.orange}; font-size: 18px;">
            $${formattedTotal}
          </td>
        </tr>
      </tfoot>
    </table>
    `;
  }

  return `
    <div style="background-color: ${COLORS.grayLight}; border-left: 4px solid ${COLORS.orange}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${discountRow ? `<tr>
          <td colspan="2" style="padding-bottom: 10px;">
            ${discountRow}
          </td>
        </tr>` : ''}
        <tr>
          <td style="color: ${COLORS.grayDark}; font-size: 16px; font-weight: bold;">
            Order Total
          </td>
          <td style="text-align: right; color: ${COLORS.orange}; font-size: 24px; font-weight: bold;">
            $${formattedTotal}
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
  userEmail: string,
  userName: string,
  orderId: string,
  orderTotal: number,
  orderItems?: Array<{ name: string; quantity: number; price: number }>,
  discountCode?: string,
  discountAmount?: number,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const formattedTotal = (orderTotal / 100).toFixed(2);
  const orderItemsTableHtml = generateOrderItemsTableHtml(orderItems, formattedTotal, discountCode, discountAmount);

  const variables: Record<string, string> = {
    userName,
    userEmail,
    orderId,
    orderTotal: `$${formattedTotal}`,
    orderItemsTable: orderItemsTableHtml,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('order_confirmation');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: userEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 10px 0; color: ${COLORS.turquoise}; font-size: 28px; font-weight: bold;">
      Order Confirmed!
    </h2>

    <p style="margin: 0 0 25px 0; color: ${COLORS.gray}; font-size: 14px;">
      Order #${orderId}
    </p>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Thank you, <strong>${userName}</strong>!
    </p>

    <p style="margin: 0 0 25px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Your payment has been successfully processed and your registration is confirmed. We can't wait to see you at Cactus Cup 2026!
    </p>

    ${orderItemsTableHtml}

    <div style="background: linear-gradient(135deg, ${COLORS.turquoise}15 0%, ${COLORS.yellow}15 100%); border-left: 4px solid ${COLORS.turquoise}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        Important Next Steps
      </h3>
      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">Complete your waiver form (if not already done)</li>
        <li style="margin-bottom: 8px;">Provide emergency contact information</li>
        <li style="margin-bottom: 8px;">Review tournament rules and schedule</li>
        <li>Check hotel partner information for accommodations</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/dashboard" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3);">
        View Order Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 14px; line-height: 1.6;">
      Questions about your order? Contact us at <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
    </p>

    <p style="margin: 25px 0 0 0; color: ${COLORS.grayDark}; font-size: 16px;">
      <strong>See you on the field!</strong><br>
      The Cactus Cup Team
    </p>
  `;

  const text = `
ORDER CONFIRMED!
Order #${orderId}

Thank you, ${userName}!

Your payment has been successfully processed and your registration is confirmed. We can't wait to see you at Cactus Cup 2026!

ORDER TOTAL: $${formattedTotal}

IMPORTANT NEXT STEPS:
• Complete your waiver form (if not already done)
• Provide emergency contact information
• Review tournament rules and schedule
• Check hotel partner information for accommodations

View your order details: https://cactuscuphema.com/dashboard

Questions about your order? Contact us at ${DEFAULT_FROM_EMAIL}

See you on the field!
The Cactus Cup Team
  `;

  return sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: `✅ Order Confirmation #${orderId} - Cactus Cup 2026`,
    html: emailTemplate(content),
    text,
  });
}

/**
 * Send tournament registration confirmation
 */
export async function sendTournamentRegistrationEmail(
  userEmail: string,
  userName: string,
  tournamentName: string,
  tournamentDate: string,
  experienceLevel?: string,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const formattedDate = new Date(tournamentDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate experience level row HTML for template
  const experienceLevelRow = experienceLevel ? `
    <tr>
      <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 4px 0;">
        Division
      </td>
      <td style="color: #ffffff; font-size: 16px; font-weight: bold; text-align: right; padding: 4px 0;">
        ${experienceLevel}
      </td>
    </tr>
  ` : '';

  const variables: Record<string, string> = {
    userName,
    userEmail,
    tournamentName,
    tournamentDate: formattedDate,
    experienceLevel: experienceLevel ? `Division: ${experienceLevel}\n` : '',
    experienceLevelRow,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('tournament_registration');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: userEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.turquoise}; font-size: 28px; font-weight: bold;">
      Tournament Registration Confirmed!
    </h2>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Congratulations, <strong>${userName}</strong>!
    </p>

    <p style="margin: 0 0 25px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      You're officially registered for <strong>${tournamentName}</strong> at Cactus Cup 2026. Sharpen your blade and prepare for battle!
    </p>

    <div style="background: linear-gradient(135deg, ${COLORS.turquoise} 0%, ${COLORS.turquoiseDark} 100%); padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.3);">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding-bottom: 15px;">
            <h3 style="margin: 0; color: ${COLORS.white}; font-size: 22px; font-weight: bold;">
              ${tournamentName}
            </h3>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.3);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 4px 0;">
                  Date
                </td>
                <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 4px 0;">
                  ${formattedDate}
                </td>
              </tr>
              ${experienceLevelRow}
              <tr>
                <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 4px 0;">
                  Location
                </td>
                <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 4px 0;">
                  Mesa, AZ
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: ${COLORS.grayLight}; border-left: 4px solid ${COLORS.orange}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        Before the Tournament
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.8;">
        <li style="margin-bottom: 8px;"><strong>Complete your waiver</strong> - Required before competition</li>
        <li style="margin-bottom: 8px;"><strong>Update emergency contact</strong> - Ensure it's current</li>
        <li style="margin-bottom: 8px;"><strong>Review tournament rules</strong> - Know the regulations</li>
        <li style="margin-bottom: 8px;"><strong>Check equipment requirements</strong> - Ensure compliance</li>
        <li><strong>Arrive early</strong> - Check-in opens 1 hour before start</li>
      </ul>
    </div>

    <div style="background: linear-gradient(135deg, ${COLORS.yellow}15 0%, ${COLORS.orange}15 100%); border: 2px solid ${COLORS.yellow}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="text-align: center; padding-bottom: 10px;">
            <span style="font-size: 32px;">&#127942;</span>
          </td>
        </tr>
        <tr>
          <td style="text-align: center;">
            <p style="margin: 0; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.6;">
              <strong>Good luck in the tournament!</strong><br>
              May your strikes be true and your defense impenetrable.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/dashboard" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3); margin-right: 10px;">
        View Registration
      </a>
      <a href="https://hemascorecard.com/" style="display: inline-block; background-color: ${COLORS.turquoise}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.3);">
        Tournament Rules
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 14px; line-height: 1.6;">
      Questions? We're here to help at <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
    </p>

    <p style="margin: 25px 0 0 0; color: ${COLORS.grayDark}; font-size: 16px;">
      <strong>Stay Cool!</strong><br>
      The Cactus Cup Team
    </p>
  `;

  const text = `
TOURNAMENT REGISTRATION CONFIRMED!

Congratulations, ${userName}!

You're officially registered for ${tournamentName} at Cactus Cup 2026. Sharpen your blade and prepare for battle!

TOURNAMENT DETAILS:
Tournament: ${tournamentName}
Date: ${formattedDate}
${experienceLevel ? `Division: ${experienceLevel}\n` : ''}Location: Mesa, Arizona

BEFORE THE TOURNAMENT:
• Complete your waiver - Required before competition
• Update emergency contact - Ensure it's current
• Review tournament rules - Know the regulations
• Check equipment requirements - Ensure compliance
• Arrive early - Check-in opens 1 hour before start

Good luck in the tournament!
May your strikes be true and your defense impenetrable.

View your registration: https://cactuscuphema.com/dashboard
Tournament rules: https://hemascorecard.com/

Questions? We're here to help at ${DEFAULT_FROM_EMAIL}

Stay Cool!
The Cactus Cup Team
  `;

  return sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: `⚔️ Tournament Registration Confirmed - ${tournamentName}`,
    html: emailTemplate(content),
    text,
  });
}

/**
 * Send activity/workshop registration confirmation
 */
export async function sendActivityRegistrationEmail(
  userEmail: string,
  userName: string,
  activityTitle: string,
  activityDate: string,
  activityTime?: string,
  activityDescription?: string,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const formattedDate = new Date(activityDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate time row HTML for template
  const activityTimeRow = activityTime ? `
    <tr>
      <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
        Time
      </td>
      <td style="color: #ffffff; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
        ${activityTime}
      </td>
    </tr>
  ` : '';

  // Generate description block HTML for template
  const activityDescriptionBlock = activityDescription ? `
    <p style="margin: 0 0 15px 0; color: rgba(255,255,255,0.9); font-size: 15px; line-height: 1.6; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.3);">
      ${activityDescription}
    </p>
  ` : '';

  const variables: Record<string, string> = {
    userName,
    userEmail,
    activityTitle,
    activityDate: formattedDate,
    activityTime: activityTime ? `Time: ${activityTime}\n` : '',
    activityTimeRow,
    activityDescription: activityDescription || '',
    activityDescriptionBlock,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('activity_registration');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: userEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.turquoise}; font-size: 28px; font-weight: bold;">
      Workshop Registration Confirmed!
    </h2>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Excellent choice, <strong>${userName}</strong>!
    </p>

    <p style="margin: 0 0 25px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      You're registered for this workshop at Cactus Cup 2026. Get ready to expand your knowledge and refine your skills!
    </p>

    <div style="background: linear-gradient(135deg, ${COLORS.turquoise} 0%, ${COLORS.turquoiseDark} 100%); padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.3);">
      <h3 style="margin: 0 0 15px 0; color: ${COLORS.white}; font-size: 22px; font-weight: bold;">
        ${activityTitle}
      </h3>
      ${activityDescriptionBlock}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
            Date
          </td>
          <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
            ${formattedDate}
          </td>
        </tr>
        ${activityTimeRow}
        <tr>
          <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
            Location
          </td>
          <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
            Mesa, AZ
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: ${COLORS.grayLight}; border-left: 4px solid ${COLORS.yellow}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        What to Bring
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">Your enthusiasm and willingness to learn</li>
        <li style="margin-bottom: 8px;">Appropriate training gear and equipment</li>
        <li style="margin-bottom: 8px;">Water bottle to stay hydrated</li>
        <li>Notebook for taking notes (optional)</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/dashboard" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3);">
        View Registration
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 14px; line-height: 1.6;">
      Questions about this workshop? Contact us at <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
    </p>

    <p style="margin: 25px 0 0 0; color: ${COLORS.grayDark}; font-size: 16px;">
      <strong>See you at the workshop!</strong><br>
      The Cactus Cup Team
    </p>
  `;

  const text = `
WORKSHOP REGISTRATION CONFIRMED!

Excellent choice, ${userName}!

You're registered for this workshop at Cactus Cup 2026. Get ready to expand your knowledge and refine your skills!

WORKSHOP DETAILS:
Workshop: ${activityTitle}
Date: ${formattedDate}
${activityTime ? `Time: ${activityTime}\n` : ''}Location: Mesa, Arizona

${activityDescription ? `${activityDescription}\n` : ''}
WHAT TO BRING:
• Your enthusiasm and willingness to learn
• Appropriate training gear and equipment
• Water bottle to stay hydrated
• Notebook for taking notes (optional)

View your registration: https://cactuscuphema.com/dashboard

Questions about this workshop? Contact us at ${DEFAULT_FROM_EMAIL}

See you at the workshop!
The Cactus Cup Team
  `;

  return sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: `📚 Workshop Confirmed - ${activityTitle}`,
    html: emailTemplate(content),
    text,
  });
}

/**
 * Send special event registration confirmation
 */
export async function sendSpecialEventRegistrationEmail(
  userEmail: string,
  userName: string,
  eventTitle: string,
  eventDate: string,
  eventTime?: string,
  ticketPrice?: number,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate time row HTML for template
  const eventTimeRow = eventTime ? `
    <tr>
      <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
        Time
      </td>
      <td style="color: #ffffff; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
        ${eventTime}
      </td>
    </tr>
  ` : '';

  // Generate ticket price row HTML for template
  const ticketPriceRow = ticketPrice ? `
    <tr>
      <td colspan="2" style="padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="color: rgba(255,255,255,0.9); font-size: 14px;">
              Ticket Price
            </td>
            <td style="color: #ffffff; font-size: 20px; font-weight: bold; text-align: right;">
              $${(ticketPrice / 100).toFixed(2)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  const variables: Record<string, string> = {
    userName,
    userEmail,
    eventTitle,
    eventDate: formattedDate,
    eventTime: eventTime ? `Time: ${eventTime}\n` : '',
    eventTimeRow,
    ticketPrice: ticketPrice ? `Ticket Price: $${(ticketPrice / 100).toFixed(2)}\n` : '',
    ticketPriceRow,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('special_event_registration');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: userEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.orange}; font-size: 28px; font-weight: bold;">
      Special Event Registration Confirmed!
    </h2>

    <p style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      Greetings, <strong>${userName}</strong>!
    </p>

    <p style="margin: 0 0 25px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      You're registered for an exclusive special event at Cactus Cup 2026. This promises to be a memorable experience!
    </p>

    <div style="background: linear-gradient(135deg, ${COLORS.orange} 0%, ${COLORS.orangeHover} 100%); padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.4);">
      <h3 style="margin: 0 0 15px 0; color: ${COLORS.white}; font-size: 22px; font-weight: bold;">
        ${eventTitle}
      </h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
            Date
          </td>
          <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
            ${formattedDate}
          </td>
        </tr>
        ${eventTimeRow}
        <tr>
          <td style="color: rgba(255,255,255,0.9); font-size: 14px; padding: 6px 0;">
            Location
          </td>
          <td style="color: ${COLORS.white}; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">
            Mesa, AZ
          </td>
        </tr>
        ${ticketPriceRow}
      </table>
    </div>

    <div style="background: linear-gradient(135deg, ${COLORS.yellow}15 0%, ${COLORS.orange}15 100%); border: 2px dashed ${COLORS.orange}; padding: 20px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
        <strong>This email serves as your confirmation</strong><br>
        <span style="font-size: 14px;">Please bring a printed or digital copy to the event</span>
      </p>
    </div>

    <div style="background-color: ${COLORS.grayLight}; border-left: 4px solid ${COLORS.turquoise}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        Event Information
      </h3>
      <p style="margin: 0; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.8;">
        Additional event details, dress code (if applicable), and any special instructions will be sent closer to the event date. Stay tuned!
      </p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/dashboard" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3);">
        View Registration
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 14px; line-height: 1.6;">
      Questions about this event? Contact us at <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color: ${COLORS.turquoise}; text-decoration: none;">${DEFAULT_FROM_EMAIL}</a>
    </p>

    <p style="margin: 25px 0 0 0; color: ${COLORS.grayDark}; font-size: 16px;">
      <strong>We look forward to seeing you!</strong><br>
      The Cactus Cup Team
    </p>
  `;

  const text = `
SPECIAL EVENT REGISTRATION CONFIRMED!

Greetings, ${userName}!

You're registered for an exclusive special event at Cactus Cup 2026. This promises to be a memorable experience!

EVENT DETAILS:
Event: ${eventTitle}
Date: ${formattedDate}
${eventTime ? `Time: ${eventTime}\n` : ''}Location: Mesa, Arizona
${ticketPrice ? `Ticket Price: $${(ticketPrice / 100).toFixed(2)}\n` : ''}
This email serves as your confirmation.
Please bring a printed or digital copy to the event.

EVENT INFORMATION:
Additional event details, dress code (if applicable), and any special instructions will be sent closer to the event date. Stay tuned!

View your registration: https://cactuscuphema.com/dashboard

Questions about this event? Contact us at ${DEFAULT_FROM_EMAIL}

We look forward to seeing you!
The Cactus Cup Team
  `;

  return sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: `🎉 Special Event Confirmed - ${eventTitle}`,
    html: emailTemplate(content),
    text,
  });
}

/**
 * Send inventory/capacity notification to admin
 */
export async function sendInventoryNotificationEmail(
  adminEmail: string,
  resourceType: 'tournament' | 'activity' | 'special_event',
  resourceName: string,
  currentCount: number,
  maxCapacity: number,
  percentageFull: number,
  fromEmail: string = DEFAULT_FROM_EMAIL
): Promise<SendEmailResponse> {
  const resourceTypeLabel = resourceType === 'special_event' ? 'Special Event' : resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  const urgencyColor = percentageFull >= 95 ? '#dc2626' : percentageFull >= 90 ? COLORS.orange : COLORS.yellow;
  const urgencyLabel = percentageFull >= 95 ? 'CRITICAL' : percentageFull >= 90 ? 'HIGH' : 'MODERATE';

  const variables: Record<string, string> = {
    resourceType: resourceType.toLowerCase(),
    resourceTypeLabel,
    resourceName,
    currentCount: currentCount.toString(),
    maxCapacity: maxCapacity.toString(),
    percentageFull: percentageFull.toFixed(1),
    urgencyColor,
    urgencyLabel,
  };

  // Try to fetch template from database
  const template = await fetchEmailTemplate('inventory_notification');

  if (template) {
    const subject = substituteVariables(template.subject, variables);
    const htmlContent = substituteVariables(template.html_content, variables);
    const textContent = substituteVariables(template.text_content, variables);

    return sendEmail({
      to: adminEmail,
      from: fromEmail,
      subject,
      html: emailTemplate(htmlContent),
      text: textContent,
    });
  }

  // Fallback to hardcoded template
  const content = `
    <h2 style="margin: 0 0 10px 0; color: ${urgencyColor}; font-size: 28px; font-weight: bold;">
      Capacity Alert!
    </h2>

    <p style="margin: 0 0 25px 0; color: ${COLORS.gray}; font-size: 14px;">
      ${urgencyLabel} - Immediate attention may be required
    </p>

    <p style="margin: 0 0 25px 0; color: ${COLORS.grayDark}; font-size: 16px; line-height: 1.6;">
      A ${resourceTypeLabel.toLowerCase()} has reached its capacity threshold and requires your attention.
    </p>

    <div style="background: linear-gradient(135deg, ${urgencyColor}15 0%, ${urgencyColor}25 100%); border: 3px solid ${urgencyColor}; padding: 25px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: ${COLORS.grayDark}; font-size: 20px; font-weight: bold;">
        ${resourceName}
      </h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.gray}; font-size: 14px;">Type:</span>
          </td>
          <td style="text-align: right; padding: 8px 0;">
            <span style="color: ${COLORS.grayDark}; font-size: 16px; font-weight: bold;">${resourceTypeLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.gray}; font-size: 14px;">Current Registrations:</span>
          </td>
          <td style="text-align: right; padding: 8px 0;">
            <span style="color: ${COLORS.grayDark}; font-size: 16px; font-weight: bold;">${currentCount}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.gray}; font-size: 14px;">Maximum Capacity:</span>
          </td>
          <td style="text-align: right; padding: 8px 0;">
            <span style="color: ${COLORS.grayDark}; font-size: 16px; font-weight: bold;">${maxCapacity}</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 15px;">
            <div style="background-color: ${COLORS.white}; border-radius: 20px; height: 30px; position: relative; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(90deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); height: 100%; width: ${percentageFull}%; border-radius: 20px;"></div>
              <span style="color: ${COLORS.grayDark}; font-size: 14px; font-weight: bold; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
                ${percentageFull.toFixed(1)}% Full
              </span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: ${COLORS.grayLight}; border-left: 4px solid ${COLORS.turquoise}; padding: 20px; margin: 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: ${COLORS.turquoiseDark}; font-size: 18px;">
        Recommended Actions
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.grayDark}; font-size: 15px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">Review current registrations in the admin panel</li>
        <li style="margin-bottom: 8px;">Consider increasing capacity if possible</li>
        <li style="margin-bottom: 8px;">Monitor waitlist and additional interest</li>
        <li style="margin-bottom: 8px;">Prepare communications for when capacity is reached</li>
        <li>Update website messaging if nearing full capacity</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://cactuscuphema.com/admin" style="display: inline-block; background-color: ${COLORS.orange}; color: ${COLORS.white}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.3);">
        Go to Admin Panel
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: ${COLORS.gray}; font-size: 13px; line-height: 1.6; font-style: italic;">
      This is an automated notification based on your configured capacity threshold settings. You can adjust these settings in the admin panel under Site Settings.
    </p>
  `;

  const text = `
CAPACITY ALERT!
${urgencyLabel} - Immediate attention may be required

A ${resourceTypeLabel.toLowerCase()} has reached its capacity threshold and requires your attention.

DETAILS:
Resource: ${resourceName}
Type: ${resourceTypeLabel}
Current Registrations: ${currentCount}
Maximum Capacity: ${maxCapacity}
Capacity: ${percentageFull.toFixed(1)}% Full

RECOMMENDED ACTIONS:
• Review current registrations in the admin panel
• Consider increasing capacity if possible
• Monitor waitlist and additional interest
• Prepare communications for when capacity is reached
• Update website messaging if nearing full capacity

Go to admin panel: https://cactuscuphema.com/admin

---
This is an automated notification based on your configured capacity threshold settings.
  `;

  return sendEmail({
    to: adminEmail,
    from: fromEmail,
    subject: `🚨 Capacity Alert: ${resourceName} at ${percentageFull.toFixed(0)}%`,
    html: emailTemplate(content),
    text,
  });
}
