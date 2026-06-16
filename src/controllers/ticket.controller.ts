import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/Ticket';
import { Event } from '../models/Event';
import logger from '../utils/logger';
import { QRCodeService } from '../services/qrcode.service';

const ticketRepository = AppDataSource.getRepository(Ticket);
const eventRepository = AppDataSource.getRepository(Event);

export class TicketController {
  // Get ticket by ID with QR code
  static async getTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      const ticket = await ticketRepository.findOne({
        where: { id: parseInt(id), userId },
        relations: ['event', 'user', 'reservation', 'reservation.seat']
      });

      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      res.json({
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        qrCode: ticket.qrCode,
        event: {
          id: ticket.event?.id,
          title: ticket.event?.title,
          date: ticket.event?.date,
          location: ticket.event?.location,
        },
        seatNumber: ticket.seatNumber,
        price: ticket.price,
        isUsed: ticket.isUsed,
        checkedInAt: ticket.checkedInAt,
        issuedAt: ticket.issuedAt,
      });
    } catch (error) {
      logger.error(`Get ticket error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Verify ticket by QR code (scanning)
  static async verifyTicket(req: Request, res: Response) {
    try {
      const { ticketCode } = req.params;

      const ticket = await ticketRepository.findOne({
        where: { ticketCode },
        relations: ['event', 'user']
      });

      if (!ticket) {
        return res.status(404).json({ 
          valid: false, 
          message: 'Invalid ticket code' 
        });
      }

      if (ticket.isUsed) {
        return res.status(400).json({ 
          valid: false, 
          message: `Ticket already used on ${ticket.checkedInAt}` 
        });
      }

      // Check if event has already passed
      if (ticket.event && new Date(ticket.event.date) < new Date()) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Event has already passed' 
        });
      }

      res.json({
        valid: true,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          eventName: ticket.event?.title,
          eventDate: ticket.event?.date,
          seatNumber: ticket.seatNumber,
          customerName: ticket.user?.name,
          customerEmail: ticket.user?.email,
        }
      });
    } catch (error) {
      logger.error(`Verify ticket error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Check-in ticket (mark as used)
  static async checkInTicket(req: Request, res: Response) {
    try {
      const { ticketCode } = req.params;
      const scannerId = (req as any).userId;

      const ticket = await ticketRepository.findOne({
        where: { ticketCode },
        relations: ['event']
      });

      if (!ticket) {
        return res.status(404).json({ 
          success: false, 
          message: 'Ticket not found' 
        });
      }

      if (ticket.isUsed) {
        return res.status(400).json({ 
          success: false, 
          message: `Ticket already checked in at ${ticket.checkedInAt}` 
        });
      }

      // Check if event has already passed
      if (ticket.event && new Date(ticket.event.date) < new Date()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot check in - event has already passed' 
        });
      }

      // Mark as used
      ticket.isUsed = true;
      ticket.checkedInAt = new Date();
      ticket.checkedInBy = scannerId;
      await ticketRepository.save(ticket);

      logger.info(`Ticket ${ticket.ticketCode} checked in by scanner ${scannerId}`);

      res.json({
        success: true,
        message: 'Check-in successful',
        ticket: {
          ticketCode: ticket.ticketCode,
          seatNumber: ticket.seatNumber,
          eventName: ticket.event?.title,
          checkedInAt: ticket.checkedInAt,
        }
      });
    } catch (error) {
      logger.error(`Check-in ticket error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get all tickets for an event (Admin only)
  static async getEventTickets(req: Request, res: Response) {
    try {
      const { eventId } = req.params;

      const tickets = await ticketRepository.find({
        where: { eventId: parseInt(eventId) },
        relations: ['user'],
        order: { seatNumber: 'ASC' }
      });

      const stats = {
        total: tickets.length,
        checkedIn: tickets.filter(t => t.isUsed).length,
        notCheckedIn: tickets.filter(t => !t.isUsed).length,
      };

      res.json({
        eventId: parseInt(eventId),
        stats,
        tickets: tickets.map(t => ({
          id: t.id,
          ticketCode: t.ticketCode,
          seatNumber: t.seatNumber,
          customerName: t.user?.name,
          customerEmail: t.user?.email,
          isUsed: t.isUsed,
          checkedInAt: t.checkedInAt,
          issuedAt: t.issuedAt,
        }))
      });
    } catch (error) {
      logger.error(`Get event tickets error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Download QR code for ticket
  static async downloadQRCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      const ticket = await ticketRepository.findOne({
        where: { id: parseInt(id), userId }
      });

      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const qrBuffer = await QRCodeService.generateQRCodeBuffer(ticket);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename=ticket-${ticket.ticketCode}.png`);
      res.send(qrBuffer);
    } catch (error) {
      logger.error(`Download QR code error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}