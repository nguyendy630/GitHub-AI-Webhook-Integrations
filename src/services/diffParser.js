const { debug } = require("winston");
const logger = require("../utils/logger");

/**
 * Diffparser service to parse unified diffs from pull requests.
 */
class DiffParser {
    constructor() {
        this.getAddedLines = this.getAddedLines.bind(this);
        this.getDeletedLines = this.getDeletedLines.bind(this);
        this.detectLanguage = this.detectLanguage.bind(this);
        this.isTestFile = this.isTestFile.bind(this);
        this.containsNewFunctions = this.containsNewFunctions.bind(this);
        this.containsImports = this.containsImports.bind(this);
        this.hasTestChanges = this.hasTestChanges.bind(this);
        this.analyzeDiff = this.analyzeDiff.bind(this);
    }

    /**
     * Parses patch for added lines.
     * @param {string} patch
     * @returns {Array{}} Array of (objects) added lines
     */
    getAddedLines(patch) {
        const lines = patch.split("\n");
        const addedLines = [];

        let newLineNumber = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Hunk header
            const hunkMatch = line.match(
                /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/,
            );

            if (hunkMatch) {
                newLineNumber = parseInt(hunkMatch[1], 10);
                continue;
            }

            // Added line
            if (line.startsWith("+") && !line.startsWith("+++")) {
                addedLines.push({
                    lineNumber: newLineNumber,
                    content: line.slice(1),
                });
                newLineNumber++;
                continue;
            }

            // Context line
            if (line.startsWith(" ")) {
                newLineNumber++;
                continue;
            }
        }

