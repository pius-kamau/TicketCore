import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Event } from './Event';
import { Reservation } from './Reservation';

export enum SeatStatus {
  AVAILABLE = 'available',
  HELD = 'held',
  BOOKED = 'booked'
}

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_id' })
  eventId: number;

  @Column({ length: 10 })
  seatNumber: string;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE
  })
  status: SeatStatus;

  @Column({ nullable: true })
  row: string;

  @Column({ nullable: true })
  section: string;

  @Column({ nullable: true, type: 'int' })
  column: number;  // Added: column position for seat map

  @Column({ nullable: true, type: 'int' })
  rowIndex: number;  // Added: row index for ordering

  @Column({ nullable: true })
  priceMultiplier: number;  // Added: VIP or premium seating

  @ManyToOne(() => Event, event => event.seats)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @OneToMany(() => Reservation, reservation => reservation.seat)
  reservations: Reservation[];
}