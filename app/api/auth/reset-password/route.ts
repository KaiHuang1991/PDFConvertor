import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: '重置令牌和新密码不能为空' },
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

    const success = await UserModel.resetPassword(token, password);

    if (!success) {
      return NextResponse.json(
        { error: '重置令牌无效或已过期' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: '密码重置成功！请使用新密码登录。' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('密码重置失败:', error);
    return NextResponse.json(
      { error: error.message || '重置失败，请稍后重试' },
      { status: 500 }
    );
  }
}

