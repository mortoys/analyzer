import duckdb
import io

def load_csv_data(csv_content):
    """
    将 CSV 内容加载到 DuckDB 表中
    """
    # 将 CSV 内容写入虚拟文件系统
    with open('/tmp/data.csv', 'w') as f:
        f.write(csv_content)
    
    # 使用 DuckDB 的原生 CSV 读取能力
    conn.execute("DROP TABLE IF EXISTS csv_data")
    conn.execute("CREATE TABLE csv_data AS SELECT * FROM read_csv_auto('/tmp/data.csv')")
    
    # 检查数据加载情况
    table_info = conn.execute("SELECT count(*) FROM csv_data").fetchone()
    print(f"成功加载 CSV 数据，表中有 {table_info[0]} 行数据")
    
    return table_info[0] 