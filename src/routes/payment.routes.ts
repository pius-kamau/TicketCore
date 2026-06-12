import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// IMPORTANT: This callback MUST be public (no auth)
router.post('/mpesa-callback', PaymentController.mpesaCallback);

// Protected routes
router.post('/mpesa/initiate', authenticate, PaymentController.initiateMpesaPayment);
router.get('/status/:paymentId', authenticate, PaymentController.checkPaymentStatus);
router.get('/my-payments', authenticate, PaymentController.getUserPayments);

export default router;