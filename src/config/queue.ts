import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

const dummyQueue = () => ({
  add: async () => ({ id: 'dummy' }),
  process: () => {},
  on: () => {},
  getWaitingCount: async () => 0,
  getActiveCount: async () => 0,
  getCompletedCount: async () => 0,
  getFailedCount: async () => 0,
  getFailed: async () => [],
  getJob: async () => null,
  clean: async () => [],
});

let emailQueue: any;
let reservationExpiryQueue: any;
let ticketQueue: any;
let notificationQueue: any;

if (redisUrl) {
  try {
    const queueOptions = {
      redis: {
        host: 'perfect-haddock-122987.upstash.io',
        port: 6379,
        password: 'gQAAAAAAAeBrAAIgcDEyNjQxMmYxNzZlYWE0ODYyOTBmMDExOWE5MzNjNjJmMA',
        tls: { rejectUnauthorized: false },
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    };

    emailQueue = new Queue('email-queue', queueOptions);
    reservationExpiryQueue = new Queue('reservation-expiry-queue', {
      ...queueOptions,
      defaultJobOptions: {
        delay: 10 * 60 * 1000,
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
    ticketQueue = new Queue('ticket-queue', queueOptions);
    notificationQueue = new Queue('notification-queue', queueOptions);

    console.log('BullMQ queues initialized');
  } catch (error) {
    console.log('BullMQ initialization failed, using dummy queues');
    emailQueue = dummyQueue();
    reservationExpiryQueue = dummyQueue();
    ticketQueue = dummyQueue();
    notificationQueue = dummyQueue();
  }
} else {
  emailQueue = dummyQueue();
  reservationExpiryQueue = dummyQueue();
  ticketQueue = dummyQueue();
  notificationQueue = dummyQueue();
  console.log('BullMQ running in dummy mode');
}

export {
  emailQueue,
  reservationExpiryQueue,
  ticketQueue,
  notificationQueue,
};