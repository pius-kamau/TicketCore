import { Job } from 'bull';
import { emailQueue } from '../config/queue';
import { sendEmail, emailTemplates } from '../config/email';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import logger from '../utils/logger';

const appUrl = process.env.APP_URL || 'http://localhost:3001';

export const processEmailJob = async (job: Job) => {
  const { type, data } = job.data;
  
  logger.info(`Processing email job: ${type} for user ${data.userId}`);

  const userRepo = AppDataSource.getRepository(User);
  const ticketRepo = AppDataSource.getRepository(Ticket);

  const user = await userRepo.findOne({ where: { id: data.userId } });
  
  if (!user) {
    logger.error(`User not found: ${data.userId}`);
    return { success: false, error: 'User not found' };
  }

  let subject = '';
  let html = '';

  switch (type) {
    case 'welcome':
      subject = `Welcome to TicketCore, ${user.name}! 🎫`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">Welcome to TicketCore!</h2>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>Thank you for joining TicketCore. You can now book tickets for amazing events!</p>
          <p>Get started by browsing our events and booking your favorite seats.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${appUrl}/events" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Browse Events</a>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 11px; color: #999; text-align: center;">&copy; 2026 TicketCore. All rights reserved.</p>
        </div>
      `;
      logger.info(`Preparing welcome email for ${user.email}`);
      break;

    case 'ticket-confirmation':
      const ticket = await ticketRepo.findOne({
        where: { id: data.ticketId },
        relations: ['event', 'event.venue', 'user']
      });
      
      if (ticket) {
        const template = await emailTemplates.ticketConfirmation(
          user.name,
          ticket.event.title,
          ticket.seatNumber,
          ticket.event.date,
          ticket.ticketCode,
          ticket.event.venue?.name || ticket.event.location || 'Venue TBD',
          appUrl
        );
        subject = template.subject;
        html = template.html;
        logger.info(`Preparing ticket confirmation email for ${user.email}`);
      } else {
        logger.error(`Ticket not found: ${data.ticketId}`);
        return { success: false, error: 'Ticket not found' };
      }
      break;

    default:
      logger.warn(`Unknown email type: ${type}`);
      return { success: false, error: 'Unknown email type' };
  }

  if (subject && html) {
    const result = await sendEmail(user.email, subject, html);
    return result;
  }

  return { success: false, error: 'No email content generated' };
};

// Register processors
emailQueue.process('welcome', async (job: Job) => {
  return processEmailJob(job);
});

emailQueue.process('ticket-confirmation', async (job: Job) => {
  return processEmailJob(job);
});

// Event listeners with proper types
emailQueue.on('completed', (job: Job) => {
  logger.info(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Email job ${job?.id} failed: ${err.message}`);
});