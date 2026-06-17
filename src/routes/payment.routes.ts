import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { mpesaPaymentSchema } from '../validators/reservation.validator';

const router = Router();

router.post('/mpesa-callback', PaymentController.mpesaCallback);

router.use(authenticate);
router.post('/mpesa/initiate', validate(mpesaPaymentSchema), PaymentController.initiateMpesaPayment);
router.get('/status/:paymentId', PaymentController.checkPaymentStatus);
router.get('/my-payments', PaymentController.getUserPayments);

export default router;