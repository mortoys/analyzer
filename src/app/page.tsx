'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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
components = analyzer.initialize()
print("Python 包已成功导入和初始化")
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
  
  // 使用 DuckDB 加载数据
  pyodide.runPython(`
csv_content = """${fileContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""
row_count = analyzer.load_csv(csv_content)
print(f"成功加载 {row_count} 行数据")
  `);
  
  // 执行 summarize 分析
  const summarizeResult = pyodide.runPython(`
result_dict = analyzer.summarize_data()
result_dict
  `);
  
  return summarizeResult.toJs({ dict_converter: Object.fromEntries }) as AnalysisResult;
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
function ChatMessage({ message }: { message: Message }) {
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
      return `文件 ${fileInfo.file.name} 的数据分析结果：
- 总行数: ${fileInfo.summarizeData.row_count}
- 字段数: ${fileInfo.summarizeData.column_count}
- 字段信息: ${fileInfo.summarizeData.columns?.join(', ')}
- 分析数据: ${JSON.stringify(fileInfo.summarizeData.data?.slice(0, 5))}`;
    }
    return `文件 ${fileInfo.file.name} 已上传但未分析`;
  }).join('\n\n');

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    initialMessages: dataContext ? [
      {
        id: 'system',
        role: 'system',
        content: `你是一个数据分析助手。当前已上传的数据文件信息：\n\n${dataContext}\n\n请基于这些数据回答用户的问题。`
      }
    ] : [],
    onFinish: (message) => {
      // 在消息完成后，可以添加一些逻辑
      console.log('AI 回复完成:', message);
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
            } catch (error) {
              console.error(`分析文件 ${file.name} 失败:`, error);
            }
          }
          
          return fileInfo;
        })
      );
      
      setFileInfos(prev => [...prev, ...newFileInfos]);
      
    } catch (error) {
      console.error('文件处理失败:', error);
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
    
    if (!input.trim()) return;
    
    // 构建包含数据上下文的消息
    let contextualInput = input;
    
    if (fileInfos.length > 0 && fileInfos.some(f => f.summarizeData)) {
      const dataInfo = fileInfos
        .filter(f => f.summarizeData)
        .map(f => `文件 ${f.file.name}: ${f.summarizeData!.row_count} 行, ${f.summarizeData!.column_count} 列`)
        .join('; ');
      
      contextualInput = `基于已上传的数据文件 (${dataInfo})，请回答: ${input}`;
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
              上传您的数据文件并开始分析
              {initializingPyodide && (
                <span className="ml-2 text-yellow-600">• 正在初始化分析引擎...</span>
              )}
              {!initializingPyodide && pyodide && (
                <span className="ml-2 text-green-600">• 分析引擎已就绪</span>
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
                  <p className="text-gray-500">在右侧上传文件，然后询问关于您数据的问题</p>
                </div>
              </div>
            ) : (
              messages.filter(m => m.role !== 'system').map((m: Message) => (
                <ChatMessage key={m.id} message={m} />
              ))
            )}
          </div>

          {/* 输入区域 */}
          <div className="bg-white border-t border-gray-200 px-8 py-4">
            <form onSubmit={handleSubmitWithContext}>
              <div className="flex items-center space-x-3">
                <input
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={input}
                  placeholder="询问关于您数据的任何问题..."
                  onChange={handleInputChange}
                  disabled={initializingPyodide}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || initializingPyodide}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  分析
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