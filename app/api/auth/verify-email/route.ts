import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';

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

    const verified = await UserModel.verifyEmail(token);

    if (!verified) {
      return NextResponse.json(
        { error: '验证令牌无效或已过期' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: '邮箱验证成功！' },
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

