import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/database';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import logger from '../utils/logger';

const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
const userRepository = AppDataSource.getRepository(User);

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class TokenService {
  static generateAccessToken(user: User): string {
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  static async generateRefreshToken(user: User, ipAddress?: string, userAgent?: string): Promise<RefreshToken> {
    await refreshTokenRepository.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshToken = refreshTokenRepository.create({
      userId: user.id,
      token: uuidv4(),
      expiresAt,
      isRevoked: false,
      ipAddress,
      userAgent
    });

    await refreshTokenRepository.save(refreshToken);
    return refreshToken;
  }

  static async verifyRefreshToken(token: string): Promise<{ valid: boolean; userId?: number; message?: string }> {
    const refreshToken = await refreshTokenRepository.findOne({
      where: { token, isRevoked: false },
      relations: ['user']
    });

    if (!refreshToken) {
      return { valid: false, message: 'Invalid refresh token' };
    }

    if (refreshToken.expiresAt < new Date()) {
      return { valid: false, message: 'Refresh token expired' };
    }

    return { valid: true, userId: refreshToken.userId };
  }

  static async revokeRefreshToken(token: string): Promise<boolean> {
    const refreshToken = await refreshTokenRepository.findOne({
      where: { token, isRevoked: false }
    });

    if (!refreshToken) {
      return false;
    }

    refreshToken.isRevoked = true;
    refreshToken.revokedAt = new Date();
    await refreshTokenRepository.save(refreshToken);
    
    logger.info(`Refresh token revoked: ${token.substring(0, 8)}...`);
    return true;
  }

  static async revokeAllUserTokens(userId: number): Promise<number> {
    const result = await refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );
    
    logger.info(`Revoked all tokens for user ${userId}`);
    return result.affected || 0;
  }

  static async cleanupExpiredTokens(): Promise<number> {
    const result = await refreshTokenRepository.delete({
      expiresAt: new Date()
    });
    
    logger.info(`Cleaned up ${result.affected || 0} expired refresh tokens`);
    return result.affected || 0;
  }

  static async getUserFromRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await refreshTokenRepository.findOne({
      where: { token, isRevoked: false },
      relations: ['user']
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      return null;
    }

    return refreshToken.user;
  }
}