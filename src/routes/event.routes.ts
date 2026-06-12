import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', EventController.getAllEvents);
router.get('/:id', EventController.getEventById);
router.get('/:id/seats', EventController.getSeatLayout);  // New route

// Admin only routes
router.post('/', authenticate, isAdmin, EventController.createEvent);
router.put('/:id', authenticate, isAdmin, EventController.updateEvent);
router.delete('/:id', authenticate, isAdmin, EventController.deleteEvent);

export default router;