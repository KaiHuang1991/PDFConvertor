import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isPasswordValid = await UserModel.verifyPassword(user, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 生成 token
    const token = generateToken(user);

    // 创建响应
    const response = NextResponse.json(
      {
        message: '登录成功',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
        token,
      },
      { status: 200 }
    );

    // 设置 Cookie（可选）
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
    });

    return response;
  } catch (error: any) {
    console.error('登录失败:', error);
    return NextResponse.json(
      { error: error.message || '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}

