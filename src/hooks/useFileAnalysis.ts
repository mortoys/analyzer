import { useState, useCallback } from 'react';
import { FileInfo, PyodideInstance } from '@/types';
import { analyzeFileWithDuckDB, generateColumnDescriptions, generateMockTableInfo } from '@/utils/fileAnalysis';

export const useFileAnalysis = (pyodide: PyodideInstance | null) => {
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileSelect = useCallback(async (files: File[]) => {
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
  }, [pyodide]);

  const removeFile = useCallback((index: number) => {
    setFileInfos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getDataContext = useCallback(() => {
    return fileInfos.map(fileInfo => {
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
  }, [fileInfos]);

  return {
    fileInfos,
    isAnalyzing,
    handleFileSelect,
    removeFile,
    getDataContext,
    hasAnalyzedFiles: fileInfos.some(f => f.summarizeData)
  };
}; 