import { useState, useEffect } from 'react';
import { PyodideInstance } from '@/types';
import { initPyodide } from '@/utils/pyodide';

export const usePyodide = () => {
  const [pyodide, setPyodide] = useState<PyodideInstance | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        const pyodideInstance = await initPyodide();
        setPyodide(pyodideInstance);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Pyodide 初始化失败';
        debugger;
        setError(errorMessage);
        console.error('Pyodide 初始化失败:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initialize();
  }, []);

  return {
    pyodide,
    isInitializing,
    error,
    isReady: !isInitializing && !!pyodide && !error
  };
}; 