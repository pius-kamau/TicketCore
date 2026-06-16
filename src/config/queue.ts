import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection URL
const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${parseInt(process.env.REDIS_PORT || '6379')}`;

// Job Queues
export const emailQueue = new Queue('email-queue', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const reservationExpiryQueue = new Queue('reservation-expiry-queue', redisUrl, {
  defaultJobOptions: {
    delay: 10 * 60 * 1000, // 10 minutes delay
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const ticketQueue = new Queue('ticket-queue', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: 5000,
    removeOnComplete: true,
  },
});

export const notificationQueue = new Queue('notification-queue', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: 5000,
  },
});

// Queue event listeners
emailQueue.on('error', (error) => {
  console.error('Email queue error:', error);
});

reservationExpiryQueue.on('error', (error) => {
  console.error('Reservation expiry queue error:', error);
});

ticketQueue.on('error', (error) => {
  console.error('Ticket queue error:', error);
});