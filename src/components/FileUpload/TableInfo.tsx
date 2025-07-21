import { TableColumn } from '@/types';
import { ColumnInfo } from './ColumnInfo';

interface TableInfoProps {
  table: {
    name: string;
    rowCount: number;
    columns: TableColumn[];
  };
}

export function TableInfo({ table }: TableInfoProps) {
  return (
    <div className="border border-gray-200 rounded-md mb-3 last:mb-0">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="font-medium text-gray-900 text-sm">{table.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {table.rowCount.toLocaleString()} rows • {table.columns.length} columns
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {table.columns.map((column, colIndex) => (
          <ColumnInfo key={colIndex} column={column} />
        ))}
      </div>
    </div>
  );
} 