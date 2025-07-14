'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import * as echarts from 'echarts';

interface TableColumn {
  name: string;
  type: string;
  description: string;
}

interface AnalysisResult {
  data: unknown[][];
  columns: string[];
  row_count: number;
  column_count: number;
  column_details?: TableColumn[];
}

// 添加 ECharts 配置接口
interface EChartsConfig {
  option: echarts.EChartsOption;
  title: string;
  description?: string;
}

// 添加 SQL 执行结果接口
interface SQLExecutionResult {
  success: boolean;
  data?: unknown[][];
  columns?: string[];
  row_count?: number;
  column_count?: number;
  error?: string;
  query?: string;
  chartConfig?: EChartsConfig | null; // 添加图表配置
}

// Python 返回结果接口
interface PythonQueryResult {
  data?: unknown[][];
  columns?: string[];
  row_count?: number;
  column_count?: number;
  column_details?: TableColumn[];
  error?: string;
  success?: boolean;
}

interface FileInfo {
  file: File;
  isExpanded: boolean;
  tables: {
    name: string;
    rowCount: number;
    columns: TableColumn[];
  }[];
  summarizeData?: AnalysisResult; // 添加 summarize 数据
}

interface PyodideInstance {
  FS: {
    writeFile: (path: string, content: string) => void;
    mkdir: (path: string) => void;
  };
  loadPackage: (packages: string[]) => Promise<void>;
  runPython: (code: string) => PyProxy;
  runPythonAsync: (code: string) => Promise<PyProxy>;
}

interface PyProxy {
  toJs: (options?: { dict_converter?: (entries: Iterable<[string, unknown]>) => Record<string, unknown> }) => unknown;
}

// 扩展 Window 接口
declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

// 添加 Python 分析器相关代码
const loadPythonPackage = async (pyodide: PyodideInstance): Promise<void> => {
  const packageFiles = [
    '__init__.py',
    'database.py',
    'analyzer.py',
    'loader.py',
    'utils.py'
  ];
  
  for (const file of packageFiles) {
    const response = await fetch(`/python/analyzer/${file}`);
    if (!response.ok) {
      throw new Error(`无法加载包文件: ${file}`);
    }
    const content = await response.text();
    pyodide.FS.writeFile(`/analyzer/${file}`, content);
  }
  
  pyodide.runPython(`
import sys
sys.path.append('/')

import analyzer
# 检查是否已经初始化过
if analyzer.db_manager is None:
    components = analyzer.initialize()
    print("Python 包已成功导入和初始化")
else:
    print("Python 包已存在，跳过初始化")
    # 确保连接存在
    if analyzer.db_manager.conn is None:
        analyzer.db_manager.connect()
        print("重新建立数据库连接")
  `);
};

const initPyodide = async (): Promise<PyodideInstance> => {
  if (typeof window !== 'undefined' && !window.loadPyodide) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  const pyodideInstance = await window.loadPyodide!({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
  });
  
  await pyodideInstance.loadPackage(['micropip']);
  await pyodideInstance.runPythonAsync(`
    import micropip
    await micropip.install('duckdb')
  `);

  pyodideInstance.FS.mkdir('/analyzer');
  await loadPythonPackage(pyodideInstance);
  
  return pyodideInstance;
};

