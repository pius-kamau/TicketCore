import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { QRCodeController } from '../controllers/qrcode.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/verify/:ticketCode', TicketController.verifyTicket);
router.get('/qrcode/:ticketCode', QRCodeController.getQRCode);

router.use(authenticate);
router.get('/:id', TicketController.getTicket);
router.post('/checkin/:ticketCode', TicketController.checkInTicket);
router.get('/download/:id', TicketController.downloadQRCode);

router.get('/event/:eventId', isAdmin, TicketController.getEventTickets);

export default router;