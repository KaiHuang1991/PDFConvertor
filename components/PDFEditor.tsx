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
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t } = useLanguage();
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
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ opId: string; startX: number; startY: number; opX: number; opY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ opId: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const renderTaskRef = useRef<any>(null);

  // 使用useRef来跟踪是否正在拖拽，避免拖拽时频繁重新渲染PDF
  const isDraggingRef = useRef(false);
  
  useEffect(() => {
    // 如果正在拖拽，不重新渲染PDF（只更新图片位置）
    if (isDraggingRef.current || dragState || resizeState) {
      return;
    }
    
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale);
    }
    
    // 清理函数：组件卸载时取消渲染任务
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfInstance, currentPage, scale, operations, dragState, resizeState]);
  
  // 拖拽结束后重新渲染
  useEffect(() => {
    if (!dragState && !resizeState && pdfInstance && isDraggingRef.current) {
      isDraggingRef.current = false;
      renderPage(currentPage, pdfInstance, scale);
    }
  }, [dragState, resizeState, pdfInstance, currentPage, scale]);

  // 拖拽和调整大小的事件处理
  useEffect(() => {
    if (!dragState && !resizeState) return;

    const handleMouseMove = async (e: MouseEvent) => {
      if (dragState) {
        isDraggingRef.current = true;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !canvasRef.current) return;
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const deltaX = (e.clientX - dragState.startX) * scaleX;
        const deltaY = (e.clientY - dragState.startY) * scaleY;

        // 使用函数式更新，避免依赖operations
        setOperations(prev => {
          const updated = prev.map(op => 
            op.id === dragState.opId
              ? { ...op, data: { ...op.data, x: dragState.opX + deltaX, y: dragState.opY + deltaY } }
              : op
          );
          
          // 实时更新canvas显示
          const canvas = canvasRef.current;
          if (canvas && pdfInstance) {
            const context = canvas.getContext("2d");
            if (context) {
              const op = updated.find(o => o.id === dragState.opId);
              if (op && (op.type === "image" || op.type === "signature")) {
                // 清除旧位置（包括选中框）
                const oldOp = prev.find(o => o.id === dragState.opId);
                if (oldOp) {
                  context.clearRect(
                    Math.min(oldOp.data.x, op.data.x) - 20,
                    Math.min(oldOp.data.y, op.data.y) - 20,
                    Math.max(oldOp.data.width, op.data.width) + 40,
                    Math.max(oldOp.data.height, op.data.height) + 40
                  );
                }
                
                // 重新绘制图片
                drawSingleOperation(context, op).then(() => {
                  // 重新绘制选中框
                  if (selectedOpId === dragState.opId) {
                    drawSelectionBox(context, op);
                  }
                });
              }
            }
          }
          
          return updated;
        });
      } else if (resizeState) {
        isDraggingRef.current = true;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !canvasRef.current) return;
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const deltaX = (e.clientX - resizeState.startX) * scaleX;
        const deltaY = (e.clientY - resizeState.startY) * scaleY;
        
        // 计算新的宽度和高度（基于鼠标移动的距离）
        // 使用deltaX作为主要变化量，保持宽高比
        const aspectRatio = resizeState.startWidth / resizeState.startHeight;
        const newWidth = Math.max(50, Math.min(2000, resizeState.startWidth + deltaX));
        const newHeight = newWidth / aspectRatio;

        // 使用函数式更新，避免依赖operations
        setOperations(prev => {
          const oldOp = prev.find(o => o.id === resizeState.opId);
          if (!oldOp) return prev;
          
          const updated = prev.map(o => 
            o.id === resizeState.opId
              ? { ...o, data: { ...o.data, width: newWidth, height: newHeight } }
              : o
          );
          
          // 实时更新canvas显示
          const canvas = canvasRef.current;
          if (canvas && pdfInstance) {
            const context = canvas.getContext("2d");
            if (context) {
              const op = updated.find(o => o.id === resizeState.opId);
              if (op && (op.type === "image" || op.type === "signature")) {
                // 清除旧位置（包括选中框）
                context.clearRect(
                  op.data.x - 20,
                  op.data.y - 20,
                  Math.max(oldOp.data.width, op.data.width) + 40,
                  Math.max(oldOp.data.height, op.data.height) + 40
                );
                
                // 重新绘制图片
                drawSingleOperation(context, op).then(() => {
                  // 重新绘制选中框
                  if (selectedOpId === resizeState.opId) {
                    drawSelectionBox(context, op);
                  }
                });
              }
            }
          }
          
          return updated;
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
      isDraggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, operations]);

  const loadPdfJs = async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    return pdfjsLib;
  };

  const renderPage = async (pageNumber: number, pdfDoc: any, zoom: number) => {
    if (!canvasRef.current) return;
    
    // 取消之前的渲染任务
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    
    const page = await pdfDoc.getPage(pageNumber);
    
    // 获取页面的原始尺寸（不考虑旋转）
    const originalViewport = page.getViewport({ scale: zoom, rotation: 0 });
    
    // 判断PDF页面本身的尺寸方向（不是内容显示方向，而是页面原始尺寸）
    // 只有当页面本身的宽度 > 高度时，才是真正的横向页面
    // 如果只是内容旋转了，但页面本身是纵向的，不应该旋转canvas
    const isPageLandscape = originalViewport.width > originalViewport.height;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // 如果PDF页面本身是横向的，旋转canvas 90度来匹配页面方向
    // 注意：只有当页面本身的宽度 > 高度时，才旋转canvas
    // 如果只是内容旋转了，但页面本身是纵向的，不应该旋转canvas
    if (isPageLandscape) {
      // 页面本身是横向的：交换宽高，并旋转canvas
      canvas.width = originalViewport.height;  // 使用高度作为宽度
      canvas.height = originalViewport.width;  // 使用宽度作为高度
    } else {
      // 页面本身是纵向的：正常设置
      canvas.width = originalViewport.width;
      canvas.height = originalViewport.height;
    }

    // 清除canvas，设置为透明背景
    context.clearRect(0, 0, canvas.width, canvas.height);

    // 保存渲染任务引用
    context.save();
    
    // 如果PDF页面本身是横向的，需要旋转context来正确显示PDF内容
    if (isPageLandscape) {
      // 旋转90度（顺时针），使canvas方向与内容显示方向一致
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
      // 使用原始尺寸的viewport来渲染（但已经旋转了context）
      const renderViewport = page.getViewport({ scale: zoom, rotation: 0 });
      const renderTask = page.render({
        canvasContext: context,
        viewport: renderViewport,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        context.restore();

        // 绘制已添加的操作（使用旋转后的坐标系）
        await drawOperations(context, pageNumber, originalViewport);
      } catch (err: any) {
        context.restore();
        if (err?.name !== "RenderingCancelledException") {
          console.error("渲染页面失败:", err);
        }
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      }
    } else {
      // 内容是纵向的：正常渲染
      const renderViewport = page.getViewport({ scale: zoom, rotation: 0 });
      const renderTask = page.render({
        canvasContext: context,
        viewport: renderViewport,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        context.restore();

        // 绘制已添加的操作
        await drawOperations(context, pageNumber, originalViewport);
      
        // 绘制选中框
        if (selectedOpId) {
          const op = operations.find(o => o.id === selectedOpId && o.pageIndex === pageNumber - 1);
          if (op && (op.type === "image" || op.type === "signature")) {
            context.save();
            context.strokeStyle = "#3b82f6";
            context.lineWidth = 2;
            context.setLineDash([5, 5]);
            context.strokeRect(op.data.x, op.data.y, op.data.width, op.data.height);
            
            // 绘制调整大小控制点
            context.fillStyle = "#3b82f6";
            context.setLineDash([]);
            context.fillRect(op.data.x + op.data.width - 8, op.data.y + op.data.height - 8, 16, 16);
            context.strokeStyle = "#ffffff";
            context.lineWidth = 2;
            context.strokeRect(op.data.x + op.data.width - 8, op.data.y + op.data.height - 8, 16, 16);
            context.restore();
          }
        }
      } catch (err: any) {
        context.restore();
        // 忽略取消错误
        if (err?.name !== "RenderingCancelledException") {
          console.error("渲染页面失败:", err);
        }
      } finally {
        // 如果这个任务还在引用中，清除它
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      }
    }
  };

  // 绘制单个操作（用于实时更新）
  const drawSingleOperation = async (ctx: CanvasRenderingContext2D, op: EditOperation) => {
    ctx.save();
    switch (op.type) {
      case "image":
        if (op.data.imageData) {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => {
              ctx.globalAlpha = op.data.opacity || 1.0;
              ctx.drawImage(img, op.data.x, op.data.y, op.data.width, op.data.height);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = op.data.imageData;
          });
        }
        break;
      case "signature":
        if (op.data.imageData) {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => {
              ctx.globalAlpha = op.data.opacity || 1.0;
              ctx.drawImage(img, op.data.x, op.data.y, op.data.width, op.data.height);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = op.data.imageData;
          });
        }
        break;
    }
    ctx.restore();
  };

  // 绘制选中框
  const drawSelectionBox = (ctx: CanvasRenderingContext2D, op: EditOperation) => {
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(op.data.x, op.data.y, op.data.width, op.data.height);
    
    // 绘制调整大小控制点
    ctx.fillStyle = "#3b82f6";
    ctx.setLineDash([]);
    ctx.fillRect(op.data.x + op.data.width - 8, op.data.y + op.data.height - 8, 16, 16);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(op.data.x + op.data.width - 8, op.data.y + op.data.height - 8, 16, 16);
    ctx.restore();
  };

  const drawOperations = async (ctx: CanvasRenderingContext2D, pageNum: number, viewport: any) => {
    const pageOps = operations.filter((op) => op.pageIndex === pageNum - 1);
    for (const op of pageOps) {
      ctx.save();
      switch (op.type) {
        case "image":
          if (op.data.imageData) {
            // 如果已经有base64数据，直接绘制
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                ctx.globalAlpha = op.data.opacity || 1.0;
                
                // 应用旋转
                const rotation = op.data.rotation || 0;
                if (rotation !== 0) {
                  // 计算图片中心点
                  const centerX = op.data.x + op.data.width / 2;
                  const centerY = op.data.y + op.data.height / 2;
                  
                  // 移动到中心点，旋转，然后绘制
                  ctx.translate(centerX, centerY);
                  ctx.rotate((rotation * Math.PI) / 180);
                  ctx.drawImage(img, -op.data.width / 2, -op.data.height / 2, op.data.width, op.data.height);
                  ctx.rotate(-(rotation * Math.PI) / 180);
                  ctx.translate(-centerX, -centerY);
                } else {
                  ctx.drawImage(img, op.data.x, op.data.y, op.data.width, op.data.height);
                }
                resolve();
              };
              img.onerror = () => resolve();
              img.src = op.data.imageData;
            });
          } else if (op.data.imageFile) {
            // 如果是File对象，转换为base64
            const reader = new FileReader();
            await new Promise<void>((resolve) => {
              reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                  ctx.globalAlpha = op.data.opacity || 1.0;
                  
                  // 应用旋转
                  const rotation = op.data.rotation || 0;
                  if (rotation !== 0) {
                    // 计算图片中心点
                    const centerX = op.data.x + op.data.width / 2;
                    const centerY = op.data.y + op.data.height / 2;
                    
                    // 移动到中心点，旋转，然后绘制
                    ctx.translate(centerX, centerY);
                    ctx.rotate((rotation * Math.PI) / 180);
                    ctx.drawImage(img, -op.data.width / 2, -op.data.height / 2, op.data.width, op.data.height);
                    ctx.rotate(-(rotation * Math.PI) / 180);
                    ctx.translate(-centerX, -centerY);
                  } else {
                    ctx.drawImage(img, op.data.x, op.data.y, op.data.width, op.data.height);
                  }
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = e.target?.result as string;
                // 保存base64到data中，避免重复读取
                op.data.imageData = e.target?.result as string;
              };
              reader.onerror = () => resolve();
              reader.readAsDataURL(op.data.imageFile);
            });
          }
          break;
        case "signature":
          if (op.data.signatureImage) {
            const reader = new FileReader();
            await new Promise<void>((resolve) => {
              reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                  ctx.globalAlpha = op.data.opacity || 1.0;
                  ctx.drawImage(img, op.data.x, op.data.y, op.data.width, op.data.height);
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = e.target?.result as string;
                op.data.imageData = e.target?.result as string;
              };
              reader.onerror = () => resolve();
              if (op.data.signatureImage instanceof File) {
                reader.readAsDataURL(op.data.signatureImage);
              } else {
                resolve();
              }
            });
          }
          break;
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
    }
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
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeTool === "select") {
      // 先检查是否点击了调整大小控制点（只检查已选中的图片）
      if (selectedOpId) {
        const selectedOp = operations.find(op => op.id === selectedOpId && op.pageIndex === currentPage - 1);
        if (selectedOp && (selectedOp.type === "image" || selectedOp.type === "signature")) {
          const resizeHandleX = selectedOp.data.x + selectedOp.data.width;
          const resizeHandleY = selectedOp.data.y + selectedOp.data.height;
          const handleSize = 16; // 控制点大小的一半
          
          // 检查是否点击了调整大小控制点（右下角）
          if (x >= resizeHandleX - handleSize && x <= resizeHandleX + handleSize &&
              y >= resizeHandleY - handleSize && y <= resizeHandleY + handleSize) {
            e.preventDefault();
            e.stopPropagation();
            setResizeState({
              opId: selectedOpId,
              startX: e.clientX,
              startY: e.clientY,
              startWidth: selectedOp.data.width,
              startHeight: selectedOp.data.height,
            });
            return;
          }
        }
      }
      
      // 检查是否点击了图片，准备拖拽
      const pageOps = operations.filter((op) => op.pageIndex === currentPage - 1 && (op.type === "image" || op.type === "signature"));
      const clickedOp = pageOps.find((op) => {
        return x >= op.data.x && x <= op.data.x + op.data.width &&
               y >= op.data.y && y <= op.data.y + op.data.height;
      });
      
      if (clickedOp) {
        setSelectedOpId(clickedOp.id);
        setDragState({
          opId: clickedOp.id,
          startX: e.clientX,
          startY: e.clientY,
          opX: clickedOp.data.x,
          opY: clickedOp.data.y,
        });
        return;
      } else {
        setSelectedOpId(null);
      }
    }

    if (activeTool === "textbox") {
      setTextPosition({ x, y });
      return;
    }

    if (activeTool !== "select" && !isDrawing) {
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
    if (!file || !pdfFile || !canvasRef.current) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      
      // 直接添加到PDF上，默认位置在左上角
      const canvas = canvasRef.current!;
      const defaultX = 50;
      const defaultY = 50;
      const defaultWidth = 200;
      const defaultHeight = 200;
      
      const newOp: EditOperation = {
        id: Date.now().toString(),
        type: "image",
        pageIndex: currentPage - 1,
        data: {
          imageFile: file,
          imageData: imageData,
          x: defaultX,
          y: defaultY,
          width: defaultWidth,
          height: defaultHeight,
          opacity: 1.0,
          rotation: 0, // 旋转角度（度）
        },
        timestamp: Date.now(),
      };
      
      setOperations([...operations, newOp]);
      setSelectedOpId(newOp.id); // 自动选中新添加的图片
      setActiveTool("select"); // 切换到选择工具，可以直接拖拽
      
      // 重新渲染以显示新图像
      if (pdfInstance) {
        await renderPage(currentPage, pdfInstance, scale);
      }
    };
    reader.readAsDataURL(file);
    
    // 重置input，允许重复选择同一文件
    e.target.value = "";
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureImage(file);
    setActiveTool("signature");
  };

  const handleImagePlace = async (x: number, y: number) => {
    if (!imageInputRef.current?.files?.[0] || !pdfFile) return;

    const file = imageInputRef.current.files[0];
    
    // 将文件转换为base64
    const reader = new FileReader();
    const imageData = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const newOp: EditOperation = {
      id: Date.now().toString(),
      type: "image",
      pageIndex: currentPage - 1,
      data: {
        imageFile: file,
        imageData: imageData, // 保存base64数据
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
      await renderPage(currentPage, pdfInstance, scale);
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
      setError(t.editor.noEditsToSave);
      return;
    }

    setLoading(true);
    setError("");
    try {
      // 现在canvas会根据PDF内容的显示方向旋转，所以坐标系统与pdf-lib一致
      // 只需要考虑缩放比例
      const scaleRatios = new Map<number, number>();
      const pageIsContentLandscape = new Map<number, boolean>();
      const pageOriginalSizes = new Map<number, { width: number; height: number }>();
      
      // 获取每个页面的原始尺寸和缩放比例
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const page = await pdfInstance.getPage(pageIndex + 1);
        // 获取原始尺寸的viewport（rotation: 0）
        const originalViewport = page.getViewport({ scale: 1.0, rotation: 0 });
        const currentViewport = page.getViewport({ scale: scale, rotation: 0 });
        
        // 保存原始页面尺寸，用于坐标转换
        pageOriginalSizes.set(pageIndex, {
          width: originalViewport.width,
          height: originalViewport.height
        });
        
        // 判断页面本身是否是横向的（基于原始尺寸，不是内容显示方向）
        const isPageLandscape = originalViewport.width > originalViewport.height;
        pageIsContentLandscape.set(pageIndex, isPageLandscape);
        
        // 如果页面本身是横向的，canvas会旋转，所以需要调整缩放比例的计算
        // 横向时，canvas的宽高是交换的
        const scaleRatio = isPageLandscape 
          ? originalViewport.height / currentViewport.height  // 横向时，用高度计算
          : originalViewport.width / currentViewport.width;   // 纵向时，用宽度计算
        scaleRatios.set(pageIndex, scaleRatio);
        
        console.log(`页面 ${pageIndex + 1} 坐标转换比例:`, {
          scale: scale,
          scaleRatio: scaleRatio,
          originalWidth: originalViewport.width,
          originalHeight: originalViewport.height,
          currentWidth: currentViewport.width,
          currentHeight: currentViewport.height,
          isPageLandscape: isPageLandscape,
          note: isPageLandscape 
            ? "页面本身是横向：canvas已旋转90度，坐标系统与pdf-lib一致"
            : "页面本身是纵向：canvas正常显示，坐标系统与pdf-lib一致"
        });
      }
      
      const pdfOps: PDFEditOperation[] = operations
        .map((op) => {
          // 映射操作类型
          let mappedType: "image" | "shape" | "annotation" | "signature" | "form";
          if (op.type === "image") {
            mappedType = "image";
          } else if (op.type === "signature") {
            mappedType = "signature";
          } else if (op.type === "rectangle" || op.type === "circle" || op.type === "line") {
            mappedType = "shape";
            // 为shape类型添加type字段
            op.data.type = op.type;
          } else if (op.type === "highlight" || op.type === "underline" || op.type === "textbox") {
            mappedType = "annotation";
            // 为annotation类型添加type字段
            op.data.type = op.type;
          } else {
            mappedType = "annotation"; // 默认
          }
          
        // 对于图片和签名，确保传递正确的数据
        let data = { ...op.data };
        if (op.type === "image" || op.type === "signature") {
          // 确保imageData存在
          if (!data.imageData) {
            console.error(`操作 ${op.id} 缺少 imageData:`, data);
            // 如果只有imageFile，尝试转换（但这在客户端可能无法完成）
            if (data.imageFile) {
              console.warn("图片数据只有imageFile，无法在保存时转换，请确保imageData存在");
            }
            // 如果既没有imageData也没有imageFile，跳过这个操作
            if (!data.imageFile) {
              console.error(`操作 ${op.id} 既没有imageData也没有imageFile，将跳过`);
              return null; // 标记为跳过
            }
          } else {
            console.log(`操作 ${op.id} 有 imageData，长度:`, data.imageData.length, "前100字符:", data.imageData.substring(0, 100));
          }
          
          // 坐标转换：canvas会根据PDF内容的显示方向旋转，所以坐标系统与pdf-lib一致
          // 获取对应页面的scaleRatio和方向信息
          const scaleRatio = scaleRatios.get(op.pageIndex) || 1.0;
          const isContentLandscape = pageIsContentLandscape.get(op.pageIndex) || false;
          
          // 如果PDF内容是横向显示的，canvas已经旋转了90度
          // 需要将canvas坐标转换回PDF原始坐标系统
          let pdfX = data.x * scaleRatio;
          let pdfY = data.y * scaleRatio;
          let pdfWidth = data.width * scaleRatio;
          let pdfHeight = data.height * scaleRatio;
          
          if (isContentLandscape) {
            // 内容横向显示：canvas旋转了90度，需要转换坐标
            // 
            // 当canvas旋转90度后：
            // - canvas.width = originalViewport.height（PDF的原始高度）
            // - canvas.height = originalViewport.width（PDF的原始宽度）
            // 
            // canvas坐标系（旋转后）：
            // - x轴：向下（在canvas上）
            // - y轴：向右（在canvas上）
            // 
            // PDF原始坐标系：
            // - x轴：向右
            // - y轴：向上（从下到上）
            // 
            // 转换公式：
            // - PDF的x = canvas的y（都是向右）
            // - PDF的y = canvas的宽度 - canvas的x - 图片宽度（需要翻转）
            // 
            // 使用预先获取的原始页面尺寸来计算翻转
            const pageSize = pageOriginalSizes.get(op.pageIndex);
            if (pageSize) {
              // 保存转换前的坐标用于调试
              const beforeX = pdfX;
              const beforeY = pdfY;
              
              // canvas旋转90度后：
              // - canvas.width = PDF的原始高度（pageSize.height）
              // - canvas.height = PDF的原始宽度（pageSize.width）
              // 
              // 用户在canvas上点击的坐标(x, y)是在旋转后的canvas坐标系中的
              // 转换到PDF坐标系：
              // - PDF的x = canvas的y（都是向右）
              // - PDF的y = canvas的宽度 - canvas的x - 图片宽度（需要翻转）
              // 
              // 注意：pdfX和pdfY已经是缩放后的值（scale=1.0时的PDF坐标）
              // 所以翻转时应该使用PDF的原始高度（即canvas旋转后的宽度）
              const canvasRotatedWidth = pageSize.height; // canvas旋转后，width = PDF的height
              
              const tempX = pdfX;
              const tempY = pdfY;
              
              // 坐标转换：canvas旋转90度后，x和y轴交换了
              // 但是，图片的宽高不需要交换，因为：
              // 1. 当canvas旋转90度后，context也旋转了，所以图片在canvas上显示是正确的
              // 2. 保存到PDF时，PDF页面本身没有旋转，所以图片应该保持原样
              // 3. 只需要转换坐标，不需要交换宽高
              pdfX = tempY; // canvas的y -> PDF的x
              // canvas的x -> PDF的y（翻转）：使用canvas旋转后的宽度（即PDF的原始高度）来翻转
              pdfY = canvasRotatedWidth - tempX - pdfWidth;
              
              // 注意：不交换宽高，保持图片方向
              
              console.log(`横向PDF坐标转换 (页面 ${op.pageIndex + 1}):`, {
                转换前: { x: beforeX, y: beforeY, width: pdfWidth, height: pdfHeight },
                转换后: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
                canvas旋转后宽度: canvasRotatedWidth,
                PDF原始尺寸: { width: pageSize.width, height: pageSize.height },
                说明: "canvas旋转90度，坐标已转换回PDF原始坐标系，宽高保持不变"
              });
            }
          }
          
          // 转换坐标到PDF原始尺寸（scale=1.0）
          // canvas坐标系是从上到下，PDF坐标系是从下到上，这个转换在pdf-utils中处理
          data.x = pdfX;
          data.y = pdfY;
          data.width = pdfWidth;
          data.height = pdfHeight;
          
          console.log(`操作 ${op.id} (页面 ${op.pageIndex + 1}) 坐标转换:`, {
            canvasX: data.x / scaleRatio,
            canvasY: data.y / scaleRatio,
            canvasWidth: data.width / scaleRatio,
            canvasHeight: data.height / scaleRatio,
            pdfX: data.x,
            pdfY: data.y, // canvas坐标系（从上到下），将在pdf-utils中转换为PDF坐标系
            pdfWidth: data.width,
            pdfHeight: data.height,
            scaleRatio: scaleRatio,
            isContentLandscape: isContentLandscape,
            note: isContentLandscape 
              ? "内容横向显示：canvas已旋转90度，坐标已转换回PDF原始坐标系"
              : "内容纵向显示：canvas正常显示，坐标系统与pdf-lib一致"
          });
          
          // 移除imageFile，只保留imageData（因为File对象无法序列化）
          if (data.imageFile) {
            delete data.imageFile;
          }
        } else if (op.type === "highlight" || op.type === "underline" || op.type === "textbox" || op.type === "rectangle" || op.type === "circle" || op.type === "line") {
          // 对于注释和形状，也需要进行坐标转换
          // 获取对应页面的scaleRatio和方向信息
          const scaleRatio = scaleRatios.get(op.pageIndex) || 1.0;
          const isContentLandscape = pageIsContentLandscape.get(op.pageIndex) || false;
          
          // 如果PDF内容是横向显示的，canvas已经旋转了90度
          // 需要将canvas坐标转换回PDF原始坐标系统
          let pdfX = data.x * scaleRatio;
          let pdfY = data.y * scaleRatio;
          let pdfWidth = (data.width || 0) * scaleRatio;
          let pdfHeight = (data.height || 0) * scaleRatio;
          
          if (isContentLandscape) {
            // 内容横向显示：canvas旋转了90度，需要转换坐标
            const pageSize = pageOriginalSizes.get(op.pageIndex);
            if (pageSize) {
              const beforeX = pdfX;
              const beforeY = pdfY;
              
              const canvasRotatedWidth = pageSize.height; // canvas旋转后，width = PDF的height
              
              const tempX = pdfX;
              const tempY = pdfY;
              
              // 坐标转换：canvas旋转90度后，x和y轴交换了
              pdfX = tempY; // canvas的y -> PDF的x
              // canvas的x -> PDF的y（翻转）：使用canvas旋转后的宽度（即PDF的原始高度）来翻转
              pdfY = canvasRotatedWidth - tempX - pdfWidth;
              
              // 对于形状和注释，宽高也需要交换（因为它们在PDF中应该保持与canvas上显示相同的方向）
              // 但是，高亮、下划线等注释的宽高实际上不需要交换，因为它们只是矩形区域
              // 只有坐标需要转换
              
              console.log(`横向PDF注释/形状坐标转换 (页面 ${op.pageIndex + 1}):`, {
                类型: op.type,
                转换前: { x: beforeX, y: beforeY, width: pdfWidth, height: pdfHeight },
                转换后: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
                canvas旋转后宽度: canvasRotatedWidth,
                PDF原始尺寸: { width: pageSize.width, height: pageSize.height },
                说明: "canvas旋转90度，坐标已转换回PDF原始坐标系"
              });
            }
          }
          
          // 转换坐标到PDF原始尺寸（scale=1.0）
          data.x = pdfX;
          data.y = pdfY;
          if (data.width !== undefined) data.width = pdfWidth;
          if (data.height !== undefined) data.height = pdfHeight;
          
          // 对于line类型，还需要转换x2和y2
          if (op.type === "line" && data.x2 !== undefined && data.y2 !== undefined) {
            let pdfX2 = data.x2 * scaleRatio;
            let pdfY2 = data.y2 * scaleRatio;
            
            if (isContentLandscape) {
              const pageSize = pageOriginalSizes.get(op.pageIndex);
              if (pageSize) {
                const canvasRotatedWidth = pageSize.height;
                const tempX2 = pdfX2;
                const tempY2 = pdfY2;
                pdfX2 = tempY2;
                pdfY2 = canvasRotatedWidth - tempX2;
              }
            }
            
            data.x2 = pdfX2;
            data.y2 = pdfY2;
          }
        }
          
          return {
            type: mappedType,
            pageIndex: op.pageIndex,
            data: data,
          } as PDFEditOperation;
        })
        .filter((op): op is PDFEditOperation => op !== null); // 过滤掉null值

      console.log("准备保存PDF，操作数量:", pdfOps.length);
      console.log("操作详情:", pdfOps.map(op => ({
        type: op.type,
        pageIndex: op.pageIndex,
        hasImageData: !!(op.data.imageData),
        hasImageFile: !!(op.data.imageFile),
        x: op.data.x,
        y: op.data.y,
        width: op.data.width,
        height: op.data.height
      })));
      
      const blob = await batchEditPDF(pdfFile, pdfOps);
      console.log("PDF保存成功，大小:", blob.size);
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
      setError(t.editor.atLeastOnePage);
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
    { id: "select" as ToolType, icon: PenTool, label: t.editor.select, color: "gray" },
    { id: "image" as ToolType, icon: ImageIcon, label: t.editor.image, color: "blue" },
    { id: "rectangle" as ToolType, icon: Square, label: t.editor.rectangle, color: "blue" },
    { id: "circle" as ToolType, icon: Circle, label: t.editor.circle, color: "blue" },
    { id: "line" as ToolType, icon: Minus, label: t.editor.line, color: "blue" },
    { id: "highlight" as ToolType, icon: Highlighter, label: t.editor.highlight, color: "yellow" },
    { id: "underline" as ToolType, icon: Type, label: t.editor.underline, color: "red" },
    { id: "textbox" as ToolType, icon: FileText, label: t.editor.textBox, color: "green" },
    { id: "signature" as ToolType, icon: FileSignature, label: t.editor.signature, color: "purple" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 顶部工具栏 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
              <Upload className="w-4 h-4" />
              <span>{t.editor.uploadPDF}</span>
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
                    {t.editor.previousPage}
                  </button>
                  <span className="px-4 py-2 text-sm">
                    {t.editor.pageOf.replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    {t.editor.nextPage}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    {t.editor.zoomOut}
                  </button>
                  <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={() => setScale(Math.min(2, scale + 0.1))}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    {t.editor.zoomIn}
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleAddPage}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    {t.editor.addPage}
                  </button>
                  <button
                    onClick={handleDeletePage}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 inline mr-1" />
                    {t.editor.deletePage}
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
                    {t.editor.savePDF}
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
            <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">{t.editor.editingTools}</h3>
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
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4 overflow-auto">
            {loading && !pdfInstance ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : pdfInstance ? (
              <div className="relative flex justify-center items-start min-h-full">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={(e) => {
                    if (activeTool === "signature" && signatureImage) {
                      const rect = canvasRef.current!.getBoundingClientRect();
                      const scaleX = canvasRef.current!.width / rect.width;
                      const scaleY = canvasRef.current!.height / rect.height;
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      handleSignaturePlace(x, y);
                    } else if (activeTool === "select") {
                      // 检查是否点击了图片
                      const rect = canvasRef.current!.getBoundingClientRect();
                      const scaleX = canvasRef.current!.width / rect.width;
                      const scaleY = canvasRef.current!.height / rect.height;
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      
                      // 查找点击的图片
                      const pageOps = operations.filter((op) => op.pageIndex === currentPage - 1 && (op.type === "image" || op.type === "signature"));
                      const clickedOp = pageOps.find((op) => {
                        return x >= op.data.x && x <= op.data.x + op.data.width &&
                               y >= op.data.y && y <= op.data.y + op.data.height;
                      });
                      
                      if (clickedOp) {
                        setSelectedOpId(clickedOp.id);
                      } else {
                        setSelectedOpId(null);
                      }
                    }
                  }}
                  className="border border-gray-300 dark:border-gray-600 cursor-crosshair"
                  style={{
                    backgroundColor: "transparent", 
                    cursor: activeTool === "select" ? "default" : "crosshair",
                    display: "block" // 确保canvas作为块级元素显示
                  }}
                />
                {previewImage && (
                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-2 rounded shadow-lg">
                    <p className="text-sm mb-2">{t.editor.clickToPlaceImage}</p>
                    <img src={previewImage} alt="Preview" className="max-w-xs max-h-48" />
                    <button
                      onClick={() => {
                        setPreviewImage(null);
                        setActiveTool("select");
                      }}
                      className="mt-2 w-full px-2 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      {t.editor.cancel}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                {t.editor.uploadPDFFile}
              </div>
            )}
          </div>

          {/* 右侧操作历史和属性面板 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">{t.editor.operationHistory}</h3>
            <div className="space-y-2 max-h-96 overflow-auto mb-4">
              {operations
                .filter((op) => op.pageIndex === currentPage - 1)
                .map((op) => (
                  <div
                    key={op.id}
                    className={`p-2 rounded text-sm flex items-center justify-between cursor-pointer ${
                      selectedOpId === op.id
                        ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                    onClick={() => setSelectedOpId(op.id)}
                  >
                    <span>{op.type}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOperations(operations.filter((o) => o.id !== op.id));
                        if (selectedOpId === op.id) {
                          setSelectedOpId(null);
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {operations.filter((op) => op.pageIndex === currentPage - 1).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">{t.editor.noOperations}</p>
              )}
            </div>
            
            {/* 选中图片的属性面板 */}
            {selectedOpId && (() => {
              const selectedOp = operations.find((op) => op.id === selectedOpId);
              if (selectedOp && (selectedOp.type === "image" || selectedOp.type === "signature")) {
                return (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <h4 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">{t.editor.imageProperties}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t.editor.rotationAngle}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="360"
                            step="1"
                            value={selectedOp.data.rotation || 0}
                            onChange={(e) => {
                              const rotation = parseInt(e.target.value) || 0;
                              setOperations(
                                operations.map((op) =>
                                  op.id === selectedOpId
                                    ? { ...op, data: { ...op.data, rotation } }
                                    : op
                                )
                              );
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <button
                            onClick={() => {
                              const currentRotation = selectedOp.data.rotation || 0;
                              const newRotation = (currentRotation + 90) % 360;
                              setOperations(
                                operations.map((op) =>
                                  op.id === selectedOpId
                                    ? { ...op, data: { ...op.data, rotation: newRotation } }
                                    : op
                                )
                              );
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            title={t.editor.degrees}
                          >
                            90°
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t.editor.imageRotationNote}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t.editor.opacity}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedOp.data.opacity || 1.0}
                          onChange={(e) => {
                            const opacity = parseFloat(e.target.value);
                            setOperations(
                              operations.map((op) =>
                                op.id === selectedOpId
                                  ? { ...op, data: { ...op.data, opacity } }
                                  : op
                              )
                            );
                          }}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {Math.round((selectedOp.data.opacity || 1.0) * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* 文本输入对话框 */}
        {textPosition && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="font-semibold mb-4">{t.editor.inputText}</h3>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                rows={4}
                placeholder={t.editor.enterTextContent}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleTextSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t.editor.confirm}
                </button>
                <button
                  onClick={() => {
                    setTextPosition(null);
                    setTextInput("");
                    setActiveTool("select");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400"
                >
                  {t.editor.cancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

