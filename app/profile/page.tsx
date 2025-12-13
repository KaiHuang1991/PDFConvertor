"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Calendar, Crown, UserCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import UserProfileForm from "@/components/UserProfileForm";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserData {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  birthDate?: string;
  userType: 'free' | 'premium' | 'vip';
  emailVerified: boolean;
  profileCompleted: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('获取用户信息失败');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'premium':
        return t.profile.premiumUser;
      case 'vip':
        return t.profile.vipUser;
      default:
        return t.profile.freeUser;
    }
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'premium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'vip':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t.profile.notSet;
    try {
      const date = new Date(dateString);
      // 根据当前语言设置日期格式
      const dateLocale = locale === 'en' ? 'en-US' : 'zh-CN';
      return date.toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return t.profile.notSet;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t.common.back}
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <UserProfileForm
          userEmail={user.email}
          currentName={user.name}
          currentAvatar={user.avatar}
          currentBirthDate={user.birthDate}
          onSuccess={() => {
            setEditing(false);
            fetchUserData();
            window.dispatchEvent(new Event('auth-change'));
          }}
          onSkip={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          {/* 用户头像和基本信息 */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <div className="flex items-center gap-6">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || user.email}
                    className="w-24 h-24 rounded-full border-4 border-white/30 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white/30 bg-white/20 flex items-center justify-center">
                    <UserCircle className="w-16 h-16" />
                  </div>
                )}
                <span className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-medium ${getUserTypeColor(user.userType)}`}>
                  {user.userType !== 'free' && <Crown className="w-3 h-3 inline mr-1" />}
                  {getUserTypeLabel(user.userType)}
                </span>
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">
                  {user.name || t.profile.username + ' - ' + t.profile.notSet}
                </h1>
                <p className="text-blue-100 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* 详细信息 */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.profile.username}</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name || t.profile.notSet}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.profile.birthDate}</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(user.birthDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Crown className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.profile.accountType}</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {getUserTypeLabel(user.userType)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.profile.emailStatus}</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.emailVerified ? t.profile.verified : t.profile.notVerified}
                  </p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <button
                onClick={() => setEditing(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <User className="w-5 h-5" />
                {t.profile.editProfile}
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t.profile.backToHome}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

