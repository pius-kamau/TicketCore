import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration - optimized for Render
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // These settings help with Render's network
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  // Use IPv4 only
  family: 4,
};

export const transporter = nodemailer.createTransport(emailConfig);

export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error);
    return false;
  }
};

// Email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to TicketCore! 🎫',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #667eea;">Welcome to TicketCore!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for joining TicketCore. You can now book tickets for amazing events!</p>
        <p>Get started by browsing our events and booking your favorite seats.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 11px; color: #999; text-align: center;">&copy; 2026 TicketCore. All rights reserved.</p>
      </div>
    `,
  }),

  ticketConfirmation: async (name: string, eventName: string, seatNumber: string, date: Date, ticketCode: string, venueName?: string, appUrl?: string) => {
    const qrCodeUrl = `${appUrl}/api/tickets/qrcode/${ticketCode}`;
    
    return {
      subject: `🎫 Your Ticket for ${eventName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">Your Ticket</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <p style="margin: 8px 0;"><strong>Event:</strong> ${eventName}</p>
            <p style="margin: 8px 0;"><strong>Venue:</strong> ${venueName || 'Madison Square Garden'}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
            <p style="margin: 8px 0;"><strong>Seat:</strong> ${seatNumber}</p>
            <p style="margin: 8px 0;"><strong>Ticket Code:</strong> ${ticketCode}</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrCodeUrl}" alt="QR Code" style="width: 150px; height: 150px; border: 1px solid #ddd; padding: 10px;">
            <p style="font-size: 12px; color: #666; margin-top: 10px;">Scan this QR code at the venue</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="${appUrl}/api/tickets/verify/${ticketCode}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">View Ticket Online</a>
          </div>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 11px; color: #999; text-align: center;">TicketCore • Real-time Booking System</p>
        </body>
        </html>
      `,
    };
  },
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"TicketCore" <noreply@ticketcore.com>',
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error);
    return { success: false, error };
  }
};