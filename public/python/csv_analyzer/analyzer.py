"""
数据分析模块
处理各种数据分析命令
"""

from typing import Dict, List, Any


class DataAnalyzer:
    """数据分析器"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
        # 延迟导入工具类以避免循环导入
        from .utils import DataProcessor
        self.data_processor = DataProcessor()
    
    def describe(self, table_name: str = "csv_data") -> Dict[str, Any]:
        """
        执行 DESCRIBE 分析
        
        Args:
            table_name: 要分析的表名
            
        Returns:
            分析结果字典
        """
        return self._run_analysis_command("DESCRIBE", table_name)
    
    def summarize(self, table_name: str = "csv_data") -> Dict[str, Any]:
        """
        执行 SUMMARIZE 分析
        
        Args:
            table_name: 要分析的表名
            
        Returns:
            分析结果字典
        """
        return self._run_analysis_command("SUMMARIZE", table_name)
    
    def _run_analysis_command(self, command: str, table_name: str) -> Dict[str, Any]:
        """
        执行分析命令的内部方法
        
        Args:
            command: SQL 命令 (DESCRIBE 或 SUMMARIZE)
            table_name: 表名
            
        Returns:
            处理后的分析结果
        """
        try:
            # 验证表是否存在
            if not self.db_manager.table_exists():
                raise ValueError(f"表 '{table_name}' 不存在")
            
            # 获取表信息
            row_count, _ = self.db_manager.get_table_info()
            
            # 执行分析命令
            query = f"{command} {table_name}"
            print(f"正在执行: {query}")
            
            cursor = self.db_manager.execute_query(query)
            result_data = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            
            print(f"查询返回: {len(result_data)} 行, {len(columns)} 列")
            print(f"列名: {columns}")
            
            if result_data:
                print(f"前3行数据: {result_data[:3]}")
            
            # 使用数据处理器处理结果
            processed_result = self.data_processor.process_query_result(result_data, columns)
            
            # 添加额外的元信息
            processed_result.update({
                "command": command,
                "table_name": table_name,
                "source_table_rows": row_count
            })
            
            print(f"分析完成: {processed_result['row_count']} 行结果")
            
            return processed_result
            
        except Exception as e:
            print(f"{command} 命令执行失败: {e}")
            raise e
    
    def custom_query(self, query: str) -> Dict[str, Any]:
        """
        执行自定义查询
        
        Args:
            query: 自定义 SQL 查询
            
        Returns:
            查询结果
        """
        try:
            print(f"执行自定义查询: {query}")
            
            cursor = self.db_manager.execute_query(query)
            result_data = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            
            processed_result = self.data_processor.process_query_result(result_data, columns)
            processed_result["query"] = query
            
            return processed_result
            
        except Exception as e:
            print(f"自定义查询执行失败: {e}")
            raise e 