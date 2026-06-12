import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Reservation } from './Reservation';
import { Event } from './Event';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_code', unique: true, length: 50 })
  ticketCode: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'reservation_id' })
  reservationId: number;

  @Column({ name: 'event_id' })
  eventId: number;

  @Column({ length: 10 })
  seatNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt: Date;

  @ManyToOne(() => User, user => user.tickets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => Reservation, reservation => reservation.ticket)
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;
}