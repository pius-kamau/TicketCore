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
      subject = emailTemplates.welcome(user.name).subject;
      html = emailTemplates.welcome(user.name).html;
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