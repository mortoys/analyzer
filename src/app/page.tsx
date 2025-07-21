'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from '@ai-sdk/react';
import { useState } from 'react';

// 导入类型定义
import { EChartsConfig, SQLExecutionResult } from '@/types';

// 导入自定义 hooks
import { usePyodide } from '@/hooks/usePyodide';
import { useFileAnalysis } from '@/hooks/useFileAnalysis';

// 导入工具函数
import { executeSQL } from '@/utils/pyodide';
import { containsSQL, extractSQL, generateEChartsConfig } from '@/utils/charts';

// 导入组件
import { ChatMessage } from '@/components/ChatMessage';
import { FileUploadPanel } from '@/components/FileUpload/FileUploadPanel';

export default function Chat() {
  // 使用自定义 hooks
  const { pyodide, isInitializing: initializingPyodide, isReady } = usePyodide();
  const { 
    fileInfos, 
    isAnalyzing, 
    handleFileSelect, 
    removeFile, 
    getDataContext,
    hasAnalyzedFiles 
  } = useFileAnalysis(pyodide);

  // 状态管理
  const [isExecutingSQL, setIsExecutingSQL] = useState(false);
  const [latestChartConfig, setLatestChartConfig] = useState<EChartsConfig | null>(null);

  // 创建包含数据上下文的聊天实例
  const dataContext = getDataContext();

  // 聊天配置，添加SQL执行逻辑
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
          const pythonResult = await executeSQL(sqlQuery, pyodide);
          
          const result: SQLExecutionResult = {
            success: pythonResult.success !== false,
            data: pythonResult.data,
            columns: pythonResult.columns,
            row_count: pythonResult.row_count,
            column_count: pythonResult.column_count,
            error: pythonResult.error,
            query: sqlQuery
          };
          
          if (result.success) {
            // 生成图表配置
            if (result.data && result.columns && result.data.length > 0) {
              try {
                const chartConfig = await generateEChartsConfig(
                  result.data,
                  result.columns,
                  sqlQuery
                );
                if (chartConfig) {
                  setLatestChartConfig(chartConfig);
                }
              } catch (error) {
                console.error('生成图表配置失败:', error);
              }
            }

            // 构建结果描述
            const resultSummary = `SQL查询执行成功！
查询：${result.query}
结果：${result.row_count} 行，${result.column_count} 列
列名：${result.columns?.join(', ')}

前${Math.min(5, result.row_count || 0)}行数据：
${result.data?.slice(0, 5).map(row => row?.join(' | ')).join('\n')}`;
            
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

  // 自定义提交处理，包含数据上下文
  const handleSubmitWithContext = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isExecutingSQL) return;
    
    // 构建包含数据上下文的消息
    let contextualInput = input;
    
    if (hasAnalyzedFiles) {
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
              {isReady && (
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