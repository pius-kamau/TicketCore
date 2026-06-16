import Joi from 'joi';

export const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(10).max(500).required(),
  location: Joi.string().min(3).max(200).required(),
  date: Joi.date().iso().greater('now').required(),
  price: Joi.number().positive().min(1).max(100000).required(),
  totalSeats: Joi.number().integer().positive().min(1).max(1000).required()
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(200),
  description: Joi.string().min(10).max(500),
  location: Joi.string().min(3).max(200),
  date: Joi.date().iso().greater('now'),
  price: Joi.number().positive().min(1).max(100000),
  isActive: Joi.boolean()
});