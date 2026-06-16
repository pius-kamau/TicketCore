import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Payment, PaymentStatus, PaymentMethod } from '../models/Payment';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Seat, SeatStatus } from '../models/Seat';
import { Ticket } from '../models/Ticket';
import { stkPush } from '../config/mpesa';
import { v4 as uuidv4 } from 'uuid';
import { ticketQueue } from '../config/queue';
import { QRCodeService } from '../services/qrcode.service';
import logger from '../utils/logger';

const paymentRepository = AppDataSource.getRepository(Payment);
const reservationRepository = AppDataSource.getRepository(Reservation);
const seatRepository = AppDataSource.getRepository(Seat);
const ticketRepository = AppDataSource.getRepository(Ticket);

export class PaymentController {
  static async initiateMpesaPayment(req: any, res: Response) {
    try {
      const { reservationId, phoneNumber } = req.body;
      const userId = req.userId;

      logger.info(`Initiating M-Pesa payment for reservation ${reservationId}, user ${userId}`);

      // Find reservation
      const reservation = await reservationRepository.findOne({
        where: { id: reservationId, userId },
        relations: ['seat', 'seat.event']
      });

      if (!reservation) {
        logger.warn(`Reservation ${reservationId} not found for user ${userId}`);
        return res.status(404).json({ message: 'Reservation not found' });
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        logger.warn(`Reservation ${reservationId} status is ${reservation.status}, not PENDING`);
        return res.status(400).json({ message: 'Reservation already processed' });
      }

      // Format phone number (remove 0, add 254)
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }

      const amount = reservation.seat.event.price;
      
      logger.info(`Initiating STK Push for ${formattedPhone}, amount ${amount}`);
      
      // Initiate STK Push
      const mpesaResponse = await stkPush(
        formattedPhone,
        amount,
        `TICKET-${reservationId}`,
        `Payment for ${reservation.seat.event.title}`
      );

      if (mpesaResponse.ResponseCode === '0') {
        // Create payment record
        const payment = new Payment();
        payment.userId = userId;
        payment.reservationId = reservationId;
        payment.amount = amount;
        payment.method = PaymentMethod.MPESA;
        payment.status = PaymentStatus.PENDING;
        payment.mpesaCheckoutId = mpesaResponse.CheckoutRequestID;
        payment.phoneNumber = formattedPhone;
        
        await paymentRepository.save(payment);
        
        logger.info(`Payment record created for reservation ${reservationId}, Checkout ID: ${mpesaResponse.CheckoutRequestID}`);
        
        res.json({
          success: true,
          message: 'STK Push sent. Check your phone.',
          checkoutRequestId: mpesaResponse.CheckoutRequestID,
          paymentId: payment.id
        });
      } else {
        logger.error(`STK Push failed: ${mpesaResponse.ResponseDescription}`);
        res.status(400).json({
          success: false,
          message: mpesaResponse.ResponseDescription
        });
      }
    } catch (error) {
      logger.error(`Initiate M-Pesa payment error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async mpesaCallback(req: Request, res: Response) {
    try {
      logger.info('M-Pesa Callback received');
      
      const { Body } = req.body;
      
      if (Body && Body.stkCallback) {
        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
        
        logger.info(`Callback for Checkout ID: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);
        
        // Find payment
        const payment = await paymentRepository.findOne({
          where: { mpesaCheckoutId: CheckoutRequestID },
          relations: ['reservation', 'reservation.seat', 'reservation.seat.event']
        });
        
        if (payment) {
          if (ResultCode === 0) {
            // Payment successful
            payment.status = PaymentStatus.COMPLETED;
            
            // Extract receipt number from metadata
            if (CallbackMetadata && CallbackMetadata.Item) {
              const receiptItem = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber');
              if (receiptItem) {
                payment.mpesaReceiptNumber = receiptItem.Value;
                logger.info(`Receipt number: ${receiptItem.Value}`);
              }
            }
            
            await paymentRepository.save(payment);
            logger.info(`Payment ${payment.id} completed successfully`);
            
            // Update reservation
            const reservation = payment.reservation;
            if (reservation) {
              reservation.status = ReservationStatus.CONFIRMED;
              await reservationRepository.save(reservation);
              logger.info(`Reservation ${reservation.id} confirmed`);
            }
            
            // Update seat
            const seat = reservation?.seat;
            if (seat) {
              seat.status = SeatStatus.BOOKED;
              await seatRepository.save(seat);
              logger.info(`Seat ${seat.id} (${seat.seatNumber}) booked`);
            }
            
            // Generate ticket
            const ticket = new Ticket();
            ticket.ticketCode = uuidv4();
            ticket.userId = payment.userId;
            ticket.reservationId = payment.reservationId;
            ticket.eventId = seat?.eventId || 0;
            ticket.seatNumber = seat?.seatNumber || '';
            ticket.price = payment.amount;
            ticket.isUsed = false;
            
            await ticketRepository.save(ticket);
            logger.info(`Ticket generated: ${ticket.ticketCode}`);
            
            // Generate QR code for ticket
            const qrCodeDataUrl = await QRCodeService.generateQRCode(ticket);
            ticket.qrCode = qrCodeDataUrl;
            await ticketRepository.save(ticket);
            logger.info(`QR Code generated for ticket ${ticket.ticketCode}`);
            
            // Add ONLY ticket processing job to queue (this will trigger the email)
            await ticketQueue.add('ticket', {
              ticketId: ticket.id,
              userId: payment.userId,
              reservationId: payment.reservationId,
              ticketCode: ticket.ticketCode,
            });
            logger.info(`Ticket job queued for ticket ${ticket.ticketCode}`);
            
            // REMOVED duplicate email sends - ticket worker handles email
            // No separate emailQueue.add calls here
            
          } else {
            payment.status = PaymentStatus.FAILED;
            await paymentRepository.save(payment);
            logger.warn(`Payment failed: ${ResultDesc}`);
          }
        } else {
          logger.warn(`Payment not found for Checkout ID: ${CheckoutRequestID}`);
        }
      } else {
        logger.warn('Invalid callback structure received');
      }
      
      res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
      logger.error(`M-Pesa callback error: ${error}`);
      res.json({ ResultCode: 1, ResultDesc: 'Failed' });
    }
  }

  static async checkPaymentStatus(req: any, res: Response) {
    try {
      const { paymentId } = req.params;
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(paymentId), userId: req.userId },
        relations: ['reservation', 'reservation.seat', 'reservation.seat.event']
      });
      
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      logger.error(`Check payment status error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getUserPayments(req: any, res: Response) {
    try {
      const payments = await paymentRepository.find({
        where: { userId: req.userId },
        relations: ['reservation', 'reservation.seat', 'reservation.seat.event'],
        order: { createdAt: 'DESC' }
      });
      
      res.json(payments);
    } catch (error) {
      logger.error(`Get user payments error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}