import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });
const config = [...compat.extends('next/core-web-vitals', 'next/typescript')];
const exportedConfig = [
  {
    ignores: ['.next/**', '.next-dev/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  ...config,
];

export default exportedConfig;
