"use client";

import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { motion } from "framer-motion";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            创建账户
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            注册新账户以开始使用 AIPDF Pro
          </p>
        </div>

        <AuthForm mode="register" />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            已有账户？{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
            >
              立即登录
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

