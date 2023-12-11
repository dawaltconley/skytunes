/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.test\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tests/tsconfig.json',
      },
    ],
  },
}
