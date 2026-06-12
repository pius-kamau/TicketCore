import 'reflect-metadata';
import app from './app';
import { initializeDatabase } from './utils/database';
import redisClient from './config/redis';
import { startCleanupJob } from './jobs/cleanupExpiredReservations';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    console.log(' Database connected successfully');
    
    // Connect to Redis
    await redisClient.connect();
    console.log(' Redis connected successfully');
    
    // Start cleanup job for expired reservations
    startCleanupJob();
    
    // Start server
    app.listen(PORT, () => {
      console.log(` TicketCore server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();