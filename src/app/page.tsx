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
      </div>
    </div>
  );
}

// 文件上传面板组件 - 紧凑版本
function FileUploadPanel({ fileInfos, onFileSelect, onRemoveFile }: {
  fileInfos: FileInfo[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
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
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
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
    const extension = fileName.toLowerCase().split('.').pop();
    
    // Excel文件可能有多个sheet
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
          },
          {
            name: 'Sales_2023',
            rowCount: 980,
            columns: [
              { name: 'order_id', type: 'string', description: '订单ID' },
              { name: 'customer_id', type: 'string', description: '客户ID' },
              { name: 'product_code', type: 'string', description: '产品代码' },
              { name: 'amount', type: 'number', description: '金额' },
              { name: 'date', type: 'date', description: '日期' }
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
          },
          {
            name: 'Summary',
            rowCount: Math.floor(Math.random() * 100) + 20,
            columns: [
              { name: 'category', type: 'string', description: '类别' },
              { name: 'total_count', type: 'number', description: '总数量' },
              { name: 'avg_value', type: 'number', description: '平均值' }
            ]
          }
        ];
      }
    } 
    // CSV或其他单表文件
    else {
      if (fileName.toLowerCase().includes('user') || fileName.toLowerCase().includes('用户')) {
        return [{
          name: 'Users',
          rowCount: 8640,
          columns: [
            { name: 'user_id', type: 'string', description: '用户唯一ID' },
            { name: 'username', type: 'string', description: '用户名' },
            { name: 'email', type: 'string', description: '邮箱地址' },
            { name: 'age', type: 'number', description: '年龄' },
            { name: 'gender', type: 'string', description: '性别' },
            { name: 'registration_date', type: 'date', description: '注册日期' },
            { name: 'last_login', type: 'date', description: '最后登录时间' },
            { name: 'is_active', type: 'string', description: '是否活跃用户' }
          ]
        }];
      } else if (fileName.toLowerCase().includes('product') || fileName.toLowerCase().includes('产品')) {
        return [{
          name: 'Products',
          rowCount: 450,
          columns: [
            { name: 'product_id', type: 'string', description: '产品ID' },
            { name: 'product_name', type: 'string', description: '产品名称' },
            { name: 'category', type: 'string', description: '产品类别' },
            { name: 'price', type: 'number', description: '价格' },
            { name: 'stock_quantity', type: 'number', description: '库存数量' },
            { name: 'supplier', type: 'string', description: '供应商' },
            { name: 'created_date', type: 'date', description: '创建日期' }
          ]
        }];
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
        />
      </div>
    </div>
  );
}