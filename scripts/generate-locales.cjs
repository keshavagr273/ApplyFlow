const fs = require('fs');
const path = require('path');

// 60 CWS target locales (excluding 'en')
const TARGET_LOCALES = [
  "am", "ar", "az", "bg", "bn", "cs", "da", "de", "el",
  "es", "fa", "fi", "fr", "gu", "ha", "he", "hi", "hr", "hu",
  "id", "ig", "it", "ja", "jv", "kk", "km", "kn", "ko", "lt",
  "ml", "mr", "my", "ne", "nl", "no", "pa", "pl", "ps", "pt",
  "ro", "ru", "sd", "si", "sk", "sl", "sv", "sw", "ta", "te",
  "th", "tl", "tr", "uk", "ur", "uz", "vi", "yo", "zh_CN", "zh_TW",
  "zu"
];

function mapLocaleToTranslateCode(locale) {
  if (locale === 'zh_CN') return 'zh-CN';
  if (locale === 'zh_TW') return 'zh-TW';
  return locale;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Replaces placeholders like $1$, $COUNT$, $2$ and newlines with stable tokens to protect them from Google Translate corruption
function protectPlaceholders(text) {
  const matches = text.match(/\$[1-9A-Z_]+\$/g) || [];
  const protectedItems = [];
  let protectedText = text;
  
  // Protect placeholders
  matches.forEach((match, index) => {
    const token = `__P_${index}__`;
    protectedItems.push({ token, original: match });
    protectedText = protectedText.split(match).join(token);
  });

  // Protect newlines to keep strings on a single line for batching
  let nlIndex = 0;
  // Handle CRLF first
  while (protectedText.includes('\r\n')) {
    const token = `__CRNL_${nlIndex}__`;
    protectedItems.push({ token, original: '\r\n' });
    protectedText = protectedText.replace('\r\n', token);
    nlIndex++;
  }
  while (protectedText.includes('\n')) {
    const token = `__NL_${nlIndex}__`;
    protectedItems.push({ token, original: '\n' });
    protectedText = protectedText.replace('\n', token);
    nlIndex++;
  }

  return { text: protectedText, placeholders: protectedItems };
}

function restorePlaceholders(text, placeholders) {
  let restored = text;
  placeholders.forEach(({ token, original }) => {
    // Check for potential space modifications around the tokens done by translation
    restored = restored.split(token).join(original);
    // Also check for lowercase/spacing variations
    const looseTokenPattern = new RegExp(token.replace(/_/g, '\\s*\\_\\s*'), 'gi');
    restored = restored.replace(looseTokenPattern, original);
  });
  return restored;
}

async function translateText(text, targetLang) {
  const translateCode = mapLocaleToTranslateCode(targetLang);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${translateCode}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json[0].map(x => x[0]).join('');
}

async function translateBatchWithFallback(batch, targetLang) {
  // Try to translate combined batch using newline delimiter
  const delimiter = "\n";
  const rawBatchTexts = batch.map(item => item.protectedText);
  const joinedText = rawBatchTexts.join(delimiter);

  try {
    const translatedJoined = await translateText(joinedText, targetLang);
    // Split by newline
    const parts = translatedJoined.split('\n');
    if (parts.length === batch.length) {
      return parts.map((part, index) => restorePlaceholders(part, batch[index].placeholders));
    }
    console.warn(`[Batch length mismatch for ${targetLang}]: expected ${batch.length}, got ${parts.length}. Falling back to sequential translation...`);
  } catch (err) {
    console.error(`[Batch translation failed for ${targetLang}]: ${err.message}. Falling back to sequential...`);
  }

  // Sequential fallback
  const results = [];
  for (const item of batch) {
    await delay(100);
    try {
      const translated = await translateText(item.protectedText, targetLang);
      results.push(restorePlaceholders(translated, item.placeholders));
    } catch (err) {
      console.error(`[Sequential translate failure for ${item.key} in ${targetLang}]:`, err);
      // Fallback to original
      results.push(item.originalText);
    }
  }
  return results;
}

async function run() {
  const messagesPath = path.join(__dirname, '../public/_locales/en/messages.json');
  const enMessages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

  const webstoreListingPath = path.join(__dirname, '../WEBSTORE_LISTING.md');
  const webstoreListing = fs.readFileSync(webstoreListingPath, 'utf8');

  // Extract long description starting from line 11 (zero-indexed line 10)
  const lines = webstoreListing.split('\n');
  const longDescriptionEn = lines.slice(10).join('\n').trim();

  console.log("Extracted English Long Description length:", longDescriptionEn.length);

  // Prepare UI keys
  const keys = Object.keys(enMessages);
  const itemsToTranslate = keys.map(key => {
    const originalText = enMessages[key].message;
    const { text, placeholders } = protectPlaceholders(originalText);
    return { key, originalText, protectedText: text, placeholders, description: enMessages[key].description };
  });

  // Batch items by character limit (max 1500 chars per batch)
  const batches = [];
  let currentBatch = [];
  let currentLen = 0;
  for (const item of itemsToTranslate) {
    if (currentLen + item.protectedText.length > 1500 && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLen = 0;
    }
    currentBatch.push(item);
    currentLen += item.protectedText.length + 1; // 1 for delimiter (\n)
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  console.log(`Prepared ${itemsToTranslate.length} keys in ${batches.length} translation batches.`);

  const translatedDescriptions = {
    en: longDescriptionEn
  };

  // Process locales
  for (const locale of TARGET_LOCALES) {
    console.log(`\n==================================================`);
    console.log(`Translating to locale: ${locale} ...`);
    const localeDir = path.join(__dirname, `../public/_locales/${locale}`);
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }

    const translatedMessages = {};

    // Translate UI batches
    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const batch = batches[bIndex];
      console.log(`- UI Batch ${bIndex + 1}/${batches.length} (${batch.length} keys)`);
      await delay(200);
      const translatedTexts = await translateBatchWithFallback(batch, locale);
      batch.forEach((item, index) => {
        translatedMessages[item.key] = {
          message: translatedTexts[index],
          description: item.description
        };
      });
    }

    // Safety checks for appName & appDesc English fallbacks
    const originalName = enMessages.appName.message;
    const originalDesc = enMessages.appDesc.message;
    const translatedName = translatedMessages.appName.message;
    const translatedDesc = translatedMessages.appDesc.message;

    if (translatedName === originalName && locale !== 'en') {
      console.warn(`[WARNING]: appName fallback detected in ${locale}. Retrying translation...`);
      await delay(300);
      try {
        const directName = await translateText(originalName, locale);
        if (directName) translatedMessages.appName.message = directName;
      } catch (e) {
        console.error(`Failed to correct appName for ${locale}:`, e);
      }
    }
    if (translatedDesc === originalDesc && locale !== 'en') {
      console.warn(`[WARNING]: appDesc fallback detected in ${locale}. Retrying translation...`);
      await delay(300);
      try {
        const directDesc = await translateText(originalDesc, locale);
        if (directDesc) translatedMessages.appDesc.message = directDesc;
      } catch (e) {
        console.error(`Failed to correct appDesc for ${locale}:`, e);
      }
    }

    // Save locale messages.json
    fs.writeFileSync(
      path.join(localeDir, 'messages.json'),
      JSON.stringify(translatedMessages, null, 2),
      'utf8'
    );
    console.log(`✓ Saved messages.json for ${locale}`);

    // Translate long description
    console.log(`- Translating long listing description...`);
    await delay(300);
    try {
      // Localize brand name references in listing text dynamically using translated brandName if translated
      const localBrandName = translatedMessages.brandName ? translatedMessages.brandName.message : "ApplyFlow";
      const { text: protectedDesc, placeholders: descPlaceholders } = protectPlaceholders(longDescriptionEn);
      
      const translatedDescRaw = await translateText(protectedDesc, locale);
      let finalDesc = restorePlaceholders(translatedDescRaw, descPlaceholders);

      // Swap brand name if Google translate translated it differently than what's in messages.json
      if (localBrandName !== "ApplyFlow") {
        finalDesc = finalDesc.split("ApplyFlow").join(localBrandName);
      }

      translatedDescriptions[locale] = finalDesc;
      console.log(`✓ Long description translated (length: ${finalDesc.length})`);
    } catch (err) {
      console.error(`Failed to translate long description for ${locale}:`, err);
      // Fallback
      translatedDescriptions[locale] = longDescriptionEn;
    }
  }

  // Generate cws_auto_filler.js
  console.log(`\nGenerating cws_auto_filler.js script...`);
  const autoFillerCode = `/**
 * ApplyFlow Chrome Web Store Developer Dashboard Auto-Filler
 * 
 * Instructions:
 * 1. Open the Chrome Web Store Developer Dashboard.
 * 2. Navigate to your extension's Store Listing page.
 * 3. Open Developer Tools (F12) and go to the Console.
 * 4. Paste this entire script and press Enter.
 * 5. Use the floating GUI controls to select a language and automate description input.
 */

(function() {
  const DESCRIPTIONS = ${JSON.stringify(translatedDescriptions, null, 2)};

  // UI panel creation (TrustedHTML CSP compliant)
  const panel = document.createElement('div');
  panel.id = 'af-cws-filler-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: '999999',
    background: '#1e293b',
    color: '#f8fafc',
    padding: '16px',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    border: '1px solid #334155',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '12px',
    width: '280px',
    boxSizing: 'border-box'
  });

  const header = document.createElement('div');
  header.textContent = 'ApplyFlow CWS Auto-Filler';
  Object.assign(header.style, {
    fontWeight: '800',
    fontSize: '14px',
    marginBottom: '8px',
    borderBottom: '1px solid #334155',
    paddingBottom: '6px',
    color: '#38bdf8'
  });
  panel.appendChild(header);

  const statusText = document.createElement('div');
  statusText.id = 'af-filler-status';
  statusText.textContent = 'Ready to fill.';
  Object.assign(statusText.style, {
    margin: '8px 0',
    color: '#94a3b8',
    fontWeight: '600'
  });
  panel.appendChild(statusText);

  // Dropdown for manual selection
  const selectLabel = document.createElement('label');
  selectLabel.textContent = 'Select target locale:';
  selectLabel.style.display = 'block';
  selectLabel.style.marginBottom = '4px';
  panel.appendChild(selectLabel);

  const select = document.createElement('select');
  select.id = 'af-locale-select';
  Object.assign(select.style, {
    width: '100%',
    padding: '6px',
    borderRadius: '6px',
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #475569',
    marginBottom: '12px',
    outline: 'none'
  });

  Object.keys(DESCRIPTIONS).forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    select.appendChild(opt);
  });
  panel.appendChild(select);

  // Button actions
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '8px';

  const fillBtn = document.createElement('button');
  fillBtn.textContent = 'Fill Current';
  Object.assign(fillBtn.style, {
    flex: '1',
    padding: '8px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer'
  });
  fillBtn.addEventListener('click', () => {
    const loc = select.value;
    const desc = DESCRIPTIONS[loc];
    if (fillDescription(desc)) {
      statusText.textContent = 'Filled description for ' + loc;
    } else {
      statusText.textContent = 'No visible description textarea found!';
    }
  });
  buttonContainer.appendChild(fillBtn);

  const autoLoopBtn = document.createElement('button');
  autoLoopBtn.textContent = 'Run Auto-Loop';
  Object.assign(autoLoopBtn.style, {
    flex: '1.2',
    padding: '8px',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer'
  });
  autoLoopBtn.addEventListener('click', () => {
    startAutoLoop();
  });
  buttonContainer.appendChild(autoLoopBtn);

  panel.appendChild(buttonContainer);
  document.body.appendChild(panel);

  // Core automation logic
  function fillDescription(text) {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    // Find the longest visible textarea which is typically the CWS description box
    const target = textareas
      .filter(t => t.offsetParent !== null)
      .sort((a, b) => b.value.length - a.value.length)[0];

    if (!target) return false;

    // Use prototype value descriptor to trigger framework lifecycle updates (React/Angular)
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    valueSetter.call(target, text);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function startAutoLoop() {
    statusText.textContent = 'Starting auto-loop...';
    
    // Find CWS Language Selection Dropdown
    const dropdown = document.querySelector('div[role="combobox"]');
    if (!dropdown) {
      statusText.textContent = 'Error: Language dropdown not found on CWS!';
      return;
    }

    statusText.textContent = 'Scanning CWS locales...';
    dropdown.click();
    await new Promise(r => setTimeout(r, 1000));

    const options = Array.from(document.querySelectorAll('li[role="option"]'));
    dropdown.click(); // Close

    if (options.length === 0) {
      statusText.textContent = 'Error: No CWS locale options found!';
      return;
    }

    statusText.textContent = 'Found ' + options.length + ' locales. Starting...';
    
    for (let i = 0; i < options.length; i++) {
      // Re-query list options to avoid stale elements
      dropdown.click();
      await new Promise(r => setTimeout(r, 800));
      const freshOptions = Array.from(document.querySelectorAll('li[role="option"]'));
      const opt = freshOptions[i];
      if (!opt) continue;

      const locName = opt.textContent.trim();
      const valCode = opt.getAttribute('data-value') || '';
      
      // Map CWS Dashboard code format to our descriptions format (e.g. zh-CN -> zh_CN, iw -> he)
      let matchedCode = valCode.replace('-', '_');
      if (matchedCode === 'iw') matchedCode = 'he';
      if (matchedCode === 'fil') matchedCode = 'tl';
      // Strip regional fallbacks where base code exists (e.g., es-419 -> es)
      if (!DESCRIPTIONS[matchedCode] && matchedCode.includes('_')) {
        matchedCode = matchedCode.split('_')[0];
      }

      const descText = DESCRIPTIONS[matchedCode] || DESCRIPTIONS['en'];
      
      statusText.textContent = 'Filling [' + (i + 1) + '/' + freshOptions.length + '] ' + locName + ' (' + matchedCode + ')...';
      
      opt.click();
      // Allow dashboard 2500ms to load the textarea context for this locale
      await new Promise(r => setTimeout(r, 2500));

      fillDescription(descText);
      await new Promise(r => setTimeout(r, 800));
    }

    statusText.textContent = '✓ Finished processing all locales!';
  }
})();
`;

  fs.writeFileSync(
    path.join(__dirname, '../cws_auto_filler.js'),
    autoFillerCode,
    'utf8'
  );
  console.log(`✓ Auto-filler script cws_auto_filler.js generated successfully!`);
}

run().catch(console.error);
