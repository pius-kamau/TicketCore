import { Router, Request, Response } from 'express';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { emailQueue, reservationExpiryQueue, ticketQueue } from '../config/queue';
import logger from '../utils/logger';

const router = Router();

// All queue routes require admin authentication
router.use(authenticate, isAdmin);

// Get all queue statuses
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [emailWaiting, emailActive, emailCompleted, emailFailed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    const [reservationWaiting, reservationActive, reservationCompleted, reservationFailed] = await Promise.all([
      reservationExpiryQueue.getWaitingCount(),
      reservationExpiryQueue.getActiveCount(),
      reservationExpiryQueue.getCompletedCount(),
      reservationExpiryQueue.getFailedCount(),
    ]);

    const [ticketWaiting, ticketActive, ticketCompleted, ticketFailed] = await Promise.all([
      ticketQueue.getWaitingCount(),
      ticketQueue.getActiveCount(),
      ticketQueue.getCompletedCount(),
      ticketQueue.getFailedCount(),
    ]);

    res.json({
      email: {
        waiting: emailWaiting,
        active: emailActive,
        completed: emailCompleted,
        failed: emailFailed,
      },
      reservationExpiry: {
        waiting: reservationWaiting,
        active: reservationActive,
        completed: reservationCompleted,
        failed: reservationFailed,
      },
      ticket: {
        waiting: ticketWaiting,
        active: ticketActive,
        completed: ticketCompleted,
        failed: ticketFailed,
      },
    });
  } catch (error) {
    logger.error(`Queue status error: ${error}`);
    res.status(500).json({ message: 'Error fetching queue status' });
  }
});

// Get failed jobs for a specific queue
router.get('/failed/:queueName', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    let failedJobs = [];

    switch (queueName) {
      case 'email':
        failedJobs = await emailQueue.getFailed();
        break;
      case 'reservation':
        failedJobs = await reservationExpiryQueue.getFailed();
        break;
      case 'ticket':
        failedJobs = await ticketQueue.getFailed();
        break;
      default:
        return res.status(400).json({ message: 'Invalid queue name' });
    }

    res.json({
      queue: queueName,
      count: failedJobs.length,
      jobs: failedJobs.map((job: any) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      })),
    });
  } catch (error) {
    logger.error(`Get failed jobs error: ${error}`);
    res.status(500).json({ message: 'Error fetching failed jobs' });
  }
});

// Retry a specific failed job
router.post('/retry/:queueName/:jobId', async (req: Request, res: Response) => {
  try {
    const { queueName, jobId } = req.params;
    let job;

    switch (queueName) {
      case 'email':
        job = await emailQueue.getJob(jobId);
        break;
      case 'reservation':
        job = await reservationExpiryQueue.getJob(jobId);
        break;
      case 'ticket':
        job = await ticketQueue.getJob(jobId);
        break;
      default:
        return res.status(400).json({ message: 'Invalid queue name' });
    }

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.retry();
    logger.info(`Retried job ${jobId} from ${queueName} queue`);

    res.json({ message: 'Job retried successfully' });
  } catch (error) {
    logger.error(`Retry job error: ${error}`);
    res.status(500).json({ message: 'Error retrying job' });
  }
});

// Retry all failed jobs in a queue
router.post('/retry-all/:queueName', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    let failedJobs = [];

    switch (queueName) {
      case 'email':
        failedJobs = await emailQueue.getFailed();
        break;
      case 'reservation':
        failedJobs = await reservationExpiryQueue.getFailed();
        break;
      case 'ticket':
        failedJobs = await ticketQueue.getFailed();
        break;
      default:
        return res.status(400).json({ message: 'Invalid queue name' });
    }

    for (const job of failedJobs) {
      await job.retry();
    }

    logger.info(`Retried ${failedJobs.length} jobs from ${queueName} queue`);

    res.json({ 
      message: `Retried ${failedJobs.length} jobs successfully`,
      count: failedJobs.length 
    });
  } catch (error) {
    logger.error(`Retry all jobs error: ${error}`);
    res.status(500).json({ message: 'Error retrying jobs' });
  }
});

// Clean completed jobs
router.post('/clean/:queueName', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    let cleanedJobs: any[] = [];
    let cleanedCount = 0;

    switch (queueName) {
      case 'email':
        cleanedJobs = await emailQueue.clean(0, 'completed');
        cleanedCount = cleanedJobs.length;
        break;
      case 'reservation':
        cleanedJobs = await reservationExpiryQueue.clean(0, 'completed');
        cleanedCount = cleanedJobs.length;
        break;
      case 'ticket':
        cleanedJobs = await ticketQueue.clean(0, 'completed');
        cleanedCount = cleanedJobs.length;
        break;
      default:
        return res.status(400).json({ message: 'Invalid queue name' });
    }

    res.json({ message: `Cleaned ${cleanedCount} completed jobs`, count: cleanedCount });
  } catch (error) {
    logger.error(`Clean jobs error: ${error}`);
    res.status(500).json({ message: 'Error cleaning jobs' });
  }
});

export default router;