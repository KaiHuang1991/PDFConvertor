"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Lock,
  Grid,
  Heart,
  HelpCircle,
  ChevronLeft,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NavigationPanel({ isOpen, onClose }: NavigationPanelProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭（但不影响语言选择器）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // 如果点击的是语言选择器内部，不关闭面板
      const languageSelector = document.querySelector('[data-language-selector]');
      if (languageSelector && languageSelector.contains(target)) {
        return;
      }
      
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  const menuItems = [
    {
      icon: CreditCard,
      label: t.nav.pricing,
      href: "/pricing",
      onClick: () => {
        onClose();
        router.push("/pricing");
      },
    },
    {
      icon: Lock,
      label: t.nav.security,
      href: "/security",
      onClick: () => {
        onClose();
        router.push("/security");
      },
    },
    {
      icon: Grid,
      label: t.nav.features,
      href: "/features",
      onClick: () => {
        onClose();
        router.push("/features");
      },
    },
    {
      icon: Heart,
      label: t.nav.aboutUs,
      href: "/about",
      onClick: () => {
        onClose();
        router.push("/about");
      },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* 面板 */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 right-0 h-full w-[320px] bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto"
          >
            {/* 顶部导航栏 */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-base">AIPDF Pro</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="关闭菜单"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* 菜单内容 */}
            <div className="p-6">
              <div className="space-y-1">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-4 px-4 py-3.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                    >
                      <div className="flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                      </div>
                      <span className="text-[15px] font-normal">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 分隔线 */}
              <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

              {/* 底部菜单项 */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    onClose();
                    router.push("/help");
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                  <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                  <span className="text-[15px] font-normal">{t.nav.help}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

