import nodemailer from 'nodemailer';

// 创建邮件传输器
const createTransporter = () => {
  // 如果配置了 SMTP，使用 SMTP
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
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
  return nodemailer.createTransporter({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'ethereal.user@ethereal.email',
      pass: 'ethereal.pass',
    },
  });
};

export async function sendVerificationEmail(email: string, token: string) {
  const transporter = createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@pdfconvertor.com',
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
    const info = await transporter.sendMail(mailOptions);
    console.log('验证邮件已发送:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('发送验证邮件失败:', error);
    throw new Error('发送邮件失败，请稍后重试');
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const transporter = createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@pdfconvertor.com',
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
    console.log('密码重置邮件已发送:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('发送密码重置邮件失败:', error);
    throw new Error('发送邮件失败，请稍后重试');
  }
}

