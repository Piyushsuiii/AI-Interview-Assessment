module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@ai-hiring-platform/auth$": "<rootDir>/../../../packages/auth/src/index.ts",
    "^@ai-hiring-platform/validation$": "<rootDir>/../../../packages/validation/src/index.ts",
    "^@ai-hiring-platform/types$": "<rootDir>/../../../packages/types/src/index.ts",
    "^@ai-hiring-platform/logger$": "<rootDir>/../../../packages/logger/src/index.ts",
    "^@ai-hiring-platform/database$": "<rootDir>/../../../packages/database/src/index.ts",
  },
};
