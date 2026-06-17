import { Job } from 'bull';
import { ticketQueue, emailQueue } from '../config/queue';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/Ticket';
import logger from '../utils/logger';

export const processTicketJob = async (job: Job) => {
  const { ticketId, userId, reservationId, ticketCode } = job.data;
  
  logger.info(`Processing ticket job for ticket ${ticketId}`);

  const ticketRepo = AppDataSource.getRepository(Ticket);
  
  const ticket = await ticketRepo.findOne({
    where: { id: ticketId },
    relations: ['user', 'event', 'event.venue', 'reservation', 'reservation.seat']
  });
  
  if (ticket) {
    await emailQueue.add('ticket-confirmation', {
      type: 'ticket-confirmation',
      data: {
        userId,
        ticketId,
        reservationId,
        ticketCode: ticket.ticketCode,
      },
    });
    
    logger.info(`Ticket ${ticket.ticketCode} queued for email`);
  } else {
    logger.error(`Ticket not found: ${ticketId}`);
  }
  
  return { success: true };
};

ticketQueue.process('ticket', async (job: Job) => {
  return processTicketJob(job);
});

ticketQueue.on('completed', (job: Job) => {
  logger.info(`Ticket job ${job.id} completed`);
});

ticketQueue.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Ticket job ${job?.id} failed: ${err.message}`);
});