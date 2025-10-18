import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { Admin, AdminRole } from '@prisma/client';

export interface AdminLoginData {
  email: string;
  password: string;
}

export interface AdminCreateData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: AdminRole;
}

export interface AdminJWTPayload {
  adminId: number;
  email: string;
  role: AdminRole;
}

export class AdminService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
  private readonly SALT_ROUNDS = 12;

  async createAdmin(adminData: AdminCreateData): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(adminData.password, this.SALT_ROUNDS);
    
    return await prisma.admin.create({
      data: {
        email: adminData.email,
        password: hashedPassword,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: adminData.role || AdminRole.ADMIN
      }
    });
  }

  async authenticateAdmin(loginData: AdminLoginData): Promise<{ admin: Admin; token: string } | null> {
    const admin = await prisma.admin.findUnique({
      where: { email: loginData.email }
    });

    if (!admin || !admin.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(loginData.password, admin.password);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role
      } as AdminJWTPayload,
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { admin, token };
  }

  async getAdminById(adminId: number): Promise<Admin | null> {
    return await prisma.admin.findUnique({
      where: { id: adminId }
    });
  }

  async getAllAdmins(): Promise<Admin[]> {
    return await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateAdmin(adminId: number, updates: Partial<Admin>): Promise<Admin> {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, this.SALT_ROUNDS);
    }

    return await prisma.admin.update({
      where: { id: adminId },
      data: updates
    });
  }

  async deleteAdmin(adminId: number): Promise<void> {
    await prisma.admin.delete({
      where: { id: adminId }
    });
  }

  verifyToken(token: string): AdminJWTPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as AdminJWTPayload;
    } catch (error) {
      return null;
    }
  }

  async createDefaultAdmin(): Promise<void> {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: 'admin@beripritsep.ru' }
    });

    if (!existingAdmin) {
      await this.createAdmin({
        email: 'admin@beripritsep.ru',
        password: 'admin123',
        firstName: 'Администратор',
        lastName: 'Системы',
        role: AdminRole.SUPER_ADMIN
      });
      console.log('✅ Default admin created: admin@beripritsep.ru / admin123');
    }
  }
}

export const adminService = new AdminService();
