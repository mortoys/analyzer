'use client';

import { useRef, useState } from 'react';
import { FileInfo } from '@/types';
import { FileInfoCard } from './FileInfoCard';

interface FileUploadPanelProps {
  fileInfos: FileInfo[];
  onFileSelect: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  isAnalyzing: boolean;
}

export function FileUploadPanel({ 
  fileInfos, 
  onFileSelect, 
  onRemoveFile, 
  isAnalyzing 
}: FileUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFileSelect(files);
    }
    // 重置文件输入
    if (event.target) {
      event.target.value = '';
    }
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
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls,.tsv"
          disabled={isAnalyzing}
        />
      </div>
    </div>
  );
} 