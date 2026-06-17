import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Event } from '../models/Event';
import { Venue } from '../models/Venue';
import { Seat, SeatStatus } from '../models/Seat';
import logger from '../utils/logger';

const eventRepository = AppDataSource.getRepository(Event);
const venueRepository = AppDataSource.getRepository(Venue);
const seatRepository = AppDataSource.getRepository(Seat);

export class EventController {
  static async getAllEvents(req: Request, res: Response) {
    try {
      const events = await eventRepository.find({
        where: { isActive: true },
        relations: ['venue'],
        order: { date: 'ASC' }
      });
      res.json(events);
    } catch (error) {
      logger.error(`Get all events error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getEventById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const event = await eventRepository.findOne({
        where: { id: parseInt(id), isActive: true },
        relations: ['venue']
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const allSeats = await seatRepository.find({
        where: { eventId: parseInt(id) }
      });

      const availableSeats = allSeats.filter(seat => seat.status === SeatStatus.AVAILABLE);
      const heldSeats = allSeats.filter(seat => seat.status === SeatStatus.HELD);
      const bookedSeats = allSeats.filter(seat => seat.status === SeatStatus.BOOKED);

      res.json({
        ...event,
        seatStats: {
          total: allSeats.length,
          available: availableSeats.length,
          held: heldSeats.length,
          booked: bookedSeats.length
        },
        availableSeats: availableSeats.map(seat => ({
          id: seat.id,
          seatNumber: seat.seatNumber,
          row: seat.row,
          section: seat.section
        }))
      });
    } catch (error) {
      logger.error(`Get event by ID error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getSeatLayout(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const seats = await seatRepository.find({
        where: { eventId: parseInt(id) },
        order: { rowIndex: 'ASC', column: 'ASC', seatNumber: 'ASC' }
      });

      const layout: any = {};
      
      seats.forEach(seat => {
        const section = seat.section || 'General';
        const row = seat.row || 'A';
        
        if (!layout[section]) {
          layout[section] = {};
        }
        if (!layout[section][row]) {
          layout[section][row] = [];
        }
        
        layout[section][row].push({
          id: seat.id,
          seatNumber: seat.seatNumber,
          status: seat.status,
          column: seat.column || 0,
          priceMultiplier: (seat as any).priceMultiplier || 1.0
        });
      });

      res.json({
        eventId: parseInt(id),
        layout,
        legend: {
          available: 'Green - Available',
          held: 'Yellow - Temporarily Held',
          booked: 'Red - Already Booked'
        }
      });
    } catch (error) {
      logger.error(`Get seat layout error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getSeatMatrix(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const seats = await seatRepository.find({
        where: { eventId: parseInt(id) },
        order: { rowIndex: 'ASC', column: 'ASC' }
      });

      if (seats.length === 0) {
        return res.json({
          eventId: parseInt(id),
          rows: 0,
          columns: 0,
          matrix: []
        });
      }

      const maxRow = Math.max(...seats.map(s => s.rowIndex || 0), 0);
      const maxCol = Math.max(...seats.map(s => s.column || 0), 0);
      
      const matrix: any[][] = [];
      for (let i = 0; i <= maxRow; i++) {
        matrix[i] = [];
        for (let j = 0; j <= maxCol; j++) {
          matrix[i][j] = null;
        }
      }
      
      seats.forEach(seat => {
        const rowIdx = seat.rowIndex || 0;
        const colIdx = seat.column || 0;
        if (matrix[rowIdx] && colIdx < matrix[rowIdx].length) {
          matrix[rowIdx][colIdx] = {
            id: seat.id,
            seatNumber: seat.seatNumber,
            status: seat.status,
            row: seat.row,
            section: seat.section
          };
        }
      });
      
      res.json({
        eventId: parseInt(id),
        rows: maxRow + 1,
        columns: maxCol + 1,
        matrix
      });
    } catch (error) {
      logger.error(`Get seat matrix error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async createEvent(req: Request, res: Response) {
    try {
      const { title, description, venueId, date, price, totalSeats, rows, columns, sections } = req.body;

      if (!title || !date || !price) {
        return res.status(400).json({ message: 'Missing required fields: title, date, price' });
      }

      let venueName: string | null = null;
      if (venueId) {
        const venue = await venueRepository.findOne({ where: { id: venueId } });
        if (!venue) {
          return res.status(404).json({ message: 'Venue not found' });
        }
        venueName = venue.name;
      }

      const event = eventRepository.create({
        title,
        description: description || '',
        venueId: venueId || null,
        location: venueName,
        date: new Date(date),
        price: parseFloat(price)
      });

      await eventRepository.save(event);

      const seats = [];
      const numRows = rows || 1;
      const numCols = columns || totalSeats || 50;
      
      for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
        const rowLetter = String.fromCharCode(65 + rowIdx);
        for (let col = 1; col <= numCols; col++) {
          const seat = new Seat();
          seat.eventId = event.id;
          seat.seatNumber = `${rowLetter}${col}`;
          seat.row = rowLetter;
          seat.rowIndex = rowIdx;
          seat.column = col;
          seat.section = sections?.[rowIdx] || 'General';
          seat.status = SeatStatus.AVAILABLE;
          seats.push(seat);
        }
      }

      await seatRepository.save(seats);
      logger.info(`Event created: ${title} (ID: ${event.id}) at venue: ${venueName || 'No venue'}`);

      res.status(201).json({
        message: 'Event created successfully',
        event,
        totalSeats: seats.length,
        rows: numRows,
        columns: numCols
      });
    } catch (error) {
      logger.error(`Create event error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, venueId, date, price, isActive } = req.body;

      const event = await eventRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      if (venueId !== undefined && venueId !== event.venueId) {
        if (venueId === null || venueId === 0) {
          event.venueId = null;
          event.location = null;
        } else {
          const venue = await venueRepository.findOne({ where: { id: venueId } });
          if (!venue) {
            return res.status(404).json({ message: 'Venue not found' });
          }
          event.venueId = venueId;
          event.location = venue.name;
        }
      }

      if (title) event.title = title;
      if (description !== undefined) event.description = description;
      if (date) event.date = new Date(date);
      if (price) event.price = parseFloat(price);
      if (isActive !== undefined) event.isActive = isActive;

      await eventRepository.save(event);
      logger.info(`Event updated: ${event.title} (ID: ${event.id})`);

      res.json({
        message: 'Event updated successfully',
        event
      });
    } catch (error) {
      logger.error(`Update event error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const event = await eventRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const bookedSeats = await seatRepository.count({
        where: { eventId: event.id, status: SeatStatus.BOOKED }
      });

      if (bookedSeats > 0) {
        return res.status(400).json({ 
          message: `Cannot delete event with ${bookedSeats} confirmed bookings. Refund tickets first.` 
        });
      }

      await seatRepository.delete({ eventId: event.id });
      await eventRepository.remove(event);
      logger.info(`Event deleted: ${event.title} (ID: ${event.id})`);

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error(`Delete event error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}