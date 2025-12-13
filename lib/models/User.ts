import { getDb } from '../db';
import bcrypt from 'bcryptjs';

export type UserType = 'free' | 'premium' | 'vip';

export interface User {
  _id?: string;
  email: string;
  password: string;
  name?: string;
  avatar?: string; // 头像URL
  birthDate?: Date; // 出生日期
  userType: UserType; // 用户类型：free（免费用户）, premium（会员用户）, vip（VIP用户）
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  profileCompleted: boolean; // 是否完成个人信息填写
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  static async create(
    userData: {
      email: string;
      password: string;
      name?: string;
    },
    originalPassword?: string // 原始密码（用于激活后发送邮件，仅临时存储）
  ): Promise<User> {
    try {
      console.log('📝 [UserModel] 开始创建用户:', { email: userData.email });
      const db = await getDb();
      const users = db.collection<User>('users');

      // 检查邮箱是否已存在
      console.log('📝 [UserModel] 检查邮箱是否已存在...');
      const existingUser = await users.findOne({ email: userData.email });
      if (existingUser) {
        console.log('❌ [UserModel] 邮箱已被注册:', userData.email);
        throw new Error('该邮箱已被注册');
      }

      // 加密密码
      console.log('📝 [UserModel] 加密密码...');
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // 生成邮箱验证 token
      console.log('📝 [UserModel] 生成验证令牌...');
      const crypto = await import('crypto');
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date();
      emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // 24小时后过期

      const newUser: any = {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        userType: 'free', // 默认免费用户
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
        profileCompleted: false, // 注册时未完成个人信息
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 临时存储原始密码（用于激活后发送邮件，发送后会被删除）
      if (originalPassword) {
        newUser.tempPassword = originalPassword;
      }

      console.log('📝 [UserModel] 插入用户到数据库...');
      const result = await users.insertOne(newUser);
      console.log('✅ [UserModel] 用户创建成功:', result.insertedId);
      const createdUser = { ...newUser, _id: result.insertedId.toString() };
      // 返回时删除临时密码字段（不暴露给外部）
      delete createdUser.tempPassword;
      return createdUser as User;
    } catch (error: any) {
      console.error('❌ [UserModel] 创建用户失败:');
      console.error('   错误消息:', error.message);
      console.error('   错误堆栈:', error.stack);
      
      // 如果是已知错误，直接抛出
      if (error.message === '该邮箱已被注册') {
        throw error;
      }
      
      // 数据库连接错误
      if (error.message?.includes('MongoDB') || error.message?.includes('数据库连接失败')) {
        throw new Error('数据库连接失败，请检查 MongoDB 配置');
      }
      
      // 其他错误
      throw new Error(`创建用户失败: ${error.message}`);
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    const db = await getDb();
    const users = db.collection<User>('users');
    return await users.findOne({ email });
  }

  static async findById(id: string): Promise<User | null> {
    const db = await getDb();
    const users = db.collection<User>('users');
    const { ObjectId } = require('mongodb');
    try {
      return await users.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      return null;
    }
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  static async verifyEmail(token: string): Promise<User | null> {
    const db = await getDb();
    const users = db.collection<User>('users');

    const user = await users.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return null;
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          emailVerificationToken: undefined,
          emailVerificationExpires: undefined,
          updatedAt: new Date(),
        },
      }
    );

    // 返回更新后的用户信息
    const updatedUser = await users.findOne({ _id: user._id });
    return updatedUser ? { ...updatedUser, _id: updatedUser._id?.toString() } : null;
  }

  static async createPasswordResetToken(email: string): Promise<string | null> {
    const db = await getDb();
    const users = db.collection<User>('users');

    const user = await users.findOne({ email });
    if (!user) {
      return null;
    }

    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1小时后过期

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires,
          updatedAt: new Date(),
        },
      }
    );

    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const db = await getDb();
    const users = db.collection<User>('users');

    const user = await users.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return false;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
          updatedAt: new Date(),
        },
      }
    );

    return true;
  }

  // 验证密码强度
  static validatePasswordStrength(password: string): { valid: boolean; error?: string } {
    // 长度检查：必须大于8位
    if (password.length < 8) {
      return { valid: false, error: '密码长度必须至少8位' };
    }

    // 特殊字符检查
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    if (!specialCharRegex.test(password)) {
      return { valid: false, error: '密码必须包含至少一个特殊字符（如 !@#$%^&* 等）' };
    }

    return { valid: true };
  }

  // 更新用户信息
  static async updateProfile(
    userId: string,
    updates: {
      name?: string;
      avatar?: string;
      birthDate?: Date;
    }
  ): Promise<boolean> {
    const db = await getDb();
    const users = db.collection<User>('users');
    const { ObjectId } = require('mongodb');

    try {
      await users.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            ...updates,
            profileCompleted: true,
            updatedAt: new Date(),
          },
        }
      );
      return true;
    } catch (error) {
      console.error('更新用户信息失败:', error);
      return false;
    }
  }

  // 更新用户类型（用于升级会员等）
  static async updateUserType(userId: string, userType: UserType): Promise<boolean> {
    const db = await getDb();
    const users = db.collection<User>('users');
    const { ObjectId } = require('mongodb');

    try {
      await users.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            userType,
            updatedAt: new Date(),
          },
        }
      );
      return true;
    } catch (error) {
      console.error('更新用户类型失败:', error);
      return false;
    }
  }
}

