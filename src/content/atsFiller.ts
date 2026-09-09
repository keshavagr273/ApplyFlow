/**
 * atsFiller.ts — Platform-Specific ATS Autofill Engine
 *
 * Covers: LinkedIn Easy Apply, Internshala, Unstop, Workday, Greenhouse,
 *         Lever, iCIMS, SmartRecruiters, BambooHR, Jobvite, Taleo, ADP,
 *         Rippling, and a smart generic fallback for unknown forms.
 */

import { UserProfile } from '../shared/types';
import { EEO_VALUE_MAP } from '../shared/fieldMatcher';

// ─── Platform Detection ───────────────────────────────────────────────────────

export type ATSPlatform =
  | 'linkedin'
  | 'internshala'
  | 'unstop'
  | 'workday'
  | 'greenhouse'
  | 'lever'
  | 'icims'
  | 'smartrecruiters'
  | 'bamboohr'
  | 'jobvite'
  | 'taleo'
  | 'adp'
  | 'naukri'
  | 'indeed'
  | 'angellist'
  | 'rippling'
  | 'generic';

export function detectATSPlatform(url: string = window.location.href): ATSPlatform {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com'))          return 'linkedin';
  if (u.includes('internshala.com'))       return 'internshala';
  if (u.includes('unstop.com'))            return 'unstop';
  if (u.includes('myworkdayjobs.com') || u.includes('workday.com')) return 'workday';
  if (u.includes('greenhouse.io') || u.includes('grnh.se')) return 'greenhouse';
  if (u.includes('jobs.lever.co') || u.includes('lever.co')) return 'lever';
  if (u.includes('icims.com'))             return 'icims';
  if (u.includes('smartrecruiters.com'))   return 'smartrecruiters';
  if (u.includes('bamboohr.com'))          return 'bamboohr';
  if (u.includes('jobvite.com'))           return 'jobvite';
  if (u.includes('taleo.net'))             return 'taleo';
  if (u.includes('adp.com'))              return 'adp';
  if (u.includes('naukri.com'))            return 'naukri';
  if (u.includes('indeed.com'))            return 'indeed';
  if (u.includes('angel.co') || u.includes('wellfound.com')) return 'angellist';
  if (u.includes('rippling.com'))          return 'rippling';
  return 'generic';
}

// ─── Core Utilities ───────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

const humanDelay = () => delay(Math.floor(Math.random() * 60) + 50);

/**
 * Recursively queries elements deep inside shadow roots.
 * Also checks if the selector is an XPath expression and evaluates it.
 */
function querySelectorDeep(selector: string, root: Document | Element | ShadowRoot = document): Element | null {
  if (!selector) return null;

  // XPath support (Simplify strategy)
  if (selector.startsWith('/') || selector.startsWith('./') || selector.startsWith('.//') || selector.startsWith('(')) {
    try {
      const doc = root instanceof Document ? root : root.ownerDocument || document;
      const context = root instanceof ShadowRoot ? doc.body : root;
      const result = doc.evaluate(selector, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue as Element;
    } catch (e) {
      console.warn('[ApplyFlow ATS] Failed to evaluate XPath:', selector, e);
    }
  }

  // Standard CSS selector within the current root
  try {
    const found = root.querySelector(selector);
    if (found) return found;
  } catch (e) {
    // Ignore if not a valid CSS selector
  }

  // Traversal of the shadow trees recursively (Simplify strategy)
  const allNodes = Array.from(root.querySelectorAll('*'));
  for (const node of allNodes) {
    if (node.shadowRoot) {
      const insideShadow = querySelectorDeep(selector, node.shadowRoot);
      if (insideShadow) return insideShadow;
    }
  }
  return null;
}

/**
 * Recursively queries all elements deep inside shadow roots.
 */
function querySelectorAllDeep(selector: string, root: Document | Element | ShadowRoot = document): Element[] {
  if (!selector) return [];

  const elements: Element[] = [];

  // Add matching elements in the current root
  try {
    elements.push(...Array.from(root.querySelectorAll(selector)));
  } catch (e) {
    // Ignore invalid CSS selector
  }

  // Find elements inside shadow roots
  const allNodes = Array.from(root.querySelectorAll('*'));
  for (const node of allNodes) {
    if (node.shadowRoot) {
      elements.push(...querySelectorAllDeep(selector, node.shadowRoot));
    }
  }

  return elements;
}

/**
 * Safely sets a value on any input/textarea/select, triggering all relevant
 * React/Vue/Angular synthetic events so frameworks detect the change.
 */
function safeSetValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (!el || !value) return;

  if (el instanceof HTMLSelectElement) {
    const normalizedTarget = value.toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i < el.options.length; i++) {
      const optText = el.options[i].text.toLowerCase().replace(/\s+/g, '');
      const optVal  = el.options[i].value.toLowerCase().replace(/\s+/g, '');
      if ((normalizedTarget === 'female' && optText === 'male') || (normalizedTarget === 'male' && optText === 'female')) {
        continue;
      }
      if (
        optText === normalizedTarget ||
        optVal === normalizedTarget ||
        (normalizedTarget && optText && optText.includes(normalizedTarget)) ||
        (normalizedTarget && optVal && optVal.includes(normalizedTarget)) ||
        (optText && normalizedTarget.includes(optText)) ||
        (optVal && normalizedTarget.includes(optVal))
      ) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        return;
      }
    }

    // Fallback for rating-based selects (e.g. target is "1"-"5")
    if (/^[1-5]$/.test(value)) {
      const rating = parseInt(value, 10);
      const keywords: Record<number, string[]> = {
        5: ['expert', 'master', 'advanced', 'fluent', 'high', '5'],
        4: ['advanced', 'expert', 'intermediate', 'good', '4'],
        3: ['intermediate', 'medium', 'average', 'moderate', '3'],
        2: ['beginner', 'basic', 'elementary', 'novice', '2'],
        1: ['beginner', 'basic', 'no experience', '1']
      };
      
      const searchWords = keywords[rating] || [];
      for (const word of searchWords) {
        for (let i = 0; i < el.options.length; i++) {
          const optText = el.options[i].text.toLowerCase();
          const optVal  = el.options[i].value.toLowerCase();
          if (optText.includes(word) || optVal.includes(word)) {
            el.selectedIndex = i;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            return;
          }
        }
      }
      
      // Fallback by options length index
      const nonPlaceholderOptions = Array.from(el.options).filter(opt => opt.value !== '');
      if (nonPlaceholderOptions.length === 5) {
        const targetOpt = nonPlaceholderOptions[rating - 1];
        if (targetOpt) {
          el.value = targetOpt.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          return;
        }
      } else if (nonPlaceholderOptions.length === 3) {
        const mappedIndex = rating === 5 ? 2 : (rating >= 3 ? 1 : 0);
        const targetOpt = nonPlaceholderOptions[mappedIndex];
        if (targetOpt) {
          el.value = targetOpt.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          return;
        }
      }
    }
    return;
  }

  // React's internal value setter — bypasses synthetic event system
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input',    { bubbles: true }));
  el.dispatchEvent(new Event('change',   { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focus',  { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur',   { bubbles: true }));
}

