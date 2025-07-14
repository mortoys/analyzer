import duckdb

def run_analysis_command(command_type):
    """
    执行 DESCRIBE 或 SUMMARIZE 分析命令
    """
    command = command_type.upper()
    
    try:
        # 验证表是否存在
        validate_table_exists(conn)
        
        # 执行分析命令
        print(f"正在执行: {command} csv_data")
        cursor = conn.execute(f"{command} csv_data")
        result_data = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        print(f"查询返回: {len(result_data)} 行, {len(columns)} 列")
        print(f"列名: {columns}")
        if result_data:
            print(f"前3行数据: {result_data[:3]}")
        
        # 使用工具函数处理结果
        result_dict = process_query_result(result_data, columns)
        
        print(f"处理后数据: {result_dict['row_count']} 行, {result_dict['column_count']} 列")
        print(f"最终返回字典的类型: {type(result_dict)}")
        print(f"数据键: {list(result_dict.keys())}")
        
        return result_dict
        
    except Exception as e:
        print(f"分析执行错误: {e}")
        raise e 