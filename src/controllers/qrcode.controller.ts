import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/Ticket';
import QRCode from 'qrcode';
import logger from '../utils/logger';

const ticketRepository = AppDataSource.getRepository(Ticket);

export class QRCodeController {
  static async getQRCode(req: Request, res: Response) {
    try {
      const { ticketCode } = req.params;
      
      const ticket = await ticketRepository.findOne({
        where: { ticketCode }
      });

      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const payload = JSON.stringify({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        eventId: ticket.eventId,
        seatNumber: ticket.seatNumber,
      });

      const qrBuffer = await QRCode.toBuffer(payload, {
        width: 300,
        margin: 2,
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(qrBuffer);
    } catch (error) {
      logger.error(`QR Code generation error: ${error}`);
      res.status(500).json({ message: 'Error generating QR code' });
    }
  }
}