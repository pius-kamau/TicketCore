import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Event } from '../models/Event';
import { Seat } from '../models/Seat';
import { Reservation } from '../models/Reservation';
import { Ticket } from '../models/Ticket';
import { Payment } from '../models/Payment';
import { Venue } from '../models/Venue';
import { RefreshToken } from '../models/RefreshToken';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ticketcore_db',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Event, Seat, Reservation, Ticket, Payment, Venue, RefreshToken],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});