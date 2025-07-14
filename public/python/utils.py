def process_query_result(result_data, columns):
    """
    处理查询结果，转换数据类型以确保 JavaScript 兼容性
    """
    processed_data = []
    for row in result_data:
        processed_row = []
        for cell in row:
            if cell is None:
                processed_row.append(None)
            elif hasattr(cell, '__str__'):
                # 将所有数据转换为字符串，确保 JavaScript 能正确处理
                processed_row.append(str(cell))
            else:
                processed_row.append(cell)
        processed_data.append(processed_row)
    
    return {
        "data": processed_data, 
        "columns": columns,
        "row_count": len(processed_data),
        "column_count": len(columns)
    }

def validate_table_exists(conn, table_name="csv_data"):
    """
    验证表是否存在并返回基本信息
    """
    try:
        table_info = conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()
        row_count = table_info[0]
        print(f"表 '{table_name}' 中有 {row_count} 行数据")
        return row_count
    except Exception as e:
        print(f"表 '{table_name}' 不存在或访问错误: {e}")
        raise e 