const analyzeFileWithDuckDB = async (file: File, pyodide: PyodideInstance): Promise<AnalysisResult> => {
  const fileContent = await file.text();
  
  // 转义文件内容以避免Python字符串问题
  const escapedContent = fileContent
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  
  // 使用 DuckDB 加载数据
  const loadResult = pyodide.runPython(`
import analyzer
# 确保连接存在
if analyzer.db_manager.conn is None:
    analyzer.db_manager.connect()
    print("重新建立数据库连接")

csv_content = """${escapedContent}"""
row_count = analyzer.load_csv(csv_content)
print(f"成功加载 {row_count} 行数据")

# 验证数据是否正确加载
if analyzer.db_manager.table_exists():
    actual_count = analyzer.db_manager.execute_query("SELECT COUNT(*) FROM csv_data").fetchone()[0]
    print(f"验证数据加载: 表存在，实际行数: {actual_count}")
else:
    print("警告: 数据加载后表不存在")

{"success": True, "row_count": row_count}
  `);
  
  if (!loadResult) {
    throw new Error("数据加载失败：Python执行返回空结果");
  }
  
  const loadJs = loadResult.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
  
  if (loadJs.error) {
    throw new Error(`数据加载失败：${loadJs.error}`);
  }
  
  console.log(`数据加载成功，共 ${loadJs.row_count} 行`);
  
  // 获取基本表信息而不是执行 summarize
  console.log('开始获取表信息...');
  const tableInfoResult = pyodide.runPython(`
import analyzer
print("=== 开始获取表信息 ===")

result = None
try:
    # 检查表是否存在
    table_exists = analyzer.db_manager.table_exists()
    print(f"表是否存在: {table_exists}")
    
    if not table_exists:
        result = {"error": "表不存在", "success": False}
        print("表不存在，返回错误")
    else:
        # 获取表的基本信息
        print("获取表基本信息...")
        row_count, column_names, column_details = analyzer.db_manager.get_table_info()
        print(f"行数: {row_count}")
        print(f"列名: {column_names}")
        print(f"列详细信息: {column_details}")
        
        # 获取样本数据
        print("获取样本数据...")
        sample_result = analyzer.data_loader.get_sample_data()
        print(f"样本数据: {sample_result}")
        
        result = {
            "data": sample_result["data"],
            "columns": column_names,
            "row_count": row_count,
            "column_count": len(column_names),
            "column_details": column_details,
            "success": True
        }
        print(f"成功构建结果: {type(result)}")
        
except Exception as e:
    import traceback
    error_msg = f"获取表信息失败: {e}\\n{traceback.format_exc()}"
    print(error_msg)
    result = {"error": error_msg, "success": False}

print(f"=== 返回结果: {result} ===")
result
  `);
  
  console.log('Python执行完成，结果:', tableInfoResult);
  console.log('结果类型:', typeof tableInfoResult);
  console.log('结果是否为null:', tableInfoResult === null);
  console.log('结果是否为undefined:', tableInfoResult === undefined);
  
  if (!tableInfoResult) {
    console.error('Python执行返回空结果');
    throw new Error("获取表信息失败：Python执行返回空结果");
  }
  
  console.log('准备转换为JavaScript对象...');
  const tableJs = tableInfoResult.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
  console.log('转换后的JavaScript对象:', tableJs);
  
  if (tableJs.error) {
    console.error('Python返回错误:', tableJs.error);
    throw new Error(`获取表信息失败：${tableJs.error}`);
  }
  
  console.log('成功获取表信息，准备返回结果...');
  const finalResult = {
    data: tableJs.data || [],
    columns: tableJs.columns || [],
    row_count: tableJs.row_count || 0,
    column_count: tableJs.column_count || 0,
    column_details: tableJs.column_details || []
  };
  
  console.log('最终返回结果:', finalResult);
  return finalResult;
};

