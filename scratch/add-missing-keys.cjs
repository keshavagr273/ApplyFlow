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

    // 1. Add missing custom_answers_title if not present
    if (!data.custom_answers_title) {
      data.custom_answers_title = {
        message: "Custom Answers",
        description: "Accordion section title for custom answers"
      };
      modified = true;
    }

    // 2. Add missing tailor_resume_title if not present
    if (!data.tailor_resume_title) {
      data.tailor_resume_title = {
        message: "Tailor Resume",
        description: "Suggestion chip for tailoring resume"
      };
      modified = true;
    }

    // 3. Add missing interview_prep_title if not present
    if (!data.interview_prep_title) {
      data.interview_prep_title = {
        message: "Interview Prep",
        description: "Suggestion chip for interview preparation"
      };
      modified = true;
    }

    // 4. Update fit_percent message to include % if not already included
    if (data.fit_percent && typeof data.fit_percent.message === 'string') {
      const msg = data.fit_percent.message;
      if (msg.includes('$1$') && !msg.includes('%')) {
        // e.g. "$1$ Fit" -> "$1$% Fit"
        data.fit_percent.message = msg.replace('$1$', '$1$%');
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(messagesPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated translations in: ${messagesPath}`);
      filesUpdated++;
    }
  } catch (err) {
    console.error(`Error processing ${messagesPath}:`, err);
  }
}

console.log(`Successfully updated ${filesUpdated} messages.json files.`);
