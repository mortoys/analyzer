"""
工具模块
提供数据处理和转换的通用功能
"""

from typing import List, Any, Dict, Union
import decimal


class DataProcessor:
    """数据处理器"""
    
    def process_query_result(self, result_data: List[List[Any]], columns: List[str]) -> Dict[str, Any]:
        """
        处理查询结果，转换数据类型以确保 JavaScript 兼容性
        
        Args:
            result_data: 查询结果数据
            columns: 列名列表
            
        Returns:
            处理后的结果字典
        """
        processed_data = []
        
        for row in result_data:
            processed_row = []
            for cell in row:
                processed_cell = self._convert_cell_value(cell)
                processed_row.append(processed_cell)
            processed_data.append(processed_row)
        
        result = {
            "data": processed_data,
            "columns": columns,
            "row_count": len(processed_data),
            "column_count": len(columns)
        }
        
        return result
    
    def _convert_cell_value(self, cell: Any) -> Union[str, None, int, float]:
        """
        转换单个单元格值为 JavaScript 兼容类型
        
        Args:
            cell: 单元格值
            
        Returns:
            转换后的值
        """
        if cell is None:
            return None
        elif isinstance(cell, decimal.Decimal):
            # 处理 Decimal 类型
            return float(cell)
        elif isinstance(cell, (int, float)):
            return cell
        elif hasattr(cell, '__str__'):
            # 将其他类型转换为字符串
            return str(cell)
        else:
            return cell
    
    def format_table_info(self, row_count: int, column_names: List[str]) -> Dict[str, Any]:
        """
        格式化表信息
        
        Args:
            row_count: 行数
            column_names: 列名列表
            
        Returns:
            格式化的表信息
        """
        return {
            "row_count": row_count,
            "column_count": len(column_names),
            "column_names": column_names,
            "summary": f"{row_count} 行 × {len(column_names)} 列"
        }
    
    def validate_data_format(self, data: List[List[Any]], columns: List[str]) -> bool:
        """
        验证数据格式是否正确
        
        Args:
            data: 数据行列表
            columns: 列名列表
            
        Returns:
            是否格式正确
        """
        if not data or not columns:
            return False
        
        # 检查每行的列数是否一致
        expected_cols = len(columns)
        for i, row in enumerate(data):
            if len(row) != expected_cols:
                print(f"警告: 第 {i+1} 行有 {len(row)} 列，期望 {expected_cols} 列")
                return False
        
        return True 