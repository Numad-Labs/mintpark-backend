import type { Config } from "jest";
const config: Config = {
  // testEnvironment: "node",
  // roots: ["<rootDir>/blockchain/evm/test"],
  // testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  // moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // moduleNameMapper: {
  //   "^@/(.*)$": "<rootDir>/src/$1",
  // },
  testEnvironment: "node",
  roots: ["<rootDir>/blockchain/evm/test"],
  transform: {
    "^.+\\.(ts|tsx)$": "babel-jest",
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  verbose: true,
};

export default config;
