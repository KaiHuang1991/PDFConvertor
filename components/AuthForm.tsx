"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Loader2 } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
}

export default function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" 
        ? { email, password }
        : { email, password, name: name || undefined };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // 显示更详细的错误信息
        const errorMessage = data.message || data.error || "操作失败";
        console.error('❌ API 错误:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          message: data.message,
          details: data.details
        });
        
        // 如果是数据库连接错误，提供更友好的提示
        if (data.error === '数据库连接失败' || data.error === '服务器配置错误') {
          throw new Error(
            '数据库连接失败。\n\n' +
            '请检查：\n' +
            '1. .env.local 文件中是否设置了 MONGODB_URI\n' +
            '2. MongoDB 服务是否正在运行\n' +
            '3. 连接字符串是否正确\n\n' +
            '详细配置指南请查看 MONGODB_SETUP.md 文件'
          );
        }
        
        throw new Error(errorMessage);
      }

      if (mode === "login") {
        // 保存 token
        if (data.token) {
          localStorage.setItem("token", data.token);
          // 触发自定义事件，通知 AuthContext 更新
          window.dispatchEvent(new Event('auth-change'));
        }
        setSuccess("登录成功！");
        setTimeout(() => {
          onSuccess?.();
          window.location.href = "/";
        }, 1000);
      } else {
        const message = data.message || "注册成功！请检查您的邮箱以验证账户。";
        setSuccess(message);
        
        // 如果是开发模式且有预览链接，显示提示
        if (data.emailPreviewUrl) {
          console.log('📧 邮件预览链接:', data.emailPreviewUrl);
          setTimeout(() => {
            setSuccess(
              message + '\n\n' +
              '📧 开发模式：邮件不会发送到真实邮箱。\n' +
              '请查看服务器控制台或浏览器控制台获取邮件预览链接。'
            );
          }, 2000);
        }
      }
    } catch (err: any) {
      setError(err.message || "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "register" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            姓名（可选）
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="请输入您的姓名"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          邮箱
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="请输入您的邮箱"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          密码
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="请输入密码（至少6位）"
          />
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm"
        >
          {success}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            处理中...
          </>
        ) : (
          mode === "login" ? "登录" : "注册"
        )}
      </button>
    </form>
  );
}