// 添加 SQL 执行函数
const executeSQL = async (query: string, pyodide: PyodideInstance): Promise<SQLExecutionResult> => {
  try {
    console.log('执行SQL查询:', query);
    
    // 清理查询字符串
    const cleanQuery = query.trim().replace(/^```sql\s*/, '').replace(/\s*```$/, '');
    
    // 检查 analyzer 是否存在和数据是否加载
    const checkResult = pyodide.runPython(`
try:
    import analyzer
    # 确保连接存在
    if analyzer.db_manager.conn is None:
        analyzer.db_manager.connect()
        print("重新建立数据库连接")
    
    # 检查数据是否已加载
    if not analyzer.db_manager.table_exists():
        result = {"error": "数据表不存在，请先上传CSV文件", "success": False}
    else:
        # 检查表中是否有数据
        row_count = analyzer.db_manager.execute_query("SELECT COUNT(*) FROM csv_data").fetchone()[0]
        if row_count == 0:
            result = {"error": "数据表为空，请确保CSV文件已正确加载", "success": False}
        else:
            result = {"success": True, "row_count": row_count}
            print(f"表验证成功，数据行数: {row_count}")
except Exception as e:
    import traceback
    result = {"error": f"系统错误: {str(e)}\\n{traceback.format_exc()}", "success": False}
    print(f"验证失败: {e}")

result
    `);
    
    if (!checkResult) {
      return {
        success: false,
        error: "Python执行失败，请刷新页面重试",
        query: cleanQuery
      };
    }
    
    const checkJs = checkResult.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
    
    if (checkJs.error) {
      return {
        success: false,
        error: checkJs.error,
        query: cleanQuery
      };
    }
    
    // 执行自定义查询
    const result = pyodide.runPython(`
import analyzer

# 确保连接和组件存在
if analyzer.db_manager.conn is None:
    analyzer.db_manager.connect()
    print("重新建立数据库连接")

# 再次验证表是否存在
table_exists = analyzer.db_manager.table_exists()
print(f"表是否存在: {table_exists}")

final_result = None

try:
    if table_exists:
        row_count = analyzer.db_manager.execute_query("SELECT COUNT(*) FROM csv_data").fetchone()[0]
        print(f"表行数: {row_count}")
        
        query_str = """${cleanQuery}"""
        print("开始执行自定义查询:")
        print(query_str)
        
        # 直接执行查询而不是通过custom_query
        cursor = analyzer.db_manager.execute_query(query_str)
        query_result = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        print(f"查询返回: {len(query_result)} 行, {len(columns)} 列")
        print(f"列名: {columns}")
        if query_result:
            print(f"前3行数据: {query_result[:3]}")
        
        # 直接构建简单的结果字典
        final_result = {
            "data": [[str(cell) if cell is not None else None for cell in row] for row in query_result],
            "columns": columns,
            "row_count": len(query_result),
            "column_count": len(columns),
            "query": query_str,
            "success": True
        }
        print(f"构建的结果字典: {final_result}")
        
    else:
        final_result = {"error": "表不存在", "success": False}
        
except Exception as e:
    import traceback
    error_details = traceback.format_exc()
    print("查询执行失败:")
    print(str(e))
    print("详细错误:")
    print(error_details)
    final_result = {"error": f"{str(e)}\\n{error_details}", "success": False}

print(f"最终返回结果: {final_result}")
final_result
    `);
    
    console.log('Python查询结果类型:', typeof result);
    console.log('Python查询结果是否为null:', result === null);
    console.log('Python查询结果是否为undefined:', result === undefined);
    console.log('Python查询结果:', result);
    
    let jsResult: PythonQueryResult;
    try {
      if (result === null || result === undefined) {
        throw new Error("Python返回结果为null或undefined");
      }
      
      jsResult = result.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
      console.log('JavaScript结果转换成功:', jsResult);
      
      if (!jsResult) {
        throw new Error("转换后的JavaScript结果为空");
      }
      
    } catch (error) {
      console.error('JavaScript结果转换失败:', error);
      console.error('原始Python结果:', result);
      
      return {
        success: false,
        error: `结果转换失败: ${error instanceof Error ? error.message : String(error)}`,
        query: cleanQuery
      };
    }
    
    if (jsResult.error) {
      return {
        success: false,
        error: jsResult.error,
        query: cleanQuery
      };
    }
    
    // 生成图表配置
    let chartConfig: EChartsConfig | null = null;
    if (jsResult.data && jsResult.columns && jsResult.data.length > 0) {
      try {
        chartConfig = await generateEChartsConfig(
          jsResult.data,
          jsResult.columns,
          cleanQuery
        );
      } catch (error) {
        console.error('生成图表配置失败:', error);
      }
    }

    return {
      success: true,
      data: jsResult.data,
      columns: jsResult.columns,
      row_count: jsResult.row_count,
      column_count: jsResult.column_count,
      query: cleanQuery,
      chartConfig: chartConfig
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      query: query
    };
  }
};

