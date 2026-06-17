import { AppDataSource } from '../config/database';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Seat, SeatStatus } from '../models/Seat';
import redisClient from '../config/redis';

const reservationRepository = AppDataSource.getRepository(Reservation);
const seatRepository = AppDataSource.getRepository(Seat);

export async function cleanupExpiredReservations() {
  try {
    console.log('Running expired reservations cleanup...');
    
    const expiredReservations = await reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.status = :status', { status: ReservationStatus.PENDING })
      .andWhere('reservation.expires_at < :now', { now: new Date() })
      .getMany();

    if (expiredReservations.length === 0) {
      console.log('No expired reservations found');
      return;
    }

    console.log(`Found ${expiredReservations.length} expired reservations`);

    for (const reservation of expiredReservations) {
      reservation.status = ReservationStatus.EXPIRED;
      await reservationRepository.save(reservation);

      const seat = await seatRepository.findOne({
        where: { id: reservation.seatId }
      });

      if (seat && seat.status === SeatStatus.HELD) {
        seat.status = SeatStatus.AVAILABLE;
        await seatRepository.save(seat);
      }

      if (redisClient.isOpen) {
        const lockKey = `seat_lock:${seat?.eventId}:${seat?.id}`;
        await redisClient.del(lockKey);
      }
    }

    console.log(`Cleaned up ${expiredReservations.length} expired reservations`);
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
  }
}

export function startCleanupJob() {
  console.log('Starting cleanup job (runs every minute)');
  
  cleanupExpiredReservations();
  setInterval(cleanupExpiredReservations, 60000);
}