// removed safeSelectRadio because it was unused

function matchesEEOLabel(labelText: string, desired: string): boolean {
  const label = labelText.trim().toLowerCase();
  const target = desired.trim().toLowerCase();

  if (target === 'male' && label.includes('female')) {
    return false;
  }

  if (target.length <= 3) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);
    return regex.test(label);
  }

  return label.includes(target);
}

function getRadioGroupLabel(radio: HTMLInputElement): string {
  const nameText = radio.name || '';
  let groupLabel = '';
  let parent = radio.parentElement;
  let depth = 0;
  while (parent && depth < 4) {
    const legend = parent.querySelector('legend, label:not([for]), .question-label, .heading_6, .question_label');
    if (legend && legend.textContent) {
      groupLabel = legend.textContent;
      break;
    }
    const prevSibling = parent.previousElementSibling;
    if (prevSibling) {
      if (prevSibling.matches('label, p, h3, h4, legend, .question-label')) {
        groupLabel = (prevSibling as HTMLElement).innerText || prevSibling.textContent || '';
        break;
      }
      const nestedLabel = prevSibling.querySelector('label, legend, .heading_6, .question_label');
      if (nestedLabel) {
        groupLabel = (nestedLabel as HTMLElement).innerText || nestedLabel.textContent || '';
        break;
      }
    }
    parent = parent.parentElement;
    depth++;
  }
  return (nameText + ' ' + groupLabel).toLowerCase();
}

/**
 * Fills an EEO radio group by finding nearby labels that match the question type.
 */
