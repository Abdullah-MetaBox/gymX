import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'noreply@gymx.local';

export async function sendInvoiceEmail(
  toEmail: string,
  payerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return { ok: true };
  }

  const amountFormatted = (amount / 100).toLocaleString('en-MU', {
    style: 'currency',
    currency: 'MUR',
    maximumFractionDigits: 0,
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `Invoice ${invoiceNumber} from GymX`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Invoice Notification</h2>
              <p>Hi ${payerName},</p>
              <p>A new invoice has been created for your membership.</p>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                <p><strong>Amount Due:</strong> <span style="font-size: 1.5em; color: #0f766e;">${amountFormatted}</span></p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
              </div>

              <p>Please ensure payment is made by the due date to avoid suspension of your membership.</p>
              <p>If you have any questions, please contact the gym directly.</p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
              <p style="font-size: 0.9em; color: #666;">GymX Management System</p>
            </div>
          </body>
        </html>
      `,
    });

    return { ok: true, data: result };
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return { ok: false, error: String(error) };
  }
}

export async function sendOverdueNotificationEmail(
  toEmail: string,
  payerName: string,
  invoiceNumber: string,
  amount: number,
  daysOverdue: number,
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return { ok: true };
  }

  const amountFormatted = (amount / 100).toLocaleString('en-MU', {
    style: 'currency',
    currency: 'MUR',
    maximumFractionDigits: 0,
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `⚠️ Payment Overdue - Invoice ${invoiceNumber}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #ef4444;">Payment Overdue</h2>
              <p>Hi ${payerName},</p>
              <p>Your payment is now <strong>${daysOverdue} days overdue</strong>. Please settle your account immediately to avoid suspension of your membership.</p>

              <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                <p><strong>Amount Due:</strong> <span style="font-size: 1.5em; color: #ef4444;">${amountFormatted}</span></p>
                <p style="margin-top: 10px; font-weight: bold;">Action Required: Please make payment immediately</p>
              </div>

              <p>If payment has already been made, please disregard this notice. If you have any issues, contact the gym immediately.</p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
              <p style="font-size: 0.9em; color: #666;">GymX Management System</p>
            </div>
          </body>
        </html>
      `,
    });

    return { ok: true, data: result };
  } catch (error) {
    console.error('Failed to send overdue notification email:', error);
    return { ok: false, error: String(error) };
  }
}
