import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    nyaa: './src/nyaa.js',
    animetosho: './src/animetosho.js',
    seadex: './src/seadex.js',
    subsplease: './src/subsplease.js',
    yameii: './src/yameii.js',
    toonshub: './src/toonshub.js',
    tsukihime: './src/tsukihime.js'
  },
  format: ['esm'],
  splitting: false,
  clean: true,
  outDir: 'dist'
})