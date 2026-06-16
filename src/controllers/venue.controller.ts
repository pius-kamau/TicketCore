import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Venue } from '../models/Venue';
import { Event } from '../models/Event';
import logger from '../utils/logger';

const venueRepository = AppDataSource.getRepository(Venue);
const eventRepository = AppDataSource.getRepository(Event);

export class VenueController {
  // Get all venues
  static async getAllVenues(req: Request, res: Response) {
    try {
      const venues = await venueRepository.find({
        where: { isActive: true },
        order: { name: 'ASC' }
      });
      res.json(venues);
    } catch (error) {
      logger.error(`Get venues error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get venue by ID with events
  static async getVenueById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const venue = await venueRepository.findOne({
        where: { id: parseInt(id), isActive: true },
        relations: ['events']
      });

      if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
      }

      res.json(venue);
    } catch (error) {
      logger.error(`Get venue error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Create venue (Admin only)
  static async createVenue(req: Request, res: Response) {
    try {
      const { name, description, address, city, state, zipCode, country, capacity, amenities, seatLayout } = req.body;

      const venue = venueRepository.create({
        name,
        description,
        address,
        city,
        state,
        zipCode,
        country,
        capacity,
        amenities: amenities || [],
        seatLayout: seatLayout || null,
        isActive: true
      });

      await venueRepository.save(venue);
      logger.info(`Venue created: ${name} (ID: ${venue.id})`);

      res.status(201).json({
        message: 'Venue created successfully',
        venue
      });
    } catch (error) {
      logger.error(`Create venue error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Update venue (Admin only)
  static async updateVenue(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, address, city, state, zipCode, country, capacity, amenities, seatLayout, isActive } = req.body;

      const venue = await venueRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
      }

      if (name) venue.name = name;
      if (description !== undefined) venue.description = description;
      if (address) venue.address = address;
      if (city) venue.city = city;
      if (state) venue.state = state;
      if (zipCode) venue.zipCode = zipCode;
      if (country) venue.country = country;
      if (capacity) venue.capacity = capacity;
      if (amenities) venue.amenities = amenities;
      if (seatLayout) venue.seatLayout = seatLayout;
      if (isActive !== undefined) venue.isActive = isActive;

      await venueRepository.save(venue);
      logger.info(`Venue updated: ${venue.name} (ID: ${venue.id})`);

      res.json({
        message: 'Venue updated successfully',
        venue
      });
    } catch (error) {
      logger.error(`Update venue error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Delete venue (Admin only)
  static async deleteVenue(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const venue = await venueRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['events']
      });

      if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
      }

      if (venue.events && venue.events.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete venue with ${venue.events.length} upcoming events. Remove events first or deactivate venue.` 
        });
      }

      await venueRepository.remove(venue);
      logger.info(`Venue deleted: ${venue.name} (ID: ${venue.id})`);

      res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
      logger.error(`Delete venue error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Get venue seat layout
  static async getVenueSeatLayout(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const venue = await venueRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
      }

      res.json({
        venueId: venue.id,
        venueName: venue.name,
        capacity: venue.capacity,
        seatLayout: venue.seatLayout || {
          type: 'grid',
          rows: 10,
          columns: 10,
          sections: ['General']
        }
      });
    } catch (error) {
      logger.error(`Get venue seat layout error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}