import { matchField, FieldSignals } from '../shared/fieldMatcher';
import { DetectedField, ScanResult, UserProfile } from '../shared/types';

export function detectCaptcha(doc: Document): boolean {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="captcha"]',
    '.g-recaptcha',
    '#recaptcha',
    '[data-sitekey]',
    'iframe[src*="challenges.cloudflare"]'
  ];
  return captchaSelectors.some(sel => !!doc.querySelector(sel));
}

export function extractJobDetails() {
  let company = "";
  let role = "";
  let jobDescription = "";

  const url = window.location.href.toLowerCase();
  
  if (url.includes('linkedin.com/jobs')) {
    company = (document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name-link') as HTMLElement)?.innerText?.trim() || "";
    role = (document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title') as HTMLElement)?.innerText?.trim() || "";
    jobDescription = (document.querySelector('.jobs-description__container, .jobs-box__html-content, #job-details') as HTMLElement)?.innerText?.trim() || "";
  } else if (url.includes('internshala.com')) {
    // 1. Try to find the application form modal elements first
    const modalForm = document.querySelector('#application_form, #application_form_container, .modal-content, .popup_container');
    const formHeading = document.querySelector<HTMLElement>('.profile_heading');

    if (formHeading) {
      let text = formHeading.innerText?.trim() || '';
      if (text.toLowerCase().startsWith('application for')) {
        text = text.replace(/application for/i, '').trim();
      }
      role = text;
      company = document.querySelector<HTMLElement>('.company_name, .company-name, #company_name')?.innerText?.trim() || '';
    } else if (modalForm) {
      const headingEl = modalForm.querySelector<HTMLElement>('.profile_heading, .profile, .heading_3, h1, h2, h3');
      if (headingEl) {
        let text = headingEl.innerText?.trim() || '';
        if (text.toLowerCase().startsWith('application for')) {
          text = text.replace(/application for/i, '').trim();
        }
        role = text;
      }
      company = modalForm.querySelector<HTMLElement>('.company_name, .company-name, [class*="company" i]')?.innerText?.trim() || '';
    }

    // 2. If not found, look for listing or detail page elements
    if (!role) {
      role = document.querySelector<HTMLElement>('.heading_3.profile, .internship-heading h1, .profile h3')?.innerText?.trim() || '';
    }
    if (!company) {
      company = document.querySelector<HTMLElement>('.heading_6.company_name, .company-name a')?.innerText?.trim() || '';
    }

    if (modalForm) {
      jobDescription = modalForm.querySelector<HTMLElement>('.job_description_container, .text-container, .internship-details-container, #about_company, .job_description, .description_container')?.innerText?.trim() || '';
    }
    if (!jobDescription) {
      jobDescription = document.querySelector<HTMLElement>('.job_description_container, .text-container, .internship-details-container, #about_company, .job_description, .description_container')?.innerText?.trim() || '';
    }
  } else if (url.includes('unstop.com')) {
    company = (document.querySelector('.company-name, .employer-name') as HTMLElement)?.innerText?.trim() || "";
    role = (document.querySelector('h1, .job-title') as HTMLElement)?.innerText?.trim() || "";
    jobDescription = (document.querySelector('.job-description, .description-tabs, #job-description') as HTMLElement)?.innerText?.trim() || "";
  }

  // Robust generic fallbacks
  if (!role) {
    role = document.querySelector('h1')?.innerText?.trim() || document.title;
  }
  if (!company) {
    const compEl = document.querySelector('[class*="company" i], [class*="employer" i], [id*="company" i]');
    company = (compEl as HTMLElement)?.innerText?.trim() || "";
  }
  if (!jobDescription) {
    // Collect paragraphs and description blocks
    const descEls = Array.from(document.querySelectorAll('p, li, div[class*="description" i], div[id*="description" i], section, article'));
    jobDescription = descEls
      .map(p => ((p as HTMLElement).innerText || p.textContent)?.trim() || "")
      .filter(t => t.length > 60)
      .slice(0, 15)
      .join('\n\n');
  }

  // Clean company string (e.g. remove " - Full time", etc.)
  if (company) {
    company = company.split('\n')[0].replace(/•.*/, '').trim();
  }

  return {
    company: company.substring(0, 100).trim(),
    role: role.substring(0, 100).trim(),
    jobDescription: jobDescription.substring(0, 8000).trim()
  };
}

function getPrecedingText(el: HTMLElement): string {
  // Try to find any preceding sibling text or text in the parent element
  const parent = el.parentElement;
  if (!parent) return "";
  
  // Get text of parent up to 2 levels high
  let text = parent.innerText || "";
  if (text.length < 20 && parent.parentElement) {
    text = parent.parentElement.innerText || "";
  }
  
  // Clean up and truncate
  return text.replace(/\n+/g, ' ').substring(0, 300).trim();
}

export function scanFields(): ScanResult {
  const inputs = Array.from(document.querySelectorAll('input, select, textarea')) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  const detectedFields: DetectedField[] = [];

  inputs.forEach((el, index) => {
    // skip hidden, buttons, files, and toggles
    if (['hidden', 'submit', 'button', 'file', 'checkbox', 'radio'].includes(el.type)) return;

    const id = el.id || el.name || `af-field-${index}`;
    if (!el.id) el.id = id;

    // Find label
    let labelText = "";
    const labelEl = document.querySelector(`label[for="${id}"]`) as HTMLLabelElement;
    if (labelEl) {
      labelText = labelEl.innerText;
    } else {
      // Sibling label check
      const prevEl = el.previousElementSibling;
      if (prevEl && prevEl.tagName === 'LABEL') {
        labelText = (prevEl as HTMLElement).innerText;
      } else {
        // Parent text check
        const parent = el.parentElement;
        if (parent && parent.innerText.length < 100) {
          labelText = parent.innerText.split('\n')[0];
        }
      }
    }

    const placeholder = el.getAttribute('placeholder') || '';
    const nameAttr = el.name || '';
    const idAttr = el.id || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const precedingText = getPrecedingText(el);
    const autocomplete = el.getAttribute('autocomplete') || '';

    const signals: FieldSignals = {
      labelText,
      placeholder,
      nameAttr,
      idAttr,
      ariaLabel,
      ariaDescribedBy: '',
      precedingText,
      autocomplete,
      inputType: el.type || el.tagName.toLowerCase()
    };

    const match = matchField(signals);
    
    // AI Autofill context understanding expansion:
    // If it's a textarea or a text field, and it doesn't match standard profiles,
    // but the text points to a question, we map it to 'custom_answer'.
    let mappedTo = match.mappedTo as keyof UserProfile | 'custom_answer' | null;
    let confidence = match.confidence;

    const lowerLabel = labelText.toLowerCase() + " " + placeholder.toLowerCase() + " " + nameAttr.toLowerCase() + " " + precedingText.toLowerCase();
    
    const isEssayQuestion = el.tagName === 'TEXTAREA' || 
      lowerLabel.includes('why') || 
      lowerLabel.includes('about yourself') || 
      lowerLabel.includes('describe') || 
      lowerLabel.includes('explain') || 
      lowerLabel.includes('experience') || 
      lowerLabel.includes('challenge') || 
      lowerLabel.includes('project');

    if (!mappedTo && isEssayQuestion) {
      mappedTo = 'custom_answer';
      confidence = 65; // Moderate confidence for essay/custom fields
    }

    if (mappedTo) {
      detectedFields.push({
        elementId: id,
        label: labelText.trim() || placeholder.trim() || nameAttr.trim() || 'Custom Answer',
        mappedTo: mappedTo as import('../shared/types').DetectedField['mappedTo'],
        confidence,
        inputType: el.type || el.tagName.toLowerCase(),
        currentValue: el.value,
        contextText: precedingText
      });
    }
  });

  const jobDetails = extractJobDetails();
  const url = window.location.href.toLowerCase();
  let platform = 'generic';
  if (url.includes('linkedin.com'))        platform = 'linkedin';
  else if (url.includes('internshala.com')) platform = 'internshala';
  else if (url.includes('unstop.com'))      platform = 'unstop';
  else if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) platform = 'workday';
  else if (url.includes('greenhouse.io'))   platform = 'greenhouse';
  else if (url.includes('lever.co'))        platform = 'lever';

  return {
    url: window.location.href,
    title: document.title,
    platform,
    company: jobDetails.company,
    role: jobDetails.role,
    jobDescription: jobDetails.jobDescription,
    fields: detectedFields,
    hasCaptcha: detectCaptcha(document),
    scannedAt: Date.now()
  };
}

const result = scanFields();
chrome.runtime.sendMessage({ type: 'SCAN_RESULT', payload: result });

