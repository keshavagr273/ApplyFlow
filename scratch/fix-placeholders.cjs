const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', '_locales');

if (!fs.existsSync(localesDir)) {
  console.error('Locales directory not found at:', localesDir);
  process.exit(1);
}

const folders = fs.readdirSync(localesDir);

let filesUpdated = 0;

for (const folder of folders) {
  const folderPath = path.join(localesDir, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const messagesPath = path.join(folderPath, 'messages.json');
  if (!fs.existsSync(messagesPath)) continue;

  try {
    const content = fs.readFileSync(messagesPath, 'utf8');
    const data = JSON.parse(content);
    let modified = false;

    for (const key of Object.keys(data)) {
      const entry = data[key];
      if (entry && typeof entry.message === 'string') {
        const msg = entry.message;
        // Find all $N$ occurrences (e.g. $1$, $2$)
        const regex = /\$(\d+)\$/g;
        let match;
        const placeHolderNumbers = new Set();
        while ((match = regex.exec(msg)) !== null) {
          placeHolderNumbers.add(match[1]);
        }

        if (placeHolderNumbers.size > 0) {
          // Initialize placeholders object if it doesn't exist
          if (!entry.placeholders) {
            entry.placeholders = {};
          }
          
          for (const num of placeHolderNumbers) {
            if (!entry.placeholders[num]) {
              entry.placeholders[num] = {
                content: `$${num}`
              };
              modified = true;
            }
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(messagesPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated placeholders in: ${messagesPath}`);
      filesUpdated++;
    }
  } catch (err) {
    console.error(`Error processing ${messagesPath}:`, err);
  }
}

console.log(`Successfully updated ${filesUpdated} messages.json files.`);
