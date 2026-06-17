import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Event } from '../models/Event';
import { Ticket } from '../models/Ticket';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { Payment, PaymentStatus } from '../models/Payment';
import { User, UserRole } from '../models/User';
import logger from '../utils/logger';

const eventRepository = AppDataSource.getRepository(Event);
const ticketRepository = AppDataSource.getRepository(Ticket);
const reservationRepository = AppDataSource.getRepository(Reservation);
const paymentRepository = AppDataSource.getRepository(Payment);
const userRepository = AppDataSource.getRepository(User);

export class AnalyticsController {
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const completedPayments = await paymentRepository.find({
        where: { status: PaymentStatus.COMPLETED }
      });
      
      const totalRevenue = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRevenue = completedPayments
        .filter(p => new Date(p.createdAt) >= today)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthRevenue = completedPayments
        .filter(p => new Date(p.createdAt) >= startOfMonth)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const totalTickets = await ticketRepository.count();
      const usedTickets = await ticketRepository.count({ where: { isUsed: true } });
      const unusedTickets = totalTickets - usedTickets;
      
      const totalEvents = await eventRepository.count();
      const upcomingEvents = await eventRepository.count({
        where: { date: new Date(), isActive: true }
      });
      
      const totalUsers = await userRepository.count();
      const adminUsers = await userRepository.count({ where: { role: UserRole.ADMIN } });
      const customerUsers = totalUsers - adminUsers;
      
      const activeReservations = await reservationRepository.count({
        where: { status: ReservationStatus.PENDING }
      });
      
      const allEvents = await eventRepository.find({ relations: ['seats'] });
      let totalSeats = 0;
      let bookedSeats = 0;
      
      for (const event of allEvents) {
        if (event.seats) {
          totalSeats += event.seats.length;
          bookedSeats += event.seats.filter(s => s.status === 'booked').length;
        }
      }
      
      const occupancyRate = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;
      