function fillEEORadio(profile: UserProfile, fieldType: 'gender' | 'disability' | 'veteran' | 'workAuthorized' | 'sponsorship'): void {
  const profileValue: string = {
    gender:         profile.gender || 'prefer-not-to-say',
    disability:     profile.disability || 'prefer-not-to-say',
    veteran:        profile.veteran || 'prefer-not-to-say',
    workAuthorized: profile.workAuthorized !== undefined ? String(profile.workAuthorized) : 'false',
    sponsorship:    profile.requiresSponsorship !== undefined ? String(profile.requiresSponsorship) : 'false'
  }[fieldType];

  const valueMap: Record<string, string[]> = (EEO_VALUE_MAP as any)[fieldType];
  const desiredLabels: string[] = valueMap[profileValue] || valueMap['prefer-not-to-say'] || [];

  // Try all radio inputs in the document recursively (including Shadow DOM)
  const allRadios = Array.from(querySelectorAllDeep('input[type="radio"]')) as HTMLInputElement[];

  const EEO_QUESTION_KEYWORDS: Record<string, string[]> = {
    gender: ['gender', 'sex'],
    disability: ['disability', 'disabled', 'handicap', 'section 503'],
    veteran: ['veteran', 'military', 'armed forces', 'discharge'],
    workAuthorized: ['authorized', 'eligible to work', 'right to work', 'work permit', 'work_auth', 'authorized?'],
    sponsorship: ['sponsorship', 'sponsor', 'visa', 'h1b', 'h-1b', 'sponsoring']
  };

  const keywords = EEO_QUESTION_KEYWORDS[fieldType] || [];
  const contextRadios = allRadios.filter(radio => {
    const context = getRadioGroupLabel(radio);
    return keywords.some(kw => context.includes(kw));
  });

  if (contextRadios.length === 0) return;

  for (const radio of contextRadios) {
    const label = querySelectorDeep(`label[for="${radio.id}"]`);
    const labelText = label?.innerHTML || (label as HTMLElement)?.innerText || radio.nextElementSibling?.textContent || radio.value || '';
    for (const desired of desiredLabels) {
      if (matchesEEOLabel(labelText, desired)) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
  }
}

// getProfileValue removed because it was unused

// ─── Per-Platform Fill Logic ──────────────────────────────────────────────────

async function fillLinkedIn(profile: UserProfile): Promise<void> {
  // LinkedIn Easy Apply modal selectors
  const fieldMap: Array<[string, string]> = [
    // Standard easy-apply form inputs
    ['input[id*="firstName"], input[aria-label*="First name" i]',   profile.name.split(' ')[0]],
    ['input[id*="lastName"],  input[aria-label*="Last name" i]',    profile.name.split(' ').slice(1).join(' ')],
    ['input[id*="email"],     input[aria-label*="Email" i]',        profile.email],
    ['input[id*="phone"],     input[aria-label*="Phone" i]',        profile.phone],
    ['input[aria-label*="LinkedIn profile URL" i]',                  profile.linkedinUrl],
    ['input[aria-label*="Website" i], input[aria-label*="Portfolio" i]', profile.portfolioUrl || profile.githubUrl || ''],
    ['input[aria-label*="City" i]',                                  profile.currentCity || ''],
    ['input[aria-label*="State" i], input[aria-label*="Province" i]', profile.currentState || ''],
    ['input[aria-label*="Zip" i], input[aria-label*="Postal" i]',   profile.postalCode || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    for (const sel of selector.split(',')) {
      const el = querySelectorDeep(sel.trim()) as HTMLInputElement;
      if (el && !el.value) {
        el.focus();
        safeSetValue(el, value);
        await humanDelay();
        break;
      }
    }
  }

  // Work auth radios
  if (profile.workAuthorized !== undefined) {
    fillEEORadio(profile, 'workAuthorized');
  }
  if (profile.requiresSponsorship !== undefined) {
    fillEEORadio(profile, 'sponsorship');
  }

  // Handle LinkedIn's custom label-driven text fields (Easy Apply multi-step)
  const allLabels = Array.from(querySelectorAllDeep(
    '.jobs-easy-apply-form-section__group-subtitle, .fb-dash-form-element label'
  )) as HTMLLabelElement[];
  for (const label of allLabels) {
    const text = label.innerText.toLowerCase();
    const formEl = label.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__group');
    if (!formEl) continue;

    const input = querySelectorDeep('input[type="text"], textarea', formEl) as HTMLInputElement | HTMLTextAreaElement;
    if (!input || input.value) continue;

    let fillValue = '';
    if (text.includes('notice') || text.includes('available'))         fillValue = profile.noticePeriod || 'Immediate';
    else if (text.includes('salary') || text.includes('ctc'))         fillValue = profile.expectedSalary || '';
    else if (text.includes('college') || text.includes('university'))  fillValue = profile.college;
    else if (text.includes('degree') || text.includes('course'))      fillValue = profile.degree;
    else if (text.includes('cgpa') || text.includes('gpa') || text.includes('percentage')) fillValue = profile.cgpa || '';
    else if (text.includes('skill') || text.includes('tech'))         fillValue = profile.skills.slice(0, 5).join(', ');
    else if (text.includes('github'))                                  fillValue = profile.githubUrl || profile.portfolioUrl || '';
    else if (text.includes('portfolio') || text.includes('website'))  fillValue = profile.portfolioUrl || '';
    else if (text.includes('linkedin'))                                fillValue = profile.linkedinUrl;
    else if (text.includes('city') || text.includes('location'))      fillValue = profile.currentCity || '';
    else if (text.includes('country'))                                 fillValue = profile.currentCountry || 'India';
    else if (text.includes('experience'))                              fillValue = profile.yearsOfExperience || '';

    if (fillValue) {
      input.focus();
      safeSetValue(input, fillValue);
      await humanDelay();
    }
  }
}

async function fillInternshala(profile: UserProfile): Promise<void> {
  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Running fillInternshala');
  const fieldMap: Array<[string, string]> = [
    ['input[name="name"], input[id*="name"]',             profile.name],
    ['input[name="email"], input[id*="email"]',           profile.email],
    ['input[name="mobile"], input[id*="mobile"], input[name="phone"]', profile.phone],
    ['input[name="college"], input[id*="college"]',       profile.college],
    ['input[name="degree"], input[id*="degree"]',         profile.degree],
    ['input[name="graduation_year"]',                     profile.graduationYear],
    ['input[name="cgpa"], input[id*="cgpa"], input[name="percentage"]', profile.cgpa || ''],
    ['input[name="resume_link"], input[id*="resume"]',    profile.resumeLink],
    ['input[name="linkedin_url"]',                         profile.linkedinUrl],
    ['input[name="portfolio_url"]',                        profile.portfolioUrl || ''],
    ['input[name="github"], input[name="github_url"]',    profile.githubUrl || ''],
    ['input[name="city"], input[id*="city"]',              profile.currentCity || ''],
    ['input[name="skills"]',                               profile.skills.join(', ')],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    for (const sel of selector.split(',')) {
      const el = querySelectorDeep(sel.trim()) as HTMLInputElement;
      if (el) {
        if (!el.value) {
          if (import.meta.env.DEV) console.log(`[ApplyFlow ATS] Internshala matched field "${sel.trim()}".`);
          safeSetValue(el, value);
          await humanDelay();
        } else {
          if (import.meta.env.DEV) console.log(`[ApplyFlow ATS] Internshala field "${sel.trim()}" already filled.`);
        }
        break;
      }
    }
  }

  // Internshala cover letter / "why this role" textarea
  const coverAreas = Array.from(querySelectorAllDeep('textarea')) as HTMLTextAreaElement[];
  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Checking Internshala textareas. Count:', coverAreas.length);
  for (const ta of coverAreas) {
    if (!ta.value) {
      const placeholder = (ta.placeholder || '').toLowerCase();
      if (placeholder.includes('why') || placeholder.includes('cover') || placeholder.includes('tell') || placeholder.includes('about yourself')) {
        const answer = `I am a ${profile.degree} student at ${profile.college} (${profile.graduationYear}) with strong expertise in ${profile.skills.slice(0, 4).join(', ')}. I am highly motivated and believe my technical skills and passion for building impactful products make me a great fit for this role.`;
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Setting cover letter on textarea.');
        safeSetValue(ta, answer);
        await humanDelay();
      }
    }
  }
}

async function fillUnstop(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[formcontrolname="name"], input[placeholder*="Name" i]', profile.name],
    ['input[formcontrolname="email"], input[placeholder*="Email" i]', profile.email],
    ['input[formcontrolname="mobile"], input[placeholder*="Mobile" i], input[placeholder*="Phone" i]', profile.phone],
    ['input[formcontrolname="collegeName"], input[placeholder*="College" i], input[placeholder*="University" i]', profile.college],
    ['input[formcontrolname="degree"], input[placeholder*="Degree" i], input[placeholder*="Course" i]', profile.degree],
    ['input[formcontrolname="cgpa"], input[placeholder*="CGPA" i], input[placeholder*="GPA" i]', profile.cgpa || ''],
    ['input[formcontrolname="passingYear"]', profile.graduationYear],
    ['input[formcontrolname="city"], input[placeholder*="City" i]', profile.currentCity || ''],
    ['input[formcontrolname="linkedInUrl"], input[placeholder*="LinkedIn" i]', profile.linkedinUrl],
    ['input[formcontrolname="resumeLink"], input[placeholder*="Resume" i]', profile.resumeLink],
    ['input[formcontrolname="githubUrl"], input[placeholder*="GitHub" i]', profile.githubUrl || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    for (const sel of selector.split(',')) {
      const el = querySelectorDeep(sel.trim()) as HTMLInputElement;
      if (el && !el.value) {
        safeSetValue(el, value);
        await humanDelay();
        break;
      }
    }
  }

  // Unstop skill tags input
  const skillsInput = querySelectorDeep('input[placeholder*="Skills" i], input[placeholder*="Add skills" i]') as HTMLInputElement;
  if (skillsInput && !skillsInput.value) {
    for (const skill of profile.skills.slice(0, 6)) {
      safeSetValue(skillsInput, skill);
      skillsInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      await delay(300);
    }
  }
}

async function fillWorkday(profile: UserProfile): Promise<void> {
  // Workday uses data-automation-id attributes extensively
  const fieldMap: Array<[string, string]> = [
    ['[data-automation-id="legalNameSection_firstName"] input',  profile.name.split(' ')[0]],
    ['[data-automation-id="legalNameSection_lastName"] input',   profile.name.split(' ').slice(1).join(' ')],
    ['[data-automation-id="phone-number"] input',                profile.phone],
    ['[data-automation-id="email"] input',                       profile.email],
    ['[data-automation-id="addressSection_addressLine1"] input', profile.address || ''],
    ['[data-automation-id="addressSection_city"] input',         profile.currentCity || ''],
    ['[data-automation-id="addressSection_postalCode"] input',   profile.postalCode || ''],
    ['[data-automation-id="linkedInLink"] input',                profile.linkedinUrl],
    ['[data-automation-id="portfolioUrl"] input, [data-automation-id="websiteUrl"] input', profile.portfolioUrl || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    for (const sel of selector.split(',')) {
      const el = querySelectorDeep(sel.trim()) as HTMLInputElement;
      if (el && !el.value) {
        el.focus();
        safeSetValue(el, value);
        await humanDelay();
        break;
      }
    }
  }

  // Workday country/state dropdowns
  const countryDropdown = querySelectorDeep(
    '[data-automation-id="country"] select, [data-automation-id="countryRegion"] select'
  ) as HTMLSelectElement;
  if (countryDropdown) safeSetValue(countryDropdown, profile.currentCountry || 'India');

  const stateDropdown = querySelectorDeep('[data-automation-id="state"] select') as HTMLSelectElement;
  if (stateDropdown && profile.currentState) safeSetValue(stateDropdown, profile.currentState);
}

async function fillGreenhouse(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['#first_name',                                   profile.name.split(' ')[0]],
    ['#last_name',                                    profile.name.split(' ').slice(1).join(' ')],
    ['#email',                                        profile.email],
    ['#phone',                                        profile.phone],
    ['#resume_text',                                  profile.resumeText?.substring(0, 3000) || ''],
    ['input[name="question[education][school_name]"]', profile.college],
    ['input[name="question[education][degree]"]',      profile.degree],
    ['input[name="question[linkedin_profile]"]',       profile.linkedinUrl],
    ['input[name="question[website]"]',                profile.portfolioUrl || profile.githubUrl || ''],
    ['input[name="question[github]"]',                 profile.githubUrl || ''],
    ['input[name="question[phone_number]"]',            profile.phone],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }

  // Greenhouse country select
  const countrySelect = querySelectorDeep('select[name="job[country_code]"]') as HTMLSelectElement;
  if (countrySelect) safeSetValue(countrySelect, 'India');

  // Greenhouse custom questions (textareas)
  const textareas = Array.from(querySelectorAllDeep('textarea')) as HTMLTextAreaElement[];
  for (const ta of textareas) {
    if (!ta.value && ta.name.includes('question')) {
      const label = querySelectorDeep(`label[for="${ta.id}"]`) as HTMLLabelElement;
      const labelText = (label?.innerText || '').toLowerCase();
      let answer = '';

      if (labelText.includes('why') || labelText.includes('work here') || labelText.includes('interest')) {
        answer = `I am deeply interested in this role because it aligns perfectly with my expertise in ${profile.skills.slice(0, 3).join(', ')}. With my background from ${profile.college} and experience building impactful projects, I am confident I can add immediate value to your team.`;
      } else if (labelText.includes('experience') || labelText.includes('describe')) {
        answer = profile.experienceSummary || `I have hands-on experience in ${profile.skills.slice(0, 4).join(', ')}, having worked on multiple projects during my time at ${profile.college}. My strong foundation in software engineering and passion for clean code drive me to consistently deliver high-quality solutions.`;
      } else if (labelText.includes('skill') || labelText.includes('technology')) {
        answer = profile.skills.join(', ');
      }

      if (answer) {
        safeSetValue(ta, answer);
        await humanDelay();
      }
    }
  }
}

async function fillLever(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[name="name"]',                  profile.name],
    ['input[name="email"]',                 profile.email],
    ['input[name="phone"]',                 profile.phone],
    ['input[name="org"]',                   profile.college], // "Current Company/Org"
    ['input[name="urls[LinkedIn]"]',        profile.linkedinUrl],
    ['input[name="urls[GitHub]"]',          profile.githubUrl || ''],
    ['input[name="urls[Portfolio]"]',       profile.portfolioUrl || ''],
    ['input[name="urls[Other]"]',           profile.portfolioUrl || profile.githubUrl || ''],
    ['input[class*="application-field"][placeholder*="City" i]', profile.currentCity || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }

  // Lever cover letter / comments textarea
  const commentsArea = querySelectorDeep('textarea[name="comments"]') as HTMLTextAreaElement;
  if (commentsArea && !commentsArea.value) {
    const cover = `Dear Hiring Team,\n\nI am excited to apply for this role. With my background in ${profile.skills.slice(0, 3).join(', ')} and my degree from ${profile.college}, I am confident in my ability to contribute meaningfully to your team.\n\nBest regards,\n${profile.name}`;
    safeSetValue(commentsArea, cover);
  }
}

async function fillICIMS(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[id*="initialsandname_firstname" i], input[id*="firstname" i]', profile.name.split(' ')[0]],
    ['input[id*="initialsandname_lastname" i],  input[id*="lastname" i]',  profile.name.split(' ').slice(1).join(' ')],
    ['input[id*="email" i]',                   profile.email],
    ['input[id*="phone" i], input[id*="mobile" i]', profile.phone],
    ['input[id*="city" i]',                    profile.currentCity || ''],
    ['input[id*="state" i]',                   profile.currentState || ''],
    ['input[id*="country" i]',                 profile.currentCountry || 'India'],
    ['input[id*="zip" i], input[id*="postal" i]', profile.postalCode || ''],
    ['input[id*="linkedin" i]',                profile.linkedinUrl],
    ['input[id*="college" i], input[id*="school" i], input[id*="university" i]', profile.college],
    ['input[id*="degree" i]',                  profile.degree],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }
}

async function fillSmartRecruiters(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[id="firstName"]', profile.name.split(' ')[0]],
    ['input[id="lastName"]',  profile.name.split(' ').slice(1).join(' ')],
    ['input[id="email"]',     profile.email],
    ['input[id="phoneNumber"], input[id="phone"]', profile.phone],
    ['input[placeholder*="City" i]',     profile.currentCity || ''],
    ['input[placeholder*="LinkedIn" i]', profile.linkedinUrl],
    ['input[placeholder*="GitHub" i]',  profile.githubUrl || ''],
    ['input[placeholder*="Website" i]', profile.portfolioUrl || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }
}

async function fillNaukri(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[placeholder*="Full name" i], input[id*="name"]',  profile.name],
    ['input[placeholder*="Email" i], input[id*="email"]',     profile.email],
    ['input[placeholder*="Mobile" i], input[id*="mobile"]',   profile.phone],
    ['input[placeholder*="Current location" i]',              profile.currentCity || ''],
    ['input[placeholder*="College" i]',                       profile.college],
    ['input[placeholder*="Degree" i]',                        profile.degree],
    ['input[placeholder*="Key skills" i]',                    profile.skills.join(', ')],
    ['input[placeholder*="Notice period" i]',                 profile.noticePeriod || 'Immediate'],
    ['input[placeholder*="Current salary" i]',                profile.expectedSalary || ''],
    ['input[placeholder*="Expected salary" i]',               profile.expectedSalary || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }
}

async function fillIndeed(profile: UserProfile): Promise<void> {
  const fieldMap: Array<[string, string]> = [
    ['input[name="applicant.name"], input[id*="applicant-name"]', profile.name],
    ['input[name="applicant.emailAddress"]',  profile.email],
    ['input[name="applicant.phoneNumber"]',   profile.phone],
    ['input[name="applicant.city"]',          profile.currentCity || ''],
  ];

  for (const [selector, value] of fieldMap) {
    if (!value) continue;
    const el = querySelectorDeep(selector) as HTMLInputElement;
    if (el && !el.value) {
      safeSetValue(el, value);
      await humanDelay();
    }
  }
}

// ─── Generic Intelligent Filler ───────────────────────────────────────────────

function safeGetLabelByFor(id: string, root: ParentNode = document): HTMLLabelElement | null {
  if (!id) return null;
  try {
    return querySelectorDeep(`label[for="${CSS.escape(id)}"]`, root as any) as HTMLLabelElement;
  } catch (err) {
    console.warn('[ApplyFlow ATS] label selector query failed:', err);
    return null;
  }
}

function findLabelForInput(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (el.id) {
    const labelEl = safeGetLabelByFor(el.id);
    if (labelEl) return labelEl.innerText;
  }

  let prev = el.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL' || prev.classList.contains('question_label')) {
      return (prev as HTMLElement).innerText;
    }
    const nestedLabel = querySelectorDeep('label, .heading_6, .question_label', prev as any);
    if (nestedLabel) {
      return (nestedLabel as HTMLElement).innerText;
    }
    break; 
  }

  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 3) {
    const inputsInParent = querySelectorAllDeep('input:not([type="hidden"]), textarea, select', parent as any);
    if (inputsInParent.length === 1) {
      const foundLabel = querySelectorDeep('label, .heading_6, .question_label, [class*="label" i], .text-bold', parent as any);
      if (foundLabel && foundLabel !== el) {
        return (foundLabel as HTMLElement).innerText;
      }
    } else {
      const associatedLabel = el.id ? safeGetLabelByFor(el.id, parent) : null;
      if (associatedLabel) return (associatedLabel as HTMLElement).innerText;
    }

    const parentPrev = parent.previousElementSibling;
    if (parentPrev) {
      if (parentPrev.tagName === 'LABEL' || parentPrev.classList.contains('question_label')) {
        return (parentPrev as HTMLElement).innerText;
      }
      const nestedLabel = querySelectorDeep('label, .heading_6, .question_label', parentPrev as any);
      if (nestedLabel) {
        return (nestedLabel as HTMLElement).innerText;
      }
    }

    parent = parent.parentElement;
    depth++;
  }

  return (el.previousElementSibling as HTMLElement)?.innerText || '';
}

