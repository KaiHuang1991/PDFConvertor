import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    console.log('📝 [注册] 收到注册请求');
    
    const { email, password, confirmPassword, name } = await request.json();
    console.log('📝 [注册] 输入数据:', { email, name: name ? '已提供' : '未提供', passwordLength: password?.length });
    
    // 验证确认密码
    if (!confirmPassword || password !== confirmPassword) {
      console.log('❌ [注册] 验证失败: 两次输入的密码不一致');
      return NextResponse.json(
        { error: '两次输入的密码不一致' },
        { status: 400 }
      );
    }

    // 验证输入
    if (!email || !password) {
      console.log('❌ [注册] 验证失败: 邮箱或密码为空');
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ [注册] 验证失败: 邮箱格式不正确');
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 验证密码强度
    const passwordValidation = UserModel.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      console.log('❌ [注册] 验证失败: 密码强度不足');
      return NextResponse.json(
        { error: passwordValidation.error || '密码不符合要求' },
        { status: 400 }
      );
    }

    console.log('📝 [注册] 开始创建用户...');
    
    // 创建用户（临时保存原始密码以便激活后发送）
    const user = await UserModel.create({ email, password, name }, password);
    console.log('✅ [注册] 用户创建成功:', { id: user._id, email: user.email });

    // 发送验证邮件
    let emailPreviewUrl = null;
    try {
      console.log('📧 [注册] 开始发送验证邮件...');
      const emailResult = await sendVerificationEmail(user.email, user.emailVerificationToken!);
      emailPreviewUrl = emailResult.previewUrl;
      console.log('✅ [注册] 验证邮件发送成功');
    } catch (emailError: any) {
      console.error('⚠️ [注册] 发送验证邮件失败:', emailError.message || emailError);
      console.error('⚠️ [注册] 错误堆栈:', emailError.stack);
      // 即使邮件发送失败，也返回成功（用户已创建）
    }

    // 检查是否使用开发模式测试邮箱
    const isDevMode = process.env.NODE_ENV === 'development';
    const isTestEmail = !process.env.SMTP_HOST && !process.env.GMAIL_USER;
    
    return NextResponse.json(
      {
        message: isDevMode && isTestEmail 
          ? '注册成功！由于使用开发模式测试邮箱，邮件不会发送到真实邮箱。请查看服务器控制台获取邮件预览链接。'
          : '注册成功！请检查您的邮箱以验证账户。',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
        emailPreviewUrl: emailPreviewUrl || undefined, // 开发模式下提供预览链接
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ [注册] 注册失败:');
    console.error('   错误消息:', error.message);
    console.error('   错误堆栈:', error.stack);
    console.error('   错误名称:', error.name);
    
    // 检查是否是 MongoDB 连接错误
    if (error.message?.includes('MongoDB') || 
        error.message?.includes('MONGODB') || 
        error.message?.includes('数据库连接失败') ||
        error.message?.includes('MongoServerError') ||
        error.message?.includes('MongoNetworkError')) {
      console.error('❌ [注册] MongoDB 连接错误');
      console.error('   请检查:');
      console.error('   1. .env.local 文件中是否设置了 MONGODB_URI');
      console.error('   2. MongoDB 服务是否正在运行');
      console.error('   3. 连接字符串是否正确');
      return NextResponse.json(
        { 
          error: '数据库连接失败',
          message: '请检查 MongoDB 配置。确保 .env.local 文件中设置了 MONGODB_URI，并且 MongoDB 服务正在运行。'
        },
        { status: 500 }
      );
    }
    
    // 检查是否是环境变量缺失
    if (error.message?.includes('MONGODB_URI') || error.message?.includes('环境变量')) {
      return NextResponse.json(
        { 
          error: '服务器配置错误',
          message: '请在 .env.local 文件中添加 MONGODB_URI 环境变量'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error.message || '注册失败，请稍后重试',
        message: process.env.NODE_ENV === 'development' 
          ? `详细错误: ${error.message}\n堆栈: ${error.stack?.substring(0, 200)}`
          : '请稍后重试或联系管理员'
      },
      { status: 500 }
    );
  }
}

