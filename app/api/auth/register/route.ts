import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      );
    }

    // 创建用户
    const user = await UserModel.create({ email, password, name });

    // 发送验证邮件
    try {
      await sendVerificationEmail(user.email, user.emailVerificationToken!);
    } catch (emailError) {
      console.error('发送验证邮件失败:', emailError);
      // 即使邮件发送失败，也返回成功（用户已创建）
    }

    return NextResponse.json(
      {
        message: '注册成功！请检查您的邮箱以验证账户。',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { error: error.message || '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}

