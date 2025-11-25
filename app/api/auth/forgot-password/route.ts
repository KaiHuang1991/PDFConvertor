import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: '邮箱不能为空' },
        { status: 400 }
      );
    }

    // 创建重置令牌
    const token = await UserModel.createPasswordResetToken(email);

    // 即使用户不存在，也返回成功（防止邮箱枚举攻击）
    if (token) {
      try {
        await sendPasswordResetEmail(email, token);
      } catch (emailError) {
        console.error('发送密码重置邮件失败:', emailError);
        return NextResponse.json(
          { error: '发送邮件失败，请稍后重试' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { message: '如果该邮箱已注册，我们已发送密码重置链接到您的邮箱。' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('忘记密码处理失败:', error);
    return NextResponse.json(
      { error: error.message || '处理失败，请稍后重试' },
      { status: 500 }
    );
  }
}

