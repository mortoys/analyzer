"""
CSV 分析器 Python 包
提供 CSV 数据加载和 DuckDB 分析功能
"""

__version__ = "1.0.0"

# 全局实例 - 延迟初始化
db_manager = None
data_analyzer = None
data_loader = None
data_processor = None

def initialize():
    """初始化包"""
    global db_manager, data_analyzer, data_loader, data_processor
    
    print(f"CSV Analyzer Package v{__version__} 开始初始化...")
    
    try:
        # 导入所需的类
        from .database import DatabaseManager
        from .analyzer import DataAnalyzer
        from .loader import DataLoader
        from .utils import DataProcessor
        
        # 创建实例
        db_manager = DatabaseManager()
        data_analyzer = DataAnalyzer(db_manager)
        data_loader = DataLoader(db_manager)
        data_processor = DataProcessor()
        
        # 建立数据库连接
        db_manager.connect()
        
        print(f"CSV Analyzer Package v{__version__} 初始化成功!")
        
        return {
            "db_manager": db_manager,
            "data_analyzer": data_analyzer,
            "data_loader": data_loader,
            "data_processor": data_processor
        }
        
    except Exception as e:
        print(f"包初始化失败: {e}")
        raise e

# 便捷函数
def load_csv(csv_content: str) -> int:
    """加载 CSV 数据"""
    if data_loader is None:
        raise RuntimeError("包未初始化，请先调用 initialize()")
    return data_loader.load_csv_from_content(csv_content)

def describe_data() -> dict:
    """执行 DESCRIBE 分析"""
    if data_analyzer is None:
        raise RuntimeError("包未初始化，请先调用 initialize()")
    return data_analyzer.describe()

def summarize_data() -> dict:
    """执行 SUMMARIZE 分析"""
    if data_analyzer is None:
        raise RuntimeError("包未初始化，请先调用 initialize()")
    return data_analyzer.summarize() 