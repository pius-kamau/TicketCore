import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Event } from '../models/Event';
import { Seat, SeatStatus } from '../models/Seat';

const eventRepository = AppDataSource.getRepository(Event);
const seatRepository = AppDataSource.getRepository(Seat);

export class EventController {
  // Get all events
  static async getAllEvents(req: Request, res: Response) {
    try {
      const events = await eventRepository.find({
        where: { isActive: true },
        order: { date: 'ASC' }
      });
      res.json(events);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get event by ID with seats
  // Get event by ID with available seats only
static async getEventById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Get the event
    const event = await eventRepository.findOne({
      where: { id: parseInt(id), isActive: true }
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get seat statistics
    const allSeats = await seatRepository.find({
      where: { eventId: parseInt(id) }
    });

    const availableSeats = allSeats.filter(seat => seat.status === SeatStatus.AVAILABLE);
    const heldSeats = allSeats.filter(seat => seat.status === SeatStatus.HELD);
    const bookedSeats = allSeats.filter(seat => seat.status === SeatStatus.BOOKED);

    // Return event with seat summary
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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Get full seat layout for an event
static async getSeatLayout(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const seats = await seatRepository.find({
      where: { eventId: parseInt(id) },
      order: { seatNumber: 'ASC' }
    });

    res.json({
      eventId: parseInt(id),
      seats: seats.map(seat => ({
        id: seat.id,
        seatNumber: seat.seatNumber,
        row: seat.row,
        section: seat.section,
        status: seat.status
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
  // Create event (Admin only)
  static async createEvent(req: Request, res: Response) {
    try {
      const { title, description, location, date, price, totalSeats } = req.body;

      // Create event
      const event = eventRepository.create({
        title,
        description,
        location,
        date: new Date(date),
        price
      });

      await eventRepository.save(event);

      // Create seats for the event
      const seats = [];
      for (let i = 1; i <= totalSeats; i++) {
        const seat = new Seat();
        seat.eventId = event.id;
        seat.seatNumber = `A${i}`;
        seat.row = 'A';
        seat.status = SeatStatus.AVAILABLE;
        seats.push(seat);
      }

      await seatRepository.save(seats);

      res.status(201).json({
        message: 'Event created successfully',
        event,
        totalSeats: seats.length
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Update event (Admin only)
  static async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, location, date, price, isActive } = req.body;

      const event = await eventRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Update fields
      if (title) event.title = title;
      if (description) event.description = description;
      if (location) event.location = location;
      if (date) event.date = new Date(date);
      if (price) event.price = price;
      if (isActive !== undefined) event.isActive = isActive;

      await eventRepository.save(event);

      res.json({
        message: 'Event updated successfully',
        event
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Delete event (Admin only)
  static async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const event = await eventRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      await eventRepository.remove(event);

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}