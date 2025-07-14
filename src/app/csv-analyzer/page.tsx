/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';

interface AnalysisResult {
  type: 'describe' | 'summarize';
  data: any[][];
  columns: string[];
}

// 1. 初始化 Pyodide
const initPyodide = async (): Promise<any> => {
  // 检查是否已有 Pyodide
  if (typeof window !== 'undefined' && !(window as any).loadPyodide) {
    // 动态加载 Pyodide 脚本
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // 初始化 Pyodide 实例
  const pyodideInstance = await (window as any).loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
  });
  
  // 安装必要的包
  await pyodideInstance.loadPackage(['micropip']);
  await pyodideInstance.runPythonAsync(`
    import micropip
    await micropip.install('duckdb')
  `);
  
  return pyodideInstance;
};

// 2. 接收和处理数据 - 使用 DuckDB 原生 CSV 读取能力
const receiveData = async (file: File, pyodide: any): Promise<void> => {
  const fileContent = await file.text();
  
  // 将 CSV 内容写入虚拟文件系统，然后使用 DuckDB 的 read_csv_auto 读取
  pyodide.runPython(`
import duckdb
import io

# 创建 DuckDB 连接
conn = duckdb.connect(':memory:')

# CSV 内容
csv_content = """${fileContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""

# 将 CSV 内容写入虚拟文件系统
with open('/tmp/data.csv', 'w') as f:
    f.write(csv_content)

# 使用 DuckDB 的原生 CSV 读取能力
conn.execute("CREATE TABLE csv_data AS SELECT * FROM read_csv_auto('/tmp/data.csv')")
  `);
};

// 3. 运行命令
const runCommand = async (commandType: 'describe' | 'summarize', pyodide: any): Promise<AnalysisResult> => {
  const command = commandType.toUpperCase();
  
  try {
    const pythonResult = pyodide.runPython(`
# 检查表是否存在
try:
    table_info = conn.execute("SELECT count(*) FROM csv_data").fetchone()
    print(f"表中有 {table_info[0]} 行数据")
except Exception as e:
    print(f"表不存在或访问错误: {e}")
    raise e

# 执行 ${command}
print(f"正在执行: ${command} csv_data")
try:
    cursor = conn.execute("${command} csv_data")
    result_data = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    print(f"查询返回: {len(result_data)} 行, {len(columns)} 列")
    print(f"列名: {columns}")
    print(f"前3行数据: {result_data[:3]}")
except Exception as e:
    print(f"查询执行错误: {e}")
    raise e

# 处理数据类型转换，特别是 Decimal 类型
processed_data = []
for row in result_data:
    processed_row = []
    for cell in row:
        if cell is None:
            processed_row.append(None)
        elif hasattr(cell, '__str__'):
            # 将所有数据转换为字符串，确保 JavaScript 能正确处理
            processed_row.append(str(cell))
        else:
            processed_row.append(cell)
    processed_data.append(processed_row)

print(f"处理后数据: {len(processed_data)} 行")
result_dict = {"data": processed_data, "columns": columns}
print(f"最终返回字典的类型: {type(result_dict)}")
print(f"数据键: {list(result_dict.keys())}")
result_dict
    `);

    // 将 PyProxy 对象转换为 JavaScript 对象
    const result = pythonResult.toJs({ dict_converter: Object.fromEntries }) as { data: any[][]; columns: string[] };

    console.log('JavaScript 接收到的数据:', result);
    console.log('数据类型:', typeof result);
    console.log('数据键:', Object.keys(result || {}));
    console.log('数据行数:', result?.data?.length);
    console.log('列数:', result?.columns?.length);

    return {
      type: commandType,
      data: result?.data || [],
      columns: result?.columns || []
    };
  } catch (error) {
    console.error('runCommand 执行错误:', error);
    throw error;
  }
};

export default function CSVAnalyzer() {
  const [pyodide, setPyodide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化 Pyodide
  const handleInitPyodide = async () => {
    setLoading(true);
    setError('');
    
    try {
      const pyodideInstance = await initPyodide();
      setPyodide(pyodideInstance);
    } catch (err) {
      setError('初始化失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleReceiveData = async (file: File) => {
    if (!file || !pyodide) return;

    setLoading(true);
    setError('');
    setFileName(file.name);

    try {
      await receiveData(file, pyodide);
      setAnalysisResults([]);
    } catch (err) {
      setError('数据处理失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 处理命令执行
  const handleRunCommand = async (commandType: 'describe' | 'summarize') => {
    if (!pyodide) return;

    setLoading(true);
    setError('');

    try {
      console.log(`开始执行 ${commandType.toUpperCase()} 命令`);
      const result = await runCommand(commandType, pyodide);
      console.log('命令执行结果:', result);
      console.log('当前分析结果数量:', analysisResults.length);
      
      setAnalysisResults(prev => {
        const newResults = [...prev, result];
        console.log('更新后的分析结果数量:', newResults.length);
        return newResults;
      });
    } catch (err) {
      console.error(`${commandType.toUpperCase()} 执行错误:`, err);
      setError(`${commandType.toUpperCase()} 执行失败: ` + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 清除结果
  const clearResults = () => {
    setAnalysisResults([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 文件选择处理
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleReceiveData(file);
    }
  };

  // 初始化 Pyodide
  useEffect(() => {
    handleInitPyodide();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      
      {/* 文件上传区域 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">上传 CSV 文件</h2>
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={loading || !pyodide}
          />
          {fileName && (
            <span className="text-sm text-green-600 font-medium">
              已选择: {fileName}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">数据分析操作</h2>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => handleRunCommand('describe')}
            disabled={loading || !pyodide || !fileName}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : '执行 DESCRIBE'}
          </button>
          <button
            onClick={() => handleRunCommand('summarize')}
            disabled={loading || !pyodide || !fileName}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : '执行 SUMMARIZE'}
          </button>
          <button
            onClick={clearResults}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            清除结果
          </button>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong>错误:</strong> {error}
        </div>
      )}

      {/* 初始化状态 */}
      {!pyodide && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          正在初始化 Pyodide 和 DuckDB...
        </div>
      )}

      {/* 分析结果 */}
      <div className="space-y-6">
        {analysisResults.length > 0 && (
          <div className="text-sm text-gray-600 mb-4">
            共有 {analysisResults.length} 个分析结果
          </div>
        )}
        {analysisResults.map((result, index) => {
          console.log(`渲染结果 ${index}:`, result);
          return (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 capitalize">
                {result.type === 'describe' ? 'DESCRIBE 结果' : 'SUMMARIZE 结果'}
                <span className="text-sm text-gray-500 ml-2">
                  ({result.data?.length || 0} 行, {result.columns?.length || 0} 列)
                </span>
              </h3>
              {result.columns && result.columns.length > 0 && result.data && result.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        {result.columns.map((column, colIndex) => (
                          <th
                            key={colIndex}
                            className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-900"
                          >
                            {column || `列 ${colIndex + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {result.columns.map((_, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="border border-gray-300 px-4 py-2 text-sm text-gray-700"
                            >
                              {row[cellIndex] !== null && row[cellIndex] !== undefined 
                                ? String(row[cellIndex]) 
                                : 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  没有数据可显示
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 