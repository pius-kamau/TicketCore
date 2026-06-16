import { Router } from 'express';
import { VenueController } from '../controllers/venue.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', VenueController.getAllVenues);
router.get('/:id', VenueController.getVenueById);
router.get('/:id/seats', VenueController.getVenueSeatLayout);

// Admin only routes
router.post('/', authenticate, isAdmin, VenueController.createVenue);
router.put('/:id', authenticate, isAdmin, VenueController.updateVenue);
router.delete('/:id', authenticate, isAdmin, VenueController.deleteVenue);

export default router;