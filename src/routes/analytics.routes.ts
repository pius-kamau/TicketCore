import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// All analytics routes require admin authentication
router.use(authenticate, isAdmin);

router.get('/dashboard', AnalyticsController.getDashboardStats);
router.get('/revenue', AnalyticsController.getRevenueReport);
router.get('/popular-events', AnalyticsController.getPopularEvents);
router.get('/seat-occupancy/:eventId', AnalyticsController.getSeatOccupancy);
router.get('/sales-by-event', AnalyticsController.getSalesByEvent);
router.get('/recent-activity', AnalyticsController.getRecentActivity);

export default router;