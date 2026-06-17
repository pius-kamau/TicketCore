import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { TokenService } from '../services/token.service';
import { emailQueue } from '../config/queue';
import logger from '../utils/logger';

const userRepository = AppDataSource.getRepository(User);

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;

      logger.info(`Registration attempt for email: ${email}`);

      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        logger.warn(`Registration failed - user already exists: ${email}`);
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = userRepository.create({
        name,
        email,
        password: hashedPassword,
        role: role || UserRole.CUSTOMER
      });

      await userRepository.save(user);
      logger.info(`User registered successfully: ${email} (ID: ${user.id})`);

      await emailQueue.add('welcome', {
        type: 'welcome',
        data: {
          userId: user.id,
          name: user.name,
          email: user.email
        }
      });
      logger.info(`Welcome email queued for user ${user.id}`);

      const accessToken = TokenService.generateAccessToken(user);
      const refreshToken = await TokenService.generateRefreshToken(
        user,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({
        message: 'User registered successfully',
        accessToken,
        refreshToken: refreshToken.token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logger.error(`Registration error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      logger.info(`Login attempt for email: ${email}`);

      const user = await userRepository.findOne({ where: { email } });
      if (!user) {
        logger.warn(`Login failed - user not found: ${email}`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn(`Login failed - invalid password for email: ${email}`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const accessToken = TokenService.generateAccessToken(user);
      const refreshToken = await TokenService.generateRefreshToken(
        user,
        req.ip,
        req.headers['user-agent']
      );

      logger.info(`User logged in successfully: ${email} (ID: ${user.id})`);

      res.json({
        message: 'Login successful',
        accessToken,
        refreshToken: refreshToken.token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logger.error(`Login error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token required' });
      }

      const verification = await TokenService.verifyRefreshToken(refreshToken);
      
      if (!verification.valid) {
        return res.status(401).json({ message: verification.message || 'Invalid refresh token' });
      }

      const user = await TokenService.getUserFromRefreshToken(refreshToken);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const newAccessToken = TokenService.generateAccessToken(user);
      const newRefreshToken = await TokenService.generateRefreshToken(
        user,
        req.ip,
        req.headers['user-agent']
      );
      
      await TokenService.revokeRefreshToken(refreshToken);

      logger.info(`Tokens refreshed for user ${user.id}`);

      res.json({
        message: 'Tokens refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken.token
      });
    } catch (error) {
      logger.error(`Refresh token error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async logout(req: any, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await TokenService.revokeRefreshToken(refreshToken);
      }

      logger.info(`User ${req.userId} logged out`);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error(`Logout error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async logoutAllDevices(req: any, res: Response) {
    try {
      const userId = req.userId;
      const count = await TokenService.revokeAllUserTokens(userId);

      logger.info(`User ${userId} logged out from all devices, ${count} tokens revoked`);
      res.json({ message: `Logged out from all devices (${count} sessions terminated)` });
    } catch (error) {
      logger.error(`Logout all devices error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  static async getProfile(req: any, res: Response) {
    try {
      const userId = req.userId;
      logger.debug(`Fetching profile for user ID: ${userId}`);

      const user = await userRepository.findOne({
        where: { id: userId },
        select: ['id', 'name', 'email', 'role', 'createdAt']
      });

      if (!user) {
        logger.warn(`Profile not found for user ID: ${userId}`);
        return res.status(404).json({ message: 'User not found' });
      }

      logger.debug(`Profile retrieved for user: ${user.email}`);
      res.json(user);
    } catch (error) {
      logger.error(`Get profile error: ${error}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}