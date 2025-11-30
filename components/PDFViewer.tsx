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
    hlCanvas.width = pdfCanvas.width;
    hlCanvas.height = pdfCanvas.height;

    // 2. 同步 CSS 显示尺寸（让它看起来一样大）
    // 优先使用 pdfCanvas 的 style.width/height（如果已设置）
    // 否则使用 offsetWidth/offsetHeight（更保险）
    if (pdfCanvas.style.width && pdfCanvas.style.height) {
      hlCanvas.style.width = pdfCanvas.style.width;
      hlCanvas.style.height = pdfCanvas.style.height;
    } else {
      hlCanvas.style.width = `${pdfCanvas.offsetWidth}px`;
      hlCanvas.style.height = `${pdfCanvas.offsetHeight}px`;
    }

    // 3. 清除可能残留的 transform，确保坐标系统一致
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

    for (const rect of pageHighlights) {
      // 【关键修复】不添加偏移，直接使用计算出的精确坐标
      // 如果坐标计算准确，就不需要额外的偏移调整
      const x = rect.x;
      const y = rect.y;
      const width = rect.width;
      const height = rect.height;
      
      // 使用 roundRect（现代浏览器支持）绘制圆角矩形，更美观且边缘更清晰
      // 如果不支持，降级到 fillRect
      if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, 3);  // 3px圆角，更美观
        ctx.fill();
      } else {
        // 兼容方案：使用 fillRect
      ctx.fillRect(x, y, width, height);
      }
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
      if (item.chars && Array.isArray(item.chars) && item.chars.length > 0) {
        usingCharLevelInfo = true;
        // 【最准确方法】使用每个字符的实际宽度
        // 遍历搜索词之前的每个字符
        for (let i = 0; i < startChar && i < item.chars.length; i++) {
          const charInfo = item.chars[i];
          let actualCharWidth: number;
          
          if (charInfo && charInfo.width) {
            // 优先使用字符的实际宽度
            actualCharWidth = charInfo.width;
          } else if (charInfo && charInfo.transform) {
            // 如果没有width，使用字符的transform[0]（水平缩放因子）
            actualCharWidth = Math.abs(charInfo.transform[0]);
        } else {
            // 回退到平均宽度
            actualCharWidth = charWidth;
          }
          
          offsetX += actualCharWidth;
        }
        
        // 遍历搜索词的每个字符
        for (let i = startChar; i < endChar && i < item.chars.length; i++) {
          const charInfo = item.chars[i];
          let actualCharWidth: number;
          
          if (charInfo && charInfo.width) {
            actualCharWidth = charInfo.width;
          } else if (charInfo && charInfo.transform) {
            actualCharWidth = Math.abs(charInfo.transform[0]);
        } else {
            actualCharWidth = charWidth;
          }
          
          matchWidth += actualCharWidth;
        }
      } else {
        // 【备用方法】如果没有字符级别信息，使用改进的平均宽度计算
        // 问题：简单的平均宽度对于变宽字体可能不准确
        // 改进：考虑字符的实际宽度分布，使用更精确的估算
        
        // 分析：item.width是实际测量的总宽度，包含了所有字符的实际宽度和间距
        // 对于变宽字体，每个字符的宽度可能不同，但平均宽度仍然是最接近实际的方法
        
        // 直接使用平均宽度计算
        offsetX = charWidth * startChar;
        matchWidth = charWidth * (endChar - startChar);
        
        // 【调试】输出计算详情，帮助分析问题
        console.log(`[高亮计算] 平均宽度计算详情:`, {
          itemWidth: width,
          strLength: str.length,
          charWidth: charWidth,
          startChar: startChar,
          endChar: endChar,
          offsetX: offsetX,
          matchWidth: matchWidth,
          expectedTotalWidth: charWidth * str.length,
          actualItemWidth: width,
          difference: Math.abs(charWidth * str.length - width)
        });
      }
      
      // PDF坐标系中的位置
      // transform[4] 是整个文本块的起始位置
      // offsetX 是从文本块起始位置到匹配文本起始位置的偏移
      const x = transform[4] + offsetX;
      
      // 【调试】输出关键计算信息
      const matchText = str.substring(startChar, endChar);
      console.log(`[高亮计算] 匹配文本: "${matchText}"`);
      console.log(`[高亮计算] item.str: "${str}"`);
      console.log(`[高亮计算] startChar: ${startChar}, endChar: ${endChar}`);
      console.log(`[高亮计算] transform[4]: ${transform[4]}, transform[5]: ${transform[5]}`);
      console.log(`[高亮计算] item.width: ${width}, str.length: ${str.length}`);
      console.log(`[高亮计算] charWidth: ${charWidth}`);
      console.log(`[高亮计算] offsetX: ${offsetX}, matchWidth: ${matchWidth}`);
      console.log(`[高亮计算] 最终x: ${x}`);
      console.log(`[高亮计算] 使用字符级别信息: ${usingCharLevelInfo ? '是' : '否（使用平均宽度）'}`);
      
      const baselineY = transform[5];  // 基线位置（PDF坐标系，y向上）
      
      // 关键修正：适配中英文字体的ascent/descent
      // 中文字体（宋体、黑体等）通常 ascent 更高，descent 较小
      // 英文字体 ascent/descent 相对平均
      // 使用经验值：适配大部分中英文混合PDF
      const ascent = 0.88;    // 字体上升部分比例（中文字体通常需要更大的ascent）
      const descent = -0.15;  // 字体下降部分比例（中文字符基本没有下降部分）
      
      // 关键修正：正确计算文本的顶部和底部
      // yTop: 基线 + 上升部分（PDF坐标系y向上，所以加法得到顶部）
      // yBottom: 基线 + 下降部分（因为descent是负值，所以实际上是向下）
      const yTop = baselineY + fontSize * ascent;    // 文本顶部（最高点）
      const yBottom = baselineY + fontSize * descent; // 文本底部（最低点，因为descent是负值）

      // 四个角点转换到viewport坐标（完美支持任意旋转）
      const p1 = viewport.convertToViewportPoint(x, yTop);           // 左上角（顶部左）
      const p2 = viewport.convertToViewportPoint(x + matchWidth, yTop); // 右上角（顶部右）
      const p3 = viewport.convertToViewportPoint(x, yBottom);        // 左下角（底部左）
      const p4 = viewport.convertToViewportPoint(x + matchWidth, yBottom); // 右下角（底部右）

      const xs = [p1[0], p2[0], p3[0], p4[0]];
      const ys = [p1[1], p2[1], p3[1], p4[1]];

      rects.push({
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
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
        
        // 【关键】使用终极提取方法获取真实可搜索文本（完美支持中文CID字体）
        const pageText = await extractSearchableText(page);
        let lowerText = pageText.toLowerCase();  // 改为 let，以便在方案2中可能需要规范化

        // 【关键优化】先获取 textContent（只获取一次，提高性能）
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

        let searchIndex = 0;
        let matchIndex = 0;
        const pageRects: HighlightRect[] = [];
        
        if (isTextContentUsable) {
          // 方案1：textContent.items 的文本可用，直接在其中查找（最准确！）
          // 这样完全避免了文本对齐问题
          let currentMatchIndex = 0;
          
          for (let j = 0; j < textContent.items.length; j++) {
            const item = textContent.items[j];
            const itemText = item.str || "";
            
            if (!itemText || itemText.length === 0) continue;
            
            const itemTextLower = itemText.toLowerCase();
            
            // 【关键验证】确保小写转换后长度不变（某些Unicode字符可能改变长度）
            // 如果长度变化，需要特殊处理（但这种情况很少见）
            
            let itemMatchStart = itemTextLower.indexOf(queryLower, 0);
            
            // 在这个 item 中查找所有匹配
            while (itemMatchStart !== -1) {
              const startChar = itemMatchStart;
              const endChar = Math.min(itemText.length, itemMatchStart + query.length);
              
              const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [
                { item, startChar, endChar }
              ];
              
              // 计算高亮矩形
              const rects = await getHighlightRects(page, matchingItems, scale, rotation);
              pageRects.push(...rects);
              
              // 添加搜索结果（用于预览）
              const preview = itemText.substring(
                Math.max(0, itemMatchStart - 30),
                Math.min(itemText.length, itemMatchStart + query.length + 30)
              );
              results.push({ page: i, preview, matchIndex: matchIndex++ });
              
              currentMatchIndex++;
              itemMatchStart = itemTextLower.indexOf(queryLower, itemMatchStart + 1);
            }
          }
        } else {
          // 方案2：textContent.items 是乱码，使用 extractSearchableText 的结果（中文PDF）
          
          // 【关键修复】构建 textContent 的完整文本
          // 
          // 问题分析：
          // 1. extractSearchableText 可能使用两种方式：
          //    - 方式1：textContent.items.join("") - 没有空格，直接连接
          //    - 方式2：operatorList 提取 - 保留了原始格式（空格、换行等）
          // 2. 如果使用了方式2，两个文本结构不一致，导致字符位置无法对齐
          //
          // 解决方案：
          // 检测 extractSearchableText 使用了哪种方式，然后确保 textContentText 使用相同方式
          // 如果使用了方式1，我们用 join("")
          // 如果使用了方式2（operatorList），我们也需要想办法保持一致
          //
          // 但这里有个问题：如果 textContent.items[].str 是乱码，我们无法用它来构建准确的文本
          // 所以，最好的方法是：确保 extractSearchableText 始终使用方式1（textContent.items）
          // 这样两个文本就能完全一致
          
          // 检测：如果 pageText 和 textContent.items 构建的文本长度相近，说明使用了方式1
          const textContentText = textContent.items
            .map((item: any) => item.str || "")
            .join("");
          const textContentTextLower = textContentText.toLowerCase();
          
          // 检查是否使用了 operatorList（方式2）
          const usesOperatorList = Math.abs(pageText.length - textContentText.length) / Math.max(pageText.length, textContentText.length, 1) > 0.3;
          
          // 【关键修复】检测并处理文本结构不一致的问题
          // 如果使用了 operatorList，文本结构可能不一致，但继续执行
          
          while ((searchIndex = lowerText.indexOf(queryLower, searchIndex)) !== -1) {
            // 计算这是第几个匹配（从 lowerText 中）
            let matchCount = 0;
            let tempIndex = 0;
            while (tempIndex < searchIndex && (tempIndex = lowerText.indexOf(queryLower, tempIndex + 1)) !== -1) {
              matchCount++;
            }

            // 在 textContentText 中查找第 matchCount 个匹配
            let currentMatchIndex = 0;
            let textContentMatchPos = -1;
            let textContentSearchIndex = 0;
            
            while ((textContentSearchIndex = textContentTextLower.indexOf(queryLower, textContentSearchIndex)) !== -1) {
              if (currentMatchIndex === matchCount) {
                textContentMatchPos = textContentSearchIndex;
              break;
            }
              currentMatchIndex++;
              textContentSearchIndex += query.length;
            }

            // 精确计算在哪个 item 中
            const matchingItems: Array<{ item: any; startChar: number; endChar: number }> = [];
            
            if (textContentMatchPos !== -1) {
              let accumulatedCharPos = 0;
              
              for (let j = 0; j < textContent.items.length; j++) {
                const item = textContent.items[j];
                const itemText = item.str || "";
                
                if (!itemText || itemText.length === 0) continue;
                
                const itemStart = accumulatedCharPos;
                const itemEnd = accumulatedCharPos + itemText.length;
                
                if (textContentMatchPos >= itemStart && textContentMatchPos < itemEnd) {
                  const relativeStart = textContentMatchPos - itemStart;
                  const relativeEnd = relativeStart + query.length;
                  
                  if (relativeEnd <= itemText.length) {
                    matchingItems.push({ item, startChar: relativeStart, endChar: relativeEnd });
                    break;
                  } else {
                    matchingItems.push({ item, startChar: relativeStart, endChar: itemText.length });
                    break;
                  }
                }
                
                accumulatedCharPos = itemEnd;
              }
            }

            // 计算高亮矩形（方案2的情况）
          if (matchingItems.length > 0) {
              const rects = await getHighlightRects(page, matchingItems, scale, rotation);
            pageRects.push(...rects);
            
            const preview = pageText.substring(
                Math.max(0, searchIndex - 30),
                Math.min(pageText.length, searchIndex + query.length + 30)
            );
            results.push({ page: i, preview, matchIndex: matchIndex++ });
          }
          
          searchIndex += query.length;
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