// 使用 AI 生成列描述
const generateColumnDescriptions = async (
  columns: TableColumn[],
  fileName: string,
  sampleData: unknown[][]
): Promise<TableColumn[]> => {
  try {
    // 构建提示信息
    const columnsInfo = columns.map(col => `${col.name} (${col.type})`).join(', ');
    const sampleDataStr = sampleData.length > 0 
      ? sampleData.slice(0, 3).map((row, index) => 
          `第${index + 1}行: ${columns.map((col, i) => `${col.name}=${row[i]}`).join(', ')}`
        ).join('\n')
      : '无样本数据';
    
    const prompt = `分析以下CSV文件的列信息，为每个列生成简洁的中文描述（每个描述不超过10个字）：

文件名: ${fileName}
列信息: ${columnsInfo}
样本数据:
${sampleDataStr}

请根据列名和样本数据推测每列的实际含义，以JSON格式返回：
{
  "列名1": "简洁描述1",
  "列名2": "简洁描述2"
}

只返回JSON，不要其他文字。`;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('AI 请求失败');
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let aiResponse = '';
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // 解析 AI SDK 的流式数据格式
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              // 直接解析 0: 后面的JSON字符串内容
              const content = JSON.parse(line.substring(2));
              aiResponse += content;
            } catch {
              // 忽略解析错误，继续处理
            }
          }
        }
      }
    }
    
    console.log('AI返回的原始响应:', aiResponse);
    
    // 尝试解析 AI 返回的 JSON
    let descriptions: Record<string, string> = {};
    try {
      // 寻找JSON块
      const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        descriptions = JSON.parse(jsonMatch[0]);
        console.log('解析的描述:', descriptions);
      }
         } catch {
       console.warn('AI 返回的描述格式无法解析，使用默认描述');
     }

    // 将 AI 生成的描述应用到列信息
    return columns.map(col => ({
      ...col,
      description: descriptions[col.name] || `${col.type} 类型字段`
    }));

  } catch (error) {
    console.error('生成列描述失败:', error);
    // 如果 AI 生成失败，返回默认描述
    return columns.map(col => ({
      ...col,
      description: `${col.type} 类型字段`
    }));
  }
};

// ECharts 组件
function EChartsComponent({ config }: { config: EChartsConfig }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // 设置图表配置
    chart.setOption(config.option);

    // 窗口大小改变时调整图表大小
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [config]);

  return (
    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{config.title}</h3>
      {config.description && (
        <p className="text-sm text-gray-600 mb-4">{config.description}</p>
      )}
      <div ref={chartRef} className="w-full h-96" />
    </div>
  );
}

// 生成 ECharts 配置
const generateEChartsConfig = async (
  data: unknown[][],
  columns: string[],
  query: string
): Promise<EChartsConfig | null> => {
  try {
    // 如果AI生成失败，返回默认配置
    return generateDefaultChart(data, columns, query);
  } catch (error) {
    console.error('生成图表配置失败:', error);
    return generateDefaultChart(data, columns, query);
  }
};

// 生成默认图表配置
const generateDefaultChart = (
  data: unknown[][],
  columns: string[],
  query: string
): EChartsConfig => {
  // 简单的数据分析来决定图表类型
  const isCountQuery = query.toLowerCase().includes('count');
  const isGroupBy = query.toLowerCase().includes('group by');

  if (isCountQuery || isGroupBy) {
    // 统计类查询使用柱状图
    return {
      option: {
        title: { text: '数据统计' },
        tooltip: {},
        xAxis: {
          type: 'category',
          data: data.map(row => String(row[0]))
        } as any,
        yAxis: {
          type: 'value'
        },
        series: [{
          type: 'bar',
          data: data.map(row => Number(row[1]) || 0)
        } as any]
      },
      title: '数据统计图表',
      description: '基于查询结果生成的统计图表'
    };
  } else {
    // 其他情况使用表格形式的柱状图
    return {
      option: {
        title: { text: '数据概览' },
        tooltip: {},
        xAxis: {
          type: 'category',
          data: data.map((_, index) => `行${index + 1}`)
        } as any,
        yAxis: {
          type: 'value'
        },
        series: [{
          type: 'bar',
          data: data.map(row => Number(row[0]) || 0)
        } as any]
      },
      title: '数据概览图表',
      description: '数据的可视化展示'
    };
  }
};

