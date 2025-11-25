"use client";

import { useState } from "react";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            欢迎回来
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            登录您的账户以继续使用 AIPDF Pro
          </p>
        </div>

        <AuthForm mode="login" />

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            忘记密码？
          </Link>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            还没有账户？{" "}
            <Link
              href="/auth/register"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
            >
              立即注册
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

