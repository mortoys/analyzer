import { EChartsConfig } from '@/types';

export const generateEChartsConfig = async (
  data: unknown[][],
  columns: string[],
  query: string
): Promise<EChartsConfig | null> => {
  try {
    return generateDefaultChart(data, columns, query);
  } catch (error) {
    console.error('生成图表配置失败:', error);
    return generateDefaultChart(data, columns, query);
  }
};

export const generateDefaultChart = (
  data: unknown[][],
  columns: string[],
  query: string
): EChartsConfig => {
  // 简单的数据分析来决定图表类型
  const isCountQuery = query.toLowerCase().includes('count');
  const isGroupBy = query.toLowerCase().includes('group by');

  if (isCountQuery || isGroupBy) {
    // 统计类查询使用柱状图
    return {
      option: {
        title: { text: '数据统计' },
        tooltip: {},
        xAxis: {
          type: 'category',
          data: data.map(row => String(row[0]))
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          type: 'bar',
          data: data.map(row => Number(row[1]) || 0)
        }]
      },
      title: '数据统计图表',
      description: '基于查询结果生成的统计图表'
    };
  } else {
    // 其他情况使用表格形式的柱状图
    return {
      option: {
        title: { text: '数据概览' },
        tooltip: {},
        xAxis: {
          type: 'category',
          data: data.map((_, index) => `行${index + 1}`)
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          type: 'bar',
          data: data.map(row => Number(row[0]) || 0)
        }]
      },
      title: '数据概览图表',
      description: '数据的可视化展示'
    };
  }
};

export const containsSQL = (message: string): boolean => {
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'WITH', 'DESCRIBE', 'SUMMARIZE'];
  const upperMessage = message.toUpperCase();
  return sqlKeywords.some(keyword => upperMessage.includes(keyword));
};

export const extractSQL = (message: string): string => {
  // 移除markdown SQL代码块标记
  const cleanMessage = message.replace(/```sql\s*\n?/gi, '').replace(/\n?\s*```/g, '');
  return cleanMessage.trim();
}; 