        return addedLines;
    }

    /**
     * Parses patch for removed lines.
     * @param {string} patch
     * @returns {Array{}} Array of (object) removed lines
     */
    getDeletedLines(patch) {
        const lines = patch.split("\n");
        const deletedLines = [];

        let newLineNumber = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Hunk header
            const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);

            if (hunkMatch) {
                newLineNumber = parseInt(hunkMatch[1], 10);
                continue;
            }

            // Removed line
            if (line.startsWith("-") && !line.startsWith("---")) {
                deletedLines.push({
                    lineNumber: newLineNumber,
                    content: line.slice(1),
                });

                newLineNumber++;
                continue;
            }

            // Context line
            if (line.startsWith(" ")) {
                newLineNumber++;
                continue;
            }
        }

        return deletedLines;
    }

    /**
     * Detects the file language by extracting the file extension from the patch.
     * @param {string} patch - The unified diff patch
     * @returns {string|null} Language code (e.g., 'js', 'py', 'java') or null if not detected
     */
    detectLanguage(patch) {
        for (const line of patch.split("\n")) {
            const trimmed = line.trim();

            if (trimmed.startsWith("+++")) {
                // Extract the filename from the +++ line
                let filename = trimmed
                    .replace("+++", "")
                    .replace("b/", "")
                    .trim();

                // Get the file extension
                const lastDotIndex = filename.lastIndexOf(".");
                if (lastDotIndex === -1) {
                    // No extension found
                    return null;
                }

                const extension = filename.substring(lastDotIndex + 1).toLowerCase();

                // Map common file extensions to language codes
                const extensionMap = {
                    // JavaScript/TypeScript
                    js: "js",
                    jsx: "js",
                    ts: "ts",
                    tsx: "ts",
                    // Python
                    py: "py",
                    // Java
                    java: "java",
                    // Go
                    go: "go",
                    // Rust
                    rs: "rust",
                    // Ruby
                    rb: "ruby",
                    html: "html",
                    htm: "html",
                    css: "css",
                    scss: "scss",
                    sass: "scss",
                    less: "less",
                    // SQL
                    sql: "sql",
                };

                // Return mapped language code or fallback to extension itself
                return extensionMap[extension] || extension;
            }
        }

        return "Unable to detect language"; // Fallback if no +++ line is found
    }

    /**
     * Checks if the file is a common test file name.
     * 
     * Any other remaining patterns not found will be detected using AI instead.
     * @param {string} filename
     */
    isTestFile(filename) {
        const testPatterns = [
            /\.test\./, // calculator.test.js
            /\.spec\./, // calculator.spec.js
            /__tests__\//, // __tests__/calculator.js
            /_test\./, // calculator_test.js
            /\.test$/, // calculator.test (no extension)
            /\.spec$/, // calculator.spec
            /^test_.*\.[^.]+$/, // test_calculator.js, test_calculator.py
            /^.*_test\.[^.]+$/, // calculator_test.js, calculator_test.py
        ];

        return testPatterns.some((pattern) => pattern.test(filename));
    }

    /**
     * Checks if the current patch has changed/updated functions.
     *
     * Common Patterns:
     * - JavaScript/TypeScript: function declarations or arrow functions.
     * - Python: def statements.
     * - Java: public static void main(String[] args) or public void methodName() throws Exception.
     * - Go: func functionName(parameters) returnType.
     * - Rust: fn functionName(parameters) -> returnType.
     * - Ruby: def methodName(parameters)
     *
     * Any other remaining patterns not found will be detected using AI instead.
     * 
     * @param {Array<{lineNumber: number, context: string}>} addedLines
     * @param {string} language
     */
    containsNewFunctions(addedLines, language) {
        // Functions to be added.
        const functions = [];

        let results = {
            hasNewFunctions: false,
            newFunctions: functions,
            lineNumbers: [],
            language: language,
        };

        // Sets current Language.
        let currentLanguage = language;

        // Patterns from common languages.
        let patterns = {
            js: {
                // Function declarations
                function: /^\s*(export\s+)?(async\s+)?function\s+\w+\s*\(/,

                // Arrow functions
                arrow: /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/,

                // Function expressions
                expression:
                    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function\s*\(/,

                // Class methods
                method: /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/,
            },
            py: {
                function: /^\s*(async\s+)?def\s+\w+\s*\(/,
            },
            java: {
                function:
                    /^\s*(public|private|protected)?\s*(static)?\s*(final)?\s*[\w<>[\],\s]+\s+\w+\s*\(/,
            },
            go: {
                function: /^\s*func\s+(\(\w+\s+\*?\w+\)\s*)?\w+\s*\(/,
            },
        };

        // Excluding control flow patterns.
        let excludePatterns = {
            commonPatterns: /^\s*(for|while|if|else|switch|catch)\s*\(/,
        };

        // Language-specific patterns
        const langPatterns = patterns[currentLanguage];

        if (!langPatterns) {
            logger.warn(`No patterns defined for language: ${currentLanguage}`);
            return results;
        }

        // Iterate through each added line.
        addedLines.forEach((lineObj) => {
            const currentContext = lineObj.context ?? lineObj.content ?? "";

            if (!currentContext) {
                return;
            }

            // Skip if line matches control flow patterns
            if (excludePatterns.commonPatterns.test(currentContext)) {
                return;
            }

            // Check all pattern types.
            for (const patternType in langPatterns) {
                if (currentContext.match(langPatterns[patternType])) {
                    if (
                        currentContext.match(langPatterns[patternType]) &&
                        !currentContext.match(excludePatterns.commonPatterns)
                    ) {
                        // Push lines into function array.
                        functions.push(currentContext.trim());
                        results.lineNumbers.push(lineObj.lineNumber);
                        break; // Stops checking other patterns once we find a match.
                    }
                }
            }
        });

        results.hasNewFunctions = functions.length > 0;
        return results;
    }

    /**
     * Parses through added lines to find changed or new imports.
     *
     * Common Patterns:
     * - JavaScript/TypeScript: import statements or require calls.
     * - Python: import statements or from ... import statements.
     * - Java: import statements.
     * - Go: import statements.
     * - Rust: use statements.
     * - Ruby: require statements.
     * 
     * Any other remaining patterns not found will be detected using AI instead.
     *
     * @param {String} addedLines
     * @param {string} language
     */
    containsImports(addedLines, language) {
        const patterns = {
            js: /import\s+.*from|require\s*\(/,
            ts: /import\s+.*from|require\s*\(/,
            py: /import\s+|from\s+.*import/,
            java: /import\s+/,
            go: /import\s+\(/,
            rust: /use\s+/,
            ruby: /require\s+/,
        };

        let importPattern = patterns[language];

        if (!importPattern) {
            logger.warn(`No import patterns defined for language: ${language}`);
            return false;
        }

        if (typeof addedLines === "string") {
            return importPattern.test(addedLines);
        }

        return addedLines.some((lineObj) => {
            const line = lineObj.context ?? lineObj.content ?? "";
            return importPattern.test(line);
        });
    }

    /**
     * Parses through added lines to find changed or new imports. Any other remaining patterns 
     * not found will be detected using AI instead
     *
     * Common Patterns:
     * - rust
     * - python
     * - java
     * - go
     * - ruby
     * @param {Array<{ lineNumber: number, context: string }>} addedLines
     * returns {Array<{ lineNumber: number, context: string }>} addedTest
     */
    hasTestChanges(addedLines, language) {
        const testPatterns = {
            js: /describe\s*\(/,
            ts: /describe\s*\(/,
            py: /def\s+test_/,
            java: /@Test/,
            go: /func\s+Test/,
            rust: /#[cfg\(test\)]/,
            ruby: /describe\s*\(/,
        };

        let addedTest = [];

        const testPattern = testPatterns[language];

        if (!testPattern) {
            logger.warn(`No test patterns defined for language: ${language}`);
            return false;
        }

        addedLines.forEach((lineObj) => {
            const line = lineObj.context ?? lineObj.content ?? "";

            if (testPattern.test(line)) {
                addedTest.push(line);
            }
        });

        return addedTest.length > 0;
    }

    /**
     * Analyzes the diff and returns an object with information about
     * - Changes in tests cases
     * - Changes in imports
     * - Changes in added lines and deleted lines
     * - Filename
     * - Language
     * @returns object
     * @param {string} patch
     */
    analyzeDiff(patch) {
        logger.info("Analyzing diff");
        const addedLines = this.getAddedLines(patch);
        const deletedLines = this.getDeletedLines(patch);
        const language = this.detectLanguage(patch);

        const parsed = {
            // 1. Added lines
            addedLines,

            // 2. Deleted lines
            deletedLines,

            // 3. File metadata
            filename: language,
            isTestFile: this.isTestFile(language),

            // 4. Basic patterns
            hasNewFunctions: this.containsNewFunctions(addedLines, language),

            // Import changes or new imports.
            hasImportChanges: this.containsImports(addedLines, language),

            // Checking for test changes
            hasTestChanges: this.isTestFile(language)
                ? this.hasTestChanges(addedLines, language)
                : false,
        };

        return parsed;
    }
}

module.exports = new DiffParser();
