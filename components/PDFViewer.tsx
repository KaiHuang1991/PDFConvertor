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

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist/build/pdf")> | null = null;

const loadPdfJs = async () => {
  if (!pdfjsLibPromise) {
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

  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

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
              <canvas ref={canvasRef} className="shadow-lg block mx-auto" />
              <canvas 
                ref={highlightLayerRef} 
                className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none"
              />
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

