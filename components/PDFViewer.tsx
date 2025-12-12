"use client";

import { useState, useRef, useEffect } from "react";
import { Search, RotateCw, ZoomIn, ZoomOut, Loader2, Maximize, ChevronLeft, ChevronRight, Upload, Download } from "lucide-react";

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

// 缓存每页可搜索文本
let searchableTextCache = new Map<number, string>();

/**
 * 【终极方案】提取真实可搜索文本（完美支持中文CID字体）
 * 
 * 关键：使用 operatorList 的 glyph.unicode 提取真实中文字符，
 * 绕过 CID 字体导致的 item.str 乱码问题
 */
const extractSearchableText = async (page: any): Promise<string> => {
  // 先尝试正常方式（英文PDF或已正确映射的PDF）
  try {
    // 尝试多种方式启用字符级别信息
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
      // @ts-ignore - 尝试不同的选项名称
      includeCharInfo: true,  // 选项1：includeCharInfo
      // @ts-ignore
      includeCharBoundingBoxes: true,  // 选项2：includeCharBoundingBoxes
      // @ts-ignore
      includeTextRects: true,  // 选项3：includeTextRects
    });

    // 【关键修复】构建文本时，确保与后续在方案2中构建 textContentText 的方式一致
    // 使用 join("")，因为 normalizeWhitespace: true 已经在 item.str 中处理了空格
    const normalText = textContent.items
      .map((item: any) => item.str || "")
      .join("")
      .trim();

    // 如果正常文本足够长且包含可读字符，直接返回
    if (normalText.length > 20 && /[\u4e00-\u9fa5a-zA-Z]/.test(normalText)) {
      return normalText;
    }
  } catch (e) {
    // 忽略错误，继续尝试其他方法
  }

  // 【关键】使用 operatorList 提取真实渲染的文字（即使是 CID 也能转成中文！）
  try {
    const pdfjsLib = await loadPdfJs();
    const ops = await page.getOperatorList();

    let text = "";
    let lastFont = "";

    for (let i = 0; i < ops.fnArray.length; i++) {
      const op = ops.fnArray[i];
      const args = ops.argsArray[i];

      // 记录当前字体
      if (op === pdfjsLib.OPS.setFont) {
        lastFont = args[0];
      }

      // 提取文本内容
      if (op === pdfjsLib.OPS.showText || op === pdfjsLib.OPS.showSpacedText) {
        const glyphs = args[0];
        if (!glyphs) continue;

        // 处理字符串数组或字符串
        if (Array.isArray(glyphs)) {
          for (const glyph of glyphs) {
            if (typeof glyph === "string") {
              text += glyph;
            } else if (glyph && typeof glyph === "object" && glyph.unicode) {
              // glyph.unicode 就是真正的中文字符！即使是 CID 字体也能拿到！
              if (glyph.unicode !== " " || text.length === 0 || text[text.length - 1] !== " ") {
                text += glyph.unicode;
              }
            }
          }
        } else if (typeof glyphs === "string") {
          text += glyphs;
        }
      }
    }

    // 【关键】保持原始文本格式，不规范化！
    // 如果这里规范化了，会改变字符位置，导致无法与 textContent.items 对齐
    // 我们将在方案2中确保两个文本使用相同的构建方式
    return text || " ";
  } catch (e) {
    console.warn("提取文本失败，使用备用方案:", e);
    // 备用方案：返回空字符串，至少不会报错
    return " ";
  }
};

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
  const [matchCase, setMatchCase] = useState(false); // 区分大小写
  const [wholeWords, setWholeWords] = useState(false); // 整词匹配
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string>("");
  const [highlights, setHighlights] = useState<Map<number, HighlightRect[]>>(new Map());
  const highlightLayerRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);  // 文本层容器（用于获取精确字符位置）

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
            
            // 使用终极提取方法获取真实可搜索文本（支持中文）
            const pageText = await extractSearchableText(page);
            const lowerText = pageText.toLowerCase();
            
            let searchIndex = 0;
            const pageRects: HighlightRect[] = [];
            
            while ((searchIndex = lowerText.indexOf(queryLower, searchIndex)) !== -1) {
              // 获取 textContent 用于坐标计算
              const textContent = await page.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false,
                // @ts-ignore - 尝试不同的选项名称
                includeCharInfo: true,
                // @ts-ignore
                includeCharBoundingBoxes: true,
                // @ts-ignore
                includeTextRects: true,
              });

              // 计算这是第几个匹配（与 handleSearch 保持一致的逻辑）
              let matchCount = 0;
              let tempIndex = 0;
              while (tempIndex < searchIndex && (tempIndex = lowerText.indexOf(queryLower, tempIndex + 1)) !== -1) {
                matchCount++;
              }
              
              const textContentText = textContent.items
                .map((item: any) => item.str || "")
                .join(" ");
              const textContentTextLower = textContentText.toLowerCase();
              
              // 在 textContentTextLower 中查找第 matchCount 个匹配
              let currentMatchIndex = 0;
              let textContentSearchIndex = 0;
              
              while ((textContentSearchIndex = textContentTextLower.indexOf(queryLower, textContentSearchIndex)) !== -1) {
                if (currentMatchIndex === matchCount) {
                  break;
                }
                currentMatchIndex++;
                textContentSearchIndex += query.length;
              }
              
              const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [];
              
              if (textContentSearchIndex !== -1) {
                let charPos = 0;
              
              for (let j = 0; j < textContent.items.length; j++) {
                const item = textContent.items[j];
                  const itemText = item.str || "";
                  
                  if (!itemText || itemText.length === 0) {
                    charPos += 1;
                    continue;
                  }
                  
                const itemStart = charPos;
                const itemEnd = charPos + itemText.length;
                
                  if (textContentSearchIndex >= itemStart && textContentSearchIndex < itemEnd) {
                    const itemTextLower = itemText.toLowerCase();
                    const relativeStart = textContentSearchIndex - itemStart;
                    
                    // 【关键修复】直接查找第一个匹配，而不是找最接近的匹配
                    // 这样可以确保找到的是item中第一个出现的匹配，而不是最接近relativeStart的匹配
                    const itemMatchStart = itemTextLower.indexOf(queryLower);
                    
                    if (itemMatchStart !== -1) {
                      const startChar = itemMatchStart;
                      const endChar = Math.min(itemText.length, itemMatchStart + query.length);
                      
                      matchingItems.push({ item, startChar, endChar });
                      break;
                    }
                }
                
                charPos = itemEnd;
                if (j < textContent.items.length - 1) {
                  charPos += 1;
                }
                }
              }
              
              if (matchingItems.length > 0) {
                // 使用最新的scale和rotation值重新计算高亮矩形
                const rects = await getHighlightRects(page, matchingItems, scale, rotation);
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

  /**
   * 【终极修复】同步高亮层 canvas 尺寸（完全复制 PDF canvas 的所有尺寸属性）
   * 这是解决 0.5~1px 偏移的终极方案！
   * 
   * 关键点：
   * 1. canvas.width/height 是设备像素（考虑 devicePixelRatio，例如 dpr=2 时，width=1680）
   * 2. canvas.style.width/height 是 CSS 像素（例如 840px）
   * 3. 必须完全同步两个 canvas 的尺寸，否则坐标会错位
   * 4. JSX 中不要绑定 width/height，让这个函数完全控制
   */
  const syncHighlightCanvasSize = () => {
    if (!canvasRef.current || !highlightLayerRef.current) return;

    const pdfCanvas = canvasRef.current;
    const hlCanvas = highlightLayerRef.current;
    const ctx = hlCanvas.getContext("2d");
    if (!ctx) return;

    // 关键：完全复制 pdfCanvas 的所有尺寸属性
    // 1. 同步设备像素尺寸（最重要！）
    // 确保与PDF canvas完全一致（包括四舍五入）
    hlCanvas.width = pdfCanvas.width;
    hlCanvas.height = pdfCanvas.height;

    // 2. 同步 CSS 显示尺寸（让它看起来一样大）
    // 确保两个canvas的显示尺寸完全一致
    if (pdfCanvas.style.width && pdfCanvas.style.height) {
      hlCanvas.style.width = pdfCanvas.style.width;
      hlCanvas.style.height = pdfCanvas.style.height;
    } else {
      // 使用offsetWidth/offsetHeight获取实际显示尺寸
      hlCanvas.style.width = `${pdfCanvas.offsetWidth}px`;
      hlCanvas.style.height = `${pdfCanvas.offsetHeight}px`;
    }

    // 3. 清除可能残留的 transform，确保坐标系统一致
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // 【调试】输出同步信息
    console.log(`[同步Canvas] PDF: ${pdfCanvas.width}x${pdfCanvas.height}, 高亮: ${hlCanvas.width}x${hlCanvas.height}`);
    console.log(`[同步Canvas] PDF样式: ${pdfCanvas.style.width || pdfCanvas.offsetWidth}x${pdfCanvas.style.height || pdfCanvas.offsetHeight}`);
    console.log(`[同步Canvas] 高亮样式: ${hlCanvas.style.width}x${hlCanvas.style.height}`);
  };

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
    // 【关键修复】确保Canvas尺寸与Viewport完全一致
    // viewport.width/height 可能包含小数，但Canvas width/height必须是整数
    // 使用 Math.round 确保一致性
    canvas.height = Math.round(viewport.height);
    canvas.width = Math.round(viewport.width);

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
      // 【关键】渲染完成后立即同步高亮层尺寸（必须在绘制高亮之前！）
      syncHighlightCanvasSize();
      
      // 【方法3】渲染文本层（用于获取精确字符位置）
      if (textLayerRef.current) {
        try {
          const pdfjsLib = await loadPdfJs();
          const textContent = await page.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false,
          });
          
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.position = 'absolute';
          textLayerDiv.style.left = '0';
          textLayerDiv.style.top = '0';
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;
          textLayerDiv.style.opacity = '0';
          textLayerDiv.style.pointerEvents = 'none';
          textLayerDiv.style.visibility = 'hidden';
          
          // 使用 PDF.js 的 renderTextLayer
          // @ts-ignore
          if (pdfjsLib.renderTextLayer) {
            // @ts-ignore
            await pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport: viewport,
              textDivs: [],
            }).promise;
          }
        } catch (error) {
          console.warn('[文本层渲染] 渲染失败，将使用备用方法:', error);
        }
      }
      
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

    // 【关键修复】不再在这里设置尺寸，因为已经在 renderPage 中通过 syncHighlightCanvasSize 同步了
    // 确保尺寸已同步（双重保险）
    if (canvasRef.current) {
      const pdfCanvas = canvasRef.current;
      if (highlightLayer.width !== pdfCanvas.width || highlightLayer.height !== pdfCanvas.height) {
        highlightLayer.width = pdfCanvas.width;
        highlightLayer.height = pdfCanvas.height;
      }
      
      // 【调试】输出canvas尺寸信息
      console.log(`[绘制高亮] Canvas尺寸检查:`);
      console.log(`[绘制高亮]   PDF Canvas: width=${pdfCanvas.width}, height=${pdfCanvas.height}`);
      console.log(`[绘制高亮]   PDF Canvas style: width=${pdfCanvas.style.width || '未设置'}, height=${pdfCanvas.style.height || '未设置'}`);
      console.log(`[绘制高亮]   PDF Canvas offset: width=${pdfCanvas.offsetWidth}, height=${pdfCanvas.offsetHeight}`);
      console.log(`[绘制高亮]   高亮 Canvas: width=${highlightLayer.width}, height=${highlightLayer.height}`);
      console.log(`[绘制高亮]   高亮 Canvas style: width=${highlightLayer.style.width || '未设置'}, height=${highlightLayer.style.height || '未设置'}`);
      console.log(`[绘制高亮]   高亮 Canvas offset: width=${highlightLayer.offsetWidth}, height=${highlightLayer.offsetHeight}`);
      console.log(`[绘制高亮]   Viewport: width=${viewport.width}, height=${viewport.height}`);
    }

    // 清除之前的高亮
    ctx.clearRect(0, 0, highlightLayer.width, highlightLayer.height);

    const pageHighlights = highlights.get(pageNumber);
    if (!pageHighlights || pageHighlights.length === 0) {
      return;
    }

    // 绘制高亮矩形（优化版：浅色高亮，完美贴字）
    // 使用更浅的黄色和更低的透明度，确保文字清晰可见
    ctx.fillStyle = "rgba(255, 240, 0, 0.35)"; // 浅黄色，35%透明度（文字清晰可见，颜色更柔和）

    // 启用抗锯齿以获得更平滑的边缘
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (let i = 0; i < pageHighlights.length; i++) {
      const rect = pageHighlights[i];
      
      // 【调试】输出绘制信息
      console.log(`[绘制高亮] 矩形 ${i + 1}/${pageHighlights.length}:`, {
        原始: { x: rect.x.toFixed(2), y: rect.y.toFixed(2), width: rect.width.toFixed(2), height: rect.height.toFixed(2) }
      });
      
      // 【关键修复】使用精确坐标，确保是整数像素
      // 由于在计算时已经使用了 Math.floor，这里直接使用即可
      // 但为了安全，再次确保坐标在边界内
      let x = Math.floor(rect.x);
      let y = Math.floor(rect.y);
      let width = Math.max(1, Math.floor(rect.width));
      let height = Math.max(1, Math.floor(rect.height));
      
      // 【关键修复】最终边界裁剪，确保不超出Canvas
      const canvasWidth = highlightLayer.width;
      const canvasHeight = highlightLayer.height;
      
      if (x < 0) {
        width += x; // 减少宽度
        x = 0;
      }
      if (y < 0) {
        height += y; // 减少高度
        y = 0;
      }
      if (x + width > canvasWidth) {
        width = Math.max(1, canvasWidth - x);
      }
      if (y + height > canvasHeight) {
        height = Math.max(1, canvasHeight - y);
      }
      
      // 确保最终值有效
      if (width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > canvasWidth || y + height > canvasHeight) {
        console.warn(`[绘制高亮] ⚠️ 矩形无效或超出边界，跳过绘制`, {
          x, y, width, height,
          canvasWidth, canvasHeight
        });
        continue; // 跳过这个矩形
      }
      
      // 【调试】输出最终绘制坐标
      console.log(`[绘制高亮] 绘制坐标: x=${x}, y=${y}, width=${width}, height=${height}`);
      console.log(`[绘制高亮] Canvas边界检查: x在[0, ${canvasWidth}], y在[0, ${canvasHeight}]`);
      
      // 使用 roundRect（现代浏览器支持）绘制圆角矩形，更美观且边缘更清晰
      // 如果不支持，降级到 fillRect
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 2);  // 2px圆角，更贴合文字
        ctx.fill();
      } else {
        // 兼容方案：使用 fillRect
      ctx.fillRect(x, y, width, height);
      }
    }
    
    console.log(`[绘制高亮] 完成绘制 ${pageHighlights.length} 个高亮矩形`);
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

  /**
   * 【方法3：已废弃】使用文本层DOM元素获取精确位置
   * 问题：手动创建的文本层span位置基于平均字符宽度，不准确
   * 解决：直接使用textContent方法，它已经足够准确
   */
  const getHighlightRectsFromTextLayer = async (
    page: any,
    matches: Array<{ item: any; startChar: number; endChar: number }>,
    scale: number,
    rotation: number
  ): Promise<HighlightRect[]> => {
    // 【改进】直接使用textContent方法，它已经足够准确
    // 文本层方法的问题在于手动创建的span位置不准确，所以回退到textContent方法
    return getHighlightRectsFromTextContent(page, matches, scale, rotation);
  };

  // 【保留旧代码供参考，但已禁用】
  const _getHighlightRectsFromTextLayer_OLD = async (
    page: any,
    matches: Array<{ item: any; startChar: number; endChar: number }>,
    scale: number,
    rotation: number
  ): Promise<HighlightRect[]> => {
    const viewport = page.getViewport({ scale, rotation });
    const rects: HighlightRect[] = [];
    const pdfjsLib = await loadPdfJs();

    try {
      // 获取文本内容
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      // 渲染文本层
      const textLayerDiv = textLayerRef.current;
      textLayerDiv.innerHTML = ''; // 清空之前的内容
      
      // 【关键修复】确保文本层div和canvas完全对齐
      // 先获取Canvas的实际显示尺寸，确保文本层和Canvas尺寸完全一致
      const canvasDisplayRect = canvasRef.current.getBoundingClientRect();
      
      textLayerDiv.style.position = 'absolute';
      textLayerDiv.style.left = '0';
      textLayerDiv.style.top = '0';
      // 【重要】使用Canvas的实际显示尺寸，而不是viewport尺寸
      // 这样可以确保文本层和Canvas完全对齐（包括处理devicePixelRatio等）
      textLayerDiv.style.width = `${canvasDisplayRect.width}px`;
      textLayerDiv.style.height = `${canvasDisplayRect.height}px`;
      textLayerDiv.style.opacity = '0'; // 隐藏文本层（只用于获取位置）
      textLayerDiv.style.pointerEvents = 'none';
      textLayerDiv.style.transform = 'none';  // 确保没有transform影响
      textLayerDiv.style.margin = '0';
      textLayerDiv.style.padding = '0';
      textLayerDiv.style.boxSizing = 'border-box';
      
      // 计算viewport到Canvas显示尺寸的缩放比例
      const viewportToDisplayScaleX = canvasDisplayRect.width / viewport.width;
      const viewportToDisplayScaleY = canvasDisplayRect.height / viewport.height;

      // 【方法3】手动创建文本层，每个字符一个span，用于获取精确位置
      // 关键改进：使用viewport坐标转换，确保位置准确
      const itemToCharIndexMap = new Map<number, number>(); // item索引 -> 该item的第一个字符的全局索引
      let globalCharIndex = 0;
      
      for (let itemIdx = 0; itemIdx < textContent.items.length; itemIdx++) {
        const item = textContent.items[itemIdx];
        if (!item.str) continue;
        
        // 记录这个item的第一个字符的全局索引
        itemToCharIndexMap.set(itemIdx, globalCharIndex);
        
        // 计算item的起始位置（PDF坐标系）
        const itemX = item.transform[4];
        const itemY = item.transform[5];
        
        // 转换为viewport坐标
        const itemViewportPoint = viewport.convertToViewportPoint(itemX, itemY);
        const itemViewportX = itemViewportPoint[0];
        const itemViewportY = itemViewportPoint[1];
        
        // 计算字符宽度（使用平均宽度，但后续会通过getBoundingClientRect获取实际宽度）
        const charWidth = item.width && item.str.length > 0 ? item.width / item.str.length : Math.abs(item.transform[0]);
        const fontSize = Math.hypot(item.transform[0], item.transform[1]);
        
        // 为每个字符创建一个span
        for (let i = 0; i < item.str.length; i++) {
          const char = item.str[i];
          const span = document.createElement('span');
          span.textContent = char;
          span.setAttribute('data-char-index', globalCharIndex.toString());
          span.setAttribute('data-item-index', itemIdx.toString());
          span.setAttribute('data-char-in-item', i.toString());
          span.style.position = 'absolute';
          span.style.whiteSpace = 'pre';
          span.style.fontSize = `${fontSize}px`;
          span.style.fontFamily = 'sans-serif';  // 使用通用字体，尽量接近PDF渲染
          span.style.lineHeight = '1';  // 避免行高影响
          
          // 计算字符位置（viewport坐标）
          const charX = itemViewportX + (i * charWidth);
          const charY = itemViewportY;
          
          // 【关键】将viewport坐标转换为Canvas显示坐标
          // 因为textLayerDiv的尺寸是Canvas的显示尺寸，而不是viewport尺寸
          span.style.left = `${charX * viewportToDisplayScaleX}px`;
          span.style.top = `${charY * viewportToDisplayScaleY}px`;
          
          textLayerDiv.appendChild(span);
          globalCharIndex++;
        }
      }

      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 从DOM元素获取精确位置
      // 【关键】重新获取canvas和textLayer的位置，确保是最新的
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const textLayerRect = textLayerDiv.getBoundingClientRect();
      
      // 【调试】检查对齐情况
      const alignmentDiff = {
        left: textLayerRect.left - canvasRect.left,
        top: textLayerRect.top - canvasRect.top,
        width: textLayerRect.width - canvasRect.width,
        height: textLayerRect.height - canvasRect.height
      };
      console.log(`[getBoundingClientRect调试] 文本层与Canvas对齐差异:`, alignmentDiff);
      
      // 计算缩放比例（考虑devicePixelRatio）
      const scaleX = canvasRef.current.width / canvasRect.width;
      const scaleY = canvasRef.current.height / canvasRect.height;
      
      // 【调试】输出 getBoundingClientRect() 信息
      console.log(`[getBoundingClientRect调试] Canvas位置:`, {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        right: canvasRect.right,
        bottom: canvasRect.bottom
      });
      console.log(`[getBoundingClientRect调试] Canvas尺寸:`, {
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height,
        styleWidth: canvasRef.current.style.width,
        styleHeight: canvasRef.current.style.height
      });
      console.log(`[getBoundingClientRect调试] 文本层位置:`, {
        left: textLayerRect.left,
        top: textLayerRect.top,
        width: textLayerRect.width,
        height: textLayerRect.height
      });
      console.log(`[getBoundingClientRect调试] 缩放比例:`, {
        scaleX: scaleX,
        scaleY: scaleY,
        devicePixelRatio: window.devicePixelRatio || 1
      });

      for (const { item, startChar, endChar } of matches) {
        const { str } = item;
        if (!str || endChar <= startChar) continue;

        // 找到这个item在textContent.items中的索引
        const itemIndex = textContent.items.indexOf(item);
        if (itemIndex === -1) continue;
        
        // 计算这个item的第一个字符的全局索引
        const itemStartCharIndex = itemToCharIndexMap.get(itemIndex);
        if (itemStartCharIndex === undefined) continue;
        
        // 计算匹配文本的全局字符索引
        const globalStartCharIndex = itemStartCharIndex + startChar;
        const globalEndCharIndex = itemStartCharIndex + endChar - 1;
        
        // 在文本层中查找对应的字符span元素
        const startSpan = textLayerDiv.querySelector(`span[data-char-index="${globalStartCharIndex}"]`) as HTMLElement;
        const endSpan = textLayerDiv.querySelector(`span[data-char-index="${globalEndCharIndex}"]`) as HTMLElement;

        if (startSpan && endSpan) {
          // 获取DOM元素的精确位置
          const startRect = startSpan.getBoundingClientRect();
          const endRect = endSpan.getBoundingClientRect();
          
          // 【调试】输出字符span的 getBoundingClientRect() 信息
          console.log(`[getBoundingClientRect调试] 匹配文本: "${str.substring(startChar, endChar)}"`);
          console.log(`[getBoundingClientRect调试] 起始字符span (charIndex=${globalStartCharIndex}):`, {
            left: startRect.left,
            top: startRect.top,
            width: startRect.width,
            height: startRect.height,
            right: startRect.right,
            bottom: startRect.bottom,
            textContent: startSpan.textContent,
            styleLeft: startSpan.style.left,
            styleTop: startSpan.style.top
          });
          console.log(`[getBoundingClientRect调试] 结束字符span (charIndex=${globalEndCharIndex}):`, {
            left: endRect.left,
            top: endRect.top,
            width: endRect.width,
            height: endRect.height,
            right: endRect.right,
            bottom: endRect.bottom,
            textContent: endSpan.textContent,
            styleLeft: endSpan.style.left,
            styleTop: endSpan.style.top
          });
          
          // 计算相对于canvas的位置
          // 【关键修复】由于文本层和Canvas现在尺寸完全一致，可以直接使用getBoundingClientRect的差值
          // 但需要考虑scaleX/scaleY（Canvas设备像素 vs CSS像素）
          const offsetX = startRect.left - canvasRect.left;
          const offsetY = startRect.top - canvasRect.top;
          
          // 【重要】如果文本层和Canvas完全对齐（left/top相同），offsetX/offsetY应该接近0
          // 但span的位置是相对于textLayerDiv的，所以需要从span的getBoundingClientRect获取
          // 然后转换为Canvas坐标
          const x = offsetX * scaleX;
          const y = offsetY * scaleY;
          const width = ((endRect.left + endRect.width) - startRect.left) * scaleX;
          const height = startRect.height * scaleY;
          
          // 【调试】输出坐标计算详情
          console.log(`[getBoundingClientRect调试] 坐标计算详情:`, {
            startRectLeft: startRect.left,
            canvasRectLeft: canvasRect.left,
            offsetX: offsetX,
            scaleX: scaleX,
            finalX: x,
            startRectTop: startRect.top,
            canvasRectTop: canvasRect.top,
            offsetY: offsetY,
            scaleY: scaleY,
            finalY: y,
            width: width,
            height: height
          });
          
          // 【调试】输出坐标计算过程
          console.log(`[getBoundingClientRect调试] 坐标计算:`, {
            offsetX: offsetX,
            offsetY: offsetY,
            finalX: x,
            finalY: y,
            finalWidth: width,
            finalHeight: height,
            calculation: {
              x: `(${startRect.left} - ${canvasRect.left}) * ${scaleX} = ${x}`,
              y: `(${startRect.top} - ${canvasRect.top}) * ${scaleY} = ${y}`,
              width: `((${endRect.left} + ${endRect.width}) - ${startRect.left}) * ${scaleX} = ${width}`,
              height: `${startRect.height} * ${scaleY} = ${height}`
            }
          });

          rects.push({ x, y, width, height });
          console.log(`[文本层方法] 找到匹配，itemIndex=${itemIndex}, startChar=${startChar}, endChar=${endChar}, x=${x}, y=${y}, width=${width}`);
      } else {
          console.warn(`[文本层方法] 未找到字符span，itemIndex=${itemIndex}, startChar=${startChar}, endChar=${endChar}, globalStart=${globalStartCharIndex}, globalEnd=${globalEndCharIndex}`);
        }
      }
    } catch (error) {
      console.error('[文本层方法] 获取位置失败，回退到其他方法:', error);
      // 回退到其他方法
      return getHighlightRectsFromTextContent(page, matches, scale, rotation);
    }

    return rects;
  };

  /**
   * 【方法2：备用】使用textContent计算位置（当前使用的方法）
   */
  const getHighlightRectsFromTextContent = async (
    page: any,
    matches: Array<{ item: any; startChar: number; endChar: number }>,
    scale: number,
    rotation: number
  ): Promise<HighlightRect[]> => {
    const viewport = page.getViewport({ scale, rotation });
    const rects: HighlightRect[] = [];

    for (const { item, startChar, endChar } of matches) {
      const { transform, str, width } = item;
      
      if (!str || endChar <= startChar) continue;

      // 【关键说明】当前获取字符宽度的方法：
      // 
      // 方法1：使用平均字符宽度（当前使用的方法）
      // - 计算：charWidth = item.width / str.length
      // - 优点：包含了字符间距，对于整个文本块是准确的
      // - 缺点：对于变宽字体，每个字符的实际宽度不同，会有误差
      // 
      // 方法2：使用字符级别的信息（如果PDF.js提供）
      // - 检查：item.chars 数组，可能包含每个字符的 width 或 transform
      // - 优点：每个字符的实际宽度，最准确
      // - 缺点：不是所有PDF都提供这个信息
      //
      // 当前实现：使用方法1（平均宽度）+ 字符类型系数（大写1.1倍）

      // 关键改进：使用Math.hypot计算字体大小（更准确）
      const fontSize = Math.hypot(transform[0], transform[1]);
      
      // 【终极精准修复】字符宽度计算（解决x坐标偏移的核心问题）
      // PDF transform 矩阵：[a, b, c, d, e, f]
      // transform[0] (a): 水平缩放因子
      // transform[4] (e): x坐标（文本起始位置）
      // 
      // 关键理解：
      // 1. item.width 是文本块的实际渲染总宽度（包含所有字符和字符间距）
      // 2. width / str.length 是平均字符宽度，包含了字符间距和字距调整
      // 3. transform[0] 是字体的水平缩放因子，但不包含字符间距
      //
      // 重要发现：对于计算字符位置，width / str.length 更准确！
      // 因为：
      // - transform[0] 只是字体的缩放因子，不包含字符间距
      // - width / str.length 是实际的文本块平均宽度，包含了所有间距信息
      // - 当我们计算 offsetX = charWidth * startChar 时，需要的是包含间距的宽度
      //
      let charWidth: number;
      
      const transformWidth = Math.abs(transform[0]);
      const avgWidth = width && str.length > 0 ? width / str.length : 0;
      
      // 【核心修复】优先使用 width / str.length，因为它包含了字符间距
      // 这是计算字符位置最准确的方法
      if (avgWidth > 0) {
        // 优先使用实际的width计算平均宽度（包含字符间距）
        charWidth = avgWidth;
      } else if (transformWidth > 0) {
        // 备用方案：使用 transform[0]（当 width 不可用时）
        charWidth = transformWidth;
      } else {
        // 最后的备用方案：使用字体大小估算
        charWidth = fontSize * 0.6;
      }
      
      // 【关键修复】计算精确的起始位置和宽度
      // 
      // 问题分析：
      // 1. transform[4] 是文本块的起始x坐标（整个item的起始位置）
      // 2. startChar 是匹配文本在 item.str 中的字符索引
      // 3. 如果使用平均字符宽度计算 offsetX，对于变宽字体会不准确
      //
      // 关键发现：
      // - item.width 是整个文本块的总宽度
      // - width / str.length 是平均字符宽度（包含字符间距）
      // - 对于变宽字体，每个字符的实际宽度可能不同，但平均宽度仍然是最准确的
      // - transform[0] 是字符的水平缩放因子，但不包含字符间距
      //
      // 最佳方案：使用 item.width / str.length 作为字符宽度，因为：
      // 1. 它考虑了实际的字符宽度和字符间距
      // 2. 对于单个 text item 内的部分文本，这是最准确的
      
      // 【精确方法】使用字符级别的信息获取每个字符的实际宽度
      // 优先使用 item.chars 数组（如果PDF.js提供），这是最准确的方法
      
      let offsetX = 0;
      let matchWidth = 0;
      let usingCharLevelInfo = false; // 标记是否使用了字符级别信息
      
      // 检查是否有字符级别的信息
      if (item.chars && Array.isArray(item.chars) && item.chars.length > 0 && item.chars.length === str.length) {
        usingCharLevelInfo = true;
        
        // 【最准确方法】使用每个字符的实际位置和宽度
        // 字符级别信息可以提供每个字符的精确 transform 和 width
        
        // 获取起始字符和结束字符的实际位置
        const startCharInfo = item.chars[startChar];
        const endCharInfo = item.chars[endChar - 1];
        
        if (startCharInfo && endCharInfo) {
          // 方法1：使用字符的 transform[4]（x坐标）直接获取位置
          // 【重要】需要确认：字符的transform[4]是相对于文本块的还是PDF页面的？
          // PDF.js文档显示，字符transform通常是相对于文本块的
          if (startCharInfo.transform && endCharInfo.transform) {
            const startCharTransform = startCharInfo.transform;
            const endCharTransform = endCharInfo.transform;
            
            // 【关键修复】字符的transform[4]是相对于文本块起始位置的偏移
            // 所以 offsetX = 字符transform[4]（相对偏移）
            // 但需要验证这是否正确，有些PDF可能是绝对坐标
            
            // 尝试两种方法，选择更合理的：
            // 方法A：假设字符transform是相对偏移
            const relativeOffsetX = startCharTransform[4];
            const relativeEndX = endCharTransform[4];
            
            // 方法B：尝试作为绝对坐标（如果transform[4]很大，可能是绝对坐标）
            // 如果字符的transform[4]接近item的transform[4]，说明是绝对坐标
            const isAbsolute = Math.abs(startCharTransform[4] - transform[4]) < Math.abs(transform[4]) * 0.1;
            
            if (isAbsolute) {
              // 绝对坐标：直接使用
              offsetX = startCharTransform[4] - transform[4];
              const endCharWidth = endCharInfo.width || Math.abs(endCharTransform[0]) || charWidth;
              matchWidth = (endCharTransform[4] + endCharWidth) - startCharTransform[4];
              console.log(`[高亮计算] 使用绝对坐标模式`);
            } else {
              // 相对坐标：字符transform[4]是相对于文本块的偏移
              offsetX = relativeOffsetX;
              const endCharWidth = endCharInfo.width || Math.abs(endCharTransform[0]) || charWidth;
              matchWidth = (relativeEndX + endCharWidth) - relativeOffsetX;
              console.log(`[高亮计算] 使用相对坐标模式 (offsetX=${offsetX.toFixed(2)})`);
            }
          } 
          // 方法2：如果没有transform，累加宽度
          else {
            // 累加起始字符之前的宽度
        for (let i = 0; i < startChar && i < item.chars.length; i++) {
          const charInfo = item.chars[i];
          if (charInfo && charInfo.width) {
                offsetX += charInfo.width;
          } else if (charInfo && charInfo.transform) {
                offsetX += Math.abs(charInfo.transform[0]);
        } else {
                offsetX += charWidth;
          }
        }
        
            // 累加匹配文本的宽度
        for (let i = startChar; i < endChar && i < item.chars.length; i++) {
          const charInfo = item.chars[i];
          if (charInfo && charInfo.width) {
                matchWidth += charInfo.width;
          } else if (charInfo && charInfo.transform) {
                matchWidth += Math.abs(charInfo.transform[0]);
        } else {
                matchWidth += charWidth;
              }
            }
          }
        } else {
          // 如果字符索引不匹配，回退到平均宽度
          offsetX = charWidth * startChar;
          matchWidth = charWidth * (endChar - startChar);
          usingCharLevelInfo = false;
        }
      } else {
        // 【备用方法】如果没有字符级别信息，使用改进的平均宽度计算
        // 改进：尝试从文本内容计算更准确的宽度
        
        // 如果 width 可用，使用实际测量的宽度
        if (width && str.length > 0) {
          // 使用平均宽度，但考虑实际文本长度
          const actualCharWidth = width / str.length;
          
          // 计算匹配文本部分在实际文本中的比例
          const matchSubstring = str.substring(startChar, endChar);
          const prefixSubstring = str.substring(0, startChar);
          
          // 使用实际宽度比例来计算
          // 假设字符宽度相对均匀，使用比例更准确
          offsetX = (prefixSubstring.length / str.length) * width;
          matchWidth = (matchSubstring.length / str.length) * width;
        } else {
          // 如果没有 width，使用 transform 估算
        offsetX = charWidth * startChar;
        matchWidth = charWidth * (endChar - startChar);
        }
      }
      
      // 【关键理解】PDF坐标系说明：
      // - transform[4] 和 transform[5] 是文本块在PDF页面坐标系中的位置
      // - transform[4] = x坐标（水平位置）
      // - transform[5] = y坐标（垂直位置，PDF坐标系y向上）
      // - 字符的 transform[4]（如果有）是相对于文本块的，还是PDF页面的？需要验证！
      
      // PDF坐标系中的位置
      // transform[4] 是整个文本块的起始位置（PDF页面坐标系）
      // offsetX 是从文本块起始位置到匹配文本起始位置的偏移
      const x = transform[4] + offsetX;
      
      // 【调试】输出关键计算信息
      const matchText = str.substring(startChar, endChar);
      console.log(`[高亮计算] ========== 开始计算高亮 ==========`);
      console.log(`[高亮计算] 匹配文本: "${matchText}"`);
      console.log(`[高亮计算] item.str: "${str}"`);
      console.log(`[高亮计算] startChar: ${startChar}, endChar: ${endChar}`);
      console.log(`[高亮计算] 文本块transform: [${transform.join(', ')}]`);
      console.log(`[高亮计算] transform[4] (item.x): ${transform[4]}, transform[5] (item.y): ${transform[5]}`);
      console.log(`[高亮计算] item.width: ${width}, str.length: ${str.length}`);
      console.log(`[高亮计算] charWidth: ${charWidth}`);
      console.log(`[高亮计算] offsetX: ${offsetX.toFixed(2)}, matchWidth: ${matchWidth.toFixed(2)}`);
      console.log(`[高亮计算] PDF坐标 - x: ${x.toFixed(2)}`);
      console.log(`[高亮计算] 文本块总宽度: ${width.toFixed(2)}, 匹配文本占比: ${((matchWidth / width) * 100).toFixed(1)}%`);
      
      // 如果有字符级别信息，输出字符坐标
      if (usingCharLevelInfo && item.chars && item.chars[startChar] && item.chars[startChar].transform) {
        const charTransform = item.chars[startChar].transform;
        console.log(`[高亮计算] 起始字符transform: [${charTransform.join(', ')}]`);
        console.log(`[高亮计算] 起始字符transform[4] (字符x): ${charTransform[4]}`);
        console.log(`[高亮计算] 字符x vs item.x: ${charTransform[4]} vs ${transform[4]}`);
        console.log(`[高亮计算] 差异: ${charTransform[4] - transform[4]}`);
      }
      
      console.log(`[高亮计算] 使用字符级别信息: ${usingCharLevelInfo ? '是' : '否（使用平均宽度）'}`);
      
      const baselineY = transform[5];  // 基线位置（PDF坐标系，y向上）
      
      // 【关键】检测文本是否旋转（通过transform矩阵）
      // transform = [a, b, c, d, e, f]
      // 如果 b != 0 或 c != 0，说明文本有旋转
      const isRotated = Math.abs(transform[1]) > 0.001 || Math.abs(transform[2]) > 0.001;
      const rotationAngle = isRotated ? Math.atan2(transform[1], transform[0]) * 180 / Math.PI : 0;
      console.log(`[高亮计算] 文本旋转检测: ${isRotated ? '是' : '否'}, 角度: ${rotationAngle.toFixed(1)}°`);
      
      // 关键修正：适配中英文字体的ascent/descent
      // 尝试从 item 中获取字体信息，如果没有则使用经验值
      let ascent = 0.88;    // 默认字体上升部分比例
      let descent = -0.15;  // 默认字体下降部分比例
      
      // 如果 item 中有字体信息，尝试使用
      if (item.fontName) {
        const fontName = item.fontName.toLowerCase();
        // 中文字体通常 ascent 更高
        if (fontName.includes('sim') || fontName.includes('microsoft') || fontName.includes('song') || fontName.includes('hei')) {
          ascent = 0.90;
          descent = -0.12;
        }
      }
      
      // 如果有字符级别的信息，使用第一个字符的高度信息
      if (item.chars && item.chars.length > 0 && startChar < item.chars.length) {
        const charInfo = item.chars[startChar];
        if (charInfo && charInfo.height) {
          // 使用字符的实际高度
          const charHeight = charInfo.height;
          // 通常 ascent 占高度的 80-90%，descent 占 10-20%
          const calculatedAscent = charHeight * 0.85;
          const calculatedDescent = -charHeight * 0.15;
          ascent = calculatedAscent / fontSize;
          descent = calculatedDescent / fontSize;
        }
      }
      
      // 关键修正：正确计算文本的顶部和底部
      // yTop: 基线 + 上升部分（PDF坐标系y向上，所以加法得到顶部）
      // yBottom: 基线 + 下降部分（因为descent是负值，所以实际上是向下）
      let yTop = baselineY + fontSize * ascent;    // 文本顶部（最高点）
      let yBottom = baselineY + fontSize * descent; // 文本底部（最低点，因为descent是负值）
      
      // 【关键修复】对于旋转文本，需要根据旋转角度调整计算方式
      // 如果文本旋转了90度或270度，x和y的对应关系会改变
      if (isRotated) {
        // 对于旋转文本，可能需要使用不同的计算方法
        // 但先尝试标准的转换，看是否有效
        console.log(`[高亮计算] 旋转文本处理: transform[1]=${transform[1]}, transform[2]=${transform[2]}`);
        
        // 如果是90度旋转（transform[1] > 0），文本是从上到下
        // 如果是-90度旋转（transform[1] < 0），文本是从下到上
        // 对于旋转文本，可能需要交换宽度和高度的计算
      }

      // 【关键】四个角点转换到viewport坐标（完美支持任意旋转）
      // viewport.convertToViewportPoint 将PDF坐标转换为canvas坐标
      // 注意：对于旋转文本，需要使用transform矩阵来计算正确的角点
      // isRotated 变量已在上面声明（第1088行），这里直接使用
      
      console.log(`[高亮计算] 文本是否旋转: ${isRotated}, transform矩阵: [${transform[0]}, ${transform[1]}, ${transform[2]}, ${transform[3]}]`);
      
      let p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number];
      
      if (isRotated) {
        // 【旋转文本】使用transform矩阵计算匹配文本的四个角点
        // transform = [a, b, c, d, e, f]
        // 对于旋转90度的文本：[0, 18, -18, 0, e, f]
        // transform[0,1] = [0, 18] 是文本宽度方向（垂直向上）
        // transform[2,3] = [-18, 0] 是文本高度方向（水平向左）
        
        // 【关键】计算文本块的高度（字符高度）
        // 对于旋转文本，高度方向是 transform[2,3]，我们需要计算高度方向向量长度
        const heightDirectionLength = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
        const textBlockHeight = fontSize * (ascent - descent);
        
        console.log(`[高亮计算] 旋转文本计算参数:`);
        console.log(`[高亮计算]   offsetX: ${offsetX.toFixed(2)}, matchWidth: ${matchWidth.toFixed(2)}`);
        console.log(`[高亮计算]   textBlockHeight: ${textBlockHeight.toFixed(2)}`);
        console.log(`[高亮计算]   高度方向向量长度: ${heightDirectionLength.toFixed(2)}`);
        console.log(`[高亮计算]   transform[0,1]: [${transform[0]}, ${transform[1]}] (宽度方向)`);
        console.log(`[高亮计算]   transform[2,3]: [${transform[2]}, ${transform[3]}] (高度方向)`);
        
        // 【关键修复】对于旋转文本，offsetX和matchWidth的单位转换
        // 问题：offsetX和matchWidth是基于item.width计算的，但item.width是文本块在文本宽度方向的总长度
        // 对于旋转90度的文本，transform[0,1] = [0, 18] 表示每个字符在宽度方向上移动18个单位
        // 但是，offsetX和matchWidth已经是基于width的比例计算的，所以它们已经是正确的单位了
        
        // 【关键】计算文本宽度方向的单位向量长度（字符宽度）
        const widthDirectionLength = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
        console.log(`[高亮计算]   宽度方向向量长度: ${widthDirectionLength.toFixed(2)}`);
        console.log(`[高亮计算]   文本块总宽度: ${width.toFixed(2)}, 字符数: ${str.length}`);
        
        // 【关键理解】对于旋转文本：
        // - offsetX和matchWidth是基于width的比例计算的，单位是"文本宽度方向的单位"
        // - transform[0,1] = [0, 18] 表示宽度方向的单位向量，长度是18
        // - 但是，当我们用 transform[1] * matchWidth 时，我们实际上是在计算 18 * matchWidth
        // - 这是错误的！因为matchWidth已经是正确的单位了，不需要再乘以18
        
        // 【关键修复】对于旋转文本，offsetX和matchWidth已经是正确的单位
        // 但是，我们需要将它们转换为在transform坐标系中的正确偏移
        // 方法：直接使用offsetX和matchWidth，因为它们已经是基于width的比例计算的
        
        // 底部起始点（基线）：文本块起始位置 + 宽度方向偏移
        // 注意：offsetX已经是基于width的比例，所以直接使用即可
        const matchBottomStartX = transform[4] + (transform[0] / widthDirectionLength) * offsetX;
        const matchBottomStartY = transform[5] + (transform[1] / widthDirectionLength) * offsetX;
        
        // 底部结束点（基线）：文本块起始位置 + 宽度方向偏移 + 匹配文本宽度
        // 注意：matchWidth已经是基于width的比例，所以直接使用即可
        const matchBottomEndX = transform[4] + (transform[0] / widthDirectionLength) * (offsetX + matchWidth);
        const matchBottomEndY = transform[5] + (transform[1] / widthDirectionLength) * (offsetX + matchWidth);
        
        console.log(`[高亮计算]   使用offsetX: ${offsetX.toFixed(2)}, matchWidth: ${matchWidth.toFixed(2)}`);
        
        // 【调试】验证计算
        const bottomLength = Math.sqrt(
          Math.pow(matchBottomEndX - matchBottomStartX, 2) + 
          Math.pow(matchBottomEndY - matchBottomStartY, 2)
        );
        console.log(`[高亮计算]   底部长度验证: ${bottomLength.toFixed(2)} (期望: ${matchWidth.toFixed(2)})`);
        
        // 【关键修复】顶部起始点（基线 + 高度方向）：底部起始点 + 高度方向偏移
        // 对于旋转文本，高度方向是 transform[2,3]，我们需要使用单位向量
        // textBlockHeight 是字符高度，需要转换为在高度方向上的正确偏移
        const heightOffset = textBlockHeight; // 字符高度
        const matchTopStartX = matchBottomStartX + (transform[2] / heightDirectionLength) * heightOffset;
        const matchTopStartY = matchBottomStartY + (transform[3] / heightDirectionLength) * heightOffset;
        
        // 顶部结束点：底部结束点 + 高度方向偏移
        const matchTopEndX = matchBottomEndX + (transform[2] / heightDirectionLength) * heightOffset;
        const matchTopEndY = matchBottomEndY + (transform[3] / heightDirectionLength) * heightOffset;
        
        // 【调试】验证高度计算
        const heightLength = Math.sqrt(
          Math.pow(matchTopStartX - matchBottomStartX, 2) + 
          Math.pow(matchTopStartY - matchBottomStartY, 2)
        );
        console.log(`[高亮计算]   高度长度验证: ${heightLength.toFixed(2)} (期望: ${textBlockHeight.toFixed(2)})`);
        
        console.log(`[高亮计算] 旋转文本 - 使用transform矩阵直接计算匹配文本角点:`);
        console.log(`[高亮计算]   底部起始: (${matchBottomStartX.toFixed(2)}, ${matchBottomStartY.toFixed(2)})`);
        console.log(`[高亮计算]   底部结束: (${matchBottomEndX.toFixed(2)}, ${matchBottomEndY.toFixed(2)})`);
        console.log(`[高亮计算]   底部长度: ${Math.sqrt(Math.pow(matchBottomEndX - matchBottomStartX, 2) + Math.pow(matchBottomEndY - matchBottomStartY, 2)).toFixed(2)}`);
        console.log(`[高亮计算]   顶部起始: (${matchTopStartX.toFixed(2)}, ${matchTopStartY.toFixed(2)})`);
        console.log(`[高亮计算]   顶部结束: (${matchTopEndX.toFixed(2)}, ${matchTopEndY.toFixed(2)})`);
        
        // 转换到viewport坐标
        p1 = viewport.convertToViewportPoint(matchTopStartX, matchTopStartY);     // 顶部起始
        p2 = viewport.convertToViewportPoint(matchTopEndX, matchTopEndY);         // 顶部结束
        p3 = viewport.convertToViewportPoint(matchBottomStartX, matchBottomStartY); // 底部起始
        p4 = viewport.convertToViewportPoint(matchBottomEndX, matchBottomEndY);     // 底部结束
      } else {
        // 【非旋转文本】使用简单的矩形计算
        // PDF坐标系中的匹配文本位置
        const matchX = transform[4] + offsetX;  // 文本块的x + 偏移
        const matchYTop = yTop;    // 文本顶部
        const matchYBottom = yBottom; // 文本底部
        
        console.log(`[高亮计算] 非旋转文本 - 简单矩形计算:`);
        console.log(`[高亮计算]   matchX: ${matchX.toFixed(2)}, matchWidth: ${matchWidth.toFixed(2)}`);
        console.log(`[高亮计算]   matchYTop: ${matchYTop.toFixed(2)}, matchYBottom: ${matchYBottom.toFixed(2)}`);
        
        // 【关键修复】对于非旋转文本，尝试使用字符级别信息提高精度
        // 即使之前检测到字符级别信息不可用，也可能在某些情况下部分可用
        if (item.chars && item.chars.length > 0 && startChar < item.chars.length && endChar <= item.chars.length) {
          // 尝试使用字符级别的信息来更精确地计算
          let preciseOffsetX = 0;
          let preciseMatchWidth = 0;
          let usingPreciseCalc = false;
          
          // 累加起始字符之前的宽度
          for (let i = 0; i < startChar && i < item.chars.length; i++) {
            const charInfo = item.chars[i];
            if (charInfo && charInfo.width) {
              preciseOffsetX += charInfo.width;
              usingPreciseCalc = true;
            } else if (charInfo && charInfo.transform) {
              preciseOffsetX += Math.abs(charInfo.transform[0]);
              usingPreciseCalc = true;
            }
          }
          
          // 累加匹配文本的宽度
          for (let i = startChar; i < endChar && i < item.chars.length; i++) {
            const charInfo = item.chars[i];
            if (charInfo && charInfo.width) {
              preciseMatchWidth += charInfo.width;
              usingPreciseCalc = true;
            } else if (charInfo && charInfo.transform) {
              preciseMatchWidth += Math.abs(charInfo.transform[0]);
              usingPreciseCalc = true;
            }
          }
          
          if (usingPreciseCalc && preciseMatchWidth > 0) {
            console.log(`[高亮计算]   使用字符级别精确计算: offsetX=${preciseOffsetX.toFixed(2)}, matchWidth=${preciseMatchWidth.toFixed(2)}`);
            const preciseMatchX = transform[4] + preciseOffsetX;
            p1 = viewport.convertToViewportPoint(preciseMatchX, matchYTop);                    // 左上
            p2 = viewport.convertToViewportPoint(preciseMatchX + preciseMatchWidth, matchYTop);       // 右上
            p3 = viewport.convertToViewportPoint(preciseMatchX, matchYBottom);                 // 左下
            p4 = viewport.convertToViewportPoint(preciseMatchX + preciseMatchWidth, matchYBottom);   // 右下
          } else {
            // 回退到平均宽度计算
            p1 = viewport.convertToViewportPoint(matchX, matchYTop);                    // 左上
            p2 = viewport.convertToViewportPoint(matchX + matchWidth, matchYTop);       // 右上
            p3 = viewport.convertToViewportPoint(matchX, matchYBottom);                 // 左下
            p4 = viewport.convertToViewportPoint(matchX + matchWidth, matchYBottom);   // 右下
          }
        } else {
          // 转换到viewport坐标（四个角点）
          p1 = viewport.convertToViewportPoint(matchX, matchYTop);                    // 左上
          p2 = viewport.convertToViewportPoint(matchX + matchWidth, matchYTop);       // 右上
          p3 = viewport.convertToViewportPoint(matchX, matchYBottom);                 // 左下
          p4 = viewport.convertToViewportPoint(matchX + matchWidth, matchYBottom);   // 右下
        }
      }
      
      console.log(`[高亮计算] Viewport转换结果:`);
      console.log(`[高亮计算]   p1 (左上/顶部起始): (${p1[0].toFixed(2)}, ${p1[1].toFixed(2)})`);
      console.log(`[高亮计算]   p2 (右上/顶部结束): (${p2[0].toFixed(2)}, ${p2[1].toFixed(2)})`);
      console.log(`[高亮计算]   p3 (左下/底部起始): (${p3[0].toFixed(2)}, ${p3[1].toFixed(2)})`);
      console.log(`[高亮计算]   p4 (右下/底部结束): (${p4[0].toFixed(2)}, ${p4[1].toFixed(2)})`);

      const xs = [p1[0], p2[0], p3[0], p4[0]];
      const ys = [p1[1], p2[1], p3[1], p4[1]];

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // 确保宽度和高度不为0（至少1像素）
      let rectWidth = Math.max(1, maxX - minX);
      let rectHeight = Math.max(1, maxY - minY);
      
      // 【关键修复】裁剪到Canvas边界内
      // 使用 Math.floor 确保坐标是整数，避免四舍五入后超出边界
      let rectX = Math.floor(minX);
      let rectY = Math.floor(minY);
      
      // 确保 x 和 y 在边界内
      if (rectX < 0) {
        rectWidth += rectX; // 减少宽度（rectX是负数）
        rectX = 0;
      }
      if (rectY < 0) {
        rectHeight += rectY; // 减少高度（rectY是负数）
        rectY = 0;
      }
      
      // 确保宽度和高度仍然有效
      rectWidth = Math.max(1, Math.floor(rectWidth));
      rectHeight = Math.max(1, Math.floor(rectHeight));
      
      // 确保右边界不超出
      const canvasWidth = Math.floor(viewport.width);
      const canvasHeight = Math.floor(viewport.height);
      
      if (rectX + rectWidth > canvasWidth) {
        rectWidth = Math.max(1, canvasWidth - rectX);
      }
      if (rectY + rectHeight > canvasHeight) {
        rectHeight = Math.max(1, canvasHeight - rectY);
      }
      
      // 确保裁剪后仍然有效
      if (rectWidth <= 0 || rectHeight <= 0 || rectX < 0 || rectY < 0) {
        console.warn(`[高亮计算] ⚠️ 裁剪后矩形无效，跳过绘制`);
        return rects; // 跳过这个矩形
      }
      
      // 最终验证：确保不超出边界
      if (rectX + rectWidth > canvasWidth || rectY + rectHeight > canvasHeight) {
        console.warn(`[高亮计算] ⚠️ 最终验证失败，跳过绘制`);
        return rects;
      }

      console.log(`[高亮计算] Viewport矩形（裁剪前）: x=${minX.toFixed(2)}, y=${minY.toFixed(2)}, width=${(maxX - minX).toFixed(2)}, height=${(maxY - minY).toFixed(2)}`);
      console.log(`[高亮计算] Viewport矩形（裁剪后）: x=${rectX.toFixed(2)}, y=${rectY.toFixed(2)}, width=${rectWidth.toFixed(2)}, height=${rectHeight.toFixed(2)}`);
      console.log(`[高亮计算] Viewport尺寸: width=${viewport.width}, height=${viewport.height}`);
      console.log(`[高亮计算] ========== 高亮计算完成 ==========`);

      rects.push({
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
      });
    }

    return rects;
  };

  /**
   * 【主函数】高亮计算函数 - 使用textContent方法
   */
  const getHighlightRects = async (
    page: any,
    matches: Array<{ item: any; startChar: number; endChar: number }>,
    scale: number,
    rotation: number
  ): Promise<HighlightRect[]> => {
    // 直接使用textContent方法（文本层方法已禁用，因为它不准确）
    const rects = await getHighlightRectsFromTextContent(page, matches, scale, rotation);
    console.log(`[高亮计算] 使用textContent方法，找到 ${rects.length} 个高亮矩形`);
    return rects;
  };

  /**
   * 检查文本是否匹配（支持整词匹配和区分大小写）
   */
  const isTextMatch = (
    text: string,
    query: string,
    matchCase: boolean,
    wholeWords: boolean,
    position: number
  ): boolean => {
    // 准备查询文本和目标文本
    const queryText = matchCase ? query : query.toLowerCase();
    const targetText = matchCase ? text : text.toLowerCase();

    // 检查位置是否匹配
    if (position + queryText.length > targetText.length) {
      return false;
    }

    const matchText = targetText.substring(position, position + queryText.length);
    
    // 基本匹配检查
    if (matchText !== queryText) {
      return false;
    }

    // 整词匹配检查
    if (wholeWords) {
      // 检查前面是否是单词边界
      const prevChar = position > 0 ? targetText[position - 1] : ' ';
      const nextChar = position + queryText.length < targetText.length 
        ? targetText[position + queryText.length] 
        : ' ';
      
      // 单词边界：非字母、数字、下划线、连字符
      const wordBoundaryRegex = /[^\w\-]/;
      
      const isPrevBoundary = wordBoundaryRegex.test(prevChar);
      const isNextBoundary = wordBoundaryRegex.test(nextChar);
      
      return isPrevBoundary && isNextBoundary;
    }

    return true;
  };

  /**
   * 在文本中查找所有匹配位置（支持精确匹配选项）
   */
  const findAllMatches = (
    text: string,
    query: string,
    matchCase: boolean,
    wholeWords: boolean
  ): number[] => {
    const matches: number[] = [];
    const queryText = matchCase ? query : query.toLowerCase();
    const targetText = matchCase ? text : text.toLowerCase();
    
    if (!queryText) return matches;

    let searchIndex = 0;
    while (searchIndex < targetText.length) {
      const index = targetText.indexOf(queryText, searchIndex);
      if (index === -1) break;

      // 检查是否匹配（整词匹配检查）
      if (isTextMatch(text, query, matchCase, wholeWords, index)) {
        matches.push(index);
        searchIndex = index + 1;
      } else {
        searchIndex = index + 1;
      }
    }

    return matches;
  };

  /**
   * 执行搜索（支持精确匹配选项）
   */
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
      if (!query) {
        setSearchResults([]);
        setHighlights(new Map());
        return;
      }

      const results: TextMatch[] = [];
      const newHighlights = new Map<number, HighlightRect[]>();

      for (let i = 1; i <= pdfInstance.numPages; i++) {
        const page = await pdfInstance.getPage(i);
        
        // 【关键】使用终极提取方法获取真实可搜索文本（完美支持中文CID字体）
        const pageText = await extractSearchableText(page);

        // 【关键优化】先获取 textContent（只获取一次，提高性能）
        // 启用字符级别信息以获取精确的位置和宽度
        const textContent = await page.getTextContent({
          normalizeWhitespace: false, // 不规范化空白，保持原始间距
          disableCombineTextItems: false, // 先尝试false，如果需要字符级别信息再改
          // 注意：PDF.js 4.x 可能不支持 includeCharInfo 等选项，需要检查
        });
        
        // 尝试获取字符级别信息（如果PDF.js支持）
        // 某些版本可能需要单独调用 getTextContent 多次或使用不同选项
        let charLevelInfoAvailable = false;
        if (textContent.items && textContent.items.length > 0) {
          const firstItem = textContent.items[0];
          if (firstItem && firstItem.chars && Array.isArray(firstItem.chars) && firstItem.chars.length > 0) {
            charLevelInfoAvailable = true;
            console.log(`[搜索] 检测到字符级别信息可用: ${firstItem.chars.length} 个字符`);
          } else {
            console.log(`[搜索] 字符级别信息不可用，将使用item级别的信息`);
          }
        }

        // 【核心修复】优先直接在 textContent.items 中查找匹配（最准确！）
        // 这样可以避免 extractSearchableText 和 textContent 文本对齐的问题
        // 但如果 textContent.items[].str 是乱码（中文CID字体），则回退到 extractSearchableText
        
        // 检查 textContent.items 的文本是否可用（不是乱码）
        const textContentSample = textContent.items
          .slice(0, Math.min(10, textContent.items.length))
          .map((item: any) => item.str || "")
          .join("");
        const isTextContentUsable = textContentSample.length > 0 && 
          (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(textContentSample) && 
           !/[\u0000-\u001F\u007F-\u009F]/.test(textContentSample)); // 检查是否有乱码字符

        let matchIndex = 0;
        const pageRects: HighlightRect[] = [];
        
        if (isTextContentUsable) {
          // 方案1：textContent.items 的文本可用，直接在其中查找（最准确！）
          // 这样完全避免了文本对齐问题
          
          for (let j = 0; j < textContent.items.length; j++) {
            const item = textContent.items[j];
            const itemText = item.str || "";
            
            if (!itemText || itemText.length === 0) continue;
            
            // 使用新的精确匹配函数查找所有匹配位置
            const matchPositions = findAllMatches(itemText, query, matchCase, wholeWords);
            
            // 处理每个匹配
            for (const matchPos of matchPositions) {
              const startChar = matchPos;
              const endChar = Math.min(itemText.length, matchPos + query.length);
              
              const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [
                { item, startChar, endChar }
              ];
              
              // 计算高亮矩形
              const rects = await getHighlightRects(page, matchingItems, scale, rotation);
              pageRects.push(...rects);
              
              // 添加搜索结果（用于预览）
              const preview = itemText.substring(
                Math.max(0, matchPos - 30),
                Math.min(itemText.length, matchPos + query.length + 30)
              );
              results.push({ page: i, preview, matchIndex: matchIndex++ });
            }
          }
        } else {
          // 方案2：textContent.items 是乱码，使用 extractSearchableText 的结果（中文PDF）
          // 使用精确匹配函数查找所有匹配
          const matchPositions = findAllMatches(pageText, query, matchCase, wholeWords);
          
          // 构建 textContent 的完整文本（用于定位）
          const textContentText = textContent.items
            .map((item: any) => item.str || "")
            .join("");
          
          // 处理每个匹配位置
          for (const matchPos of matchPositions) {
            // 在 textContentText 中查找对应的位置
            // 由于 textContentText 可能是乱码，我们需要通过字符位置来映射
              let accumulatedCharPos = 0;
            let foundInItem = false;
              
              for (let j = 0; j < textContent.items.length; j++) {
                const item = textContent.items[j];
                const itemText = item.str || "";
                
              if (!itemText || itemText.length === 0) {
                // 空项仍计入位置
                accumulatedCharPos += 1;
                continue;
              }
                
                const itemStart = accumulatedCharPos;
                const itemEnd = accumulatedCharPos + itemText.length;
                
              // 检查匹配是否在这个 item 的范围内
              if (matchPos >= itemStart && matchPos < itemEnd) {
                const relativeStart = matchPos - itemStart;
                const relativeEnd = Math.min(itemText.length, relativeStart + query.length);
                
                const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [
                  { item, startChar: relativeStart, endChar: relativeEnd }
                ];
                
                // 计算高亮矩形
                const rects = await getHighlightRects(page, matchingItems, scale, rotation);
                pageRects.push(...rects);
                
                // 添加搜索结果（用于预览）
                const preview = pageText.substring(
                  Math.max(0, matchPos - 30),
                  Math.min(pageText.length, matchPos + query.length + 30)
                );
                results.push({ page: i, preview, matchIndex: matchIndex++ });
                
                foundInItem = true;
                    break;
                }
                
                accumulatedCharPos = itemEnd;
              if (j < textContent.items.length - 1) {
                accumulatedCharPos += 1; // 项之间的分隔
              }
            }
            
            // 如果没找到对应的 item，仍然添加结果（可能跨多个 item）
            if (!foundInItem) {
            const preview = pageText.substring(
                Math.max(0, matchPos - 30),
                Math.min(pageText.length, matchPos + query.length + 30)
            );
            results.push({ page: i, preview, matchIndex: matchIndex++ });
          }
          }
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
      setError("搜索时发生错误，该PDF可能使用了特殊字体");
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

  // 保存并下载高亮层
  const handleDownloadHighlights = async () => {
    if (!canvasRef.current || !highlightLayerRef.current || !pdfInstance) {
      alert("请先加载PDF并搜索文本");
      return;
    }

    try {
      const pdfCanvas = canvasRef.current;
      const highlightCanvas = highlightLayerRef.current;
      
      // 创建一个新的canvas来合并PDF和高亮层
      const mergedCanvas = document.createElement("canvas");
      mergedCanvas.width = pdfCanvas.width;
      mergedCanvas.height = pdfCanvas.height;
      const ctx = mergedCanvas.getContext("2d");
      
      if (!ctx) {
        alert("无法创建画布上下文");
        return;
      }

      // 先绘制PDF内容
      ctx.drawImage(pdfCanvas, 0, 0);
      
      // 再绘制高亮层（叠加）
      ctx.drawImage(highlightCanvas, 0, 0);

      // 转换为图片并下载
      mergedCanvas.toBlob((blob) => {
        if (!blob) {
          alert("无法生成图片");
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName ? fileName.replace('.pdf', '') : 'pdf'}_highlighted_${currentPage}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("下载高亮层失败:", error);
      alert("下载失败，请重试");
    }
  };

  // 下载所有页面的高亮层（合并为一张大图）
  const handleDownloadAllHighlights = async () => {
    if (!pdfInstance || highlights.size === 0) {
      alert("请先搜索文本以生成高亮");
      return;
    }

    try {
      const totalPages = pdfInstance.numPages;
      
      // 计算总高度（所有页面）
      let totalHeight = 0;
      const pageCanvases: HTMLCanvasElement[] = [];
      const highlightCanvases: HTMLCanvasElement[] = [];
      const pageHeights: number[] = [];
      const pageWidths: number[] = [];
      
      // 渲染所有页面
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfInstance.getPage(i);
        const viewport = page.getViewport({ scale, rotation });
        
        // 创建PDF canvas
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        const pageCtx = pageCanvas.getContext("2d");
        
        if (!pageCtx) continue;
        
        await page.render({ canvasContext: pageCtx, viewport }).promise;
        pageCanvases.push(pageCanvas);
        pageWidths.push(viewport.width);
        pageHeights.push(viewport.height);
        totalHeight += viewport.height;

        // 创建高亮canvas
        const highlightCanvas = document.createElement("canvas");
        highlightCanvas.width = viewport.width;
        highlightCanvas.height = viewport.height;
        const highlightCtx = highlightCanvas.getContext("2d");
        
        if (highlightCtx) {
          // 绘制该页的高亮
          const pageHighlights = highlights.get(i);
          if (pageHighlights && pageHighlights.length > 0) {
            highlightCtx.fillStyle = "rgba(255, 240, 0, 0.35)";
            highlightCtx.imageSmoothingEnabled = true;
            highlightCtx.imageSmoothingQuality = "high";
            
            for (const rect of pageHighlights) {
              let x = Math.floor(rect.x);
              let y = Math.floor(rect.y);
              let width = Math.max(1, Math.floor(rect.width));
              let height = Math.max(1, Math.floor(rect.height));
              
              // 边界检查
              if (x < 0) {
                width += x;
                x = 0;
              }
              if (y < 0) {
                height += y;
                y = 0;
              }
              if (x + width > viewport.width) {
                width = Math.max(1, viewport.width - x);
              }
              if (y + height > viewport.height) {
                height = Math.max(1, viewport.height - y);
              }
              
              if (width > 0 && height > 0 && x >= 0 && y >= 0) {
                if (highlightCtx.roundRect) {
                  highlightCtx.beginPath();
                  highlightCtx.roundRect(x, y, width, height, 2);
                  highlightCtx.fill();
                } else {
                  highlightCtx.fillRect(x, y, width, height);
                }
              }
            }
          }
        }
        highlightCanvases.push(highlightCanvas);
      }

      // 创建合并canvas
      const maxWidth = Math.max(...pageWidths);
      const mergedCanvas = document.createElement("canvas");
      mergedCanvas.width = maxWidth;
      mergedCanvas.height = totalHeight;
      const ctx = mergedCanvas.getContext("2d");
      
      if (!ctx) {
        alert("无法创建画布上下文");
        return;
      }

      // 绘制所有页面（PDF + 高亮）
      let currentY = 0;
      for (let i = 0; i < pageCanvases.length; i++) {
        // 绘制PDF
        ctx.drawImage(pageCanvases[i], 0, currentY);
        // 绘制高亮层
        if (highlightCanvases[i]) {
          ctx.drawImage(highlightCanvases[i], 0, currentY);
        }
        currentY += pageHeights[i];
      }

      // 下载
      mergedCanvas.toBlob((blob) => {
        if (!blob) {
          alert("无法生成图片");
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName ? fileName.replace('.pdf', '') : 'pdf'}_all_highlights.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("下载所有高亮层失败:", error);
      alert("下载失败，请重试");
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
          {highlights.size > 0 && (
            <>
              <button 
                onClick={handleDownloadHighlights} 
                className={buttonClass}
                title="下载当前页面的高亮层"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDownloadAllHighlights} 
                className={buttonClass}
                title="下载所有页面的高亮层"
              >
                <Download className="w-4 h-4" /> 全部
              </button>
            </>
          )}
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

        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
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
          {/* 精确匹配选项 */}
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span>区分大小写</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              <input
                type="checkbox"
                checked={wholeWords}
                onChange={(e) => setWholeWords(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span>整词匹配（精确）</span>
            </label>
          </div>
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
                    // 【关键修复】删除 width/height 绑定，让 syncHighlightCanvasSize 完全接管尺寸
                    // width 和 height 由 syncHighlightCanvasSize 函数在渲染时动态设置
                    imageRendering: "crisp-edges"  // 使用 crisp-edges 使高亮边缘更锐利
                  }}
                />
                {/* 【方法3】文本层容器（隐藏，用于获取精确字符位置） */}
                <div 
                  ref={textLayerRef}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{
                    opacity: 0,
                    visibility: 'hidden',
                    zIndex: -1,
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

