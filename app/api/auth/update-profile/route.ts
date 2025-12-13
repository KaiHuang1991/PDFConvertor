import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: '令牌无效或已过期' },
        { status: 401 }
      );
    }

    const { name, avatar, birthDate } = await request.json();

    // 验证出生日期格式
    let birthDateObj: Date | undefined;
    if (birthDate) {
      birthDateObj = new Date(birthDate);
      if (isNaN(birthDateObj.getTime())) {
        return NextResponse.json(
          { error: '出生日期格式不正确' },
          { status: 400 }
        );
      }
    }

    const success = await UserModel.updateProfile(payload.userId, {
      name,
      avatar,
      birthDate: birthDateObj,
    });

    if (!success) {
      return NextResponse.json(
        { error: '更新用户信息失败' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: '用户信息更新成功' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败，请稍后重试' },
      { status: 500 }
    );
  }
}



