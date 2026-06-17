import QRCode from 'qrcode';
import { Ticket } from '../models/Ticket';
import logger from '../utils/logger';

export class QRCodeService {
  static async generateQRCode(ticket: Ticket): Promise<string> {
    try {
      const payload = JSON.stringify({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        eventId: ticket.eventId,
        seatNumber: ticket.seatNumber,
        userId: ticket.userId,
        issuedAt: ticket.issuedAt,
        verifyUrl: `${process.env.APP_URL}/api/tickets/verify/${ticket.ticketCode}`,
      });

      const qrCodeDataUrl = await QRCode.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      logger.info(`QR Code generated for ticket ${ticket.ticketCode}`);
      return qrCodeDataUrl;
    } catch (error) {
      logger.error(`QR Code generation failed: ${error}`);
      throw error;
    }
  }

  static async generateQRCodeBuffer(ticket: Ticket): Promise<Buffer> {
    const payload = JSON.stringify({
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      eventId: ticket.eventId,
      seatNumber: ticket.seatNumber,
    });

    return await QRCode.toBuffer(payload, {
      width: 300,
      margin: 2,
    });
  }
}