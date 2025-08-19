import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: {
    shexParser: '@shexjs/parser',
  },
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    entryFileNames: '[name].es.js',
    chunkFileNames: 'chunks/[name].es.js',
    assetFileNames: 'assets/[name][extname]',
  },
  plugins: [
    resolve(),
    commonjs(),
    // terser({
    //   sourceMap: { includeSources: true }
    // })
  ],
};
