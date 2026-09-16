import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      '../../packages/rnosai-ui/src/**/*.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react-dom/server': path.resolve(__dirname, './node_modules/react-dom/server.node.js'),
    },
  },
});
