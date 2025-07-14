import duckdb

# 创建 DuckDB 连接
conn = duckdb.connect(':memory:')
print("DuckDB 连接已创建") 