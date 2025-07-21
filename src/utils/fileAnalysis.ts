import { AnalysisResult, TableColumn, PyodideInstance, PythonQueryResult } from '@/types';

export const analyzeFileWithDuckDB = async (file: File, pyodide: PyodideInstance): Promise<AnalysisResult> => {
  const filePath = `/tmp/data.csv`;
  const stream = file.stream();
  const reader = stream.getReader();

  // 使用流式传输将文件写入 Pyodide 虚拟文件系统
  const pyodideStream = pyodide.FS.open(filePath, 'w');
  let position = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pyodide.FS.write(pyodideStream, value, 0, value.length, position);
      position += value.length;
    }
  } finally {
    pyodide.FS.close(pyodideStream);
  }

  // 执行Python代码并获取结果
  pyodide.runPython(`
import analyzer
import os

# 确保连接存在
if analyzer.db_manager.conn is None:
    analyzer.db_manager.connect()
    print("重新建立数据库连接")

file_path = '${filePath}'
table_name = "csv_data"

try:
    # 删除已存在的表
    try:
        analyzer.db_manager.execute_query(f"DROP TABLE IF EXISTS {table_name}")
    except:
        pass
    
    # 将 CSV 文件加载到 DuckDB 表中
    create_query = f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{file_path}')"
    analyzer.db_manager.execute_query(create_query)
    
    # 获取表信息
    columns_query = f"DESCRIBE {table_name}"
    columns_result = analyzer.db_manager.execute_query(columns_query).fetchall()
    columns = [row[0] for row in columns_result]
    column_types = [row[1] for row in columns_result]
    
    # 获取行数
    count_query = f"SELECT COUNT(*) FROM {table_name}"
    row_count = analyzer.db_manager.execute_query(count_query).fetchone()[0]
    
    # 获取样本数据
    sample_query = f"SELECT * FROM {table_name} LIMIT 5"
    sample_data = analyzer.db_manager.execute_query(sample_query).fetchall()
    
    # 数据已加载到数据库，现在可以删除文件系统中的文件以释放内存
    try:
        os.remove(file_path)
        print(f"已删除临时文件 '{file_path}'，释放文件系统内存")
    except:
        print(f"无法删除临时文件 '{file_path}'，但不影响功能")
    
    # 设置表已就绪的标志
    analyzer.table_ready = True
    analyzer.current_table_name = table_name
    
    print(f"成功将文件加载到表 '{table_name}'，共 {row_count} 行，{len(columns)} 列")
    
    # 将结果存储到全局变量中
    globals()['load_result'] = {
        "success": True, 
        "row_count": row_count,
        "columns": columns,
        "column_types": column_types,
        "sample_data": sample_data,
        "table_name": table_name
    }
    
except Exception as e:
    import traceback
    error_details = traceback.format_exc()
    print(f"加载数据失败: {e}")
    print(error_details)
    
    # 如果失败，也尝试删除临时文件
    try:
        os.remove(file_path)
    except:
        pass
        
    globals()['load_result'] = {"error": f"加载数据失败: {e}\\n{error_details}", "success": False}
  `);

  const loadResult = pyodide.runPython('load_result');
  
  if (!loadResult) {
    throw new Error("数据加载失败：Python执行返回空结果");
  }
  
  const loadJs = loadResult.toJs({ dict_converter: Object.fromEntries }) as PythonQueryResult;
  
  if (loadJs.error) {
    throw new Error(`数据加载失败：${loadJs.error}`);
  }
  
  console.log(`数据加载成功，共 ${loadJs.row_count} 行`);
  
  // 构建列详细信息
  const columnDetails: TableColumn[] = (loadJs.columns || []).map((name: string, index: number) => ({
    name,
    type: loadJs.column_types?.[index] || 'unknown',
    description: `${loadJs.column_types?.[index] || 'unknown'} 类型字段`
  }));
  
  return {
    data: loadJs.sample_data || [],
    columns: loadJs.columns || [],
    row_count: loadJs.row_count || 0,
    column_count: loadJs.columns?.length || 0,
    column_details: columnDetails
  };
};

export const generateColumnDescriptions = async (
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

export const generateMockTableInfo = (fileName: string) => {
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