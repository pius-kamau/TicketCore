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

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, NODE_ENV } = process.env;

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: DB_HOST || 'localhost',
  port: parseInt(DB_PORT || '5432'),
  username: DB_USER || 'postgres',
  password: DB_PASSWORD || 'postgres',
  database: DB_NAME || 'ticketcore_db',
  synchronize: false,
  logging: NODE_ENV === 'development',
  entities: [User, Event, Seat, Reservation, Ticket, Payment, Venue, RefreshToken],
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});