import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate); // All reservation routes require authentication

router.post('/hold', ReservationController.holdSeat);
router.post('/confirm', ReservationController.confirmBooking);
router.get('/my-reservations', ReservationController.getUserReservations);
router.get('/my-tickets', ReservationController.getUserTickets);  // New route
router.delete('/cancel/:reservationId', ReservationController.cancelReservation);

export default router;