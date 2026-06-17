import { Request, Response } from 'express';
import { emailQueue, reservationExpiryQueue, ticketQueue, notificationQueue } from '../config/queue';
import logger from '../utils/logger';

export class QueueController {
  static async getQueueStatus(req: Request, res: Response) {
    try {
      const queues = {
        email: {
          waiting: await emailQueue.getWaitingCount(),
          active: await emailQueue.getActiveCount(),
          completed: await emailQueue.getCompletedCount(),
          failed: await emailQueue.getFailedCount(),
        },
        reservationExpiry: {
          waiting: await reservationExpiryQueue.getWaitingCount(),
          active: await reservationExpiryQueue.getActiveCount(),
          completed: await reservationExpiryQueue.getCompletedCount(),
          failed: await reservationExpiryQueue.getFailedCount(),
        },
        ticket: {
          waiting: await ticketQueue.getWaitingCount(),
          active: await ticketQueue.getActiveCount(),
          completed: await ticketQueue.getCompletedCount(),
          failed: await ticketQueue.getFailedCount(),
        },
      };
      
      res.json(queues);
    } catch (error) {
      logger.error(`Queue status error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async retryFailedJobs(req: Request, res: Response) {
    try {
      const { queueName } = req.params;
      let queue;
      
      switch (queueName) {
        case 'email':
          queue = emailQueue;
          break;
        case 'reservation':
          queue = reservationExpiryQueue;
          break;
        case 'ticket':
          queue = ticketQueue;
          break;
        default:
          return res.status(400).json({ message: 'Invalid queue name' });
      }
      
      const failedJobs = await queue.getFailed();
      
      for (const job of failedJobs) {
        await job.retry();
      }
      
      res.json({ message: `Retried ${failedJobs.length} jobs`, count: failedJobs.length });
    } catch (error) {
      logger.error(`Retry jobs error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}