async function fillGeneric(profile: UserProfile): Promise<void> {
  const inputs = Array.from(querySelectorAllDeep(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
  )) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Starting fillGeneric on fields:', inputs.length);

  for (const el of inputs) {
    if (el.value && el.value.length > 0) continue; // Skip already-filled

    const labelText = findLabelForInput(el);

    const placeholder = (el as HTMLInputElement).placeholder?.toLowerCase() || '';
    const nameAttr   = el.name?.toLowerCase() || '';
    const idAttr     = el.id?.toLowerCase() || '';
    const combined   = `${labelText} ${placeholder} ${nameAttr} ${idAttr}`.toLowerCase();

    let fillValue = '';

    // Match in order of priority
    if (/\bfull.?name\b|your name|applicant name/i.test(combined))        fillValue = profile.name;
    else if (/\bfirst.?name\b/i.test(combined))                           fillValue = profile.name.split(' ')[0];
    else if (/\blast.?name\b|surname\b/i.test(combined))                  fillValue = profile.name.split(' ').slice(1).join(' ');
    else if (/\bemail\b/i.test(combined))                                  fillValue = profile.email;
    else if (/\bphone\b|\bmobile\b|\bcontact\b|\btel\b/i.test(combined))  fillValue = profile.phone;
    else if (/\bcollege\b|\buniversity\b|\binstitut/i.test(combined))      fillValue = profile.college;
    else if (/\bdegree\b|\bcourse\b|\bqualification\b/i.test(combined))   fillValue = profile.degree;
    else if (/\bgrad\b|\bpassout\b|\bpassing.?year\b|batch\b/i.test(combined)) fillValue = profile.graduationYear;
    else if (/\bcgpa\b|\bgpa\b|\bpercentage\b|\bmarks\b|\bgrade\b/i.test(combined)) fillValue = profile.cgpa || '';
    else if (/\blinkedin\b/i.test(combined))                              fillValue = profile.linkedinUrl;
    else if (/\bgithub\b/i.test(combined))                               fillValue = profile.githubUrl || profile.portfolioUrl || '';
    else if (/\bportfolio\b|\bwebsite\b/i.test(combined))               fillValue = profile.portfolioUrl || '';
    else if (/\bresume.?(link|url|drive)\b/i.test(combined))             fillValue = profile.resumeLink;
    else if (/\bskill\b|\btechnology\b|\btech.?stack\b/i.test(combined)) fillValue = profile.skills.join(', ');
    else if (/\bcity\b|\blocation\b/i.test(combined))                   fillValue = profile.currentCity || '';
    else if (/\bstate\b|\bprovince\b/i.test(combined))                  fillValue = profile.currentState || '';
    else if (/\bcountry\b/i.test(combined))                             fillValue = profile.currentCountry || 'India';
    else if (/\bpostal\b|\bpin.?code\b|\bzip\b/i.test(combined))       fillValue = profile.postalCode || '';
    else if (/\bnotice.?period\b|\bjoining\b/i.test(combined))          fillValue = profile.noticePeriod || 'Immediate';
    else if (/\bsalary\b|\bctc\b|\bcompensation\b/i.test(combined))     fillValue = profile.expectedSalary || '';
    else if (/\bexperience.?\(?years\)?\b|years.*experience|experience.*years/i.test(combined)) fillValue = profile.yearsOfExperience || '1';
    else if (/\bnationality\b|\bcitizenship\b/i.test(combined))         fillValue = profile.nationality || 'Indian';
    else if (/proficiency|rate your|rating|how would you rate|skill level/i.test(combined)) {
      // Proficiency rating check
      let matchedSkill = '';
      for (const skill of profile.skills) {
        const normalizedSkill = skill.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedCombined = combined.replace(/[^a-z0-9]/g, '');
        if (normalizedCombined.includes(normalizedSkill)) {
          matchedSkill = skill;
          break;
        }
      }
      // If user possesses the skill, select 4/5. Otherwise select 3.
      fillValue = matchedSkill ? '4' : '3';
    }
    else if (/how many projects|number of projects|projects.*completed|projects.*built/i.test(combined)) {
      fillValue = '3';
    }
    else if (/available|availability|start.*internship/i.test(combined)) {
      fillValue = 'Yes, I am available to start immediately for the full duration of the internship.';
    }
    else if (/duration|how many months|number of months/i.test(combined)) {
      if (el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'number' || /e\.?g\.?\s*\d+/i.test(placeholder)) {
        fillValue = '3';
      } else {
        fillValue = '3 months';
      }
    }
    else if (el.tagName === 'TEXTAREA' && !el.value) {
      // Smart essay/cover letter fill
      fillValue = `I am a ${profile.degree} student from ${profile.college} (${profile.graduationYear}) with strong skills in ${profile.skills.slice(0, 4).join(', ')}. I am highly motivated to contribute to your team and Eager to apply my knowledge to real-world challenges.`;
    }

    if (fillValue) {
      if (import.meta.env.DEV) console.log(`[ApplyFlow ATS] Generic matched field -> filling value`);
      el.focus();
      safeSetValue(el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, fillValue);
      await humanDelay();
    } else {
      if (import.meta.env.DEV) console.log(`[ApplyFlow ATS] No match for field text: "${combined.substring(0, 80)}..."`);
    }
  }

  // ── Handle Generic Radio Buttons (e.g., availability / start date) ──
  const radios = Array.from(querySelectorAllDeep('input[type="radio"]')) as HTMLInputElement[];
  const radioGroups = new Map<string, HTMLInputElement[]>();
  for (const r of radios) {
    const name = r.name || 'unnamed';
    if (!radioGroups.has(name)) {
      radioGroups.set(name, []);
    }
    radioGroups.get(name)!.push(r);
  }

  for (const [name, group] of radioGroups.entries()) {
    if (group.some(r => r.checked)) continue;

    // Find the question/group label
    let groupLabel = '';
    const firstRadio = group[0];
    let parent = firstRadio.parentElement;
    let depth = 0;
    while (parent && depth < 3 && !groupLabel) {
      const foundLabel = querySelectorDeep('label, .heading_6, .question_label, [class*="label" i], .text-bold', parent as any);
      if (foundLabel && !group.includes(foundLabel as any)) {
        groupLabel = (foundLabel as HTMLElement).innerText;
        break;
      }
      const prevSibling = parent.previousElementSibling;
      if (prevSibling) {
        if (prevSibling.tagName === 'LABEL' || prevSibling.classList.contains('question_label')) {
          groupLabel = (prevSibling as HTMLElement).innerText;
          break;
        }
        const nestedLabel = querySelectorDeep('label, .heading_6, .question_label', prevSibling as any);
        if (nestedLabel) {
          groupLabel = (nestedLabel as HTMLElement).innerText;
          break;
        }
      }
      parent = parent.parentElement;
      depth++;
    }

    const combinedGroup = groupLabel.toLowerCase();
    
    if (/available|availability|start.*internship|duration/i.test(combinedGroup)) {
      for (const radio of group) {
        const label = querySelectorDeep(`label[for="${radio.id}"]`);
        const labelText = (label?.innerHTML || (label as HTMLElement)?.innerText || radio.nextElementSibling?.textContent || radio.parentElement?.innerText || '').toLowerCase();
        if (/yes|available|can start/i.test(labelText) && !/no\b|other/i.test(labelText)) {
          if (import.meta.env.DEV) console.log(`[ApplyFlow ATS] Generic matched radio option for availability.`);
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          radio.dispatchEvent(new Event('input', { bubbles: true }));
          await humanDelay();
          break;
        }
      }
    }
  }
}

