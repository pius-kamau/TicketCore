import Joi from 'joi';

export const holdSeatSchema = Joi.object({
  eventId: Joi.number().integer().positive().required(),
  seatId: Joi.number().integer().positive().required()
});

export const confirmBookingSchema = Joi.object({
  reservationId: Joi.number().integer().positive().required()
});

export const mpesaPaymentSchema = Joi.object({
  reservationId: Joi.number().integer().positive().required(),
  phoneNumber: Joi.string().pattern(/^254[0-9]{9}$/).required().messages({
    'string.pattern.base': 'Phone number must be in format 254XXXXXXXXX (e.g., 254115790058)'
  })
});