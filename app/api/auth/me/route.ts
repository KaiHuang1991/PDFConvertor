import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { UserModel } from '@/lib/models/User';

export async function GET(request: NextRequest) {
  try {
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

    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : undefined,
        userType: user.userType || 'free',
        emailVerified: user.emailVerified,
        profileCompleted: user.profileCompleted || false,
      },
    });
  } catch (error: any) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { error: error.message || '获取用户信息失败' },
      { status: 500 }
    );
  }
}

