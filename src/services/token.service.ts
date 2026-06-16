import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/database';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import logger from '../utils/logger';

const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
const userRepository = AppDataSource.getRepository(User);

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days

export class TokenService {
  // Generate access token
  static generateAccessToken(user: User): string {
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  // Generate refresh token and save to database
  static async generateRefreshToken(user: User, ipAddress?: string, userAgent?: string): Promise<RefreshToken> {
    // Revoke all existing refresh tokens for this user (optional - one active session)
    await refreshTokenRepository.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );

    // Create new refresh token
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

  // Verify refresh token
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

  // Revoke refresh token (logout)
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

  // Revoke all user tokens (logout from all devices)
  static async revokeAllUserTokens(userId: number): Promise<number> {
    const result = await refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );
    
    logger.info(`Revoked all tokens for user ${userId}`);
    return result.affected || 0;
  }

  // Clean up expired tokens (run as a scheduled job)
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await refreshTokenRepository.delete({
      expiresAt: new Date()
    });
    
    logger.info(`Cleaned up ${result.affected || 0} expired refresh tokens`);
    return result.affected || 0;
  }

  // Get user from refresh token
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