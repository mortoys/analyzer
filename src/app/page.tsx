'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from '@ai-sdk/react';
import { useState, useRef } from 'react';

interface TableColumn {
  name: string;
  type: string;
  description: string;
}

interface FileInfo {
  file: File;
  isExpanded: boolean;
  tables: {
    name: string;
    rowCount: number;
    columns: TableColumn[];
  }[];
}

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
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-gray-900">{column.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{column.description}</div>
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(column.type)}`}>
        {column.type}
      </div>
    </div>
  );
}

// 表格信息组件
function TableInfo({ table, isExpanded, onToggleExpanded }: {
  table: { name: string; rowCount: number; columns: TableColumn[] };
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50" 
        onClick={onToggleExpanded}
      >
        <div className="flex-1">
          <div className="font-medium text-gray-900">{table.name}</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {table.rowCount.toLocaleString()} rows • {table.columns.length} columns
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">{table.columns.length}</span>
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
      
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-gray-100">
          {table.columns.map((column, colIndex) => (
            <ColumnInfo key={colIndex} column={column} />
          ))}
        </div>
      )}
    </div>
  );
}

// 文件信息卡片组件
function FileInfoCard({ fileInfo, index, onRemove, onToggleExpanded }: {
  fileInfo: FileInfo;
  index: number;
  onRemove: (index: number) => void;
  onToggleExpanded: (index: number) => void;
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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{fileInfo.file.name}</div>
            <div className="text-sm text-gray-500 mt-0.5">
              {formatFileSize(fileInfo.file.size)} • {getFileExtension(fileInfo.file.name)}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-3 space-y-3">
        {fileInfo.tables.map((table, tableIndex) => (
          <TableInfo
            key={tableIndex}
            table={table}
            isExpanded={fileInfo.isExpanded}
            onToggleExpanded={() => onToggleExpanded(index)}
          />
        ))}
      </div>
    </div>
  );
}

// 文件上传面板组件
function FileUploadPanel({ fileInfos, onFileSelect, onRemoveFile, onToggleExpanded }: {
  fileInfos: FileInfo[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onToggleExpanded: (index: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed top-6 right-6 w-80 bg-white rounded-lg border border-gray-200 shadow-lg z-10 max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Data Sources</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          Upload
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fileInfos.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm mb-3">No data files uploaded</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Upload your first file
            </button>
          </div>
        ) : (
          fileInfos.map((fileInfo, index) => (
            <FileInfoCard
              key={index}
              fileInfo={fileInfo}
              index={index}
              onRemove={onRemoveFile}
              onToggleExpanded={onToggleExpanded}
            />
          ))
        )}
      </div>

      {fileInfos.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="text-sm text-gray-600">
            {fileInfos.length} file{fileInfos.length > 1 ? 's' : ''} loaded
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFileSelect}
        accept=".csv,.xlsx,.xls,.tsv"
      />
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
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  
  // 模拟生成表格信息的假数据
  const generateMockTableInfo = (fileName: string) => {
    // 根据文件名生成不同的假数据
    if (fileName.toLowerCase().includes('sales') || fileName.toLowerCase().includes('销售')) {
      return [{
        name: 'Sales Data',
        rowCount: 1250,
        columns: [
          { name: 'order_id', type: 'string', description: 'Unique order identifier' },
          { name: 'customer_name', type: 'string', description: 'Customer full name' },
          { name: 'product_name', type: 'string', description: 'Product name' },
          { name: 'sales_amount', type: 'number', description: 'Total sales amount' },
          { name: 'order_date', type: 'date', description: 'Order date' },
          { name: 'region', type: 'string', description: 'Sales region' }
        ]
      }];
    } else if (fileName.toLowerCase().includes('user') || fileName.toLowerCase().includes('用户')) {
      return [{
        name: 'User Information',
        rowCount: 8640,
        columns: [
          { name: 'user_id', type: 'string', description: 'Unique user ID' },
          { name: 'username', type: 'string', description: 'Username' },
          { name: 'email', type: 'string', description: 'Email address' },
          { name: 'age', type: 'number', description: 'User age' },
          { name: 'gender', type: 'string', description: 'User gender' },
          { name: 'registration_date', type: 'date', description: 'Registration date' }
        ]
      }];
    } else {
      return [{
        name: 'Data Table',
        rowCount: Math.floor(Math.random() * 5000) + 100,
        columns: [
          { name: 'id', type: 'number', description: 'Primary key ID' },
          { name: 'name', type: 'string', description: 'Name field' },
          { name: 'value', type: 'number', description: 'Numeric value' },
          { name: 'category', type: 'string', description: 'Category' },
          { name: 'created_at', type: 'date', description: 'Creation timestamp' }
        ]
      }];
    }
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // 只接受表格文件
    const tableFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return ['csv', 'xlsx', 'xls', 'tsv'].includes(extension || '');
    });
    
    const newFileInfos = tableFiles.map(file => ({
      file,
      isExpanded: false,
      tables: generateMockTableInfo(file.name)
    }));
    
    setFileInfos(prev => [...prev, ...newFileInfos]);
  };

  const removeFile = (index: number) => {
    setFileInfos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExpanded = (index: number) => {
    setFileInfos(prev => prev.map((info, i) => 
      i === index ? { ...info, isExpanded: !info.isExpanded } : info
    ));
  };
  
  return (
    <div className="h-screen bg-gray-50">
      {/* 主内容区域 */}
      <div className="flex h-full">
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div className="bg-white border-b border-gray-200 px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Data Analysis</h1>
            <p className="text-gray-600 mt-1">Upload your data files and start analyzing</p>
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to analyze your data</h3>
                  <p className="text-gray-500">Upload files on the right and ask questions about your data</p>
                </div>
              </div>
            ) : (
              messages.map((m: Message) => (
                <ChatMessage key={m.id} message={m} />
              ))
            )}
          </div>

          {/* 输入区域 */}
          <div className="bg-white border-t border-gray-200 px-8 py-4">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center space-x-3">
                <input
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={input}
                  placeholder="Ask me anything about your data..."
                  onChange={handleInputChange}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Analyze
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
          onToggleExpanded={toggleExpanded}
        />
      </div>
    </div>
  );
}