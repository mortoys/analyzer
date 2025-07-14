"""
数据库管理模块
处理 DuckDB 连接和基本数据库操作
"""

import duckdb
from typing import Optional, Tuple, List, Any


class DatabaseManager:
    """DuckDB 数据库管理器"""
    
    def __init__(self):
        self.conn: Optional[Any] = None
        self.table_name = "csv_data"
    
    def connect(self) -> Any:
        """创建数据库连接"""
        if self.conn is None:
            self.conn = duckdb.connect(':memory:')
            print("DuckDB 连接已创建")
        return self.conn
    
    def disconnect(self):
        """关闭数据库连接"""
        if self.conn is not None:
            self.conn.close()
            self.conn = None
            print("DuckDB 连接已关闭")
    
    def execute_query(self, query: str) -> Any:
        """执行查询"""
        if self.conn is None:
            raise RuntimeError("数据库连接未建立，请先调用 connect()")
        return self.conn.execute(query)
    
    def get_table_info(self) -> Tuple[int, List[str]]:
        """获取表的基本信息"""
        try:
            # 获取行数
            row_count = self.execute_query(f"SELECT count(*) FROM {self.table_name}").fetchone()[0]
            
            # 获取列信息
            columns_info = self.execute_query(f"DESCRIBE {self.table_name}").fetchall()
            column_names = [col[0] for col in columns_info]
            
            print(f"表 '{self.table_name}' 信息: {row_count} 行, {len(column_names)} 列")
            print(f"列名: {column_names}")
            
            return row_count, column_names
        except Exception as e:
            print(f"获取表信息失败: {e}")
            raise e
    
    def table_exists(self) -> bool:
        """检查表是否存在"""
        try:
            self.execute_query(f"SELECT 1 FROM {self.table_name} LIMIT 1")
            return True
        except:
            return False 