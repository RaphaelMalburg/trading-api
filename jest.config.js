/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/server/tests"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/server/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/server/tests/setup.ts"],
};

module.exports = config;
