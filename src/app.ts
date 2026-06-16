import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import venueRoutes from './routes/venue.routes';
import { httpLogger } from './middlewares/logger.middleware';
import { generalLimiter, authLimiter, paymentLimiter } from './middlewares/rateLimit.middleware';
import { swaggerSpec } from './config/swagger';
import logger from './utils/logger';
import ticketRoutes from './routes/ticket.routes';
import analyticsRoutes from './routes/analytics.routes';
import queueRoutes from './routes/queue.routes';

dotenv.config();

const app = express();

// Logging middleware (first!)
app.use(httpLogger);

// Global rate limiter (apply to all routes)
app.use(generalLimiter);

// Helmet with relaxed CSP for development
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
logger.info('Swagger documentation available at /api-docs');

// Routes with specific rate limiters
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/admin/queues', queueRoutes);

// Health check (no rate limit)
app.get('/health', (req, res) => {
  logger.info('Health check performed');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack || '');
  res.status(500).json({ message: 'Internal server error' });
});

export default app;