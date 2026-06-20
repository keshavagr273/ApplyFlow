import fs from 'fs';
import path from 'path';

const srcDir = path.resolve(process.cwd(), './dist');
const destDir = path.resolve(process.cwd(), './dist-firefox');

// Helper to recursively copy directories
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  console.log('[ApplyFlow Packager] Starting Firefox build adaptation...');

  // Ensure source build directory exists
  if (!fs.existsSync(srcDir)) {
    console.error(`[ApplyFlow Packager] Source dist directory not found at ${srcDir}. Please run npm run build first.`);
    process.exit(1);
  }

  // Clean/Create destination directory
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  // Copy files from dist to dist-firefox
  copyRecursiveSync(srcDir, destDir);
  console.log(`[ApplyFlow Packager] Copied build outputs to ${destDir}`);

  // Modify manifest.json for Firefox compatibility
  const manifestPath = path.join(destDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // 1. Remove Chrome-only permissions & configurations
    if (manifest.permissions) {
      manifest.permissions = manifest.permissions.filter(p => p !== 'sidePanel');
    }
    delete manifest.side_panel;
    delete manifest.oauth2;

    // 2. Add Firefox sidebar_action config
    manifest.sidebar_action = {
      default_panel: 'side-panel.html',
      default_icon: 'icons/icon32.png',
      default_title: 'ApplyFlow Sidebar'
    };

    // 3. Add Gecko Firefox extension ID
    manifest.browser_specific_settings = {
      gecko: {
        id: 'applyflow@keshavagrawal.com',
        strict_min_version: '109.0'
      }
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('[ApplyFlow Packager] manifest.json successfully adapted for Firefox V3.');
  } else {
    console.error('[ApplyFlow Packager] manifest.json not found in the output directory.');
    process.exit(1);
  }

  console.log('[ApplyFlow Packager] Firefox packaging completed successfully! Outputs are in ./dist-firefox');
}

main().catch(err => {
  console.error('[ApplyFlow Packager] Package script failed:', err);
  process.exit(1);
});
