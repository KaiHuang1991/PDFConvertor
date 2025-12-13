import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { sendAccountInfoEmail } from '@/lib/email';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: '验证令牌不能为空' },
        { status: 400 }
      );
    }

    // 在验证前获取用户信息和原始密码
    const db = await getDb();
    const users = db.collection<any>('users');
    const userBeforeVerify = await users.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!userBeforeVerify) {
      return NextResponse.json(
        { error: '验证令牌无效或已过期' },
        { status: 400 }
      );
    }

    // 获取原始密码（临时存储的）
    const originalPassword = userBeforeVerify.tempPassword;

    const verified = await UserModel.verifyEmail(token);

    if (!verified) {
      return NextResponse.json(
        { error: '验证令牌无效或已过期' },
        { status: 400 }
      );
    }

    // 发送账号信息邮件
    if (originalPassword) {
      try {
        await sendAccountInfoEmail(verified.email, originalPassword);
        // 删除临时密码
        const { ObjectId } = require('mongodb');
        await users.updateOne(
          { _id: new ObjectId(verified._id) },
          { $unset: { tempPassword: '' } }
        );
      } catch (emailError: any) {
        console.error('发送账号信息邮件失败:', emailError);
        // 即使邮件发送失败，邮箱验证仍然成功
      }
    }

    // 重新获取更新后的用户信息
    const { ObjectId } = require('mongodb');
    const updatedUser = await users.findOne({ _id: new ObjectId(verified._id) });

    return NextResponse.json(
      { 
        message: '邮箱验证成功！账号信息已发送到您的邮箱。',
        email: verified.email,
        profileCompleted: updatedUser?.profileCompleted || false,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('邮箱验证失败:', error);
    return NextResponse.json(
      { error: error.message || '验证失败，请稍后重试' },
      { status: 500 }
    );
  }
}

