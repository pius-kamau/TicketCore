import 'reflect-metadata';
import { createServer } from 'http';
import app from './app';
import { initializeDatabase } from './utils/database';
import redisClient from './config/redis';
import { startCleanupJob } from './jobs/cleanupExpiredReservations';
import { initializeSocket } from './socket';
import { startWorkers } from './workers';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  const startServer = async () => {
    try {
      await initializeDatabase();
      console.log(' Database connected successfully');
      
      await redisClient.connect();
      console.log(' Redis connected successfully');
      
      startCleanupJob();
      startWorkers();
      
      const httpServer = createServer(app);
      initializeSocket(httpServer);
      
      httpServer.listen(PORT, () => {
        console.log(` TicketCore server running on port ${PORT}`);
        console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(` Socket.io ready for real-time connections`);
      });
    } catch (error) {
      console.error(' Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

export { app };