import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: '邮箱不能为空' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // 即使用户不存在，也返回成功（防止邮箱枚举攻击）
      return NextResponse.json(
        { message: '如果该邮箱已注册，我们已发送验证邮件。' },
        { status: 200 }
      );
    }

    // 如果邮箱已经验证，不需要重新发送
    if (user.emailVerified) {
      return NextResponse.json(
        { message: '该邮箱已经验证，无需重新发送验证邮件。' },
        { status: 200 }
      );
    }

    // 如果没有验证令牌，生成一个新的
    if (!user.emailVerificationToken) {
      const crypto = await import('crypto');
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date();
      emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24);

      const db = await import('@/lib/db').then(m => m.getDb());
      const users = db.collection('users');
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationToken,
            emailVerificationExpires,
            updatedAt: new Date(),
          },
        }
      );
      user.emailVerificationToken = emailVerificationToken;
    }

    // 发送验证邮件
    try {
      await sendVerificationEmail(user.email, user.emailVerificationToken);
      return NextResponse.json(
        { message: '验证邮件已重新发送，请检查您的邮箱。' },
        { status: 200 }
      );
    } catch (emailError: any) {
      console.error('⚠️ [重发验证邮件] 发送失败:', emailError.message || emailError);
      return NextResponse.json(
        { error: '发送邮件失败，请稍后重试' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('重发验证邮件失败:', error);
    return NextResponse.json(
      { error: error.message || '操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}

