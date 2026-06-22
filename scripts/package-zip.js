import fs from 'fs';
import path from 'path';
import * as archiverModule from 'archiver';
const archiver = archiverModule.default || archiverModule;

const distDir = path.resolve(process.cwd(), './dist');
const outputFile = path.resolve(process.cwd(), './applyflow.zip');

async function main() {
  console.log('[ApplyFlow Packager] Starting ZIP packaging...');

  if (!fs.existsSync(distDir)) {
    console.error(`[ApplyFlow Packager] Source dist directory not found at ${distDir}. Please run npm run build first.`);
    process.exit(1);
  }

  // Create a file to write to
  const output = fs.createWriteStream(outputFile);
  const archive = new archiverModule.ZipArchive({
    zlib: { level: 9 } // Sets the compression level.
  });

  // Listen for all archive data to be written
  output.on('close', () => {
    console.log(`[ApplyFlow Packager] ZIP package completed successfully!`);
    console.log(`[ApplyFlow Packager] Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[ApplyFlow Packager] Output path: ${outputFile}`);
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[ApplyFlow Packager] Warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    throw err;
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Append files from dist directory, preserving structure
  archive.directory(distDir, false);

  // Finalize the archive (ie we are done writing all files)
  await archive.finalize();
}

main().catch(err => {
  console.error('[ApplyFlow Packager] ZIP packaging failed:', err);
  process.exit(1);
});
