// Web Worker types
export interface WorkerInstance {
  postMessage: (data: any, transfer?: any[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((error: any) => void) | null;
  terminate: () => void;
}

export interface ThreadlyAnnotation {
  type: "basic" | "pool" | "shared";
  poolSize?: number;
  shared?: boolean;
}

export interface WorkerConfig {
  id: string;
  filePath: string;
  functionName: string;
  annotation: ThreadlyAnnotation;
  sourceCode: string;
  imports?: string[];
}

export interface WorkerPool {
  workers: WorkerInstance[];
  available: WorkerInstance[];
  busy: WorkerInstance[];
  maxSize: number;
}

export interface ThreadlyContext {
  workers: Map<string, WorkerInstance | WorkerPool>;
  configs: Map<string, WorkerConfig>;
  baseDir: string;
}

export interface CompileOptions {
  outputDir: string;
  baseDir: string;
  target: "es2020" | "es2015" | "es5";
  module: "commonjs" | "esnext";
  sourceMap?: boolean;
}

export interface RuntimeOptions {
  poolSize?: number;
  shared?: boolean;
  transferable?: boolean;
}

export type WorkerFunction<TArgs extends any[] = any[], TReturn = any> = (
  ...args: TArgs
) => TReturn | Promise<TReturn>;
export type AsyncWorkerFunction<TArgs extends any[] = any[], TReturn = any> = (
  ...args: TArgs
) => Promise<TReturn>;
