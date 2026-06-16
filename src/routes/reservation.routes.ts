import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { holdSeatSchema, confirmBookingSchema } from '../validators/reservation.validator';

const router = Router();

router.use(authenticate);

router.post('/hold', validate(holdSeatSchema), ReservationController.holdSeat);
router.post('/confirm', validate(confirmBookingSchema), ReservationController.confirmBooking);
router.get('/my-reservations', ReservationController.getUserReservations);
router.get('/my-tickets', ReservationController.getUserTickets);
router.delete('/cancel/:reservationId', ReservationController.cancelReservation);

export default router;