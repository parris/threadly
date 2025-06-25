import { ThreadlyAnnotation } from "./types";

/**
 * Parses Threadly annotations from comment strings
 */
export class AnnotationParser {
  private static readonly ANNOTATION_REGEX = /\/\*\s*@threadly\s*(.*?)\s*\*\//;

  /**
   * Extracts and parses Threadly annotations from a comment
   */
  static parseAnnotation(comment: string): ThreadlyAnnotation | null {
    const match = comment.match(this.ANNOTATION_REGEX);
    if (!match) return null;

    const config = match[1].trim();
    if (!config) {
      return { type: "basic" };
    }

    const annotation: ThreadlyAnnotation = { type: "basic" };

    // Parse pool configuration
    const poolMatch = config.match(/pool\s*\(\s*size\s*=\s*(\d+)\s*\)/);
    if (poolMatch) {
      annotation.type = "pool";
      annotation.poolSize = parseInt(poolMatch[1], 10);
    }

    // Parse shared (can be combined with pool)
    if (config.includes("shared")) {
      annotation.shared = true;
      // If it's a pool with shared, keep the pool type but add shared flag
      if (annotation.type === "basic") {
        annotation.type = "shared";
      }
    }

    return annotation;
  }

  /**
   * Checks if a comment contains a Threadly annotation
   */
  static hasAnnotation(comment: string): boolean {
    return this.ANNOTATION_REGEX.test(comment);
  }

  /**
   * Extracts the function name from a function declaration or expression
   */
  static extractFunctionName(node: any): string | null {
    if (node.type === "FunctionDeclaration") {
      return node.id?.name || null;
    }

    if (
      node.type === "VariableDeclarator" &&
      node.init?.type === "FunctionExpression"
    ) {
      return node.id?.name || null;
    }

    if (
      node.type === "AssignmentExpression" &&
      node.right?.type === "FunctionExpression"
    ) {
      if (node.left.type === "MemberExpression") {
        return node.left.property?.name || null;
      }
      return node.left?.name || null;
    }

    return null;
  }

  /**
   * Generates a unique worker ID based on function name and file path
   */
  static generateWorkerId(functionName: string, filePath: string): string {
    const normalizedPath = filePath.replace(/[^a-zA-Z0-9]/g, "_");
    return `${normalizedPath}_${functionName}`;
  }
}
