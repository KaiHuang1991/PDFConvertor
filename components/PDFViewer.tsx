"use client";

import { useState, useRef, useEffect } from "react";
import { Search, RotateCw, ZoomIn, ZoomOut, Loader2, Maximize, ChevronLeft, ChevronRight, Upload, Image, Type, MousePointer, X } from "lucide-react";

interface TextMatch {
  page: number;
  preview: string;
  matchIndex?: number;
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacedImage {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: string; // base64
  isDragging?: boolean;
  isResizing?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLibPromise: Promise<any> | null = null;

const loadPdfJs = async () => {
  if (!pdfjsLibPromise) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pdfjsLibPromise = import("pdfjs-dist/build/pdf");
  }
  const pdfjsLib = await pdfjsLibPromise;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjsLib;
};

const buttonClass =
  "px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-40 disabled:cursor-not-allowed";

export default function PDFViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdfInstance, setPdfInstance] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TextMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string>("");
  const [highlights, setHighlights] = useState<Map<number, HighlightRect[]>>(new Map());
  const highlightLayerRef = useRef<HTMLCanvasElement | null>(null);
  
  // 编辑功能相关状态
  const [editMode, setEditMode] = useState<"select" | "image" | "text">("select");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [imageLayerRef] = useState<HTMLCanvasElement | null>(null);
  const imageLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; imageId: string } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; imageId: string; startWidth: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale, rotation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfInstance, scale, rotation, currentPage, highlights, placedImages]);

  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

  // 同步图片层和高亮层的尺寸
  useEffect(() => {
    if (canvasRef.current && imageLayerCanvasRef.current && highlightLayerRef.current) {
      const mainCanvas = canvasRef.current;
      const imageLayer = imageLayerCanvasRef.current;
      const highlightLayer = highlightLayerRef.current;
      
      // 同步尺寸
      imageLayer.style.width = `${mainCanvas.width}px`;
      imageLayer.style.height = `${mainCanvas.height}px`;
      highlightLayer.style.width = `${mainCanvas.width}px`;
      highlightLayer.style.height = `${mainCanvas.height}px`;
    }
  }, [rendering, scale, rotation, currentPage]);

  const renderPage = async (pageNumber: number, pdfDoc: any, zoom = scale, rotate = rotation) => {
    if (!canvasRef.current) return;
    setRendering(true);
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: zoom, rotation: rotate });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      setRendering(false);
      return;
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });
    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
      // 渲染完成后绘制高亮
      await drawHighlights(pageNumber, page, viewport);
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        throw err;
      }
      return;
    } finally {
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
      setRendering(false);
    }
  };

  const drawHighlights = async (pageNumber: number, page: any, viewport: any) => {
    if (!highlightLayerRef.current || !searchQuery.trim()) {
      return;
    }

    const highlightLayer = highlightLayerRef.current;
    const ctx = highlightLayer.getContext("2d");
    if (!ctx) return;

    // 设置高亮层尺寸与PDF canvas一致
    highlightLayer.width = viewport.width;
    highlightLayer.height = viewport.height;

    // 清除之前的高亮
    ctx.clearRect(0, 0, highlightLayer.width, highlightLayer.height);

    const pageHighlights = highlights.get(pageNumber);
    if (!pageHighlights || pageHighlights.length === 0) {
      return;
    }

    // 绘制高亮矩形
    ctx.fillStyle = "rgba(255, 255, 0, 0.4)"; // 半透明黄色
    ctx.strokeStyle = "rgba(255, 200, 0, 0.8)";
    ctx.lineWidth = 1.5;

    for (const rect of pageHighlights) {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  };

  const deleteImage = (imageId: string) => {
    setPlacedImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setPendingImage(result);
        setEditMode("image");
      }
    };
    reader.readAsDataURL(file);
    // 重置input，允许重复选择同一文件
    e.target.value = "";
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // 如果点击的是图片元素或控制按钮，不处理
    const target = e.target as HTMLElement;
    if (target.closest('.pdf-image-element') || target.closest('button')) {
      return;
    }

    // 检查是否在图片放置模式
    if (!canvasRef.current || !pdfInstance || editMode !== "image" || !pendingImage) {
      console.log("点击条件检查:", {
        hasCanvas: !!canvasRef.current,
        hasPdf: !!pdfInstance,
        editMode,
        hasPendingImage: !!pendingImage
      });
      return;
    }

    const canvas = canvasRef.current;
    const container = e.currentTarget; // 使用事件绑定的容器
    const containerRect = container.getBoundingClientRect();
    
    // 计算相对于容器的坐标（考虑滚动和偏移）
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    
    console.log("点击位置:", { 
      clientX: e.clientX, 
      clientY: e.clientY,
      containerRect,
      x, 
      y,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });
    
    // 创建新图片对象（坐标相对于容器）
    const newImage: PlacedImage = {
      id: Date.now().toString(),
      page: currentPage,
      x: x - 75, // 默认宽度150，居中
      y: y - 75, // 默认高度150，居中
      width: 150,
      height: 150,
      imageData: pendingImage,
    };

    console.log("创建图片:", newImage);
    setPlacedImages(prev => {
      const updated = [...prev, newImage];
      console.log("更新图片列表，总数:", updated.length);
      return updated;
    });
    setPendingImage(null);
    setEditMode("select");
    setSelectedImageId(newImage.id);
  };

  const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedImageId(imageId);
    setEditMode("select");
    
    const image = placedImages.find(img => img.id === imageId);
    if (!image) return;

    // 获取图片元素的当前位置
    const imageElement = e.currentTarget as HTMLElement;
    const container = imageElement.offsetParent as HTMLElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    
    // 计算图片相对于容器的位置
    const imageX = imageRect.left - containerRect.left;
    const imageY = imageRect.top - containerRect.top;

    const startX = e.clientX;
    const startY = e.clientY;
    setDragStart({ x: startX, y: startY, imageId });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    const image = placedImages.find(img => img.id === imageId);
    if (!image) return;

    const startX = e.clientX;
    const startY = e.clientY;
    setResizeStart({ x: startX, y: startY, imageId, startWidth: image.width, startHeight: image.height });
  };

  useEffect(() => {
    if (!dragStart && !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragStart) {
        const image = placedImages.find(img => img.id === dragStart.imageId);
        if (!image) return;

        // 计算鼠标移动的距离
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setPlacedImages(prev => prev.map(img => 
          img.id === dragStart.imageId
            ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
            : img
        ));

        setDragStart({ x: e.clientX, y: e.clientY, imageId: dragStart.imageId });
      } else if (resizeStart) {
        const image = placedImages.find(img => img.id === resizeStart.imageId);
        if (!image) return;

        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const aspectRatio = resizeStart.startWidth / resizeStart.startHeight;

        // 保持宽高比调整大小
        const newWidth = Math.max(50, resizeStart.startWidth + deltaX);
        const newHeight = newWidth / aspectRatio;

        setPlacedImages(prev => prev.map(img => 
          img.id === resizeStart.imageId
            ? { ...img, width: newWidth, height: newHeight }
            : img
        ));

        setResizeStart({ 
          x: e.clientX, 
          y: e.clientY, 
          imageId: resizeStart.imageId, 
          startWidth: newWidth, 
          startHeight: newHeight 
        });
      }
    };

    const handleMouseUp = () => {
      setDragStart(null);
      setResizeStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, resizeStart, placedImages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setLoading(true);
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      const pdfDoc = await loadingTask.promise;
      setPdfInstance(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      setScale(1.2);
      setRotation(0);
      setSearchResults([]);
      setHighlights(new Map());
      setSearchQuery("");
      setPlacedImages([]);
      setPendingImage(null);
      setEditMode("select");
    } catch (error: any) {
      console.error("加载PDF失败:", error);
      setError(error?.message || "加载PDF失败，请确认文件是否损坏");
      setPdfInstance(null);
      setTotalPages(0);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  };

  const changePage = async (offset: number) => {
    if (!pdfInstance) return;
    const newPage = currentPage + offset;
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    await renderPage(newPage, pdfInstance);
  };

  const handleZoom = (direction: "in" | "out") => {
    const step = 0.2;
    setScale((prev) => {
      const next = direction === "in" ? prev + step : prev - step;
      return Math.min(Math.max(next, 0.6), 3);
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFullScreen = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  const handleSearch = async () => {
    if (!pdfInstance || !searchQuery.trim()) {
      setSearchResults([]);
      setHighlights(new Map());
      return;
    }
    
    setSearching(true);
    setError("");
    
    try {
      const query = searchQuery.trim();
      const queryLower = query.toLowerCase();
      const results: TextMatch[] = [];
      const newHighlights = new Map<number, HighlightRect[]>();

      for (let i = 1; i <= pdfInstance.numPages; i++) {
        const page = await pdfInstance.getPage(i);
        const textContent = await page.getTextContent();
        
        // 构建页面文本
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        const lowerPageText = pageText.toLowerCase();
        
        // 查找所有匹配项
        let searchIndex = 0;
        let matchIndex = 0;
        const pageRects: HighlightRect[] = [];
        
        while ((searchIndex = lowerPageText.indexOf(queryLower, searchIndex)) !== -1) {
          // 找到包含匹配文本的文本项
          let charPos = 0;
          const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [];
          
          for (let j = 0; j < textContent.items.length; j++) {
            const item = textContent.items[j];
            const itemText = item.str;
            const itemStart = charPos;
            const itemEnd = charPos + itemText.length;
            
            // 检查这个文本项是否包含匹配文本的一部分
            if (searchIndex < itemEnd && searchIndex + query.length > itemStart) {
              const startChar = Math.max(0, searchIndex - itemStart);
              const endChar = Math.min(itemText.length, searchIndex + query.length - itemStart);
              matchingItems.push({ item, startChar, endChar });
            }
            
            charPos = itemEnd;
            if (j < textContent.items.length - 1) {
              charPos += 1; // 空格
            }
            
            // 如果已经找到所有匹配的项，停止
            if (searchIndex + query.length <= itemEnd) {
              break;
            }
          }
          
          // 计算高亮矩形
          if (matchingItems.length > 0) {
            const firstItem = matchingItems[0];
            const lastItem = matchingItems[matchingItems.length - 1];
            const firstTransform = firstItem.item.transform;
            const lastTransform = lastItem.item.transform;
            
            // 计算字体大小和字符宽度
            const fontSize = Math.abs(firstTransform[0]) || Math.abs(firstTransform[2]) || 12;
            const charWidth = fontSize * 0.6;
            
            // 计算起始位置（transform[4]是x，transform[5]是y）
            let x = firstTransform[4];
            // PDF坐标系y轴向下，需要转换
            const viewport = page.getViewport({ scale: 1.0 });
            let y = viewport.height - firstTransform[5] - fontSize;
            
            // 计算宽度
            let width = 0;
            if (matchingItems.length === 1) {
              // 单个文本项
              width = (lastItem.endChar - firstItem.startChar) * charWidth;
            } else {
              // 多个文本项
              // 第一个项的剩余部分
              width = (firstItem.item.str.length - firstItem.startChar) * charWidth;
              // 中间项
              for (let k = 1; k < matchingItems.length - 1; k++) {
                width += matchingItems[k].item.str.length * charWidth;
              }
              // 最后一项
              width += lastItem.endChar * charWidth;
            }
            
            const height = fontSize * 1.3;
            
            // 转换到当前视口
            const currentViewport = page.getViewport({ scale: scale, rotation: rotation });
            const scaleX = currentViewport.width / viewport.width;
            const scaleY = currentViewport.height / viewport.height;
            
            pageRects.push({
              x: x * scaleX,
              y: y * scaleY,
              width: Math.max(width * scaleX, 10), // 最小宽度
              height: height * scaleY,
            });
            
            const preview = pageText.substring(
              Math.max(0, searchIndex - 20), 
              Math.min(pageText.length, searchIndex + query.length + 20)
            );
            results.push({ page: i, preview, matchIndex: matchIndex++ });
          }
          
          searchIndex += query.length;
        }
        
        if (pageRects.length > 0) {
          newHighlights.set(i, pageRects);
        }
      }
      
      setSearchResults(results);
      setHighlights(newHighlights);
      
      if (results.length > 0) {
        setCurrentPage(results[0].page);
        await renderPage(results[0].page, pdfInstance, scale, rotation);
      }
    } catch (error: any) {
      console.error("搜索失败:", error);
      setError("搜索时发生错误，请重试");
      setSearchResults([]);
      setHighlights(new Map());
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* 编辑工具栏 */}
      {pdfInstance && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">编辑工具：</span>
            <button
              onClick={() => {
                setEditMode("select");
                setPendingImage(null);
              }}
              className={`px-3 py-2 rounded-lg transition ${
                editMode === "select"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <MousePointer className="w-4 h-4 inline mr-1" />
              选择
            </button>
            <label className="px-3 py-2 rounded-lg cursor-pointer transition bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
              <Image className="w-4 h-4 inline mr-1" />
              图像
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
            <button
              onClick={() => setEditMode("text")}
              className={`px-3 py-2 rounded-lg transition ${
                editMode === "text"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <Type className="w-4 h-4 inline mr-1" />
              文本框
            </button>
          </div>
          {pendingImage && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={pendingImage} alt="预览" className="w-12 h-12 object-cover rounded" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">点击PDF放置图像</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">在PDF上点击任意位置放置图片</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPendingImage(null);
                    setEditMode("select");
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
          <Upload className="w-4 h-4" />
          <span>{fileName ? "重新上传" : "上传PDF"}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
        </label>

        {fileName && (
          <div className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">
            当前文件：{fileName}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleZoom("out")} className={buttonClass}><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => handleZoom("in")} className={buttonClass}><ZoomIn className="w-4 h-4" /></button>
          <button onClick={handleRotate} className={buttonClass}><RotateCw className="w-4 h-4" /></button>
          <button onClick={handleFullScreen} className={buttonClass}><Maximize className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <button className={buttonClass} onClick={() => changePage(-1)} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            第 {currentPage} / {totalPages || "0"} 页
          </span>
          <button className={buttonClass} onClick={() => changePage(1)} disabled={currentPage >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="搜索文本..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent text-sm"
            />
          </div>
          <button 
            className={buttonClass} 
            onClick={handleSearch}
            disabled={searching || !pdfInstance || !searchQuery.trim()}
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                搜索中...
              </>
            ) : (
              "搜索"
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mb-3" />
          正在加载PDF...
        </div>
      )}

      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow overflow-auto min-h-[60vh] flex items-center justify-center">
        {error ? (
          <div className="text-center text-red-500 py-20">{error}</div>
        ) : pdfInstance ? (
          <>
            {rendering && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            )}
            <div 
              className="relative inline-block my-6"
              style={{ cursor: editMode === "image" && pendingImage ? "crosshair" : "default" }}
            >
              <div className="relative">
                <canvas 
                  ref={canvasRef} 
                  className="shadow-lg block mx-auto"
                  onClick={(e) => {
                    // 如果点击的是图片元素，不处理
                    const target = e.target as HTMLElement;
                    if (target.closest('.pdf-image-element') || target.closest('button')) {
                      return;
                    }

                    // 检查是否在图片放置模式
                    if (!pdfInstance || editMode !== "image" || !pendingImage) {
                      return;
                    }

                    const clickedCanvas = e.currentTarget;
                    const canvasRect = clickedCanvas.getBoundingClientRect();
                    
                    // 计算相对于canvas的坐标（图片是absolute定位，相对于relative父容器）
                    const x = e.clientX - canvasRect.left;
                    const y = e.clientY - canvasRect.top;
                    
                    console.log("Canvas点击位置:", { x, y, canvasRect, canvasWidth: clickedCanvas.width, canvasHeight: clickedCanvas.height });
                    
                    // 创建新图片对象
                    const newImage: PlacedImage = {
                      id: Date.now().toString(),
                      page: currentPage,
                      x: x - 75, // 默认宽度150，居中
                      y: y - 75, // 默认高度150，居中
                      width: 150,
                      height: 150,
                      imageData: pendingImage,
                    };

                    console.log("创建图片:", newImage);
                    setPlacedImages(prev => [...prev, newImage]);
                    setPendingImage(null);
                    setEditMode("select");
                    setSelectedImageId(newImage.id);
                  }}
                />
                <canvas 
                  ref={highlightLayerRef} 
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ 
                    width: canvasRef.current?.width || 0,
                    height: canvasRef.current?.height || 0
                  }}
                />
                
                {/* 使用DOM元素显示图片，支持拖拽和调整大小 */}
                {placedImages
                  .filter(img => img.page === currentPage)
                  .map((img) => (
                    <div
                      key={img.id}
                      className={`pdf-image-element absolute border-2 ${
                        selectedImageId === img.id 
                          ? "border-blue-500" 
                          : "border-transparent hover:border-gray-400"
                      }`}
                      style={{
                        left: `${img.x}px`,
                        top: `${img.y}px`,
                        width: `${img.width}px`,
                        height: `${img.height}px`,
                        cursor: dragStart?.imageId === img.id ? "grabbing" : "move",
                        userSelect: "none",
                      }}
                      onMouseDown={(e) => handleImageMouseDown(e, img.id)}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      <img
                        src={img.imageData}
                        alt="Placed"
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                      {selectedImageId === img.id && (
                        <>
                          {/* 调整大小控制点 */}
                          <div
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize border-2 border-white"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleResizeMouseDown(e, img.id);
                            }}
                          />
                          {/* 删除按钮 */}
                          <button
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteImage(img.id);
                            }}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-20">
            上传 PDF 文件以开始预览
          </div>
        )}
      </div>

      {searchQuery && !searching && searchResults.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            未找到匹配的文本
          </p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
            搜索结果（{searchResults.length}）
          </h4>
          <div className="space-y-2 max-h-40 overflow-auto">
            {searchResults.map((match, idx) => (
              <button
                key={`${match.page}-${idx}`}
                className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
                onClick={async () => {
                  setCurrentPage(match.page);
                  await renderPage(match.page, pdfInstance, scale, rotation);
                }}
              >
                <span className="font-medium text-blue-600 dark:text-blue-400">第 {match.page} 页：</span>{" "}
                {match.preview}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

