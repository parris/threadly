import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import { AnnotationParser } from "./parser";
import { ThreadlyAnnotation, WorkerConfig, CompileOptions } from "./types";

export interface TransformResult {
  modifiedSource: string;
  workerConfigs: WorkerConfig[];
}

export class ThreadlyTransformer {
  private options: CompileOptions;

  constructor(options: CompileOptions) {
    this.options = options;
  }

  /**
   * Transforms a TypeScript source file, extracting annotated functions
   */
  transform(sourceFile: string): TransformResult {
    const sourceCode = fs.readFileSync(sourceFile, "utf-8");

    // Parse the source code using TypeScript AST
    const sourceFileObj = ts.createSourceFile(
      sourceFile,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const workerConfigs: WorkerConfig[] = [];
    const transformedSource = this.transformSourceFile(
      sourceFileObj,
      sourceFile,
      workerConfigs
    );

    return {
      modifiedSource: transformedSource,
      workerConfigs,
    };
  }

  private transformSourceFile(
    sourceFile: ts.SourceFile,
    filePath: string,
    workerConfigs: WorkerConfig[]
  ): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const transformer = new ThreadlyASTTransformer(
      filePath,
      workerConfigs,
      this.options
    );

    const result = ts.transform(sourceFile, [transformer.getTransformer()]);
    return printer.printFile(result.transformed[0] as ts.SourceFile);
  }

  /**
   * Compiles worker files from configurations
   */
  compileWorkers(workerConfigs: WorkerConfig[]): void {
    const transformer = new ThreadlyASTTransformer("", [], this.options);
    transformer.compileWorkers(workerConfigs);
  }
}

/**
 * AST Transformer that handles Threadly annotations
 */
class ThreadlyASTTransformer {
  private filePath: string;
  private workerConfigs: WorkerConfig[];
  private importStatements: string[] = [];
  private options: CompileOptions;

  // New: Store all import declarations and their bindings
  private allImports: ts.ImportDeclaration[] = [];
  private importBindings: Map<
    string,
    {
      importDecl: ts.ImportDeclaration;
      type: "default" | "named" | "namespace";
      module: string;
    }
  > = new Map();
  private workerUsedImports: Set<string> = new Set();
  private nonWorkerUsedImports: Set<string> = new Set();

  constructor(
    filePath: string,
    workerConfigs: WorkerConfig[],
    options: CompileOptions
  ) {
    this.filePath = filePath;
    this.workerConfigs = workerConfigs;
    this.options = options;
  }

  getTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext) => {
      return (rootNode: ts.SourceFile) => {
        // First pass: collect all import declarations and their bindings
        this.collectAllImports(rootNode);
        // Second pass: collect usage of imports in worker and non-worker code
        this.collectImportUsages(rootNode);
        // Third pass: transform the AST, removing worker-only imports from the main file
        return this.visitNode(rootNode, context) as ts.SourceFile;
      };
    };
  }

  private collectAllImports(sourceFile: ts.SourceFile) {
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        this.allImports.push(statement);
        const importClause = statement.importClause;
        const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral)
          .text;
        if (importClause) {
          // Default import
          if (importClause.name) {
            this.importBindings.set(importClause.name.text, {
              importDecl: statement,
              type: "default",
              module: moduleSpecifier,
            });
          }
          // Namespace import
          if (
            importClause.namedBindings &&
            ts.isNamespaceImport(importClause.namedBindings)
          ) {
            this.importBindings.set(importClause.namedBindings.name.text, {
              importDecl: statement,
              type: "namespace",
              module: moduleSpecifier,
            });
          }
          // Named imports
          if (
            importClause.namedBindings &&
            ts.isNamedImports(importClause.namedBindings)
          ) {
            for (const element of importClause.namedBindings.elements) {
              this.importBindings.set(element.name.text, {
                importDecl: statement,
                type: "named",
                module: moduleSpecifier,
              });
            }
          }
        }
      }
    }
  }

  private collectImportUsages(sourceFile: ts.SourceFile) {
    // Helper to walk the AST and collect identifiers
    const visit = (node: ts.Node, inWorker: boolean) => {
      // If this is a worker-annotated function, mark as inWorker
      if (
        (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
        this.findThreadlyAnnotation(node)
      ) {
        inWorker = true;
      }
      // Track identifier usage
      if (ts.isIdentifier(node)) {
        if (this.importBindings.has(node.text)) {
          if (inWorker) {
            this.workerUsedImports.add(node.text);
          } else {
            this.nonWorkerUsedImports.add(node.text);
          }
        }
      }
      // Track namespace property access (e.g., math.std)
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const ns = node.expression.text;
        if (
          this.importBindings.has(ns) &&
          this.importBindings.get(ns)?.type === "namespace"
        ) {
          if (inWorker) {
            this.workerUsedImports.add(ns);
          } else {
            this.nonWorkerUsedImports.add(ns);
          }
        }
      }
      node.forEachChild((child) => visit(child, inWorker));
    };
    visit(sourceFile, false);
  }

  private visitNode(
    node: ts.Node,
    context: ts.TransformationContext
  ): ts.Node | undefined {
    // Remove worker-only import declarations from the main file
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;
      if (importClause) {
        // Default import
        if (
          importClause.name &&
          this.isWorkerOnlyImport(importClause.name.text)
        ) {
          return undefined;
        }
        // Namespace import
        if (
          importClause.namedBindings &&
          ts.isNamespaceImport(importClause.namedBindings)
        ) {
          if (this.isWorkerOnlyImport(importClause.namedBindings.name.text)) {
            return undefined;
          }
        }
        // Named imports
        if (
          importClause.namedBindings &&
          ts.isNamedImports(importClause.namedBindings)
        ) {
          const remainingElements = importClause.namedBindings.elements.filter(
            (element) => !this.isWorkerOnlyImport(element.name.text)
          );
          if (remainingElements.length === 0) {
            return undefined;
          } else if (
            remainingElements.length !==
            importClause.namedBindings.elements.length
          ) {
            // Some named imports are worker-only, so rewrite the import
            return ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              ts.factory.updateImportClause(
                importClause,
                importClause.isTypeOnly,
                importClause.name,
                ts.factory.createNamedImports(remainingElements)
              ),
              node.moduleSpecifier,
              node.assertClause
            );
          }
        }
      }
    }
    if (ts.isFunctionDeclaration(node)) {
      return this.visitFunctionDeclaration(node, context);
    } else if (ts.isVariableStatement(node)) {
      return this.visitVariableStatement(node, context);
    } else if (ts.isSourceFile(node)) {
      return this.visitSourceFile(node, context);
    }
    return ts.visitEachChild(
      node,
      (child) => this.visitNode(child, context),
      context
    );
  }

  private isWorkerOnlyImport(binding: string): boolean {
    return (
      this.workerUsedImports.has(binding) &&
      !this.nonWorkerUsedImports.has(binding)
    );
  }

  private visitSourceFile(
    node: ts.SourceFile,
    context: ts.TransformationContext
  ): ts.SourceFile {
    const visitedNode = ts.visitEachChild(
      node,
      (child) => this.visitNode(child, context),
      context
    ) as ts.SourceFile;

    // Add import statements at the top if we have any
    if (this.importStatements.length > 0) {
      const importNodes = this.importStatements.map((importStr) => {
        // Create a simple import statement node
        return ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([])
          ),
          ts.factory.createStringLiteral(importStr)
        );
      });

      return ts.factory.updateSourceFile(visitedNode, [
        ...importNodes,
        ...visitedNode.statements,
      ]);
    }

    return visitedNode;
  }

  private visitFunctionDeclaration(
    node: ts.FunctionDeclaration,
    context: ts.TransformationContext
  ): ts.Node | undefined {
    const annotation = this.findThreadlyAnnotation(node);

    if (annotation && node.name) {
      this.validateAsyncFunction(node, node.name.text);
      const workerConfig = this.createWorkerConfig(node, annotation);
      this.workerConfigs.push(workerConfig);

      // Replace with import and wrapper
      return this.createWorkerReplacement(node.name.text, annotation);
    }

    return node;
  }

  private visitVariableStatement(
    node: ts.VariableStatement,
    context: ts.TransformationContext
  ): ts.Node | undefined {
    const declarations = node.declarationList.declarations;

    for (const declaration of declarations) {
      if (
        declaration.initializer &&
        ts.isArrowFunction(declaration.initializer)
      ) {
        const annotation = this.findThreadlyAnnotation(node);

        if (
          annotation &&
          declaration.name &&
          ts.isIdentifier(declaration.name)
        ) {
          this.validateAsyncArrowFunction(
            declaration.initializer,
            declaration.name.text
          );
          const workerConfig = this.createWorkerConfig(declaration, annotation);
          this.workerConfigs.push(workerConfig);

          // Replace with import and wrapper
          return this.createWorkerReplacement(
            declaration.name.text,
            annotation
          );
        }
      }
    }

    return node;
  }

  private findThreadlyAnnotation(node: ts.Node): ThreadlyAnnotation | null {
    const sourceFile = node.getSourceFile();
    const text = sourceFile.getFullText();
    const nodeStart = node.getStart();

    // Look for comments before the node
    const triviaStart = nodeStart - 1;
    const triviaEnd = nodeStart;

    // Get the text before the node
    const beforeNode = text.substring(0, triviaEnd);
    const lines = beforeNode.split("\n");

    // Look for threadly annotation in the last few lines
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
      const line = lines[i];
      if (line.includes("/* @threadly")) {
        return AnnotationParser.parseAnnotation(line);
      }
    }

    return null;
  }

  private validateAsyncFunction(
    node: ts.FunctionDeclaration,
    functionName: string
  ): void {
    if (
      !node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      const lineNumber =
        node.getSourceFile().getLineAndCharacterOfPosition(node.getStart())
          .line + 1;
      throw new Error(
        `Threadly Error: Function '${functionName}' in ${this.filePath}:${lineNumber} must be async. ` +
          `Add 'async' keyword before 'function'.`
      );
    }
  }

  private validateAsyncArrowFunction(
    node: ts.ArrowFunction,
    functionName: string
  ): void {
    if (
      !node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      const lineNumber =
        node.getSourceFile().getLineAndCharacterOfPosition(node.getStart())
          .line + 1;
      throw new Error(
        `Threadly Error: Arrow function '${functionName}' in ${this.filePath}:${lineNumber} must be async. ` +
          `Use 'const ${functionName} = async (...args) =>' instead.`
      );
    }
  }

  private extractFunctionCode(
    node: ts.FunctionDeclaration | ts.VariableDeclaration
  ): string {
    const sourceFile = node.getSourceFile();
    const text = sourceFile.getFullText();

    if (ts.isFunctionDeclaration(node)) {
      return text.substring(node.getStart(), node.getEnd());
    } else if (node.initializer && ts.isArrowFunction(node.initializer)) {
      // For arrow functions, we need to include the variable declaration
      return text.substring(node.getStart(), node.getEnd());
    }

    return "";
  }

  private extractImportsForFunction(
    node: ts.FunctionDeclaration | ts.VariableDeclaration,
    sourceFile: ts.SourceFile
  ): string[] {
    const usedImports = new Set<string>();
    const usedIdentifiers = new Set<string>();
    this.collectIdentifiers(node, usedIdentifiers);
    // Also check for namespace usage
    for (const [binding, info] of this.importBindings.entries()) {
      if (usedIdentifiers.has(binding) || this.isNamespaceUsed(binding, node)) {
        usedImports.add(binding);
      }
    }
    // For each used import, get the original import declaration as code
    const importStrings: string[] = [];
    for (const binding of usedImports) {
      const info = this.importBindings.get(binding);
      if (info) {
        // Reconstruct the import statement as code
        const importDecl = info.importDecl;
        const printer = ts.createPrinter();
        importStrings.push(
          printer.printNode(ts.EmitHint.Unspecified, importDecl, sourceFile)
        );
      }
    }
    // Remove duplicates
    return Array.from(new Set(importStrings));
  }

  private isNamespaceUsed(namespaceName: string, node: ts.Node): boolean {
    let found = false;

    const checkNode = (n: ts.Node) => {
      if (
        ts.isPropertyAccessExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === namespaceName
      ) {
        found = true;
        return;
      }
      n.forEachChild(checkNode);
    };

    checkNode(node);
    return found;
  }

  private collectIdentifiers(node: ts.Node, identifiers: Set<string>): void {
    if (ts.isIdentifier(node)) {
      identifiers.add(node.text);
    }

    node.forEachChild((child) => this.collectIdentifiers(child, identifiers));
  }

  private createWorkerConfig(
    node: ts.FunctionDeclaration | ts.VariableDeclaration,
    annotation: ThreadlyAnnotation
  ): WorkerConfig {
    const functionName = this.getFunctionName(node);
    const functionCode = this.extractFunctionCode(node);
    const workerId = AnnotationParser.generateWorkerId(
      functionName,
      this.filePath
    );
    const imports = this.extractImportsForFunction(node, node.getSourceFile());

    return {
      id: workerId,
      filePath: path.join(this.options.outputDir, `${workerId}.worker.js`),
      functionName,
      annotation,
      sourceCode: functionCode,
      imports,
    };
  }

  private getFunctionName(
    node: ts.FunctionDeclaration | ts.VariableDeclaration
  ): string {
    if (ts.isFunctionDeclaration(node)) {
      return node.name?.text || "anonymous";
    } else if (ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return "anonymous";
  }

  private createWorkerReplacement(
    functionName: string,
    annotation: ThreadlyAnnotation
  ): ts.VariableStatement {
    const workerId = AnnotationParser.generateWorkerId(
      functionName,
      this.filePath
    );

    // Add import statement
    this.importStatements.push(`./workers/${workerId}.worker`);

    // Create wrapper function
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          functionName,
          undefined,
          undefined,
          ts.factory.createArrowFunction(
            [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
            undefined,
            [
              ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                ts.factory.createIdentifier("args"),
                undefined,
                undefined,
                undefined
              ),
            ],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createAwaitExpression(
              ts.factory.createCallExpression(
                ts.factory.createIdentifier(functionName),
                undefined,
                [
                  ts.factory.createSpreadElement(
                    ts.factory.createIdentifier("args")
                  ),
                ]
              )
            )
          )
        ),
      ])
    );
  }

  /**
   * Compiles worker files from configurations
   */
  compileWorkers(workerConfigs: WorkerConfig[]): void {
    // Ensure output directory exists
    const workersDir = path.join(this.options.outputDir, "workers");
    if (!fs.existsSync(workersDir)) {
      fs.mkdirSync(workersDir, { recursive: true });
    }

    // Generate worker files
    workerConfigs.forEach((config) => {
      const workerCode = this.generateWorkerCode(config);
      const workerPath = path.join(workersDir, `${config.id}.worker.ts`);

      fs.writeFileSync(workerPath, workerCode);
    });
  }

  private generateWorkerCode(config: WorkerConfig): string {
    const { functionName, sourceCode, annotation, imports } = config;

    let workerCode = `// Auto-generated worker file for ${functionName}\n`;
    workerCode += `import { expose } from 'comlink';\n\n`;

    // Add the extracted imports as code (not just strings)
    if (imports && imports.length > 0) {
      workerCode += imports.join("\n") + "\n\n";
    }

    // Add the original function
    workerCode += sourceCode + "\n\n";

    // Expose the function - always async since workers are async
    workerCode += `expose(${functionName});\n`;

    return workerCode;
  }
}
