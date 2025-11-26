"use client";

import { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  Highlighter,
  Type,
  FileSignature,
  Plus,
  Trash2,
  ArrowUpDown,
  Download,
  Upload,
  Loader2,
  X,
  FileText,
  PenTool,
} from "lucide-react";
import {
  insertImage,
  insertShape,
  addAnnotation,
  addPage,
  deletePage,
  reorderPages,
  fillFormField,
  addSignature,
  batchEditPDF,
  PDFEditOperation,
} from "@/lib/pdf-utils";
import { downloadBlob } from "@/lib/utils";

type ToolType = "select" | "image" | "rectangle" | "circle" | "line" | "highlight" | "underline" | "textbox" | "signature";

interface EditOperation {
  id: string;
  type: ToolType;
  pageIndex: number;
  data: any;
  timestamp: number;
}

export default function PDFEditor() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInstance, setPdfInstance] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [operations, setOperations] = useState<EditOperation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [formFields, setFormFields] = useState<Map<string, string>>(new Map());
  const [showPageManager, setShowPageManager] = useState(false);
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale);
    }
  }, [pdfInstance, currentPage, scale, operations]);

  const loadPdfJs = async () => {
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    return pdfjsLib;
  };

  const renderPage = async (pageNumber: number, pdfDoc: any, zoom: number) => {
    if (!canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: zoom });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    // 绘制已添加的操作
    drawOperations(context, pageNumber, viewport);
  };

  const drawOperations = (ctx: CanvasRenderingContext2D, pageNum: number, viewport: any) => {
    const pageOps = operations.filter((op) => op.pageIndex === pageNum - 1);
    pageOps.forEach((op) => {
      ctx.save();
      switch (op.type) {
        case "rectangle":
          if (op.data.fill) {
            ctx.fillStyle = `rgba(${op.data.color.join(",")}, ${op.data.opacity || 1})`;
            ctx.fillRect(op.data.x, op.data.y, op.data.width, op.data.height);
          }
          if (op.data.borderWidth > 0) {
            ctx.strokeStyle = `rgba(${op.data.borderColor.join(",")}, ${op.data.opacity || 1})`;
            ctx.lineWidth = op.data.borderWidth;
            ctx.strokeRect(op.data.x, op.data.y, op.data.width, op.data.height);
          }
          break;
        case "circle":
          ctx.beginPath();
          ctx.arc(op.data.x, op.data.y, op.data.radius, 0, Math.PI * 2);
          if (op.data.fill) {
            ctx.fillStyle = `rgba(${op.data.color.join(",")}, ${op.data.opacity || 1})`;
            ctx.fill();
          }
          if (op.data.borderWidth > 0) {
            ctx.strokeStyle = `rgba(${op.data.borderColor.join(",")}, ${op.data.opacity || 1})`;
            ctx.lineWidth = op.data.borderWidth;
            ctx.stroke();
          }
          break;
        case "line":
          ctx.strokeStyle = `rgba(${op.data.borderColor.join(",")}, ${op.data.opacity || 1})`;
          ctx.lineWidth = op.data.borderWidth || 2;
          ctx.beginPath();
          ctx.moveTo(op.data.x, op.data.y);
          ctx.lineTo(op.data.x2, op.data.y2);
          ctx.stroke();
          break;
        case "highlight":
          ctx.fillStyle = `rgba(255, 255, 0, 0.3)`;
          ctx.fillRect(op.data.x, op.data.y, op.data.width, op.data.height);
          break;
        case "underline":
        case "strikethrough":
          ctx.strokeStyle = `rgba(${op.data.color.join(",")})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(op.data.x, op.data.y);
          ctx.lineTo(op.data.x + op.data.width, op.data.y);
          ctx.stroke();
          break;
        case "textbox":
          ctx.fillStyle = `rgb(${op.data.color.join(",")})`;
          ctx.font = `${op.data.fontSize || 12}px Arial`;
          ctx.fillText(op.data.text, op.data.x, op.data.y);
          break;
      }
      ctx.restore();
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setError("");
    setLoading(true);
    setOperations([]);
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      const pdfDoc = await loadingTask.promise;
      setPdfInstance(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      setPageOrder(Array.from({ length: pdfDoc.numPages }, (_, i) => i));
    } catch (error: any) {
      console.error("加载PDF失败:", error);
      setError(error?.message || "加载PDF失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || activeTool === "select") return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeTool === "textbox") {
      setTextPosition({ x, y });
      return;
    }

    if (!isDrawing) {
      setIsDrawing(true);
      setDrawStart({ x, y });
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDrawing || !drawStart || activeTool === "select") return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 完成绘制
    const width = Math.abs(x - drawStart.x);
    const height = Math.abs(y - drawStart.y);
    const minX = Math.min(x, drawStart.x);
    const minY = Math.min(y, drawStart.y);

    const newOp: EditOperation = {
      id: Date.now().toString(),
      type: activeTool,
      pageIndex: currentPage - 1,
      data: {},
      timestamp: Date.now(),
    };

    switch (activeTool) {
      case "rectangle":
        newOp.data = {
          x: minX,
          y: minY,
          width: Math.max(width, 10),
          height: Math.max(height, 10),
          color: [0, 0, 255],
          borderColor: [0, 0, 255],
          borderWidth: 2,
          fill: false,
          opacity: 1.0,
        };
        break;
      case "circle":
        const radius = Math.max(Math.sqrt(width * width + height * height) / 2, 10);
        newOp.data = {
          x: drawStart.x,
          y: drawStart.y,
          radius,
          color: [0, 0, 255],
          borderColor: [0, 0, 255],
          borderWidth: 2,
          fill: false,
          opacity: 1.0,
        };
        break;
      case "line":
        newOp.data = {
          x: drawStart.x,
          y: drawStart.y,
          x2: x,
          y2: y,
          borderColor: [0, 0, 255],
          borderWidth: 2,
          opacity: 1.0,
        };
        break;
      case "highlight":
        newOp.data = {
          x: minX,
          y: minY,
          width: Math.max(width, 10),
          height: Math.max(height, 10),
          color: [255, 255, 0],
        };
        break;
      case "underline":
        newOp.data = {
          x: minX,
          y: minY,
          width: Math.max(width, 10),
          color: [255, 0, 0],
        };
        break;
    }

    setOperations([...operations, newOp]);
    setIsDrawing(false);
    setDrawStart(null);
    setActiveTool("select");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pdfFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 等待用户点击位置
    setActiveTool("image");
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureImage(file);
    setActiveTool("signature");
  };

  const handleImagePlace = (x: number, y: number) => {
    if (!imageInputRef.current?.files?.[0] || !pdfFile) return;

    const file = imageInputRef.current.files[0];
    const newOp: EditOperation = {
      id: Date.now().toString(),
      type: "image",
      pageIndex: currentPage - 1,
      data: {
        imageFile: file,
        x: Math.max(0, x - 100), // 居中放置
        y: Math.max(0, y - 100),
        width: 200,
        height: 200,
        opacity: 1.0,
      },
      timestamp: Date.now(),
    };
    setOperations([...operations, newOp]);
    setPreviewImage(null);
    setActiveTool("select");
    // 重新渲染以显示新图像
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale);
    }
  };

  const handleSignaturePlace = (x: number, y: number) => {
    if (!signatureImage || !pdfFile) return;

    const newOp: EditOperation = {
      id: Date.now().toString(),
      type: "signature",
      pageIndex: currentPage - 1,
      data: {
        signatureImage,
        x: Math.max(0, x - 75), // 居中放置
        y: Math.max(0, y - 30),
        width: 150,
        height: 60,
        opacity: 1.0,
      },
      timestamp: Date.now(),
    };
    setOperations([...operations, newOp]);
    setActiveTool("select");
    // 重新渲染
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPosition) return;

    const newOp: EditOperation = {
      id: Date.now().toString(),
      type: "textbox",
      pageIndex: currentPage - 1,
      data: {
        text: textInput,
        x: textPosition.x,
        y: textPosition.y,
        color: [0, 0, 0],
        fontSize: 12,
      },
      timestamp: Date.now(),
    };
    setOperations([...operations, newOp]);
    setTextInput("");
    setTextPosition(null);
    setActiveTool("select");
  };

  const handleSave = async () => {
    if (!pdfFile || operations.length === 0) {
      setError("没有可保存的编辑操作");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const pdfOps: PDFEditOperation[] = operations.map((op) => ({
        type: op.type === "signature" ? "signature" : op.type,
        pageIndex: op.pageIndex,
        data: op.data,
      }));

      const blob = await batchEditPDF(pdfFile, pdfOps);
      downloadBlob(blob, "edited.pdf");
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPage = async () => {
    if (!pdfFile) return;
    setLoading(true);
    try {
      const blob = await addPage(pdfFile, currentPage - 1);
      // 重新加载PDF
      const newFile = new File([blob], pdfFile.name, { type: "application/pdf" });
      setPdfFile(newFile);
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await blob.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      const pdfDoc = await loadingTask.promise;
      setPdfInstance(pdfDoc);
      setTotalPages(pdfDoc.numPages);
    } catch (err: any) {
      setError(err.message || "添加页面失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePage = async () => {
    if (!pdfFile || totalPages <= 1) {
      setError("至少需要保留一页");
      return;
    }
    setLoading(true);
    try {
      const blob = await deletePage(pdfFile, currentPage - 1);
      const newFile = new File([blob], pdfFile.name, { type: "application/pdf" });
      setPdfFile(newFile);
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await blob.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      const pdfDoc = await loadingTask.promise;
      setPdfInstance(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      if (currentPage > pdfDoc.numPages) {
        setCurrentPage(pdfDoc.numPages);
      }
      // 移除当前页面的操作
      setOperations(operations.filter((op) => op.pageIndex !== currentPage - 1));
    } catch (err: any) {
      setError(err.message || "删除页面失败");
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    { id: "select" as ToolType, icon: PenTool, label: "选择", color: "gray" },
    { id: "image" as ToolType, icon: ImageIcon, label: "图像", color: "blue" },
    { id: "rectangle" as ToolType, icon: Square, label: "矩形", color: "blue" },
    { id: "circle" as ToolType, icon: Circle, label: "圆形", color: "blue" },
    { id: "line" as ToolType, icon: Minus, label: "直线", color: "blue" },
    { id: "highlight" as ToolType, icon: Highlighter, label: "高亮", color: "yellow" },
    { id: "underline" as ToolType, icon: Type, label: "下划线", color: "red" },
    { id: "textbox" as ToolType, icon: FileText, label: "文本框", color: "green" },
    { id: "signature" as ToolType, icon: FileSignature, label: "签名", color: "purple" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 顶部工具栏 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
              <Upload className="w-4 h-4" />
              <span>上传PDF</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {pdfFile && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="px-4 py-2 text-sm">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    缩小
                  </button>
                  <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={() => setScale(Math.min(2, scale + 0.1))}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    放大
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleAddPage}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    添加页面
                  </button>
                  <button
                    onClick={handleDeletePage}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 inline mr-1" />
                    删除页面
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || operations.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    保存PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 左侧工具栏 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">编辑工具</h3>
            <div className="space-y-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      if (tool.id === "image") {
                        imageInputRef.current?.click();
                      } else if (tool.id === "signature") {
                        signatureInputRef.current?.click();
                      } else {
                        setActiveTool(tool.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSignatureUpload}
            />
          </div>

          {/* 中间PDF预览区 */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            {loading && !pdfInstance ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : pdfInstance ? (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={(e) => {
                    if (activeTool === "image" && previewImage) {
                      const rect = canvasRef.current!.getBoundingClientRect();
                      const scaleX = canvasRef.current!.width / rect.width;
                      const scaleY = canvasRef.current!.height / rect.height;
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      handleImagePlace(x, y);
                    } else if (activeTool === "signature" && signatureImage) {
                      const rect = canvasRef.current!.getBoundingClientRect();
                      const scaleX = canvasRef.current!.width / rect.width;
                      const scaleY = canvasRef.current!.height / rect.height;
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      handleSignaturePlace(x, y);
                    }
                  }}
                  className="border border-gray-300 dark:border-gray-600 cursor-crosshair max-w-full"
                  style={{ cursor: activeTool === "select" ? "default" : "crosshair" }}
                />
                {previewImage && (
                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-2 rounded shadow-lg">
                    <p className="text-sm mb-2">点击PDF放置图像</p>
                    <img src={previewImage} alt="Preview" className="max-w-xs max-h-48" />
                    <button
                      onClick={() => {
                        setPreviewImage(null);
                        setActiveTool("select");
                      }}
                      className="mt-2 w-full px-2 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                请上传PDF文件开始编辑
              </div>
            )}
          </div>

          {/* 右侧操作历史 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">操作历史</h3>
            <div className="space-y-2 max-h-96 overflow-auto">
              {operations
                .filter((op) => op.pageIndex === currentPage - 1)
                .map((op) => (
                  <div
                    key={op.id}
                    className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm flex items-center justify-between"
                  >
                    <span>{op.type}</span>
                    <button
                      onClick={() => {
                        setOperations(operations.filter((o) => o.id !== op.id));
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {operations.filter((op) => op.pageIndex === currentPage - 1).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">暂无操作</p>
              )}
            </div>
          </div>
        </div>

        {/* 文本输入对话框 */}
        {textPosition && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="font-semibold mb-4">输入文本</h3>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                rows={4}
                placeholder="输入文本内容..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleTextSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  确定
                </button>
                <button
                  onClick={() => {
                    setTextPosition(null);
                    setTextInput("");
                    setActiveTool("select");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

