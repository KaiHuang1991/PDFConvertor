"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, Image, ArrowRight, RefreshCw, MoreVertical, Grid3x3 } from "lucide-react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import NavigationPanel from "@/components/NavigationPanel";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const [showNavPanel, setShowNavPanel] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AIPDF Pro
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex gap-6">
                <Link href="/viewer" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.pdfViewer}
                </Link>
                <Link href="/editor" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.pdfEditor}
                </Link>
                <Link href="/tools" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.pdfTools}
                </Link>
                <Link href="/convert" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.formatConversion}
                </Link>
                <Link href="/chat" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.aiChat}
                </Link>
                <Link href="/ocr" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t.nav.ocrRecognition}
                </Link>
              </nav>
              <div className="flex items-center gap-2">
                {/* 语言选择器 */}
                <LanguageSelector />
                {/* 导航面板触发按钮 */}
                <button
                  onClick={() => setShowNavPanel(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="打开导航菜单"
                >
                  <Grid3x3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 导航面板 */}
      <NavigationPanel isOpen={showNavPanel} onClose={() => setShowNavPanel(false)} />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t.home.title}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {t.home.subtitle}
            <br />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{t.home.privacyNote}</span>
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">{t.home.coreFeatures}</h3>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: FileText, 
              title: t.home.features.pdfBasicOps.title,
              desc: t.home.features.pdfBasicOps.desc,
              href: "/tools"
            },
            { 
              icon: Image, 
              title: t.home.features.pdfEditor.title,
              desc: t.home.features.pdfEditor.desc,
              href: "/editor"
            },
            { 
              icon: RefreshCw, 
              title: t.home.features.formatConversion.title,
              desc: t.home.features.formatConversion.desc,
              href: "/convert"
            },
            { 
              icon: Sparkles, 
              title: t.home.features.aiChat.title,
              desc: t.home.features.aiChat.desc,
              href: "/chat"
            },
            { 
              icon: Image, 
              title: t.home.features.ocr.title,
              desc: t.home.features.ocr.desc,
              href: "/ocr"
            },
          ].map((feature, idx) => (
            <Link key={idx} href={feature.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <feature.icon className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" />
                </div>
                <h4 className="text-xl font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {feature.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-300">{feature.desc}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">{t.home.getStarted}</h3>
            <p className="text-blue-100 mb-6 text-lg">
              {t.home.ctaDescription}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/tools"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                {t.home.startUsingTools}
              </Link>
              <Link
                href="/chat"
                className="px-6 py-3 bg-white/10 text-white border-2 border-white rounded-lg font-semibold hover:bg-white/20 transition"
              >
                {t.home.tryAIChat}
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>© 2025 AIPDF Pro. 免费、开源、隐私优先的AI PDF工具平台</p>
        </div>
      </footer>
    </div>
  );
}

