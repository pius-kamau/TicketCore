import { createClient } from 'redis';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL;
let redisClient: any = null;

if (redisUrl) {
  try {
    const isSecure = redisUrl.startsWith('rediss://');
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        tls: isSecure || redisUrl.includes('upstash.io'),
        rejectUnauthorized: false,
      },
    });

    redisClient.on('error', (err: Error) => {
      console.error('Redis error:', err.message);
    });
    
    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('ready', () => console.log('Redis ready'));
    redisClient.on('end', () => console.log('Redis disconnected'));
    
    logger.info('Redis client initialized');
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
  }
} else {
  logger.warn('Redis not configured. Running without Redis.');
}

export default redisClient;