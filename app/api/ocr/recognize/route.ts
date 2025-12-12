import { NextRequest, NextResponse } from "next/server";

/**
 * OCR 识别 API Route
 * 在后端调用云端 OCR API，保护 API 密钥
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, provider = "baidu", enableTable = false } = body;

    if (!image) {
      return NextResponse.json(
        { error: "缺少图片数据" },
        { status: 400 }
      );
    }

    // 根据 provider 调用不同的 OCR 服务
    let result;
    
    switch (provider) {
      case "baidu":
        console.log("开始调用百度 OCR API...");
        console.log("图片base64长度:", image?.length || 0);
        
        const baiduData = await recognizeWithBaiduOCR(image, enableTable);
        
        console.log("百度 OCR API 调用成功，开始转换结果...");
        console.log("百度 OCR 原始响应类型:", typeof baiduData);
        console.log("百度 OCR 原始响应 keys:", Object.keys(baiduData || {}));
        console.log("百度 OCR 完整响应:", JSON.stringify(baiduData, null, 2));
        
        result = convertBaiduResult(baiduData);
        
        console.log("结果转换成功:");
        console.log("  转换后文本长度:", result.text?.length || 0);
        console.log("  转换后置信度:", result.confidence);
        console.log("  转换后words数量:", result.words?.length || 0);
        console.log("  转换后完整结果:", JSON.stringify(result, null, 2).substring(0, 500));
        break;
      case "tencent":
        result = await recognizeWithTencentOCR(image, enableTable);
        break;
      case "aliyun":
        result = await recognizeWithAliyunOCR(image, enableTable);
        break;
      default:
        return NextResponse.json(
          { error: "不支持的 OCR 服务商" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("OCR 识别失败:", error);
    // 记录详细的错误信息以便调试
    const errorMessage = error.message || "OCR 识别失败";
    console.error("错误详情:", {
      message: errorMessage,
      stack: error.stack,
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        // 如果是配置错误，提供更友好的提示
        hint: errorMessage.includes("未配置") 
          ? "请在 .env.local 文件中配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY" 
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 百度 OCR 识别
 */
