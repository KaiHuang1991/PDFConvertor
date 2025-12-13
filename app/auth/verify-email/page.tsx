"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import UserProfileForm from "@/components/UserProfileForm";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "profile">("loading");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileCompleted, setProfileCompleted] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("验证令牌不存在");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setMessage(data.message || "邮箱验证成功！");
          setProfileCompleted(data.profileCompleted || false);
          
          // 如果未完成个人信息，显示表单
          if (!data.profileCompleted) {
            // 从API响应中获取邮箱
            setUserEmail(data.email || '');
            setStatus("profile");
          } else {
            setStatus("success");
            setTimeout(() => {
              router.push("/auth/login");
            }, 3000);
          }
        } else {
          setStatus("error");
          setMessage(data.error || "验证失败");
        }
      } catch (error) {
        setStatus("error");
        setMessage("验证过程中发生错误，请稍后重试");
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full ${status === "profile" ? "max-w-2xl" : "max-w-md"} bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 ${status === "profile" ? "" : "text-center"}`}
      >
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              正在验证...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              请稍候，我们正在验证您的邮箱
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              验证成功！
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              3秒后自动跳转到登录页面...
            </p>
            <Link
              href="/auth/login"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              立即登录
            </Link>
          </>
        )}

        {status === "profile" && (
          <div className="w-full">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                邮箱验证成功！
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
            <UserProfileForm
              userEmail={userEmail}
              onSuccess={() => {
                setStatus("success");
                setMessage("个人信息已保存！");
                setTimeout(() => {
                  router.push("/auth/login");
                }, 2000);
              }}
              onSkip={() => {
                setStatus("success");
                setMessage("您可以稍后在个人中心完善信息。");
                setTimeout(() => {
                  router.push("/auth/login");
                }, 2000);
              }}
            />
          </div>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              验证失败
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <Link
              href="/auth/register"
              className="inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              返回注册
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

