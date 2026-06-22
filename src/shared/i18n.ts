import enMessages from '../../public/_locales/en/messages.json';

/**
 * Returns a translated message for the given key, replacing placeholders ($1, $2, etc.) if provided.
 */
export function t(key: string, ...substitutions: string[]): string {
  // If chrome.i18n is available, use it.
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    return chrome.i18n.getMessage(key, substitutions);
  }

  // Fallback to the base English file for unit testing and local development context.
  const msgObj = (enMessages as Record<string, any>)[key];
  if (!msgObj || !msgObj.message) {
    return key;
  }

  let message = msgObj.message;
  // Replace placeholders like $1, $2, etc.
  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((sub, i) => {
      const placeholder = `$${i + 1}$`;
      // Check for both $1$ style (which chrome.i18n uses under the hood) and $1 style
      message = message.split(placeholder).join(sub);
      message = message.split(`$${i + 1}`).join(sub);
    });
  }

  return message;
}
