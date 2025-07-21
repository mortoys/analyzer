export interface TableColumn {
  name: string;
  type: string;
  description: string;
}

export interface AnalysisResult {
  data: unknown[][];
  columns: string[];
  row_count: number;
  column_count: number;
  column_details?: TableColumn[];
}

export interface EChartsConfig {
  option: any; // ECharts option type
  title: string;
  description?: string;
}

export interface SQLExecutionResult {
  success: boolean;
  data?: unknown[][];
  columns?: string[];
  row_count?: number;
  column_count?: number;
  error?: string;
  query?: string;
  chartConfig?: EChartsConfig | null;
}

export interface PythonQueryResult {
  data?: unknown[][];
  columns?: string[];
  row_count?: number;
  column_count?: number;
  column_details?: TableColumn[];
  error?: string;
  success?: boolean;
  column_types?: string[];
  sample_data?: unknown[][];
  table_name?: string;
}

export interface FileInfo {
  file: File;
  isExpanded: boolean;
  tables: {
    name: string;
    rowCount: number;
    columns: TableColumn[];
  }[];
  summarizeData?: AnalysisResult;
}

export interface PyodideInstance {
  FS: {
    writeFile: (path: string, content: string | Uint8Array) => void;
    mkdir: (path: string) => void;
    open: (path: string, flags: string) => number;
    write: (stream: number, buffer: Uint8Array, offset: number, length: number, position?: number) => void;
    close: (stream: number) => void;
  };
  loadPackage: (packages: string[]) => Promise<void>;
  runPython: (code: string) => PyProxy;
  runPythonAsync: (code: string) => Promise<PyProxy>;
}

export interface PyProxy {
  toJs: (options?: { dict_converter?: (entries: Iterable<[string, unknown]>) => Record<string, unknown> }) => unknown;
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInstance>;
  }
} 