async function recognizeWithBaiduOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("未配置百度 OCR API 密钥");
  }

  try {
    // 获取 access_token
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    const tokenResponse = await fetch(tokenUrl);
    
    if (!tokenResponse.ok) {
      throw new Error(`获取 token 失败: HTTP ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`获取 access_token 失败: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.access_token) {
      throw new Error(`获取 access_token 失败: 响应中缺少 access_token，响应: ${JSON.stringify(tokenData)}`);
    }

    // 【改进】同时调用普通识别和表格识别API，合并结果
    // 重要：使用 general API（而不是 general_basic）来获取带坐标的文字内容
    // general_basic 不返回位置信息（只有文字），general API 返回完整的位置信息（文字+坐标）
    console.log("调用普通文字识别API（使用general API获取坐标信息）...");
    const generalResponse = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/general?access_token=${tokenData.access_token}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          image: base64Image,
          language_type: "CHN_ENG",
          detect_direction: "true", // 检测文字方向
          detect_language: "true",  // 检测语言
        }),
      }
    );

    if (!generalResponse.ok) {
      throw new Error(`普通文字识别API调用失败: HTTP ${generalResponse.status}`);
    }

    const generalData = await generalResponse.json();
    
    // 记录原始API响应，查看是否包含location字段
    console.log("📋 general API 原始响应（前3项）:");
    if (generalData.words_result && Array.isArray(generalData.words_result) && generalData.words_result.length > 0) {
      const firstThreeItems = generalData.words_result.slice(0, 3);
      firstThreeItems.forEach((item: any, index: number) => {
        console.log(`  第 ${index + 1} 项:`, JSON.stringify(item, null, 2));
      });
    }
    
    if (generalData.error_code) {
      throw new Error(`普通文字识别失败 [错误码 ${generalData.error_code}]: ${generalData.error_msg || "未知错误"}`);
    }

    // 如果启用表格识别，同时调用表格识别API
    let tableData: any = null;
    if (enableTable) {
      console.log("调用表格识别API...");
      const tableResponse = await fetch(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/table?access_token=${tokenData.access_token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            image: base64Image,
            language_type: "CHN_ENG",
          }),
        }
      );

      if (tableResponse.ok) {
        tableData = await tableResponse.json();
        console.log("表格识别API响应:", JSON.stringify(tableData, null, 2));
        
        if (tableData.error_code) {
          console.warn("表格识别API返回错误:", tableData.error_msg);
          // 表格识别失败不影响整体结果，继续使用普通识别结果
          tableData = null;
        } else {
          console.log(`表格识别结果: table_num=${tableData.table_num || 0}`);
          if (tableData.table_num > 0 && tableData.tables_result) {
            console.log(`成功识别到 ${tableData.table_num} 个表格`);
            console.log("表格数据:", JSON.stringify(tableData.tables_result, null, 2).substring(0, 500));
          }
        }
      }
    }

    // 合并结果：使用普通识别的文字结果，添加表格识别结果
    const mergedData = {
      ...generalData,
      tables_result: tableData?.tables_result || generalData.tables_result || [],
      table_num: tableData?.table_num || generalData.table_num || 0,
    };
    
    const data = mergedData;
    
    // 详细记录合并后的数据
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📥 百度 OCR API 合并后的响应:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  是否有words_result:", !!data.words_result);
    console.log("  words_result长度:", data.words_result?.length || 0);
    if (data.words_result && Array.isArray(data.words_result) && data.words_result.length > 0) {
      const firstItem = data.words_result[0];
      console.log("  第一个识别项的完整结构:", JSON.stringify(firstItem, null, 2));
      console.log("  第一个识别项的keys:", Object.keys(firstItem || {}));
      console.log("  是否有location字段:", !!firstItem.location);
      if (firstItem.location) {
        console.log("  location字段的值:", JSON.stringify(firstItem.location, null, 2));
        console.log("  location字段的keys:", Object.keys(firstItem.location));
      } else {
        console.warn("  ⚠️  没有location字段！可能的原因：");
        console.warn("    1. 百度API返回格式不符合预期");
        console.warn("    2. 使用了错误的API端点");
        console.warn("    3. API版本不匹配");
      }
    }
    console.log("  是否有tables_result:", !!data.tables_result);
    console.log("  tables_result是否为数组:", Array.isArray(data.tables_result));
    console.log("  tables_result长度:", Array.isArray(data.tables_result) ? data.tables_result.length : 0);
    console.log("  table_num:", data.table_num);
    if (data.tables_result && Array.isArray(data.tables_result) && data.tables_result.length > 0) {
      console.log("  表格数据预览:", JSON.stringify(data.tables_result[0], null, 2).substring(0, 500));
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 检查错误码
    if (data.error_code) {
      console.error("❌ 百度 OCR API 返回错误:");
      console.error("  错误码:", data.error_code);
      console.error("  错误信息:", data.error_msg);
      console.error("  完整响应:", JSON.stringify(data, null, 2));
      throw new Error(`百度 OCR 识别失败 [错误码 ${data.error_code}]: ${data.error_msg || "未知错误"}`);
    }
    
    // 检查是否有其他错误信息（即使没有error_code）
    if (data.error_msg && !data.words_result) {
      console.warn("⚠️  警告: 响应中包含错误信息，但没有错误码");
      console.warn("  错误信息:", data.error_msg);
    }

    // 结果已经在上面合并了，这里不需要额外处理
    
    // 检查是否有识别结果
    if (!data.words_result || (Array.isArray(data.words_result) && data.words_result.length === 0)) {
      console.warn("⚠️  百度 OCR API 返回空结果！");
      console.warn("可能的原因：");
      console.warn("  1. 图片中没有可识别的文字");
      console.warn("  2. 图片质量太差或格式不支持");
      console.warn("  3. 图片尺寸太大（超过限制）");
      console.warn("  4. API配额用完或服务异常");
      console.warn("完整响应数据:", JSON.stringify(data, null, 2));
      
      // 即使没有识别结果，也返回数据结构，让前端知道调用成功了
      return {
        words_result: [],
        words_result_num: 0,
      };
    }

    console.log("✅ 百度 OCR API 成功识别到文字");
    return data;
  } catch (error: any) {
    // 如果已经是我们抛出的错误，直接抛出
    if (error.message && error.message.includes("失败")) {
      throw error;
    }
    // 否则包装错误
    throw new Error(`百度 OCR 调用异常: ${error.message || error}`);
  }
}

/**
 * 腾讯 OCR 识别（需要实现签名算法）
 */
async function recognizeWithTencentOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  // TODO: 实现腾讯云 OCR
  throw new Error("腾讯 OCR 暂未实现");
}

