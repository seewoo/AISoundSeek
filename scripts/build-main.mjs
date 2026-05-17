import * as esbuild from 'esbuild'

const apiUrl = process.env.AUDIO_SEEK_API_URL || 'http://localhost:8080/api'

await esbuild.build({
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/main/main/main.js',
  external: ['electron', 'sql.js'],
  define: {
    '__AUDIO_SEEK_API_URL__': JSON.stringify(apiUrl),
  },
})

// Preload script must be compiled separately (it runs in a restricted context)
await esbuild.build({
  entryPoints: ['src/main/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/main/main/preload.js',
  external: ['electron'],
})

console.log(`Built main process with API_URL: ${apiUrl}`)
console.log('Built preload script')