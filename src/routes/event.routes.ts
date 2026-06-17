import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', EventController.getAllEvents);
router.get('/:id', EventController.getEventById);
router.get('/:id/seats', EventController.getSeatLayout);
router.get('/:id/seats/matrix', EventController.getSeatMatrix);

router.post('/', authenticate, isAdmin, EventController.createEvent);
router.put('/:id', authenticate, isAdmin, EventController.updateEvent);
router.delete('/:id', authenticate, isAdmin, EventController.deleteEvent);

export default router;