function showUpgradeModal(platformName: string) {
  const modalId = 'af-premium-blocker-modal';
  if (document.getElementById(modalId)) return;

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999999';
  overlay.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";

  const content = document.createElement('div');
  content.style.backgroundColor = '#ffffff';
  content.style.borderRadius = '24px';
  content.style.padding = '32px';
  content.style.width = '420px';
  content.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
  content.style.border = '1px solid rgba(74, 108, 247, 0.1)';
  content.style.textAlign = 'center';

  content.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">👑</div>
    <h3 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; letter-spacing: -0.5px;">Premium Platform Restricted</h3>
    <p style="font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.5; margin: 0 0 24px 0;">
      Autofilling on <strong style="color: #4a6cf7; text-transform: capitalize;">${platformName}</strong> is an ApplyFlow Premium feature. Upgrade to Pro to unlock unlimited one-click fills on all 15+ job application sites.
    </p>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button id="af-upgrade-btn" style="background: linear-gradient(135deg, #4a6cf7 0%, #aa3bff 100%); color: #ffffff; border: none; border-radius: 12px; padding: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(74, 108, 247, 0.2);">
        Upgrade to Premium
      </button>
      <button id="af-kofi-btn" style="background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        ☕ Support on Ko-fi
      </button>
      <button id="af-close-modal-btn" style="background: transparent; color: #94a3b8; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 8px; margin-top: 4px;">
        Maybe Later
      </button>
    </div>
  `;

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // Event Listeners
  content.querySelector('#af-upgrade-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    overlay.remove();
  });

  content.querySelector('#af-kofi-btn')?.addEventListener('click', () => {
    window.open(import.meta.env.VITE_KOFI_URL || 'https://ko-fi.com/keshav12oct', '_blank');
  });

  content.querySelector('#af-close-modal-btn')?.addEventListener('click', () => {
    overlay.remove();
  });
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runATSFill(profile: UserProfile): Promise<{ filled: number; platform: ATSPlatform }> {
  // Normalize profile fields to prevent any TypeError crashes downstream
  if (profile) {
    profile.name = profile.name || '';
    profile.email = profile.email || '';
    profile.phone = profile.phone || '';
    profile.college = profile.college || '';
    profile.degree = profile.degree || '';
    profile.graduationYear = profile.graduationYear || '';
    profile.skills = profile.skills || [];
    profile.currentCity = profile.currentCity || '';
    profile.currentState = profile.currentState || '';
    profile.currentCountry = profile.currentCountry || '';
    profile.postalCode = profile.postalCode || '';
  }

  const platform = detectATSPlatform();
  let filled = 0;
  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] runATSFill started. Detected platform:', platform);

  const res = await chrome.storage.local.get('settings');
  const settings = (res.settings || {}) as { isPremium?: boolean };
  const isPremium = !!settings.isPremium;
  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] isPremium:', isPremium);

  const freePlatforms: ATSPlatform[] = ['linkedin', 'internshala', 'unstop'];
  if (!isPremium && !freePlatforms.includes(platform)) {
    console.warn('[ApplyFlow ATS] Platform restricted. Premium required for:', platform);
    showUpgradeModal(platform === 'generic' ? 'this site' : platform);
    return { filled: 0, platform };
  }

  try {
    switch (platform) {
      case 'linkedin':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillLinkedIn');
        await fillLinkedIn(profile);
        break;
      case 'internshala':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillInternshala');
        await fillInternshala(profile);
        break;
      case 'unstop':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillUnstop');
        await fillUnstop(profile);
        break;
      case 'workday':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillWorkday');
        await fillWorkday(profile);
        break;
      case 'greenhouse':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillGreenhouse');
        await fillGreenhouse(profile);
        break;
      case 'lever':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillLever');
        await fillLever(profile);
        break;
      case 'icims':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillICIMS');
        await fillICIMS(profile);
        break;
      case 'smartrecruiters':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillSmartRecruiters');
        await fillSmartRecruiters(profile);
        break;
      case 'naukri':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillNaukri');
        await fillNaukri(profile);
        break;
      case 'indeed':
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillIndeed');
        await fillIndeed(profile);
        break;
      default:
        if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing fillGeneric fallback');
        await fillGeneric(profile);
        break;
    }

    // Always run the generic filler as a second pass to catch any remaining fields
    if (platform !== 'generic') {
      if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Executing second-pass fillGeneric');
      await fillGeneric(profile);
    }

    // EEO fill pass — runs on all platforms
    if (profile.gender)             fillEEORadio(profile, 'gender');
    if (profile.disability)         fillEEORadio(profile, 'disability');
    if (profile.veteran)            fillEEORadio(profile, 'veteran');
    if (profile.workAuthorized !== undefined) fillEEORadio(profile, 'workAuthorized');
    if (profile.requiresSponsorship !== undefined) fillEEORadio(profile, 'sponsorship');

    // Count filled fields
    filled = Array.from(querySelectorAllDeep(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea'
    ) as (HTMLInputElement | HTMLTextAreaElement)[]).filter(el => el.value && el.value.length > 0).length;

  } catch (err) {
    console.error('[ApplyFlow ATS] Fill error:', err);
  }

  return { filled, platform };
}

// ─── Success Page Detection ───────────────────────────────────────────────────

export function detectSubmissionSuccess(): boolean {
  const url = window.location.href.toLowerCase();
  const body = document.body?.innerText?.toLowerCase() || '';

  const urlSuccessPatterns = [
    '/success', '/confirmation', '/thank-you', '/thankyou',
    '/submitted', '/applied', '/complete', '/done', '?success=true'
  ];

  const bodySuccessPatterns = [
    'thank you for applying',
    'your application has been submitted',
    'application received',
    'successfully submitted',
    'we have received your application',
    'your application is complete',
    'application confirmed',
    'आवेदन सफलतापूर्वक', // Hindi: Application successful
  ];

  for (const p of urlSuccessPatterns) if (url.includes(p)) return true;
  for (const p of bodySuccessPatterns) if (body.includes(p)) return true;

  return false;
}

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime?.onMessage && !(window as any).__applyFlowAtsFillerInjected) {
  (window as any).__applyFlowAtsFillerInjected = true;
  console.log('[ApplyFlow ATS] atsFiller.ts injected and listening for messages.');

  chrome.runtime.onMessage.addListener((message: { type: string; payload?: any }, sender) => {
    if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Message received in listener:', message.type);
    // SECURITY: Only accept messages from this extension
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'DO_ATS_FILL') {
      const { profile } = message.payload;
      if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Triggering runATSFill');
      runATSFill(profile)
        .then((result) => {
          if (import.meta.env.DEV) console.log('[ApplyFlow ATS] runATSFill completed:', result);
        })
        .catch(err => console.error('[ApplyFlow ATS] runATSFill failed:', err));
    }
  });

  // Notify the service worker that we are ready
  if (import.meta.env.DEV) console.log('[ApplyFlow ATS] Sending ATS_FILLER_READY to background script...');
  chrome.runtime.sendMessage({ type: 'ATS_FILLER_READY' })
    .catch((err) => console.warn('[ApplyFlow ATS] Failed to send ATS_FILLER_READY:', err));
}
