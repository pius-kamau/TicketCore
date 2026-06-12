import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Payment, PaymentStatus, PaymentMethod } from '../models/Payment';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Seat, SeatStatus } from '../models/Seat';
import { Ticket } from '../models/Ticket';
import { stkPush } from '../config/mpesa';
import { v4 as uuidv4 } from 'uuid';

const paymentRepository = AppDataSource.getRepository(Payment);
const reservationRepository = AppDataSource.getRepository(Reservation);
const seatRepository = AppDataSource.getRepository(Seat);
const ticketRepository = AppDataSource.getRepository(Ticket);

export class PaymentController {
  static async initiateMpesaPayment(req: any, res: Response) {
    try {
      const { reservationId, phoneNumber } = req.body;
      const userId = req.userId;

      // Find reservation
      const reservation = await reservationRepository.findOne({
        where: { id: reservationId, userId },
        relations: ['seat', 'seat.event']
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        return res.status(400).json({ message: 'Reservation already processed' });
      }

      // Format phone number (remove 0, add 254)
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }

      const amount = reservation.seat.event.price;
      
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
        
        res.json({
          success: true,
          message: 'STK Push sent. Check your phone.',
          checkoutRequestId: mpesaResponse.CheckoutRequestID
        });
      } else {
        res.status(400).json({
          success: false,
          message: mpesaResponse.ResponseDescription
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async mpesaCallback(req: Request, res: Response) {
    try {
      console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));
      
      const { Body } = req.body;
      
      if (Body && Body.stkCallback) {
        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
        
        // Find payment
        const payment = await paymentRepository.findOne({
          where: { mpesaCheckoutId: CheckoutRequestID },
          relations: ['reservation', 'reservation.seat']
        });
        
        if (payment) {
          if (ResultCode === 0) {
            // Payment successful
            payment.status = PaymentStatus.COMPLETED;
            await paymentRepository.save(payment);
            
            // Update reservation
            const reservation = payment.reservation;
            reservation.status = ReservationStatus.CONFIRMED;
            await reservationRepository.save(reservation);
            
            // Update seat
            const seat = reservation.seat;
            seat.status = SeatStatus.BOOKED;
            await seatRepository.save(seat);
            
            // Generate ticket
            const ticket = new Ticket();
            ticket.ticketCode = uuidv4();
            ticket.userId = payment.userId;
            ticket.reservationId = reservation.id;
            ticket.eventId = seat.eventId;
            ticket.seatNumber = seat.seatNumber;
            ticket.price = payment.amount;
            ticket.isUsed = false;
            
            await ticketRepository.save(ticket);
            
            console.log(`Payment successful for reservation ${reservation.id}`);
          } else {
            payment.status = PaymentStatus.FAILED;
            await paymentRepository.save(payment);
            console.log(`Payment failed: ${ResultDesc}`);
          }
        }
      }
      
      res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
      console.error('Callback error:', error);
      res.json({ ResultCode: 1, ResultDesc: 'Failed' });
    }
  }

  static async checkPaymentStatus(req: any, res: Response) {
    try {
      const { paymentId } = req.params;
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(paymentId), userId: req.userId }
      });
      
      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getUserPayments(req: any, res: Response) {
    try {
      const payments = await paymentRepository.find({
        where: { userId: req.userId },
        relations: ['reservation', 'reservation.seat', 'reservation.seat.event']
      });
      
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
}