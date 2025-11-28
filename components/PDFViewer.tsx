"use client";

import { useState, useRef, useEffect } from "react";
import { Search, RotateCw, ZoomIn, ZoomOut, Loader2, Maximize, ChevronLeft, ChevronRight, Upload } from "lucide-react";

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

  useEffect(() => {
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale, rotation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfInstance, scale, rotation, currentPage, highlights]);

  // 当scale或rotation改变时，如果有搜索查询，重新计算高亮位置
  useEffect(() => {
    // 使用ref来检查是否有高亮，避免依赖highlights.size导致循环
    const hasHighlights = highlights.size > 0;
    
    if (pdfInstance && searchQuery.trim() && hasHighlights) {
      // 延迟执行，确保状态已更新
      const timer = setTimeout(async () => {
        try {
          const query = searchQuery.trim();
          const queryLower = query.toLowerCase();
          const newHighlights = new Map<number, HighlightRect[]>();

          for (let i = 1; i <= pdfInstance.numPages; i++) {
            const page = await pdfInstance.getPage(i);
            const textContent = await page.getTextContent();
            
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            const lowerPageText = pageText.toLowerCase();
            
            let searchIndex = 0;
            const pageRects: HighlightRect[] = [];
            
            while ((searchIndex = lowerPageText.indexOf(queryLower, searchIndex)) !== -1) {
              let charPos = 0;
              const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [];
              
              for (let j = 0; j < textContent.items.length; j++) {
                const item = textContent.items[j];
                const itemText = item.str;
                const itemStart = charPos;
                const itemEnd = charPos + itemText.length;
                
                if (searchIndex < itemEnd && searchIndex + query.length > itemStart) {
                  const startChar = Math.max(0, searchIndex - itemStart);
                  const endChar = Math.min(itemText.length, searchIndex + query.length - itemStart);
                  matchingItems.push({ item, startChar, endChar });
                }
                
                charPos = itemEnd;
                if (j < textContent.items.length - 1) {
                  charPos += 1;
                }
                
                if (searchIndex + query.length <= itemEnd) {
                  break;
                }
              }
              
              if (matchingItems.length > 0) {
                // 使用最新的scale和rotation值重新计算高亮矩形
                const rects = calculateHighlightRects(page, matchingItems, scale, rotation);
                pageRects.push(...rects);
              }
              
              searchIndex += query.length;
            }
            
            if (pageRects.length > 0) {
              newHighlights.set(i, pageRects);
            }
          }
          
          // 更新高亮状态
          setHighlights(newHighlights);
          
          // 重新渲染当前页面以显示更新后的高亮
          if (currentPage) {
            await renderPage(currentPage, pdfInstance, scale, rotation);
          }
        } catch (error) {
          console.error("重新计算高亮失败:", error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, rotation]);

  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

  // 同步高亮层的尺寸
  useEffect(() => {
    if (canvasRef.current && highlightLayerRef.current) {
      const mainCanvas = canvasRef.current;
      const highlightLayer = highlightLayerRef.current;
      
      // 同步尺寸（使用canvas的实际像素尺寸）
      highlightLayer.style.width = `${mainCanvas.width}px`;
      highlightLayer.style.height = `${mainCanvas.height}px`;
      
      // 确保高亮层canvas的像素尺寸与主canvas一致
      if (highlightLayer.width !== mainCanvas.width || highlightLayer.height !== mainCanvas.height) {
        highlightLayer.width = mainCanvas.width;
        highlightLayer.height = mainCanvas.height;
      }
    }
  }, [rendering, scale, rotation, currentPage, highlights]);

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

    // 设置高亮层尺寸与PDF canvas完全一致
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
      // 确保坐标在有效范围内
      const x = Math.max(0, Math.min(rect.x, highlightLayer.width));
      const y = Math.max(0, Math.min(rect.y, highlightLayer.height));
      const width = Math.max(1, Math.min(rect.width, highlightLayer.width - x));
      const height = Math.max(1, Math.min(rect.height, highlightLayer.height - y));
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    }
  };


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

  // 计算高亮矩形（基于PDF坐标和当前视口，使用PDF.js viewport转换）
  const calculateHighlightRects = (page: any, matchingItems: Array<{ item: any; startChar: number; endChar: number }>, currentScale: number, currentRotation: number): HighlightRect[] => {
    // 获取当前viewport（包含旋转和缩放）
    const viewport = page.getViewport({ scale: currentScale, rotation: currentRotation });
    
    // 辅助函数：将PDF坐标转换为viewport坐标（canvas坐标）
    // 使用viewport的transform矩阵进行转换
    const convertToViewportCoords = (pdfX: number, pdfY: number): { x: number; y: number } => {
      // PDF.js的viewport已经包含了旋转和缩放信息
      // 我们需要将PDF坐标转换为viewport坐标
      // viewport.transform是一个4x4矩阵，但我们只需要2D转换
      
      // 获取基础viewport（未旋转）用于计算
      const baseViewport = page.getViewport({ scale: 1.0, rotation: 0 });
      const baseWidth = baseViewport.width;
      const baseHeight = baseViewport.height;
      
      // 如果没有旋转，直接转换
      if (currentRotation === 0) {
        return {
          x: pdfX * (viewport.width / baseWidth),
          y: (baseHeight - pdfY) * (viewport.height / baseHeight)
        };
      }
      
      // 有旋转时，PDF坐标系原点始终在左下角
      // 顺时针旋转90度后，新的坐标系仍然以左下角为原点
      if (currentRotation === 90) {
        // 顺时针旋转90度：
        // 新的x坐标 = 未旋转时的y值（原来的y轴变成新的x轴）
        // 新的y坐标 = PDF宽度 - 未旋转时的x值（原来的x轴变成新的y轴，但方向相反）
        const newX = pdfY;
        const newY = baseWidth - pdfX;
        
        // 转换为canvas坐标（canvas原点在左上角，y向下）
        const rotatedViewport = page.getViewport({ scale: 1.0, rotation: currentRotation });
        const scaleX = viewport.width / rotatedViewport.width;
        const scaleY = viewport.height / rotatedViewport.height;
        
        return {
          x: newX * scaleX,
          y: (rotatedViewport.height - newY) * scaleY
        };
      } else if (currentRotation === 180) {
        // 旋转180度：
        // 新的x坐标 = PDF宽度 - 未旋转时的x值
        // 新的y坐标 = PDF高度 - 未旋转时的y值
        const newX = baseWidth - pdfX;
        const newY = baseHeight - pdfY;
        
        const scaleX = viewport.width / baseWidth;
        const scaleY = viewport.height / baseHeight;
        
        return {
          x: newX * scaleX,
          y: (baseHeight - newY) * scaleY
        };
      } else if (currentRotation === 270) {
        // 顺时针旋转270度（或逆时针90度）：
        // 新的x坐标 = PDF高度 - 未旋转时的y值
        // 新的y坐标 = 未旋转时的x值
        const newX = baseHeight - pdfY;
        const newY = pdfX;
        
        const rotatedViewport = page.getViewport({ scale: 1.0, rotation: currentRotation });
        const scaleX = viewport.width / rotatedViewport.width;
        const scaleY = viewport.height / rotatedViewport.height;
        
        return {
          x: newX * scaleX,
          y: (rotatedViewport.height - newY) * scaleY
        };
      } else {
        // 其他角度，使用围绕页面中心旋转的方法
        // 首先转换为未旋转的canvas坐标
        const unrotatedX = pdfX;
        const unrotatedY = baseHeight - pdfY;
        
        // 页面中心点
        const centerX = baseWidth / 2;
        const centerY = baseHeight / 2;
        
        // 相对于中心点的坐标
        const relX = unrotatedX - centerX;
        const relY = unrotatedY - centerY;
        
        // 应用旋转（逆时针）
        const radians = (currentRotation * Math.PI) / 180;
        const rotatedX = relX * Math.cos(radians) - relY * Math.sin(radians);
        const rotatedY = relX * Math.sin(radians) + relY * Math.cos(radians);
        
        // 旋转后的viewport中心点
        const newCenterX = viewport.width / 2;
        const newCenterY = viewport.height / 2;
        
        return {
          x: newCenterX + rotatedX,
          y: newCenterY + rotatedY
        };
      }
    };
    
    // 如果只有一个匹配项，直接计算
    if (matchingItems.length === 1) {
      const matchItem = matchingItems[0];
      const item = matchItem.item;
      const transform = item.transform;
      
      // 获取文本的实际宽度和高度
      const textWidth = item.width || 0;
      const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || 12;
      const textHeight = item.height || fontSize;
      
      // 计算字符宽度
      let charWidth: number;
      if (textWidth > 0 && item.str.length > 0) {
        charWidth = textWidth / item.str.length;
      } else {
        charWidth = fontSize;
      }
      
      // 计算匹配部分的精确宽度
      const matchWidth = (matchItem.endChar - matchItem.startChar) * charWidth;
      
      // PDF坐标系中的位置
      const pdfX = transform[4];
      const pdfY = transform[5];
      
      // 计算匹配文本的起始X坐标
      const matchStartX = pdfX + (matchItem.startChar * charWidth);
      
      // 计算文本的垂直位置
      const baselineRatio = 0.95;
      const baselineOffset = textHeight * (1 - baselineRatio);
      const pdfTextBottom = pdfY - baselineOffset;
      const pdfTextTop = pdfY - baselineOffset + textHeight;
      
      // 使用viewport转换PDF坐标到viewport坐标
      const topLeft = convertToViewportCoords(matchStartX, pdfTextTop);
      const bottomRight = convertToViewportCoords(matchStartX + matchWidth, pdfTextBottom);
      
      // 计算高亮矩形的实际位置和尺寸
      const rectX = Math.min(topLeft.x, bottomRight.x);
      const rectY = Math.min(topLeft.y, bottomRight.y);
      const rectWidth = Math.abs(bottomRight.x - topLeft.x);
      const rectHeight = Math.abs(bottomRight.y - topLeft.y);
      
      // 计算高度：使用viewport的缩放比例
      const baseViewport = page.getViewport({ scale: 1.0, rotation: 0 });
      const heightScale = viewport.height / baseViewport.height;
      const minHeight = textHeight * heightScale;
      
      return [{
        x: rectX,
        y: rectY,
        width: Math.max(rectWidth, 2),
        height: Math.max(rectHeight, minHeight * 1.15),
      }];
    }
    
    // 多个文本项：需要计算整体边界框
    if (matchingItems.length > 1) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let maxHeight = 0;
      
      for (let idx = 0; idx < matchingItems.length; idx++) {
        const matchItem = matchingItems[idx];
        const item = matchItem.item;
        const transform = item.transform;
        
        const textWidth = item.width || 0;
        const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || 12;
        const textHeight = item.height || fontSize;
        maxHeight = Math.max(maxHeight, textHeight);
        
        // 计算字符宽度
        let charWidth: number;
        if (textWidth > 0 && item.str.length > 0) {
          charWidth = textWidth / item.str.length;
        } else {
          charWidth = fontSize;
        }
        
        const pdfX = transform[4];
        const pdfY = transform[5];
        
        let itemStartX: number;
        let itemEndX: number;
        
        if (idx === 0) {
          itemStartX = pdfX + (matchItem.startChar * charWidth);
          itemEndX = pdfX + (textWidth > 0 ? textWidth : item.str.length * charWidth);
        } else if (idx === matchingItems.length - 1) {
          itemStartX = pdfX;
          itemEndX = pdfX + (matchItem.endChar * charWidth);
        } else {
          itemStartX = pdfX;
          itemEndX = pdfX + (textWidth > 0 ? textWidth : item.str.length * charWidth);
        }
        
        minX = Math.min(minX, itemStartX);
        maxX = Math.max(maxX, itemEndX);
        
        // 计算Y坐标
        const baselineRatio = 0.95;
        const baselineOffset = textHeight * (1 - baselineRatio);
        const pdfTextBottom = pdfY - baselineOffset;
        const pdfTextTop = pdfY - baselineOffset + textHeight;
        
        minY = Math.min(minY, pdfTextBottom);
        maxY = Math.max(maxY, pdfTextTop);
      }
      
      // 使用viewport转换PDF坐标到viewport坐标
      const topLeft = convertToViewportCoords(minX, maxY);
      const bottomRight = convertToViewportCoords(maxX, minY);
      
      // 计算高亮矩形的实际位置和尺寸
      const rectX = Math.min(topLeft.x, bottomRight.x);
      const rectY = Math.min(topLeft.y, bottomRight.y);
      const rectWidth = Math.abs(bottomRight.x - topLeft.x);
      const rectHeight = Math.abs(bottomRight.y - topLeft.y);
      
      // 计算高度：使用viewport的缩放比例
      const baseViewport = page.getViewport({ scale: 1.0, rotation: 0 });
      const heightScale = viewport.height / baseViewport.height;
      const minHeight = maxHeight * heightScale;
      
      return [{
        x: rectX,
        y: rectY,
        width: Math.max(rectWidth, 2),
        height: Math.max(rectHeight, minHeight * 1.2),
      }];
    }
    
    return [];
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
        
        // 构建页面文本（用于搜索）
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
          
          // 计算高亮矩形（使用当前scale和rotation）
          if (matchingItems.length > 0) {
            const rects = calculateHighlightRects(page, matchingItems, scale, rotation);
            pageRects.push(...rects);
            
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
            <div className="relative inline-block my-6">
              <div className="relative">
                <canvas 
                  ref={canvasRef} 
                  className="shadow-lg block mx-auto"
                />
                <canvas 
                  ref={highlightLayerRef} 
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ 
                    width: canvasRef.current?.width || 0,
                    height: canvasRef.current?.height || 0,
                    imageRendering: "auto"
                  }}
                />
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

