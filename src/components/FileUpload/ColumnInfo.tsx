import { TableColumn } from '@/types';

interface ColumnInfoProps {
  column: TableColumn;
}

export function ColumnInfo({ column }: ColumnInfoProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-blue-600 bg-blue-50';
      case 'number': return 'text-green-600 bg-green-50';
      case 'date': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-gray-900">{column.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{column.description}</div>
      </div>
      <div className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(column.type)}`}>
        {column.type}
      </div>
    </div>
  );
} 