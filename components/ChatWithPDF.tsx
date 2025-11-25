"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquare, Bot, User } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";

interface ChatWithPDFProps {
  files: File[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatWithPDF({ files }: ChatWithPDFProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (files.length > 0 && !pdfText) {
      extractPDFText();
    }
  }, [files]);

  const extractPDFText = async () => {
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const text = await extractTextFromPDF(files[0]);
      setPdfText(text);
      // 正确计算页数：根据 "--- 第 X 页 ---" 格式
      const pageCount = (text.match(/--- 第 \d+ 页 ---/g) || []).length;
      setMessages([
        {
          role: "assistant",
          content: `✅ 已成功提取PDF内容（共${pageCount}页）。您可以问我关于这份PDF的任何问题，比如："总结一下这份文档"、"第5页说了什么"、"提取关键信息"等。`,
        },
      ]);
    } catch (error: any) {
      setMessages([
        {
          role: "assistant",
          content: `❌ 提取PDF文本失败：${error.message}。请确保PDF未加密或尝试其他文件。`,
        },
      ]);
    } finally {
      setExtracting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !pdfText) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 调用Groq API（需要在API路由中实现）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          pdfText: pdfText,
          history: messages,
        }),
      });

      if (!response.ok) {
        // 尝试读取详细的错误信息
        let errorMessage = "AI服务暂时不可用，请稍后重试";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // 如果无法解析JSON，使用默认错误信息
          errorMessage = `请求失败 (状态码: ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 错误：${error.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>请先上传PDF文件以开始AI聊天</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold">AI PDF助手</h3>
          {extracting && (
            <span className="ml-auto text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在提取PDF内容...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div
                className={`
                  max-w-[80%] rounded-lg px-4 py-2
                  ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  }
                `}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={pdfText ? "问关于PDF的任何问题..." : "等待PDF内容提取..."}
            disabled={loading || !pdfText || extracting}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !pdfText || extracting || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 提示：可以问"总结这份文档"、"第X页说了什么"、"提取关键信息"等
        </p>
      </div>
    </div>
  );
}

