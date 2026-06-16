import './email.worker';
import './reservation-expiry.worker';
import './ticket.worker';
import logger from '../utils/logger';

export function startWorkers() {
  logger.info(' Bull workers started');
  logger.info('   - Email worker');
  logger.info('   - Reservation expiry worker');
  logger.info('   - Ticket worker');
}