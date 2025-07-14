"""
数据加载模块
处理 CSV 文件的加载和导入
"""

from typing import Optional, Dict, Any
from .database import DatabaseManager


class DataLoader:
    """CSV 数据加载器"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def load_csv_from_content(self, csv_content: str, table_name: str = "csv_data") -> int:
        """
        从 CSV 内容字符串加载数据到 DuckDB
        
        Args:
            csv_content: CSV 文件内容
            table_name: 目标表名
            
        Returns:
            加载的行数
        """
        try:
            # 确保数据库连接存在
            self.db_manager.connect()
            
            # 将 CSV 内容写入虚拟文件系统
            with open('/tmp/data.csv', 'w', encoding='utf-8') as f:
                f.write(csv_content)
            
            # 删除已存在的表
            try:
                self.db_manager.execute_query(f"DROP TABLE IF EXISTS {table_name}")
            except:
                pass
            
            # 使用 DuckDB 的原生 CSV 读取能力
            create_query = f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('/tmp/data.csv')"
            self.db_manager.execute_query(create_query)
            
            # 获取加载的行数
            row_count = self.db_manager.execute_query(f"SELECT count(*) FROM {table_name}").fetchone()[0]
            
            print(f"成功加载 CSV 数据到表 '{table_name}'，共 {row_count} 行")
            
            return row_count
            
        except Exception as e:
            print(f"加载 CSV 数据失败: {e}")
            raise e
    
    def get_sample_data(self, table_name: str = "csv_data", limit: int = 5) -> Dict[str, Any]:
        """
        获取表的样本数据
        
        Args:
            table_name: 表名
            limit: 样本行数
            
        Returns:
            包含样本数据和列信息的字典
        """
        try:
            query = f"SELECT * FROM {table_name} LIMIT {limit}"
            cursor = self.db_manager.execute_query(query)
            
            sample_data = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            
            return {
                "data": sample_data,
                "columns": columns,
                "sample_size": len(sample_data)
            }
            
        except Exception as e:
            print(f"获取样本数据失败: {e}")
            raise e 