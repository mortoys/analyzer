import { PyodideInstance, PythonQueryResult } from '@/types';

export const loadPythonPackage = async (pyodide: PyodideInstance): Promise<void> => {
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

export const initPyodide = async (): Promise<PyodideInstance> => {
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

  // 安全地创建目录，避免已存在的错误
  try {
    pyodideInstance.FS.mkdir('/analyzer');
  } catch {
    // 如果目录已存在，忽略错误
    console.log('目录 /analyzer 可能已存在，继续执行');
  }
  
  try {
    pyodideInstance.FS.mkdir('/tmp');
  } catch {
    // 如果目录已存在，忽略错误  
    console.log('目录 /tmp 可能已存在，继续执行');
  }
  
  await loadPythonPackage(pyodideInstance);
  
  return pyodideInstance;
};

export const executeSQL = async (query: string, pyodide: PyodideInstance): Promise<PythonQueryResult> => {
  const cleanQuery = query.trim().replace(/^```sql\s*/, '').replace(/\s*```$/, '');
  
  const result = pyodide.runPython(`
import analyzer

# 确保连接存在
if analyzer.db_manager.conn is None:
    analyzer.db_manager.connect()
    print("重新建立数据库连接")

# 检查表是否已准备好
if not hasattr(analyzer, 'table_ready') or not analyzer.table_ready:
    result = {"error": "没有可用的数据表，请先上传CSV文件", "success": False}
else:
    try:
        query_str = """${cleanQuery}"""
        
        print(f"执行查询: {query_str}")
        
        cursor = analyzer.db_manager.execute_query(query_str)
        query_result = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        print(f"查询返回: {len(query_result)} 行, {len(columns)} 列")
        
        result = {
            "data": [[str(cell) if cell is not None else None for cell in row] for row in query_result],
            "columns": columns,
            "row_count": len(query_result),
            "column_count": len(columns),
            "query": query_str,
            "success": True
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print("查询执行失败:")
        print(str(e))
        result = {"error": f"{str(e)}\\n{error_details}", "success": False}

result
  `);
  
  if (!result) {
    throw new Error("Python返回结果为null或undefined");
  }
  
  return result.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
}; 