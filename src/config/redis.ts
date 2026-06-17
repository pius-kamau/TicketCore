import { createClient } from 'redis';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL;

let redisClient: any = null;

if (redisUrl) {
  try {
    // Check if it's a secure URL (rediss://) or needs TLS
    const isSecure = redisUrl.startsWith('rediss://');
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        tls: isSecure || redisUrl.includes('upstash.io'),
        rejectUnauthorized: false,
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
    });
    
    redisClient.on('connect', () => console.log(' Redis connected successfully'));
    redisClient.on('ready', () => console.log(' Redis ready for commands'));
    redisClient.on('end', () => console.log('Redis connection closed'));
    
    logger.info('Redis client initialized');
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
  }
} else {
  logger.warn(' Redis not configured. Running without Redis.');
}

export default redisClient;