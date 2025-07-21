'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { EChartsConfig } from '@/types';

interface EChartsComponentProps {
  config: EChartsConfig;
}

export function EChartsComponent({ config }: EChartsComponentProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // 设置图表配置
    chart.setOption(config.option);

    // 窗口大小改变时调整图表大小
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [config]);

  return (
    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{config.title}</h3>
      {config.description && (
        <p className="text-sm text-gray-600 mb-4">{config.description}</p>
      )}
      <div ref={chartRef} className="w-full h-96" />
    </div>
  );
} 