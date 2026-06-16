import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import logger from '../utils/logger';

export const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      logger.warn(`Validation error: ${JSON.stringify(errors)}`);
      
      return res.status(400).json({
        message: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};