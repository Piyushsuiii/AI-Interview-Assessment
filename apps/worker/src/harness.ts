import type { SupportedLanguage } from "./docker";

export type HarnessTest = { name: string; input: unknown; expected: unknown };
export type Harness = { tests: HarnessTest[] };

export function parseHarness(value: unknown): Harness {
  const candidate = Array.isArray(value) ? value : (value as { tests?: unknown } | null)?.tests;
  if (!Array.isArray(candidate)) {
    throw new Error("Challenge test harness must contain a tests array");
  }
  const tests = candidate;
  if (tests.length > 100) throw new Error("A test set cannot contain more than 100 tests");
  return {
    tests: tests.map((test, index) => {
      if (!test || typeof test !== "object" || !("expected" in test)) throw new Error(`Invalid test at index ${index}`);
      const item = test as { name?: unknown; input?: unknown; expected: unknown };
      return { name: typeof item.name === "string" ? item.name.slice(0, 100) : `test ${index + 1}`, input: item.input, expected: item.expected };
    }),
  };
}

export function buildProgram(language: SupportedLanguage, source: string, harness: Harness): string {
  const tests = JSON.stringify(harness.tests);
  if (language === "python") {
    return `${source}\n\nimport json as __json\n__tests = __json.loads(${JSON.stringify(tests)})\n__results = []\nfor __test in __tests:\n    try:\n        __input = __test.get("input")\n        __actual = solve(*__input) if isinstance(__input, list) else solve(__input)\n        __passed = __actual == __test["expected"]\n        __results.append({"name": __test["name"], "passed": __passed, "actual": __actual})\n    except Exception as __error:\n        __results.append({"name": __test["name"], "passed": False, "error": str(__error)[:500]})\nprint("__RESULT__" + __json.dumps({"tests": __results}, separators=(",", ":")))\n`;
  }
  return `${source}\n\nconst __tests = ${tests};\nconst __results = [];\nfor (const __test of __tests) {\n  try {\n    const __actual = Array.isArray(__test.input) ? await solve(...__test.input) : await solve(__test.input);\n    const __passed = JSON.stringify(__actual) === JSON.stringify(__test.expected);\n    __results.push({ name: __test.name, passed: __passed, actual: __actual });\n  } catch (__error) {\n    __results.push({ name: __test.name, passed: false, error: String(__error).slice(0, 500) });\n  }\n}\nconsole.log("__RESULT__" + JSON.stringify({ tests: __results }));\n`;
}

export function extractResults(stdout: string): { tests: Array<{ passed: boolean; [key: string]: unknown }> } {
  const line = stdout.split(/\r?\n/).reverse().find((item) => item.startsWith("__RESULT__"));
  if (!line) throw new Error("Execution did not produce a test result");
  const result = JSON.parse(line.slice("__RESULT__".length)) as { tests?: unknown };
  if (!Array.isArray(result.tests)) throw new Error("Execution produced an invalid test result");
  return result as { tests: Array<{ passed: boolean; [key: string]: unknown }> };
}
