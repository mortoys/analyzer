import { FileInfo } from '@/types';
import { TableInfo } from './TableInfo';

interface FileInfoCardProps {
  fileInfo: FileInfo;
  index: number;
  onRemove: (index: number) => void;
}

export function FileInfoCard({ fileInfo, index, onRemove }: FileInfoCardProps) {
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