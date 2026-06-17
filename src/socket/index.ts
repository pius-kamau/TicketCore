import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import logger from '../utils/logger';

interface SeatUpdateData {
  eventId: number;
  seatId: number;
  seatNumber: string;
  status: 'available' | 'held' | 'booked';
  userId?: number;
}

export let io: SocketServer;

export const initializeSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on('join-event', (eventId: number) => {
      socket.join(`event_${eventId}`);
      logger.info(`Socket ${socket.id} joined event_${eventId}`);
    });

    socket.on('leave-event', (eventId: number) => {
      socket.leave(`event_${eventId}`);
      logger.info(`Socket ${socket.id} left event_${eventId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io server initialized');
  return io;
};

export const broadcastSeatUpdate = (eventId: number, seatData: SeatUpdateData) => {
  if (io) {
    io.to(`event_${eventId}`).emit('seat-update', {
      ...seatData,
      timestamp: new Date().toISOString()
    });
    logger.debug(`Broadcast seat update for event ${eventId}, seat ${seatData.seatNumber}`);
  }
};

export const broadcastBulkSeatUpdate = (eventId: number, seats: SeatUpdateData[]) => {
  if (io) {
    io.to(`event_${eventId}`).emit('bulk-seat-update', {
      seats,
      timestamp: new Date().toISOString()
    });
    logger.debug(`Broadcast bulk seat update for event ${eventId}, ${seats.length} seats`);
  }
};