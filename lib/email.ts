import nodemailer from 'nodemailer';

// 缓存 Ethereal Email 账户（开发模式）
let etherealAccount: nodemailer.TestAccount | null = null;

// 创建邮件传输器
const createTransporter = async () => {
  // 如果配置了 SMTP，使用 SMTP
  if (process.env.SMTP_HOST) {
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = port === 465 || process.env.SMTP_SECURE === 'true';
    
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: secure, // 465 端口使用 SSL，587 端口使用 STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // QQ 邮箱需要设置 tls
      tls: {
        rejectUnauthorized: false, // 允许自签名证书
      },
    });
  }

  // 否则使用 Gmail（需要应用专用密码）
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
  }

  // 开发模式：使用 Ethereal Email（测试邮箱）
  // 如果没有账户，创建一个新的
  if (!etherealAccount) {
    try {
      etherealAccount = await nodemailer.createTestAccount();
      console.log('📧 [开发模式] 已创建 Ethereal Email 测试账户:');
      console.log('   邮箱:', etherealAccount.user);
      console.log('   密码:', etherealAccount.pass);
      console.log('   查看邮件: https://ethereal.email');
    } catch (error: any) {
      console.error('❌ [开发模式] 创建 Ethereal Email 账户失败:', error.message);
      throw new Error('无法创建测试邮箱账户，请配置 SMTP 或 Gmail');
    }
  }

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  });
};

export async function sendVerificationEmail(email: string, token: string) {
  const transporter = await createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

  // 确定发件人地址
  // QQ 邮箱要求发件人地址必须与登录邮箱（SMTP_USER）一致
  let fromAddress: string;
  if (process.env.SMTP_FROM) {
    fromAddress = process.env.SMTP_FROM;
  } else if (process.env.SMTP_USER) {
    // 优先使用 SMTP_USER（QQ 邮箱要求发件人必须是登录邮箱）
    fromAddress = process.env.SMTP_USER;
  } else if (process.env.GMAIL_USER) {
    fromAddress = process.env.GMAIL_USER;
  } else {
    // 开发模式：使用 Ethereal Email 账户的邮箱
    const isDevMode = process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER;
    if (isDevMode && etherealAccount) {
      fromAddress = etherealAccount.user;
    } else {
      fromAddress = 'noreply@pdfconvertor.com';
    }
  }
  
  // 验证发件人地址格式
  if (!fromAddress || !fromAddress.includes('@')) {
    throw new Error('发件人地址格式不正确，必须是有效的邮箱地址');
  }

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: '验证您的邮箱 - AIPDF Pro',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">欢迎使用 AIPDF Pro！</h2>
        <p>感谢您注册我们的服务。请点击下面的链接验证您的邮箱：</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            验证邮箱
          </a>
        </p>
        <p>或者复制以下链接到浏览器：</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          此链接将在 24 小时后过期。如果您没有注册此账户，请忽略此邮件。
        </p>
      </div>
    `,
  };

  try {
    console.log('📧 [邮件] 发送配置:');
    console.log('   发件人:', fromAddress);
    console.log('   收件人:', email);
    console.log('   SMTP主机:', process.env.SMTP_HOST || '未配置');
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 验证邮件已发送:', info.messageId);
    
    // 开发模式：如果是 Ethereal Email，打印预览链接
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 [开发模式] 邮件不会发送到真实邮箱！');
        console.log('📧 [开发模式] 请使用以下链接查看邮件：');
        console.log('   ', previewUrl);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    }
    
    return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || null };
  } catch (error: any) {
    console.error('❌ 发送验证邮件失败:');
    console.error('   错误消息:', error.message);
    console.error('   错误代码:', error.code);
    console.error('   响应代码:', error.responseCode);
    console.error('   命令:', error.command);
    console.error('   发件人地址:', fromAddress);
    console.error('   SMTP配置:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : '未配置',
    });
    if (error.response) {
      console.error('   响应:', error.response);
    }
    throw new Error(`发送邮件失败: ${error.message}`);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const transporter = await createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

  // 确定发件人地址
  // QQ 邮箱要求发件人地址必须与登录邮箱（SMTP_USER）一致
  let fromAddress: string;
  if (process.env.SMTP_FROM) {
    fromAddress = process.env.SMTP_FROM;
  } else if (process.env.SMTP_USER) {
    // 优先使用 SMTP_USER（QQ 邮箱要求发件人必须是登录邮箱）
    fromAddress = process.env.SMTP_USER;
  } else if (process.env.GMAIL_USER) {
    fromAddress = process.env.GMAIL_USER;
  } else {
    // 开发模式：使用 Ethereal Email 账户的邮箱
    const isDevMode = process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER;
    if (isDevMode && etherealAccount) {
      fromAddress = etherealAccount.user;
    } else {
      fromAddress = 'noreply@pdfconvertor.com';
    }
  }
  
  // 验证发件人地址格式
  if (!fromAddress || !fromAddress.includes('@')) {
    throw new Error('发件人地址格式不正确，必须是有效的邮箱地址');
  }

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: '重置您的密码 - AIPDF Pro',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">重置密码</h2>
        <p>您请求重置密码。请点击下面的链接重置您的密码：</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            重置密码
          </a>
        </p>
        <p>或者复制以下链接到浏览器：</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 密码重置邮件已发送:', info.messageId);
    
    // 开发模式：如果是 Ethereal Email，打印预览链接
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 [开发模式] 邮件预览链接:', previewUrl);
      }
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ 发送密码重置邮件失败:', error);
    throw new Error('发送邮件失败，请稍后重试');
  }
}

// 发送账号密码邮件（邮箱激活后）
export async function sendAccountInfoEmail(
  email: string,
  password: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string | null }> {
  const transporter = await createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 确定发件人地址
  let fromAddress: string;
  if (process.env.SMTP_FROM) {
    fromAddress = process.env.SMTP_FROM;
  } else if (process.env.SMTP_USER) {
    fromAddress = process.env.SMTP_USER;
  } else if (process.env.GMAIL_USER) {
    fromAddress = process.env.GMAIL_USER;
  } else {
    const isDevMode = process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER;
    if (isDevMode && etherealAccount) {
      fromAddress = etherealAccount.user;
    } else {
      fromAddress = 'noreply@pdfconvertor.com';
    }
  }

  if (!fromAddress || !fromAddress.includes('@')) {
    throw new Error('发件人地址格式不正确，必须是有效的邮箱地址');
  }

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: '欢迎使用 AIPDF Pro - 您的账号信息',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">欢迎使用 AIPDF Pro！</h2>
        <p>您的邮箱已验证成功，账户已激活。以下是您的账号信息，请妥善保管：</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>登录邮箱：</strong>${email}</p>
          <p style="margin: 10px 0;"><strong>登录密码：</strong><code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
        </div>

        <p style="color: #dc2626; font-weight: bold; background-color: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626;">
          ⚠️ 安全提示：请妥善保管您的密码，不要将密码泄露给他人。建议您定期更换密码以确保账户安全。
        </p>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/auth/login" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            立即登录
          </a>
        </p>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          如果您没有注册此账户，请忽略此邮件或联系我们的支持团队。
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 账号信息邮件已发送:', info.messageId);

    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 [开发模式] 邮件预览链接:', previewUrl);
      }
      return { success: true, messageId: info.messageId, previewUrl };
    }

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ 发送账号信息邮件失败:', error);
    throw new Error('发送邮件失败，请稍后重试');
  }
}

