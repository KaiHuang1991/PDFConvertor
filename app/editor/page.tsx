"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const PDFEditor = dynamic(() => import("@/components/PDFEditor"), { ssr: false });

export default function EditorPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.pages.backToHome}
          </Link>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.editor.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t.editor.description}
            </p>
          </div>
        </div>
        <PDFEditor />
      </div>
    </div>
  );
}

