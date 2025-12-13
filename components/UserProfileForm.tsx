"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Calendar, Upload, Loader2, X } from "lucide-react";

interface UserProfileFormProps {
  userEmail: string;
  currentName?: string;
  currentAvatar?: string;
  currentBirthDate?: string;
  onSuccess?: () => void;
  onSkip?: () => void;
}

export default function UserProfileForm({
  userEmail,
  currentName,
  currentAvatar,
  currentBirthDate,
  onSuccess,
  onSkip,
}: UserProfileFormProps) {
  const [name, setName] = useState(currentName || "");
  const [avatar, setAvatar] = useState(currentAvatar || "");
  const [birthDate, setBirthDate] = useState(currentBirthDate || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatar || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      // 验证文件大小（限制5MB）
      if (file.size > 5 * 1024 * 1024) {
        setError('图片大小不能超过5MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let avatarUrl = avatar;

      // 如果有上传文件，先上传图片
      if (avatarFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', avatarFile);
        
        // 这里应该调用图片上传API
        // 暂时使用base64（实际项目中应该上传到云存储）
        avatarUrl = avatarPreview;
        setUploading(false);
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          name: name || undefined,
          avatar: avatarUrl || undefined,
          birthDate: birthDate || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || '更新失败，请稍后重试');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          完善个人信息
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          请填写您的个人信息（所有字段均为选填）
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 头像上传 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            头像（选填）
          </label>
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="头像预览"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPreview("");
                      setAvatarFile(null);
                      setAvatar("");
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={uploading}
              />
              <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {uploading ? "上传中..." : avatarPreview ? "更换头像" : "上传头像"}
                </span>
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            支持 JPG、PNG 格式，最大 5MB
          </p>
        </div>

        {/* 用户名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            用户名（选填）
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="请输入您的用户名"
            />
          </div>
        </div>

        {/* 出生日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            出生日期（选填）
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading || uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : (
              "保存信息"
            )}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              稍后填写
            </button>
          )}
        </div>
      </form>
    </motion.div>
  );
}



