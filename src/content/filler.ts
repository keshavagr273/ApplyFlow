/**
 * filler.ts — Field Filling Content Script
 *
 * Injected dynamically when the service-worker receives a FILL_FIELDS message.
 * Now supports radio buttons, checkboxes, and React-controlled selects.
 */

import { DetectedField, UserProfile } from '../shared/types';
import { EEO_VALUE_MAP } from '../shared/fieldMatcher';

// ─── Value setter ─────────────────────────────────────────────────────────────

export function safeSetValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (!el || value === undefined || value === null) return;

  if (el instanceof HTMLSelectElement) {
    const normalizedTarget = value.toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i < el.options.length; i++) {
      const optText = el.options[i].text.toLowerCase().replace(/\s+/g, '');
      const optVal  = el.options[i].value.toLowerCase().replace(/\s+/g, '');
      if ((normalizedTarget === 'female' && optText === 'male') || (normalizedTarget === 'male' && optText === 'female')) {
        continue;
      }
      if (
        optText.includes(normalizedTarget) ||
        optVal.includes(normalizedTarget) ||
        normalizedTarget.includes(optText) ||
        normalizedTarget.includes(optVal)
      ) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
    return;
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input',    { bubbles: true }));
  el.dispatchEvent(new Event('change',   { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur',  { bubbles: true }));
}

// ─── Radio / Checkbox helpers ─────────────────────────────────────────────────

function safeClickRadio(el: HTMLInputElement): void {
  el.click();
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input',  { bubbles: true }));
}

export function fillEEOField(
  fieldType: 'eeo_gender' | 'eeo_work_auth' | 'eeo_sponsorship' | 'eeo_disability' | 'eeo_veteran' | 'eeo_ethnicity',
  profile: UserProfile
): void {
  const typeKey = fieldType.replace('eeo_', '');
  const keyMap: Record<string, string> = {
    'work_auth': 'workAuthorized',
    'sponsorship': 'sponsorship',
    'gender': 'gender',
    'disability': 'disability',
    'veteran': 'veteran',
    'ethnicity': 'ethnicity'
  };
  const valueMap: Record<string, string[]> = (EEO_VALUE_MAP as any)[keyMap[typeKey] || typeKey];
  if (!valueMap) return;

  const profileValue: string = {
    eeo_gender:      profile.gender || 'prefer-not-to-say',
    eeo_disability:  profile.disability || 'prefer-not-to-say',
    eeo_veteran:     profile.veteran || 'prefer-not-to-say',
    eeo_work_auth:   profile.workAuthorized !== undefined ? String(profile.workAuthorized) : 'false',
    eeo_sponsorship: profile.requiresSponsorship !== undefined ? String(profile.requiresSponsorship) : 'false',
    eeo_ethnicity:   profile.ethnicity || ''
  }[fieldType] || '';

  const desiredLabels: string[] = valueMap[profileValue] || valueMap['prefer-not-to-say'] || [];

  const allRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  for (const radio of allRadios) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${radio.id}"]`);
    const siblingText = radio.parentElement?.innerText || radio.parentElement?.textContent || '';
    const labelText = (label?.innerText || label?.textContent || siblingText || radio.value || '').toLowerCase();

    for (const desired of desiredLabels) {
      const escapedDesired = desired.toLowerCase().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedDesired}\\b`);
      if (regex.test(labelText)) {
        safeClickRadio(radio);
        return;
      }
    }
  }
}

// ─── Main Fill Handler ────────────────────────────────────────────────────────

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

if (!(window as any).__applyFlowFillerInjected) {
  (window as any).__applyFlowFillerInjected = true;

  chrome.runtime.onMessage.addListener((message: { type: string; payload?: any }) => {
  if (message.type !== 'DO_FILL') return;

  if (!message.payload || !Array.isArray(message.payload.fields) || !message.payload.profile) {
    console.error('[ApplyFlow] Invalid DO_FILL payload', message.payload);
    return;
  }

  const { fields, profile } = message.payload as { fields: DetectedField[], profile: UserProfile };

  (async () => {
    for (const field of fields) {
      if (!field.mappedTo) continue;

      // ── EEO radio/checkbox fields ──
      if (field.mappedTo.startsWith('eeo_')) {
        fillEEOField(field.mappedTo as any, profile);
        await delay(Math.floor(Math.random() * 50) + 60);
        continue;
      }

      // ── Custom essay answers ──
      if (field.mappedTo === 'custom_answer') {
        const el = document.getElementById(field.elementId) as HTMLTextAreaElement | HTMLInputElement | null;
        if (!el || el.value) continue;

        // Find matching custom answer if any
        const answerObj = profile.customAnswers?.find(ca =>
          field.label.toLowerCase().includes(ca.trigger.toLowerCase()) ||
          ca.trigger.toLowerCase().includes(field.label.toLowerCase())
        );

        let answer = answerObj?.answer || '';
        if (!answer) {
          const labelLower = field.label.toLowerCase();
          if (labelLower.includes('why') || labelLower.includes('hire') || labelLower.includes('interest')) {
            answer = `I am excited to apply for this role because my skills in ${profile.skills.slice(0, 3).join(', ')} align perfectly with your requirements. My experience from ${profile.college} and hands-on project work have prepared me to contribute immediately and grow as part of your team.`;
          } else if (labelLower.includes('about') || labelLower.includes('yourself') || labelLower.includes('introduce')) {
            answer = `I'm a ${profile.degree} student from ${profile.college} (${profile.graduationYear}) with expertise in ${profile.skills.slice(0, 4).join(', ')}. I am passionate about building impactful software and eager to bring my skills to solve real-world problems.`;
          } else if (labelLower.includes('challenge') || labelLower.includes('difficult') || labelLower.includes('problem')) {
            answer = `One of my key challenges was optimizing performance in a real-time application I built. I identified bottlenecks in the state management layer, restructured the data flow, and reduced load times by 40%. This experience taught me the importance of profiling, systematic debugging, and delivering measurable improvements.`;
          } else {
            answer = `With my background in ${profile.skills.slice(0, 3).join(', ')} and my degree from ${profile.college}, I am confident in my ability to contribute effectively to this role. I bring strong problem-solving skills, a collaborative mindset, and genuine enthusiasm for building great products.`;
          }
        }

        safeSetValue(el, answer);
        await delay(Math.floor(Math.random() * 60) + 80);
        continue;
      }

      // ── Standard profile fields ──
      const el = document.getElementById(field.elementId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!el) continue;

      // Handle radio inputs
      if (field.inputType === 'radio') {
        const radio = el as HTMLInputElement;
        if (!radio.checked) {
          safeClickRadio(radio);
          await delay(Math.floor(Math.random() * 40) + 50);
        }
        continue;
      }

      // Handle checkboxes
      if (field.inputType === 'checkbox') {
        const checkbox = el as HTMLInputElement;
        const checkVal = (profile as Record<string, any>)[field.mappedTo];
        if (typeof checkVal === 'boolean' && !checkbox.checked === !checkVal) {
          checkbox.click();
        }
        continue;
      }

      // Handle text/select/textarea
      if (el.value && el.value.length > 0) continue; // Don't overwrite existing values

      let valToFill: any = (profile as Record<string, any>)[field.mappedTo];
      if (Array.isArray(valToFill)) valToFill = valToFill.join(', ');
      if (typeof valToFill === 'boolean') valToFill = valToFill ? 'Yes' : 'No';
      if (!valToFill) continue;

      safeSetValue(el, String(valToFill));
      chrome.runtime.sendMessage({ type: 'FIELD_FILLED', fieldId: field.elementId }).catch(() => {});
      await delay(Math.floor(Math.random() * 70) + 80);
    }

    // Notify completion
    chrome.runtime.sendMessage({ type: 'FILL_COMPLETE', fieldCount: fields.length }).catch(() => {});
  })();
});
}