      res.json({
        revenue: {
          total: totalRevenue,
          today: todayRevenue,
          thisMonth: monthRevenue,
          currency: 'KES',
        },
        tickets: {
          total: totalTickets,
          used: usedTickets,
          unused: unusedTickets,
          usageRate: totalTickets > 0 ? (usedTickets / totalTickets) * 100 : 0,
        },
        events: {
          total: totalEvents,
          upcoming: upcomingEvents,
        },
        users: {
          total: totalUsers,
          customers: customerUsers,
          admins: adminUsers,
        },
        reservations: {
          active: activeReservations,
        },
        occupancy: {
          totalSeats,
          bookedSeats,
          rate: Math.round(occupancyRate * 100) / 100,
        },
      });
    } catch (error) {
      logger.error(`Dashboard stats error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async getRevenueReport(req: Request, res: Response) {
    try {
      const { period = 'monthly' } = req.query;
      
      const completedPayments = await paymentRepository.find({
        where: { status: PaymentStatus.COMPLETED },
        order: { createdAt: 'ASC' }
      });
      
      let revenueData = [];
      
      if (period === 'daily') {
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const dailyMap = new Map();
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, 0);
        }
        
        for (const payment of completedPayments) {
          const dateStr = payment.createdAt.toISOString().split('T')[0];
          if (dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, dailyMap.get(dateStr) + Number(payment.amount));
          }
        }
        
        revenueData = Array.from(dailyMap.entries())
          .map(([date, amount]) => ({ date, amount }))
          .reverse();
      } else if (period === 'weekly') {
        const weeklyMap = new Map();
        for (const payment of completedPayments) {
          const weekNumber = getWeekNumber(payment.createdAt);
          const year = payment.createdAt.getFullYear();
          const weekKey = `${year}-W${weekNumber}`;
          weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Number(payment.amount));
        }
        revenueData = Array.from(weeklyMap.entries())
          .map(([week, amount]) => ({ week, amount }));
      } else {
        const monthlyMap = new Map();
        for (const payment of completedPayments) {
          const monthKey = payment.createdAt.toISOString().slice(0, 7);
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Number(payment.amount));
        }
        revenueData = Array.from(monthlyMap.entries())
          .map(([month, amount]) => ({ month, amount }))
          .sort((a, b) => a.month.localeCompare(b.month));
      }
      
      res.json({
        period,
        data: revenueData,
        total: revenueData.reduce((sum, item) => sum + (item.amount || 0), 0),
      });
    } catch (error) {
      logger.error(`Revenue report error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async getPopularEvents(req: Request, res: Response) {
    try {
      const events = await eventRepository.find({
        relations: ['seats'],
        order: { date: 'DESC' }
      });
      
      const eventStats = [];
      
      for (const event of events) {
        const tickets = await ticketRepository.count({ where: { eventId: event.id } });
        const totalSeats = event.seats?.length || 0;
        
        eventStats.push({
          id: event.id,
          title: event.title,
          date: event.date,
          price: event.price,
          ticketsSold: tickets,
          totalSeats,
          occupancyRate: totalSeats > 0 ? (tickets / totalSeats) * 100 : 0,
          revenue: tickets * Number(event.price),
        });
      }
      
      eventStats.sort((a, b) => b.ticketsSold - a.ticketsSold);
      
      res.json(eventStats);
    } catch (error) {
      logger.error(`Popular events error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async getSeatOccupancy(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      
      const event = await eventRepository.findOne({
        where: { id: parseInt(eventId) },
        relations: ['seats']
      });
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      const tickets = await ticketRepository.find({
        where: { eventId: parseInt(eventId) },
        relations: ['user']
      });
      
      const seatMap = event.seats.map(seat => {
        const ticket = tickets.find(t => t.seatNumber === seat.seatNumber);
        return {
          seatNumber: seat.seatNumber,
          row: seat.row,
          column: seat.column,
          status: seat.status,
          ticketCode: ticket?.ticketCode,
          customerName: ticket?.user?.name,
          checkedIn: ticket?.isUsed || false,
        };
      });
      
      const stats = {
        total: seatMap.length,
        available: seatMap.filter(s => s.status === 'available').length,
        held: seatMap.filter(s => s.status === 'held').length,
        booked: seatMap.filter(s => s.status === 'booked').length,
        checkedIn: seatMap.filter(s => s.checkedIn).length,
      };
      
      res.json({
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
        },
        stats,
        seats: seatMap,
      });
    } catch (error) {
      logger.error(`Seat occupancy error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async getSalesByEvent(req: Request, res: Response) {
    try {
      const events = await eventRepository.find({
        order: { date: 'DESC' }
      });
      
      const salesData = [];
      
      for (const event of events) {
        const tickets = await ticketRepository.find({
          where: { eventId: event.id },
          relations: ['payment']
        });
        
        const ticketsSold = tickets.length;
        const totalRevenue = tickets.reduce((sum, t) => sum + Number(t.price), 0);
        
        salesData.push({
          eventId: event.id,
          eventName: event.title,
          eventDate: event.date,
          ticketsSold,
          totalRevenue,
          averagePrice: ticketsSold > 0 ? totalRevenue / ticketsSold : 0,
        });
      }
      
      res.json(salesData);
    } catch (error) {
      logger.error(`Sales by event error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
  
  static async getRecentActivity(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      const recentPayments = await paymentRepository.find({
        where: { status: PaymentStatus.COMPLETED },
        relations: ['user', 'reservation', 'reservation.seat'],
        order: { createdAt: 'DESC' },
        take: limit
      });
      
      const recentCheckins = await ticketRepository.find({
        where: { isUsed: true },
        relations: ['user', 'event'],
        order: { checkedInAt: 'DESC' },
        take: limit
      });
      
      const activities = [];
      
      for (const payment of recentPayments) {
        activities.push({
          type: 'purchase',
          timestamp: payment.createdAt,
          user: payment.user?.name || 'Unknown',
          email: payment.user?.email,
          amount: payment.amount,
          seatNumber: payment.reservation?.seat?.seatNumber,
          eventId: payment.reservation?.seat?.eventId,
        });
      }
      
      for (const ticket of recentCheckins) {
        activities.push({
          type: 'checkin',
          timestamp: ticket.checkedInAt,
          user: ticket.user?.name || 'Unknown',
          email: ticket.user?.email,
          seatNumber: ticket.seatNumber,
          eventName: ticket.event?.title,
        });
      }
      
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(activities.slice(0, limit));
    } catch (error) {
      logger.error(`Recent activity error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}