// const { add } = require("winston");
const { debug } = require("winston");
const logger = require("../utils/logger");

/**
 * Diffparser service to parse unified diffs from pull requests.
 */
class DiffParser {
    /**
     * Parses patch for added lines.
     * @param {*} patch
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
                    context: line.slice(1),
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
     * @param {*} patch
     * @returns {Array{}} Array of (object) removed lines
     */
    getDeletedLines(patch) {
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
            if (line.startsWith("-") && !line.startsWith("---")) {
                addedLines.push({
                    lineNumber: newLineNumber,
                    context: line.slice(1),
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
     * Grabs the extension of the filename to detect language.
     * @param {*} filename
     */
    detectLanguage(patch) {
        for (const line of patch.split("\n")) {
            const trimmed = line.trim();

            if (trimmed.startsWith("+++")) {
                return trimmed
                    .replace("+++", "")
                    .replace("b/", "")
                    .trim()
                    .split(".")
                    .pop();
            }
        }
        return null;
    }

    /**
     * Checks if the file is a common test file name.
     * @param {*} filename
     */
    isTestFile(filename) {
        const testPatterns = [
            /\.test\./, // calculator.test.js
            /\.spec\./, // calculator.spec.js
            /__tests__\//, // __tests__/calculator.js
            /_test\./, // calculator_test.js
            /\.test$/, // calculator.test (no extension)
            /\.spec$/, // calculator.spec
            /test_.*\.py$/, // test_calculator.py (Python)
            /.*_test\.py$/, // calculator_test.py (Python)
        ];
        return testPatterns.some((pattern) => pattern.test(filename));
    }

    /**
     * Checks if the current patch has functions.
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
            const currentContext = lineObj.context;

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
     *
     * @param {Array<{ lineNumber: number, context: string }>} addedLines
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
        // List of imports
        let addedImports = [];

        addedLines.forEach((lineObj) => {
            const line = lineObj.context;

            // Testing for import patterns.
            if (patterns[language].test(line)) {
                addedImports.push(line);
            }
        });

        return addedImports;
    }

    /**
     *
     * @param {Array<{ lineNumber: number, context: string }>} addedLines
     * returns {Array<{ lineNumber: number, context: string }>} addedTest
     */
    hasTestChanges(addedLines) {
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

        addedLines.forEach((lineObj) => {
            const line = lineObj.context;

            if (testPatterns[language].match(line)) {
                addedTest.push(line);
            }
        });
    }

    /**
     * Analyzes the diff and returns an object with information about the changes.
     * @returns object
     * @param {string} patch
     */
    analyzeDiff(patch) {
        logger.info("Analyzing diff");
        const parsed = {
            // 1. Added lines
            addedLines: this.getAddedLines(patch),

            // 2. Deleted lines
            deletedLines: this.getDeletedLines(patch),

            // 3. File metadata
            filename: this.detectLanguage(patch),
            isTestFile: this.isTestFile(this.detectLanguage(patch)),

            // 4. Basic patterns
            hasNewFunctions: this.containsNewFunctions(
                this.getAddedLines(patch),
                this.detectLanguage(patch),
            ),

            // Import changes or new imports.
            hasImportChanges: this.containsImports(
                this.getAddedLines(patch),
                this.detectLanguage(patch),
            ),

            // Checking for test changes
            hasTestChanges: this.isTestFile(this.detectLanguage(patch)) ? this.hasTestChanges(this.getAddedLines(patch)) : false,
        };
        return parsed;
    }
}

module.exports = new DiffParser();
