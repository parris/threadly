import { AnnotationParser } from "../src/parser";

describe("AnnotationParser", () => {
  describe("parseAnnotation", () => {
    it("should parse basic @threadly annotation", () => {
      const comment = "/* @threadly */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "basic",
      });
    });

    it("should parse pool @threadly annotation", () => {
      const comment = "/* @threadly pool(size=4) */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "pool",
        poolSize: 4,
      });
    });

    it("should parse shared @threadly annotation", () => {
      const comment = "/* @threadly shared */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "shared",
        shared: true,
      });
    });

    it("should parse combined annotations", () => {
      const comment = "/* @threadly shared */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "shared",
        shared: true,
      });
    });

    it("should parse pool with shared memory annotation", () => {
      const comment = "/* @threadly pool(size=5) shared */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "pool",
        poolSize: 5,
        shared: true,
      });
    });

    it("should parse shared memory with pool annotation", () => {
      const comment = "/* @threadly shared pool(size=3) */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "pool",
        poolSize: 3,
        shared: true,
      });
    });

    it("should return null for non-threadly comments", () => {
      const comment = "/* This is a regular comment */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toBeNull();
    });

    it("should handle whitespace variations", () => {
      const comment = "/* @threadly   shared   */";
      const result = AnnotationParser.parseAnnotation(comment);

      expect(result).toEqual({
        type: "shared",
        shared: true,
      });
    });
  });

  describe("hasAnnotation", () => {
    it("should return true for threadly annotations", () => {
      const comment = "/* @threadly */";
      expect(AnnotationParser.hasAnnotation(comment)).toBe(true);
    });

    it("should return true for threadly annotations with options", () => {
      const comment = "/* @threadly pool(size=4) */";
      expect(AnnotationParser.hasAnnotation(comment)).toBe(true);
    });

    it("should return false for non-threadly comments", () => {
      const comment = "/* Regular comment */";
      expect(AnnotationParser.hasAnnotation(comment)).toBe(false);
    });
  });

  describe("extractFunctionName", () => {
    it("should extract function name from function declaration", () => {
      const node = {
        type: "FunctionDeclaration",
        id: { name: "testFunction" },
      };

      const result = AnnotationParser.extractFunctionName(node);
      expect(result).toBe("testFunction");
    });

    it("should extract function name from variable declaration", () => {
      const node = {
        type: "VariableDeclarator",
        id: { name: "testFunction" },
        init: { type: "FunctionExpression" },
      };

      const result = AnnotationParser.extractFunctionName(node);
      expect(result).toBe("testFunction");
    });

    it("should return null for unnamed functions", () => {
      const node = {
        type: "FunctionDeclaration",
        id: null,
      };

      const result = AnnotationParser.extractFunctionName(node);
      expect(result).toBeNull();
    });
  });

  describe("generateWorkerId", () => {
    it("should generate worker ID from function name and file path", () => {
      const functionName = "testFunction";
      const filePath = "/path/to/file.ts";

      const result = AnnotationParser.generateWorkerId(functionName, filePath);
      expect(result).toBe("_path_to_file_ts_testFunction");
    });

    it("should handle special characters in file path", () => {
      const functionName = "testFunction";
      const filePath = "/path/with-special/chars.ts";

      const result = AnnotationParser.generateWorkerId(functionName, filePath);
      expect(result).toBe("_path_with_special_chars_ts_testFunction");
    });
  });
});
