import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import copy from 'rollup-plugin-copy';
import html from '@rollup/plugin-html';
import livereload from 'rollup-plugin-livereload';
import postcss from 'rollup-plugin-postcss';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import svelte from 'rollup-plugin-svelte';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, 'dist');
const production = !process.env.ROLLUP_WATCH;

export default {
  input: path.join(__dirname, 'src', 'main.js'),
  output: {
    dir: outputPath,
    format: 'iife',
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
    svelte(),
    postcss({
      extract: 'main.css',
      minimize: production,
    }),
    html({
      template: ({ files }) => (
        fs.readFileSync(path.join(__dirname, 'src', 'index.html'), 'utf8')
          .replace(
            '<link rel="stylesheet">',
            (files.css || [])
              .map(({ fileName }) => `<link rel="stylesheet" href="/${fileName}">`)
              .join('\n')
          )
          .replace(
            '<script></script>',
            (files.js || [])
              .map(({ fileName }) => `<script defer src="/${fileName}"></script>`)
              .join('\n')
          )
      ),
    }),
    ...(production ? [
      terser({ format: { comments: false } }),
      copy({
        targets: [{ src: 'screenshot.png', dest: 'dist' }],
      }),
    ] : [
      serve({
        contentBase: outputPath,
        port: 8080,
      }),
      livereload(outputPath),
    ]),
  ],
  watch: { clearScreen: false },
};
