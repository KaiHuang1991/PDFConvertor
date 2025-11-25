"use client";

import { useState, useRef, useEffect } from "react";
import { Search, RotateCw, ZoomIn, ZoomOut, Loader2, Maximize, ChevronLeft, ChevronRight, Upload } from "lucide-react";

interface TextMatch {
  page: number;
  preview: string;
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
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (pdfInstance) {
      renderPage(currentPage, pdfInstance, scale, rotation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfInstance, scale, rotation]);

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
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: TextMatch[] = [];

    for (let i = 1; i <= pdfInstance.numPages; i++) {
      const page = await pdfInstance.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      if (pageText.toLowerCase().includes(query)) {
        const index = pageText.toLowerCase().indexOf(query);
        const preview = pageText.substring(Math.max(0, index - 20), index + query.length + 20);
        results.push({ page: i, preview });
      }
    }
    setSearchResults(results);
    if (results.length) {
      setCurrentPage(results[0].page);
      await renderPage(results[0].page, pdfInstance);
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
              placeholder="搜索文本..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent text-sm"
            />
          </div>
          <button className={buttonClass} onClick={handleSearch}>
            搜索
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
            <canvas ref={canvasRef} className="mx-auto my-6 shadow-lg" />
          </>
        ) : (
          <div className="text-center text-gray-500 py-20">
            上传 PDF 文件以开始预览
          </div>
        )}
      </div>

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
                  await renderPage(match.page, pdfInstance);
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