/**
 * 阿里云 OCR 识别（需要实现签名算法）
 */
async function recognizeWithAliyunOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  // TODO: 实现阿里云 OCR
  throw new Error("阿里云 OCR 暂未实现");
}

/**
 * 转换百度 OCR 结果格式
 */
function convertBaiduResult(data: any): any {
  try {
    console.log("convertBaiduResult 开始转换，输入数据:");
    console.log("  data类型:", typeof data);
    console.log("  data是否为null:", data === null);
    console.log("  data是否为undefined:", data === undefined);
    console.log("  data的keys:", data ? Object.keys(data) : "无keys");
    
    if (!data) {
      console.warn("convertBaiduResult: 输入数据为空");
      return {
        text: "",
        confidence: 0,
        words: undefined,
        lines: undefined,
        tables: undefined,
      };
    }
    
    const words: any[] = [];
    const lines: any[] = [];
    
    // 处理普通文字识别结果
    console.log("检查 words_result:", {
      hasWordsResult: !!data.words_result,
      isArray: Array.isArray(data.words_result),
      length: data.words_result?.length || 0,
      value: data.words_result,
    });
    
    if (data.words_result && Array.isArray(data.words_result)) {
      console.log(`处理 ${data.words_result.length} 个识别结果项`);
      
      // 第一步：将所有识别项转换为words，并提取位置信息
      const allWords: Array<{
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        confidence: number;
      }> = [];
      
      data.words_result.forEach((item: any, index: number) => {
        if (!item || !item.words) return;
        
        // 详细日志：查看原始数据格式
        if (index === 0) {
          console.log("📋 第一个识别项的原始数据:", JSON.stringify(item, null, 2));
          console.log("   location字段:", item.location);
          console.log("   location类型:", typeof item.location);
        }
        
        const bbox = item.location || {};
        const word = {
          text: item.words || "",
          bbox: {
            x0: bbox.left || 0,
            y0: bbox.top || 0,
            x1: (bbox.left || 0) + (bbox.width || 0),
            y1: (bbox.top || 0) + (bbox.height || 0),
          },
          confidence: item.probability ? item.probability * 100 : 0,
        };
        
        // 如果坐标是0，记录警告
        if (word.bbox.x0 === 0 && word.bbox.y0 === 0 && word.bbox.x1 === 0 && word.bbox.y1 === 0) {
          console.warn(`⚠️  第 ${index + 1} 个识别项坐标全为0:`, {
            text: word.text,
            location: item.location,
            item: JSON.stringify(item).substring(0, 200),
          });
        }
        
        words.push(word);
        allWords.push(word);
      });
      
      // 验证坐标信息
      if (allWords.length > 0) {
        const sampleWord = allWords[0];
        const wordsWithCoordinates = allWords.filter(w => w.bbox.x0 !== 0 || w.bbox.y0 !== 0);
        console.log("✅ 坐标信息统计:", {
          totalWords: allWords.length,
          wordsWithCoordinates: wordsWithCoordinates.length,
          sampleWord: {
            text: sampleWord.text,
            bbox: sampleWord.bbox,
            hasCoordinates: !!(sampleWord.bbox.x0 && sampleWord.bbox.y0),
          },
        });
      }
      
      // 第二步：将同一行的words合并为lines（根据y坐标相近判断）
      const LINE_TOLERANCE = 5; // y坐标容差（像素）
      const linesByY = new Map<number, typeof allWords>();
      
      allWords.forEach((word) => {
        const yKey = Math.round(word.bbox.y0 / LINE_TOLERANCE) * LINE_TOLERANCE;
        if (!linesByY.has(yKey)) {
          linesByY.set(yKey, []);
        }
        linesByY.get(yKey)!.push(word);
      });
      
      // 第三步：按y坐标排序，创建lines
      const sortedYs = Array.from(linesByY.keys()).sort((a, b) => a - b);
      sortedYs.forEach((yKey) => {
        const lineWords = linesByY.get(yKey)!;
        // 按x坐标排序，确保顺序正确
        lineWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
        
        // 合并文本和计算整行的bbox
        const lineText = lineWords.map(w => w.text).join(" ");
        const lineBbox = {
          x0: Math.min(...lineWords.map(w => w.bbox.x0)),
          y0: Math.min(...lineWords.map(w => w.bbox.y0)),
          x1: Math.max(...lineWords.map(w => w.bbox.x1)),
          y1: Math.max(...lineWords.map(w => w.bbox.y1)),
        };
        
        lines.push({
          text: lineText,
          words: lineWords,
          bbox: lineBbox,
        });
      });
      
      console.log(`处理完成，生成 ${words.length} 个words，${lines.length} 个lines（合并后）`);
    } else {
      console.warn("words_result 不存在或不是数组");
    }

    // 处理表格识别结果：先绘制表格结构，然后将OCR文本按坐标填入
    const tables: any[] = [];
    const tableRegionWords: Set<number> = new Set(); // 记录已用于表格的word索引，避免重复
    
    console.log("开始处理表格数据...");
    console.log("  tables_result存在:", !!data.tables_result);
    console.log("  tables_result类型:", typeof data.tables_result);
    console.log("  tables_result是否为数组:", Array.isArray(data.tables_result));
    console.log("  table_num:", data.table_num);
    
    // allWords现在应该在之前已经定义，用于表格文本匹配
    if (data.tables_result && Array.isArray(data.tables_result) && data.tables_result.length > 0) {
      console.log(`处理 ${data.tables_result.length} 个表格`);
      
      data.tables_result.forEach((table: any, tableIndex: number) => {
        console.log(`处理第 ${tableIndex + 1} 个表格`);
        
        if (!table) {
          console.warn(`表格 ${tableIndex + 1} 为空，跳过`);
          return;
        }
        
        // 获取表格的位置范围
        let tableBounds: { x0: number; y0: number; x1: number; y1: number } | null = null;
        if (table.table_location && Array.isArray(table.table_location) && table.table_location.length >= 4) {
          const locations = table.table_location.map((loc: any) => ({ x: loc.x || 0, y: loc.y || 0 }));
          tableBounds = {
            x0: Math.min(...locations.map((l: any) => l.x)),
            y0: Math.min(...locations.map((l: any) => l.y)),
            x1: Math.max(...locations.map((l: any) => l.x)),
            y1: Math.max(...locations.map((l: any) => l.y)),
          };
          console.log(`表格 ${tableIndex + 1} 位置范围:`, tableBounds);
        }
        
        let rows: string[][] = [];
        let headers: string[] | undefined = undefined;
        
        // 处理表格：body是单元格数组，每个单元格有坐标信息
        if (table.body && Array.isArray(table.body) && table.body.length > 0) {
          console.log(`表格 ${tableIndex + 1} 使用body格式，单元格数: ${table.body.length}`);
          
          // 第一步：找到最大行列数，建立表格结构
          let maxRow = -1;
          let maxCol = -1;
          
          table.body.forEach((cell: any) => {
            if (cell && typeof cell.row_end === 'number') {
              maxRow = Math.max(maxRow, cell.row_end);
            }
            if (cell && typeof cell.col_end === 'number') {
              maxCol = Math.max(maxCol, cell.col_end);
            }
          });
          
          if (maxRow < 0 || maxCol < 0) {
            console.warn(`表格 ${tableIndex + 1} 无法确定尺寸，跳过`);
            return;
          }
          
          console.log(`表格 ${tableIndex + 1} 尺寸: ${maxRow + 1} 行 x ${maxCol + 1} 列`);
          
          // 第二步：建立单元格坐标映射
          // 每个单元格有 cell_location 数组，包含4个点的坐标
          interface CellInfo {
            row: number;
            col: number;
            bounds: { x0: number; y0: number; x1: number; y1: number };
            text: string;
          }
          
          const cellMap = new Map<string, CellInfo>();
          
          table.body.forEach((cell: any) => {
            if (!cell) return;
            
            const row = cell.row_start !== undefined && cell.row_start !== null ? cell.row_start : 0;
            const col = cell.col_start !== undefined && cell.col_start !== null ? cell.col_start : 0;
            
            // 获取单元格坐标范围
            let cellBounds: { x0: number; y0: number; x1: number; y1: number } | null = null;
            if (cell.cell_location && Array.isArray(cell.cell_location) && cell.cell_location.length >= 4) {
              const locations = cell.cell_location.map((loc: any) => ({ x: loc.x || 0, y: loc.y || 0 }));
              cellBounds = {
                x0: Math.min(...locations.map((l: any) => l.x)),
                y0: Math.min(...locations.map((l: any) => l.y)),
                x1: Math.max(...locations.map((l: any) => l.x)),
                y1: Math.max(...locations.map((l: any) => l.y)),
              };
            }
            
            // 先使用表格识别提供的文本（作为备选）
            let cellText = "";
            if (cell.words) {
              cellText = String(cell.words).trim();
            }
            
            const key = `${row},${col}`;
            cellMap.set(key, {
              row,
              col,
              bounds: cellBounds || { x0: 0, y0: 0, x1: 0, y1: 0 },
              text: cellText,
            });
          });
          
          // 第三步：将OCR文本识别结果按坐标匹配到单元格
          // 遍历所有OCR识别的words，找到落在单元格范围内的文本
          // 使用之前定义的words数组（包含所有识别到的words和坐标信息）
          if (words.length > 0 && tableBounds) {
            words.forEach((word: any, wordIndex: number) => {
              // 检查word是否在表格范围内
              const wordCenterX = (word.bbox.x0 + word.bbox.x1) / 2;
              const wordCenterY = (word.bbox.y0 + word.bbox.y1) / 2;
              
              if (wordCenterX >= tableBounds.x0 && wordCenterX <= tableBounds.x1 &&
                  wordCenterY >= tableBounds.y0 && wordCenterY <= tableBounds.y1) {
                
                // 找到包含这个word的单元格
                for (const [key, cellInfo] of cellMap.entries()) {
                  if (cellInfo.bounds.x0 === 0 && cellInfo.bounds.y0 === 0) continue; // 跳过没有坐标的单元格
                  
                  // 检查word是否在单元格范围内（使用中心点判断）
                  if (wordCenterX >= cellInfo.bounds.x0 && wordCenterX <= cellInfo.bounds.x1 &&
                      wordCenterY >= cellInfo.bounds.y0 && wordCenterY <= cellInfo.bounds.y1) {
                    
                    // 将文本添加到单元格
                    const existingText = cellInfo.text;
                    cellInfo.text = existingText 
                      ? `${existingText} ${word.text}`.trim()
                      : word.text;
                    
                    // 标记这个word已用于表格
                    tableRegionWords.add(wordIndex);
                    break;
                  }
                }
              }
            });
          }
          
          // 第四步：构建表格行数组
          const tableGrid: (string | undefined)[][] = [];
          for (let r = 0; r <= maxRow; r++) {
            tableGrid[r] = new Array(maxCol + 1).fill(undefined);
          }
          
          // 填充单元格文本
          cellMap.forEach((cellInfo, key) => {
            if (cellInfo.text) {
              tableGrid[cellInfo.row][cellInfo.col] = cellInfo.text
                .replace(/\n+/g, " ") // 将换行符替换为空格
                .replace(/\s+/g, " ") // 合并多个空格
                .trim();
            }
          });
          
          // 转换为行数组
          rows = tableGrid
            .map(row => row.map(cell => cell || ""))
            .filter(row => row.some(cell => cell.trim() !== "")); // 过滤完全空白的行
          
          // 处理表头
          if (table.header && Array.isArray(table.header) && table.header.length > 0) {
            headers = table.header.map((h: any) => {
              if (typeof h === 'string') return h;
              if (h && h.words) return h.words;
              if (h && h.text) return h.text;
              return String(h || "");
            }).filter((h: string) => h.trim());
          } else if (rows.length > 0) {
            // 如果没有表头，将第一行作为表头
            headers = rows[0];
            rows = rows.slice(1);
          }
        } 
        // 尝试格式2：直接是行数组
        else if (Array.isArray(table)) {
          console.log(`表格 ${tableIndex + 1} 使用数组格式，行数: ${table.length}`);
          rows = table.map((row: any) => {
            if (Array.isArray(row)) {
              return row.map((cell: any) => String(cell || ""));
            }
            return [String(row || "")];
          });
        }
        // 尝试格式3：表格单元格数组
        else if (table.cells && Array.isArray(table.cells)) {
          console.log(`表格 ${tableIndex + 1} 使用cells格式`);
          // 需要根据单元格位置重组为行
          // 这里简化处理，可能需要更复杂的逻辑
        }
        
        if (rows.length > 0) {
          console.log(`表格 ${tableIndex + 1} 转换成功，${rows.length} 行`);
          tables.push({
            rows,
            headers,
          });
        } else {
          console.warn(`表格 ${tableIndex + 1} 没有有效行数据`);
        }
      });
    } else {
      console.log("没有表格数据或tables_result为空");
    }
    
    console.log(`表格处理完成，共识别到 ${tables.length} 个有效表格`);

    // 智能拼接文本，保持段落格式
    // 百度OCR的words_result通常每个item是一行文本，我们根据位置信息重建段落结构
    let textResult = "";
    if (data.words_result && Array.isArray(data.words_result) && data.words_result.length > 0) {
      interface TextItem {
        text: string;
        y: number;
        height: number;
        bottom: number;
      }
      
      const items: TextItem[] = data.words_result
        .filter((item: any) => item && item.words && item.location)
        .map((item: any) => ({
          text: item.words || "",
          y: item.location?.top || 0,
          height: item.location?.height || 0,
          bottom: (item.location?.top || 0) + (item.location?.height || 0),
        }));
      
      if (items.length > 0) {
        // 按y坐标排序（从上到下）
        items.sort((a: TextItem, b: TextItem) => a.y - b.y);
        
        // 计算平均行高，用于判断段落间距
        const avgLineHeight = items.reduce((sum: number, item: TextItem) => sum + item.height, 0) / items.length;
        const paragraphGap = avgLineHeight * 1.8; // 段落间距阈值：1.8倍行高
        
        // 重建段落结构
        const paragraphs: string[] = [];
        let currentParagraph: string[] = [];
        
        for (let i = 0; i < items.length; i++) {
          const currentItem = items[i];
          currentParagraph.push(currentItem.text);
          
          // 检查下一行是否应该开始新段落
          if (i < items.length - 1) {
            const nextItem = items[i + 1];
            const gap = nextItem.y - currentItem.bottom;
            
            // 如果行间距大于阈值，认为是新段落
            if (gap > paragraphGap) {
              if (currentParagraph.length > 0) {
                // 段落内的行用单换行符连接（保留行结构）
                paragraphs.push(currentParagraph.join("\n"));
                currentParagraph = [];
              }
            }
          }
        }
        
        // 添加最后一个段落
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join("\n"));
        }
        
        // 用双换行符连接段落（保留段落间距）
        textResult = paragraphs.join("\n\n");
      }
    }

    // 计算置信度
    let confidence = 0;
    if (words.length > 0) {
      const confidences = words.map(w => w.confidence || 0).filter(c => c > 0);
      if (confidences.length > 0) {
        confidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      } else {
        // 如果没有置信度数据，但识别到了文字，给一个默认值
        confidence = textResult.trim().length > 0 ? 85 : 0;
      }
    } else if (textResult.trim().length > 0) {
      // 有文本但没有words数据，给一个默认置信度
      confidence = 85;
    }

    // 如果表格区域有文本被使用了，从words和lines中排除这些文本（避免重复）
    let filteredWords = words;
    let filteredLines = lines;
    
    if (tableRegionWords.size > 0) {
      console.log(`从文本结果中排除 ${tableRegionWords.size} 个已用于表格的words`);
      
      // 过滤words（排除已用于表格的）
      filteredWords = words.filter((_, index) => !tableRegionWords.has(index));
      
      // 重新构建lines（排除已用于表格的words）
      // 这里简化处理，只保留不在表格区域的lines
      if (tables.length > 0 && lines.length > 0) {
        // 获取所有表格的位置范围
        const tableRanges: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
        // 注意：tableRegionWords记录的是word索引，我们可以通过word的坐标判断line是否在表格内
        
        // 简化：如果line的所有words都被用于表格，则排除这个line
        filteredLines = lines.filter((line: any) => {
          // 检查line中的words是否都在表格区域
          if (!line.words || line.words.length === 0) return true;
          
          // 暂时保留所有lines，避免过度过滤
          // 表格区域的文本已经在表格中显示了
          return true;
        });
      }
    }
    
    console.log("转换结果统计:", {
      textLength: textResult.length,
      wordsCount: words.length,
      filteredWordsCount: filteredWords.length,
      linesCount: lines.length,
      filteredLinesCount: filteredLines.length,
      confidence,
      hasTables: tables.length > 0,
      tablesCount: tables.length,
    });

    return {
      text: textResult || "",
      confidence: Math.round(confidence * 100) / 100, // 保留两位小数
      words: filteredWords.length > 0 ? filteredWords : undefined,
      lines: filteredLines.length > 0 ? filteredLines : undefined,
      tables: tables.length > 0 ? tables : undefined,
    };
  } catch (error: any) {
    console.error("转换百度 OCR 结果时出错:", error);
    throw new Error(`转换 OCR 结果失败: ${error.message || "未知错误"}`);
  }
}




