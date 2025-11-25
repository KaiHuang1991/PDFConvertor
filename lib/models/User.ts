import { getDb } from '../db';
import bcrypt from 'bcryptjs';

export interface User {
  _id?: string;
  email: string;
  password: string;
  name?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  static async create(userData: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const db = await getDb();
    const users = db.collection<User>('users');

    // 检查邮箱是否已存在
    const existingUser = await users.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('该邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // 生成邮箱验证 token
    const crypto = await import('crypto');
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // 24小时后过期

    const newUser: User = {
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);
    return { ...newUser, _id: result.insertedId.toString() };
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

  static async verifyEmail(token: string): Promise<boolean> {
    const db = await getDb();
    const users = db.collection<User>('users');

    const user = await users.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return false;
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

    return true;
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
}

