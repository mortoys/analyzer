# CSV Analyzer Python 包

这是一个专为 Pyodide 环境设计的 CSV 数据分析包，提供了完整的数据加载和分析功能。

## 包结构

```
csv_analyzer/
├── __init__.py      # 包初始化和便捷函数
├── database.py      # DuckDB 数据库管理
├── loader.py        # CSV 数据加载器
├── analyzer.py      # 数据分析器
└── utils.py         # 工具函数和数据处理
```

## 主要特性

1. **模块化设计**: 每个功能模块独立，便于维护和扩展
2. **类型安全**: 使用 Python 类型注解，提供更好的代码提示
3. **错误处理**: 完整的异常处理和错误信息
4. **JavaScript 兼容**: 数据类型自动转换，确保与前端的兼容性

## 使用方法

### 基本用法

```python
import csv_analyzer

# 初始化包
components = csv_analyzer.initialize()

# 加载 CSV 数据
row_count = csv_analyzer.load_csv(csv_content)

# 执行分析
describe_result = csv_analyzer.describe_data()
summarize_result = csv_analyzer.summarize_data()
```

### 高级用法

```python
# 使用具体的类实例
db_manager = csv_analyzer.db_manager
data_loader = csv_analyzer.data_loader
data_analyzer = csv_analyzer.data_analyzer

# 获取表信息
row_count, columns = db_manager.get_table_info()

# 获取样本数据
sample = data_loader.get_sample_data(limit=10)

# 执行自定义查询
custom_result = data_analyzer.custom_query("SELECT * FROM csv_data LIMIT 5")
```

## 模块说明

### DatabaseManager
- 管理 DuckDB 连接
- 提供查询执行接口
- 表存在性检查

### DataLoader
- CSV 文件加载
- 数据格式验证
- 样本数据获取

### DataAnalyzer
- DESCRIBE/SUMMARIZE 分析
- 自定义查询执行
- 结果数据处理

### DataProcessor
- 数据类型转换
- JavaScript 兼容性处理
- 结果格式化

## 优势

1. **更好的代码组织**: 相关功能分组到对应模块
2. **模块间引用**: 各模块可以互相导入和使用
3. **面向对象设计**: 使用类封装功能，提高代码复用性
4. **易于扩展**: 新功能可以轻松添加到对应模块
5. **更好的测试**: 每个模块可以独立测试 