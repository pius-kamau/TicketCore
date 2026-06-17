import { Job } from 'bull';
import { reservationExpiryQueue } from '../config/queue';
import { AppDataSource } from '../config/database';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Seat, SeatStatus } from '../models/Seat';
import redisClient from '../config/redis';
import logger from '../utils/logger';

export const processReservationExpiry = async (job: Job) => {
  const { reservationId, seatId, eventId, userId } = job.data;
  
  logger.info(`Processing reservation expiry for reservation ${reservationId}`);
  
  const reservationRepo = AppDataSource.getRepository(Reservation);
  const seatRepo = AppDataSource.getRepository(Seat);
  
  const reservation = await reservationRepo.findOne({
    where: { id: reservationId },
    relations: ['seat', 'user']
  });
  
  if (reservation && reservation.status === ReservationStatus.PENDING) {
    reservation.status = ReservationStatus.EXPIRED;
    await reservationRepo.save(reservation);
    
    if (reservation.seat) {
      reservation.seat.status = SeatStatus.AVAILABLE;
      await seatRepo.save(reservation.seat);
    }
    
    const lockKey = `seat_lock:${eventId}:${seatId}`;
    await redisClient.del(lockKey);
    
    logger.info(`Reservation ${reservationId} expired and seat ${seatId} released`);
  } else {
    logger.info(`Reservation ${reservationId} already processed, skipping expiry`);
  }
  
  return { success: true };
};

reservationExpiryQueue.process('expire', async (job: Job) => {
  return processReservationExpiry(job);
});

reservationExpiryQueue.on('completed', (job: Job) => {
  logger.info(`Reservation expiry job ${job.id} completed`);
});

reservationExpiryQueue.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Reservation expiry job ${job?.id} failed: ${err.message}`);
});