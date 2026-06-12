import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Seat, SeatStatus } from '../models/Seat';
import { Ticket } from '../models/Ticket';
import { Event } from '../models/Event';  // Add this import
import redisClient from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

const reservationRepository = AppDataSource.getRepository(Reservation);
const seatRepository = AppDataSource.getRepository(Seat);
const ticketRepository = AppDataSource.getRepository(Ticket);
const eventRepository = AppDataSource.getRepository(Event);  // Add this

const SEAT_LOCK_DURATION = parseInt(process.env.SEAT_LOCK_DURATION_SECONDS || '600');

export class ReservationController {
  // Hold a seat (temporary reservation)
  static async holdSeat(req: any, res: Response) {
    try {
      const { eventId, seatId } = req.body;
      const userId = req.userId;

      // Check Redis connection
      if (!redisClient.isOpen) {
        return res.status(503).json({ message: 'Redis service unavailable' });
      }

      // Check if seat exists and is available
      const seat = await seatRepository.findOne({
        where: { id: seatId, eventId }
      });

      if (!seat) {
        return res.status(404).json({ message: 'Seat not found' });
      }

      if (seat.status !== SeatStatus.AVAILABLE) {
        return res.status(400).json({ message: `Seat is already ${seat.status}` });
      }

      // Check Redis for existing lock
      const lockKey = `seat_lock:${eventId}:${seatId}`;
      const existingLock = await redisClient.get(lockKey);

      if (existingLock) {
        return res.status(400).json({ message: 'Seat is currently held by another user' });
      }

      // Create reservation in database
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + SEAT_LOCK_DURATION);

      const reservation = reservationRepository.create({
        userId,
        seatId,
        status: ReservationStatus.PENDING,
        expiresAt
      });

      await reservationRepository.save(reservation);

      // Update seat status to HELD
      seat.status = SeatStatus.HELD;
      await seatRepository.save(seat);

      // Store lock in Redis with TTL
      await redisClient.setEx(lockKey, SEAT_LOCK_DURATION, reservation.id.toString());

      res.status(201).json({
        message: 'Seat held successfully',
        reservationId: reservation.id,
        expiresAt
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Confirm booking and generate ticket
  static async confirmBooking(req: any, res: Response) {
    try {
      const { reservationId } = req.body;
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
        return res.status(400).json({ message: `Reservation is ${reservation.status}` });
      }

      if (new Date() > reservation.expiresAt) {
        return res.status(400).json({ message: 'Reservation has expired' });
      }

      // Update reservation status
      reservation.status = ReservationStatus.CONFIRMED;
      await reservationRepository.save(reservation);

      // Update seat status to BOOKED
      const seat = reservation.seat;
      seat.status = SeatStatus.BOOKED;
      await seatRepository.save(seat);

      // Generate ticket
      const ticketCode = uuidv4();
      const ticket = ticketRepository.create({
        ticketCode,
        userId,
        reservationId: reservation.id,
        eventId: seat.eventId,
        seatNumber: seat.seatNumber,
        price: seat.event.price,
        isUsed: false
      });

      await ticketRepository.save(ticket);

      // Remove Redis lock
      const lockKey = `seat_lock:${seat.eventId}:${seat.id}`;
      await redisClient.del(lockKey);

      res.json({
        message: 'Booking confirmed successfully',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          event: seat.event.title,
          seatNumber: seat.seatNumber,
          price: ticket.price
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get user's reservations
  static async getUserReservations(req: any, res: Response) {
    try {
      const userId = req.userId;
      const reservations = await reservationRepository.find({
        where: { userId },
        relations: ['seat', 'seat.event'],
        order: { createdAt: 'DESC' }
      });

      res.json(reservations);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get user's tickets
  static async getUserTickets(req: any, res: Response) {
    try {
      const userId = req.userId;
      const tickets = await ticketRepository.find({
        where: { userId },
        relations: ['reservation', 'reservation.seat', 'reservation.seat.event'],
        order: { issuedAt: 'DESC' }
      });

      res.json(tickets.map(ticket => ({
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        eventName: ticket.reservation?.seat?.event?.title || 'Event not found',
        eventDate: ticket.reservation?.seat?.event?.date,
        location: ticket.reservation?.seat?.event?.location,
        seatNumber: ticket.seatNumber,
        price: ticket.price,
        isUsed: ticket.isUsed,
        issuedAt: ticket.issuedAt
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Cancel reservation (release seat)
  static async cancelReservation(req: any, res: Response) {
    try {
      const { reservationId } = req.params;
      const userId = req.userId;

      const reservation = await reservationRepository.findOne({
        where: { id: parseInt(reservationId), userId },
        relations: ['seat']
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        return res.status(400).json({ message: `Cannot cancel ${reservation.status} reservation` });
      }

      // Update reservation status
      reservation.status = ReservationStatus.CANCELLED;
      await reservationRepository.save(reservation);

      // Release seat
      const seat = reservation.seat;
      seat.status = SeatStatus.AVAILABLE;
      await seatRepository.save(seat);

      // Remove Redis lock
      const lockKey = `seat_lock:${seat.eventId}:${seat.id}`;
      await redisClient.del(lockKey);

      res.json({ message: 'Reservation cancelled successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}