// 判断消息是否包含SQL查询
const containsSQL = (message: string): boolean => {
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'WITH', 'DESCRIBE', 'SUMMARIZE'];
  const upperMessage = message.toUpperCase();
  return sqlKeywords.some(keyword => upperMessage.includes(keyword));
};

// 提取SQL查询
const extractSQL = (message: string): string => {
  // 移除markdown SQL代码块标记
  const cleanMessage = message.replace(/```sql\s*\n?/gi, '').replace(/\n?\s*```/g, '');
  return cleanMessage.trim();
};

// 列信息组件
function ColumnInfo({ column }: { column: TableColumn }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-blue-600 bg-blue-50';
      case 'number': return 'text-green-600 bg-green-50';
      case 'date': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-gray-900">{column.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{column.description}</div>
      </div>
      <div className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(column.type)}`}>
        {column.type}
      </div>
    </div>
  );
}

// 表格信息组件
function TableInfo({ table }: {
  table: { name: string; rowCount: number; columns: TableColumn[] };
}) {
  return (
    <div className="border border-gray-200 rounded-md mb-3 last:mb-0">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="font-medium text-gray-900 text-sm">{table.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {table.rowCount.toLocaleString()} rows • {table.columns.length} columns
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {table.columns.map((column, colIndex) => (
          <ColumnInfo key={colIndex} column={column} />
        ))}
      </div>
    </div>
  );
}

// 文件信息卡片组件 - 包含表和列信息
function FileInfoCard({ fileInfo, index, onRemove }: {
  fileInfo: FileInfo;
  index: number;
  onRemove: (index: number) => void;
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* 文件头部信息 */}
      <div className="flex items-center justify-between p-3 bg-white">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{fileInfo.file.name}</div>
            <div className="text-xs text-gray-500">
              {formatFileSize(fileInfo.file.size)} • {getFileExtension(fileInfo.file.name)} • {fileInfo.tables.length} table{fileInfo.tables.length > 1 ? 's' : ''}
              {fileInfo.summarizeData && (
                <span className="ml-2 text-green-600">• 已分析</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* 表格和列信息 */}
      <div className="px-3 pb-3 bg-gray-50">
        {fileInfo.tables.map((table, tableIndex) => (
          <TableInfo key={tableIndex} table={table} />
        ))}
        
        {/* 显示分析结果摘要 */}
        {fileInfo.summarizeData && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <div className="text-sm font-medium text-blue-900 mb-2">数据分析摘要</div>
            <div className="text-xs text-blue-700">
              已通过 DuckDB 分析 {fileInfo.summarizeData.row_count} 行数据，
              包含 {fileInfo.summarizeData.column_count} 个字段
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 文件上传面板组件 - 紧凑版本
function FileUploadPanel({ fileInfos, onFileSelect, onRemoveFile, isAnalyzing }: {
  fileInfos: FileInfo[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  isAnalyzing: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="fixed top-6 right-6 z-10">
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
        {/* 头部 - 可点击展开/收起 */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={toggleExpanded}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-medium text-gray-900 text-sm">Data Sources</span>
            {fileInfos.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                {fileInfos.length}
              </span>
            )}
            {isAnalyzing && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                分析中...
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              disabled={isAnalyzing}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* 展开的内容 */}
        {isExpanded && (
          <div className="w-96 max-h-[32rem] overflow-hidden flex flex-col">
            {fileInfos.length === 0 ? (
              <div className="p-6 text-center border-t border-gray-100">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-sm mb-3">No data files uploaded</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  disabled={isAnalyzing}
                >
                  Upload your first file
                </button>
              </div>
            ) : (
              <div className="border-t border-gray-100 max-h-[30rem] overflow-y-auto">
                {fileInfos.map((fileInfo, index) => (
                  <FileInfoCard
                    key={index}
                    fileInfo={fileInfo}
                    index={index}
                    onRemove={onRemoveFile}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileSelect}
          accept=".csv,.xlsx,.xls,.tsv"
          disabled={isAnalyzing}
        />
      </div>
    </div>
  );
}

// 聊天消息组件
function ChatMessage({ message, chartData }: { message: Message; chartData?: EChartsConfig | null }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-white text-gray-900 border border-gray-200'
      } rounded-lg px-4 py-3 shadow-sm`}>
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="text-sm prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // 自定义 markdown 组件样式
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800">
                      {children}
                    </code>
                  ) : (
                    <code className={`block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto ${className}`}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto mb-2">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 mb-2">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-2">
                    <table className="min-w-full border-collapse border border-gray-300 text-xs">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-medium text-left">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-300 px-2 py-1">
                    {children}
                  </td>
                ),
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {/* 显示图表 */}
            {chartData && (
              <EChartsComponent config={chartData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  const [pyodide, setPyodide] = useState<PyodideInstance | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [initializingPyodide, setInitializingPyodide] = useState(true);
  const [isExecutingSQL, setIsExecutingSQL] = useState(false);
  const [latestChartConfig, setLatestChartConfig] = useState<EChartsConfig | null>(null);
  
  // 初始化 Pyodide
  useEffect(() => {
    const initializePyodide = async () => {
      try {
        setInitializingPyodide(true);
        const pyodideInstance = await initPyodide();
        setPyodide(pyodideInstance);
      } catch (error) {
        console.error('Pyodide 初始化失败:', error);
      } finally {
        setInitializingPyodide(false);
      }
    };
    
    initializePyodide();
  }, []);

  // 创建包含数据上下文的聊天实例
  const dataContext = fileInfos.map(fileInfo => {
    if (fileInfo.summarizeData) {
      const data = fileInfo.summarizeData;
      return `文件 ${fileInfo.file.name} 的数据信息：
- 总行数: ${data.row_count}
- 字段数: ${data.column_count}
- 字段名称: ${data.columns?.join(', ')}
- 样本数据 (前5行): 
${data.data?.slice(0, 5).map((row, index) => 
  `  第${index + 1}行: ${data.columns?.map((col, i) => `${col}=${row[i]}`).join(', ')}`
).join('\n')}`;
    }
    return `文件 ${fileInfo.file.name} 已上传但未分析`;
  }).join('\n\n');

  // 修改聊天配置，添加SQL执行逻辑
  const { messages, input, handleInputChange, handleSubmit, append } = useChat({
    initialMessages: dataContext ? [
      {
        id: 'system',
        role: 'system',
                 content: `你是一个数据分析助手。当前已上传的数据文件信息：

${dataContext}

重要规则：
1. 用户询问数据问题时，你应该首先返回一个可执行的SQL查询语句
2. 表名固定为 'csv_data'
3. 只返回SQL查询，不要包含其他解释文字
4. 支持的SQL操作：SELECT, DESCRIBE, SUMMARIZE, WITH等DuckDB支持的语法
5. 根据上面的样本数据了解字段名称和数据类型
6. 如果需要复杂分析，使用WITH子句或子查询
7. 字段名称区分大小写，请使用准确的字段名

示例：
用户问："显示数据的前10行"
你应该回复：SELECT * FROM csv_data LIMIT 10

用户问："统计每个类别的数量"
你应该回复：SELECT category, COUNT(*) as count FROM csv_data GROUP BY category ORDER BY count DESC`
      }
    ] : [],
    onFinish: async (message) => {
      // 检查AI返回的消息是否包含SQL
      if (containsSQL(message.content) && pyodide) {
        setIsExecutingSQL(true);
        
        try {
          // 提取并执行SQL
          const sqlQuery = extractSQL(message.content);
          const result = await executeSQL(sqlQuery, pyodide);
          
          if (result.success) {
            // 构建结果描述
            const resultSummary = `SQL查询执行成功！
查询：${result.query}
结果：${result.row_count} 行，${result.column_count} 列
列名：${result.columns?.join(', ')}

前${Math.min(5, result.row_count || 0)}行数据：
${result.data?.slice(0, 5).map(row => row?.join(' | ')).join('\n')}`;
            
            // 如果有图表配置，存储它
            if (result.chartConfig) {
              setLatestChartConfig(result.chartConfig);
            }
            
            // 让AI分析结果
            await append({
              role: 'user',
              content: `请分析以下SQL查询结果：\n\n${resultSummary}`
            });
          } else {
            // 处理SQL执行错误
            await append({
              role: 'user',
              content: `SQL查询执行失败：${result.error}\n查询：${result.query}\n请提供一个修正的SQL查询。`
            });
          }
        } catch (error) {
          console.error('SQL执行失败:', error);
          await append({
            role: 'user',
            content: `SQL执行过程中发生错误：${error instanceof Error ? error.message : String(error)}`
          });
        } finally {
          setIsExecutingSQL(false);
        }
      }
    }
  });
  
  // 模拟生成表格信息的假数据
  const generateMockTableInfo = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
    
    if (extension === 'xlsx' || extension === 'xls') {
      if (fileName.toLowerCase().includes('sales') || fileName.toLowerCase().includes('销售')) {
        return [
          {
            name: 'Sales_2024',
            rowCount: 1250,
            columns: [
              { name: 'order_id', type: 'string', description: '订单唯一标识符' },
              { name: 'customer_name', type: 'string', description: '客户姓名' },
              { name: 'product_name', type: 'string', description: '产品名称' },
              { name: 'sales_amount', type: 'number', description: '销售金额' },
              { name: 'order_date', type: 'date', description: '订单日期' },
              { name: 'region', type: 'string', description: '销售区域' }
            ]
          }
        ];
      } else {
        return [
          {
            name: 'Sheet1',
            rowCount: Math.floor(Math.random() * 3000) + 500,
            columns: [
              { name: 'id', type: 'number', description: '主键ID' },
              { name: 'name', type: 'string', description: '名称字段' },
              { name: 'value', type: 'number', description: '数值' },
              { name: 'category', type: 'string', description: '类别' },
              { name: 'created_at', type: 'date', description: '创建时间' }
            ]
          }
        ];
      }
    } else {
      return [{
        name: 'Data',
        rowCount: Math.floor(Math.random() * 5000) + 100,
        columns: [
          { name: 'id', type: 'number', description: '主键标识符' },
          { name: 'name', type: 'string', description: '名称' },
          { name: 'value', type: 'number', description: '数值' },
          { name: 'category', type: 'string', description: '分类' },
          { name: 'status', type: 'string', description: '状态' },
          { name: 'created_at', type: 'date', description: '创建时间戳' }
        ]
      }];
    }
  };
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const tableFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return ['csv', 'xlsx', 'xls', 'tsv'].includes(extension || '');
    });
    
    if (tableFiles.length === 0) return;
    
    setIsAnalyzing(true);
    
    try {
      const newFileInfos = await Promise.all(
        tableFiles.map(async (file) => {
          const fileInfo: FileInfo = {
            file,
            isExpanded: false,
            tables: generateMockTableInfo(file.name)
          };
          
          // 如果 Pyodide 已初始化且文件是 CSV，则进行分析
          if (pyodide && file.name.toLowerCase().endsWith('.csv')) {
            try {
              const summarizeData = await analyzeFileWithDuckDB(file, pyodide);
              fileInfo.summarizeData = summarizeData;
              
              // 使用真实的列信息替换模拟数据
              if (summarizeData.column_details && summarizeData.column_details.length > 0) {
                // 使用 AI 生成列描述
                const columnsWithAIDescription = await generateColumnDescriptions(
                  summarizeData.column_details,
                  file.name,
                  summarizeData.data?.slice(0, 3) || []
                );
                
                fileInfo.tables = [{
                  name: file.name.replace('.csv', ''),
                  rowCount: summarizeData.row_count,
                  columns: columnsWithAIDescription
                }];
              }
              
              console.log(`文件 ${file.name} 分析完成，数据已加载到 DuckDB`);
            } catch (error) {
              console.error(`分析文件 ${file.name} 失败:`, error);
              // 显示错误信息给用户
              alert(`文件 ${file.name} 分析失败：${error instanceof Error ? error.message : String(error)}`);
            }
          }
          
          return fileInfo;
        })
      );
      
      setFileInfos(prev => [...prev, ...newFileInfos]);
      
    } catch (error) {
      console.error('文件处理失败:', error);
      alert(`文件处理失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeFile = (index: number) => {
    setFileInfos(prev => prev.filter((_, i) => i !== index));
  };

  // 自定义提交处理，包含数据上下文
  const handleSubmitWithContext = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isExecutingSQL) return;
    
    // 构建包含数据上下文的消息
    let contextualInput = input;
    
    if (fileInfos.length > 0 && fileInfos.some(f => f.summarizeData)) {
      const dataInfo = fileInfos
        .filter(f => f.summarizeData)
        .map(f => `文件 ${f.file.name}: ${f.summarizeData!.row_count} 行, ${f.summarizeData!.column_count} 列`)
        .join('; ');
      
      contextualInput = `基于已上传的数据文件 (${dataInfo})，请提供SQL查询来回答: ${input}`;
    }
    
    // 创建新的表单事件，包含修改后的输入
    const inputElement = e.currentTarget.querySelector('input') as HTMLInputElement;
    if (inputElement) {
      const originalValue = inputElement.value;
      inputElement.value = contextualInput;
      
      // 提交表单
      handleSubmit(e);
      
      // 恢复原始值
      inputElement.value = originalValue;
    }
  };
  
  return (
    <div className="h-screen bg-gray-50">
      {/* 主内容区域 */}
      <div className="flex h-full">
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div className="bg-white border-b border-gray-200 px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">数据分析助手</h1>
            <p className="text-gray-600 mt-1">
              上传您的数据文件，AI将生成SQL查询并执行分析
              {initializingPyodide && (
                <span className="ml-2 text-yellow-600">• 正在初始化分析引擎...</span>
              )}
              {!initializingPyodide && pyodide && (
                <span className="ml-2 text-green-600">• 分析引擎已就绪</span>
              )}
              {isExecutingSQL && (
                <span className="ml-2 text-blue-600">• 正在执行SQL查询...</span>
              )}
            </p>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">准备分析您的数据</h3>
                  <p className="text-gray-500">在右侧上传文件，然后询问关于您数据的问题，AI会生成SQL查询并执行分析</p>
                </div>
              </div>
            ) : (
              messages.filter(m => m.role !== 'system').map((m: Message, index) => {
                const isLastAIMessage = m.role === 'assistant' && index === messages.filter(m => m.role !== 'system').length - 1;
                return (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    chartData={isLastAIMessage ? latestChartConfig : null}
                  />
                );
              })
            )}
          </div>

          {/* 输入区域 */}
          <div className="bg-white border-t border-gray-200 px-8 py-4">
            <form onSubmit={handleSubmitWithContext}>
              <div className="flex items-center space-x-3">
                <input
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={input}
                  placeholder="询问关于您数据的任何问题，AI会生成SQL查询..."
                  onChange={handleInputChange}
                  disabled={initializingPyodide || isExecutingSQL}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || initializingPyodide || isExecutingSQL}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isExecutingSQL ? '执行中...' : '分析'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 文件上传面板 */}
        <FileUploadPanel
          fileInfos={fileInfos}
          onFileSelect={handleFileSelect}
          onRemoveFile={removeFile}
          isAnalyzing={isAnalyzing}
        />
      </div>
    </div>
  );
}