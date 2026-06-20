/**
 * clipper.ts — Universal Web Clipper Content Script
 *
 * Injected on all pages. Intelligently detects job listings and injects a
 * floating "Save Job" button that one-click saves the listing to ApplyFlow.
 */import type { ClippedJob, Application } from '../shared/types';
import { detectPlatformFromUrl, isJobPage as isSharedJobPage } from '../shared/platformUtils';

// ─── Platform & Job Detection ─────────────────────────────────────────────────

type Platform = Application['platform'];

export function detectPlatform(url: string): Platform {
  return detectPlatformFromUrl(url) as Platform;
}

export function isJobPage(): boolean {
  const url = window.location.href;
  if (!isSharedJobPage(url)) return false;

  const platform = detectPlatform(url);
  if (platform !== 'company_site') return true;

  // Additional check for generic websites: must have keywords signaling individual detail view
  const title = document.title.toLowerCase();
  const body = document.body?.innerText?.substring(0, 2000).toLowerCase() || '';
  const jobKeywords = [
    'apply now', 'apply for this job', 'submit application', 'job description',
    'responsibilities', 'requirements', 'qualifications', 'salary:', 'stipend:',
    'location:', 'experience required', 'skills required', 'about the role',
    'what you will do', 'what we are looking for', 'about the position'
  ];
  let keywordCount = 0;
  for (const kw of jobKeywords) {
    if (body.includes(kw) || title.includes(kw.split(' ')[0])) keywordCount++;
  }

  return keywordCount >= 2;
}

// ─── Job Info Extraction ──────────────────────────────────────────────────────

const PLATFORM_SELECTORS: Record<string, {
  role: string[];
  company: string[];
  description: string[];
  location: string[];
  salary?: string[];
}> = {
  linkedin: {
    role: ['.job-details-jobs-unified-top-card__job-title h1', '.job-details-jobs-unified-top-card__title-container h2', '.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '.t-24', '.jobs-search-two-pane__details h2'],
    company: ['.job-details-jobs-unified-top-card__company-name a', '.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name-link a', '.jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name-link'],
    description: ['.jobs-description-content__text', '.jobs-description__container', '.jobs-box__html-content', '#job-details'],
    location: ['.job-details-jobs-unified-top-card__title-container .truncate span:nth-of-type(2)', '.job-details-jobs-unified-top-card__primary-description', '.jobs-unified-top-card__bullet', '.tvm__text'],
    salary: ['.job-details-jobs-unified-top-card__salary-info', '.jobs-unified-top-card__salary-info']
  },
  indeed: {
    role: ['.jobsearch-JobInfoHeader-title', '[data-testid="jobDetailTitle"]', 'h1'],
    company: ['[data-testid="inlineHeader-companyName"] span a', '[data-testid="inlineHeader-companyName"]', 'div.icl-u-lg-mr--sm.icl-u-xs-mr--xs a'],
    description: ['div#jobDescriptionText', '.jobsearch-jobDescriptionText'],
    location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="jobsearch-CompanyInfoContainer"] + div'],
    salary: ['#salaryInfoAndJobType > span', '#salaryInfoAndJobType span.attribute_snippet', '.jobsearch-JobMetadataHeader-item']
  },
  glassdoor: {
    role: ['[data-test="job-details-header"] h1', 'div.css-17x2pwl.e11nt52q6', '[class*=jobDetailsContainer] [id^="jd-job-title"]'],
    company: ['[data-test="job-details-header"] div a div h4', 'div.css-16nw49e.e11nt52q1', '[class*=jobDetailsContainer] .hq-and-size'],
    description: ['.JobDetails_jobDescription__uW_fK', 'div.css-58vpdc.desc', '[class^=JobDetails_jobDescription]'],
    location: ['[data-test="location"]', '[class*=jobDetailsContainer] [data-test="location"]'],
    salary: ['span[data-test="detailSalary"]']
  },
  internshala: {
    role: ['.internship-heading h1', '.profile h3', '.heading_3.profile', '.heading_4_5.profile', '.profile_heading', '.job-title-href'],
    company: ['.company-name a', '.heading_6.company_name', '.company_name', '.company-name'],
    description: ['.internship-details-container', '#about_company', '.job_description', '.description_container', '.job_description_container', '.text-container'],
    location: ['.location-icon ~ span', '.location_link', '.location'],
    salary: ['.stipend', '.salary']
  },
  unstop: {
    role: ['h1.opportunity-title', 'h1'],
    company: ['.company-name', '.employer-name'],
    description: ['.opportunity-details', '.description-content'],
    location: []
  },
  greenhouse: {
    role: ['h1.app-title', '.heading h1', 'h1'],
    company: ['.company-name'],
    description: ['#content', '.job-post-body'],
    location: ['.location']
  },
  lever: {
    role: ['.posting-headline h2', 'h2'],
    company: ['.posting-headline .sort-by-team'],
    description: ['.posting-description'],
    location: ['.sort-by-location', '.location']
  },
  workday: {
    role: ['[data-automation-id="jobPostingHeader"]', 'h1'],
    company: [],
    description: ['[data-automation-id="jobPostingDescription"]'],
    location: ['[data-automation-id="location"]']
  },
  naukri: {
    role: ['.jd-header-title', '.jd-header h1', 'h1'],
    company: ['.jd-header-comp-name a', '.jd-header-comp-name'],
    description: ['.job-desc', '.jd-desc', '.jd-description'],
    location: ['.locationKey', '.loc'],
    salary: ['.salaryKey', '.salary']
  },
  angellist: {
    role: ['.cl-job-header h1', 'h1'],
    company: ['.cl-job-header a', '.company-name'],
    description: ['.job-description', '.description'],
    location: ['.location']
  },
  wellfound: {
    role: ['.cl-job-header h1', 'h1'],
    company: ['.cl-job-header a', '.company-name'],
    description: ['.job-description', '.description'],
    location: ['.location']
  },
  smartrecruiters: {
    role: ['h1.job-title', 'h1'],
    company: ['h2.company-name', '.company-name'],
    description: ['.job-description', '.description'],
    location: ['.location']
  },
  icims: {
    role: ['.iCIMS_Header h1', 'h1'],
    company: ['.iCIMS_Company', '.company'],
    description: ['.iCIMS_JobDescription', '.job-description'],
    location: ['.iCIMS_Location', '.location']
  },
  bamboohr: {
    role: ['.BambooHR-ATS-Jobs-Title', 'h2'],
    company: [],
    description: ['.BambooHR-ATS-Jobs-Description', '.job-description'],
    location: ['.BambooHR-ATS-Jobs-Location', '.location']
  },
  jobvite: {
    role: ['.jv-job-detail-title', 'h2'],
    company: [],
    description: ['.jv-job-detail-description', '.job-description'],
    location: ['.jv-job-detail-meta', '.location']
  },
  taleo: {
    role: ['.taleo-title', 'h1'],
    company: [],
    description: ['.taleo-description', '.job-description'],
    location: []
  }
};

export function extractJsonLdJobInfo(doc: Document | Element = document): Partial<ClippedJob> | null {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      const text = script.textContent?.trim();
      if (!text) continue;
      
      try {
        const parsed = JSON.parse(text);
        
        const findJobPosting = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj['@type'] === 'JobPosting' || (Array.isArray(obj['@type']) && obj['@type'].includes('JobPosting'))) {
            return obj;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const res = findJobPosting(item);
              if (res) return res;
            }
          }
          if (obj['@graph'] && Array.isArray(obj['@graph'])) {
            return findJobPosting(obj['@graph']);
          }
          return null;
        };

        const jobObj = findJobPosting(parsed);
        if (jobObj) {
          const role = jobObj.title || '';
          
          let company = '';
          if (typeof jobObj.hiringOrganization === 'object' && jobObj.hiringOrganization) {
            company = jobObj.hiringOrganization.name || '';
          } else if (typeof jobObj.hiringOrganization === 'string') {
            company = jobObj.hiringOrganization;
          }
          
          let description = jobObj.description || '';
          if (description) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            description = tempDiv.innerText || tempDiv.textContent || description;
          }
          
          let location = '';
          if (jobObj.jobLocation) {
            const locObj = jobObj.jobLocation;
            if (locObj.address) {
              const addr = locObj.address;
              location = [
                addr.addressLocality || addr.addressRegion,
                addr.addressCountry
              ].filter(Boolean).join(', ') || addr.streetAddress || '';
            }
          }
          
          let salary = '';
          if (jobObj.baseSalary) {
            const salObj = jobObj.baseSalary;
            if (salObj.value) {
              const val = salObj.value;
              if (val.value) {
                salary = `${val.value} ${val.unitText || ''}`;
              } else if (val.minValue && val.maxValue) {
                salary = `${val.minValue}-${val.maxValue} ${val.unitText || ''}`;
              }
            }
          }
          
          if (role || company) {
            return {
              role: role.trim(),
              company: company.trim(),
              description: description.trim(),
              location: location.trim(),
              salary: salary.trim()
            };
          }
        }
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}

export function extractCleanGenericDescription(root: Element | Document = document): string {
  try {
    const bodyEl = root instanceof Document ? root.body : root;
    if (bodyEl) {
      const clone = bodyEl.cloneNode(true) as HTMLElement;
      
      const elementsToRemove = clone.querySelectorAll('script, style, noscript, nav, footer, header, form, iframe, button, svg, path, aside, [class*="sidebar" i], [id*="sidebar" i], [class*="menu" i], [class*="social" i], [class*="share" i]');
      elementsToRemove.forEach(el => el.remove());
      
      const blocks = Array.from(clone.querySelectorAll('div, section, article, p, main'));
      let bestBlock: HTMLElement | null = null;
      let maxDensityScore = 0;
      
      for (const block of blocks as HTMLElement[]) {
        const text = block.innerText?.trim() || '';
        if (text.length < 200) continue;
        
        const linksText = Array.from(block.querySelectorAll('a'))
          .map(a => a.innerText || '')
          .join(' ');
        const linkRatio = linksText.length / (text.length || 1);
        
        if (linkRatio > 0.4) continue; 
        
        let score = text.length * (1 - linkRatio);
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('job description') || lowerText.includes('responsibilities') || lowerText.includes('requirements') || lowerText.includes('what you will do')) {
          score *= 1.5;
        }
        
        if (score > maxDensityScore) {
          maxDensityScore = score;
          bestBlock = block;
        }
      }
      
      if (bestBlock) {
        const cleanText = bestBlock.innerText?.trim();
        if (cleanText && cleanText.length >= 200) {
          return cleanText;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  
  const textBlocks = Array.from(root.querySelectorAll('p, li, [class*="description" i], [class*="requirement" i]'));
  return textBlocks
    .map(el => (el as HTMLElement).innerText?.trim() || '')
    .filter(t => t.length > 60)
    .slice(0, 15)
    .join('\n\n');
}

export function extractJobInfo(): ClippedJob {
  const url = window.location.href;
  const platform = detectPlatform(url);
  let company = '';
  let role    = '';
  let description = '';
  let salary  = '';
  let location = '';

  // 1. Try JSON-LD parsing first (most robust)
  const jsonLd = extractJsonLdJobInfo(document);
  if (jsonLd) {
    role = jsonLd.role || '';
    company = jsonLd.company || '';
    description = jsonLd.description || '';
    location = jsonLd.location || '';
    salary = jsonLd.salary || '';
  }

  // 2. Try selector based matching for missing fields
  if (!role || !company || !description || !location) {
    const selectors = PLATFORM_SELECTORS[platform];
    if (selectors) {
      if (!role) {
        for (const rSel of selectors.role) {
          const el = document.querySelector<HTMLElement>(rSel);
          if (el) { role = el.innerText?.trim() || ''; if (role) break; }
        }
      }
      if (!company) {
        for (const cSel of selectors.company) {
          const el = document.querySelector<HTMLElement>(cSel);
          if (el) { company = el.innerText?.trim() || ''; if (company) break; }
        }
      }
      if (!description) {
        for (const dSel of selectors.description) {
          const el = document.querySelector<HTMLElement>(dSel);
          if (el) { description = el.innerText?.trim() || ''; if (description) break; }
        }
      }
      if (!location) {
        for (const lSel of selectors.location) {
          const el = document.querySelector<HTMLElement>(lSel);
          if (el) { location = el.innerText?.trim() || ''; if (location) break; }
        }
      }
      if (!salary && selectors.salary) {
        for (const sSel of selectors.salary) {
          const el = document.querySelector<HTMLElement>(sSel);
          if (el) { salary = el.innerText?.trim() || ''; if (salary) break; }
        }
      }
    }
  }

  // 3. Fallback to heuristics if still missing
  if (!role) {
    role = document.querySelector<HTMLElement>('h1')?.innerText?.trim() || document.title.split(' - ')[0].trim();
  }
  if (!company) {
    const metaCompany = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"], meta[name="author"]');
    company = metaCompany?.content || document.querySelector<HTMLElement>('[class*="company" i], [class*="employer" i]')?.innerText?.trim() || '';
    if (!company) {
      company = document.title.split(' - ').pop()?.trim() || '';
    }
  }
  if (!description) {
    description = extractCleanGenericDescription(document);
  }
  if (!salary) {
    const salaryEl = document.querySelector<HTMLElement>('[class*="salary" i], [class*="stipend" i], [class*="ctc" i]');
    salary = salaryEl?.innerText?.trim() || '';
  }
  if (!location) {
    const locEl = document.querySelector<HTMLElement>('[class*="location" i], [class*="city" i]');
    location = locEl?.innerText?.trim() || '';
  }

  // Clean up
  company = company.split('\n')[0].replace(/•.*/, '').trim().substring(0, 100);
  role    = role.split('\n')[0].trim().substring(0, 100);

  return {
    company,
    role,
    url,
    platform,
    description: description.substring(0, 5000),
    salary: salary.substring(0, 100),
    location: location.substring(0, 100),
    clippedAt: Date.now()
  };
}

// ─── Inline Save Button Injection ─────────────────────────────────────────────

export function extractJobInfoForElement(titleEl: HTMLElement): ClippedJob {
  const url = window.location.href;
  const platform = detectPlatform(url);
  let company = '';
  let role = titleEl.innerText?.trim() || '';
  let description = '';
  let salary = '';
  let location = '';

  // Clean role string
  if (role.toLowerCase().startsWith('application for')) {
    role = role.replace(/application for/i, '').trim();
  }

  // 1. Locate the container element for this job card or modal
  const cardContainer = titleEl.closest('.individual_internship, .internship_meta, #application_form, #application_form_container, .modal-content, .popup_container, .job-card-container, .job-search-card, .jobs-search-results-list__list-item, .jobs-search-two-pane__details');

  if (cardContainer) {
    // 1. Try scoped JSON-LD first
    const jsonLd = extractJsonLdJobInfo(cardContainer);
    if (jsonLd) {
      role = jsonLd.role || role;
      company = jsonLd.company || '';
      description = jsonLd.description || '';
      location = jsonLd.location || '';
      salary = jsonLd.salary || '';
    }

    // 2. Try selector based matching for missing fields
    if (!role || !company || !description || !location) {
      const selectors = PLATFORM_SELECTORS[platform];
      if (selectors) {
        if (!role) {
          for (const rSel of selectors.role) {
            const el = cardContainer.querySelector<HTMLElement>(rSel);
            if (el) { role = el.innerText?.trim() || role; break; }
          }
        }
        if (!company) {
          for (const cSel of selectors.company) {
            const el = cardContainer.querySelector<HTMLElement>(cSel);
            if (el) { company = el.innerText?.trim() || ''; if (company) break; }
          }
        }
        if (!description) {
          for (const dSel of selectors.description) {
            const el = cardContainer.querySelector<HTMLElement>(dSel);
            if (el) { description = el.innerText?.trim() || ''; if (description) break; }
          }
        }
        if (!location) {
          for (const lSel of selectors.location) {
            const el = cardContainer.querySelector<HTMLElement>(lSel);
            if (el) { location = el.innerText?.trim() || ''; if (location) break; }
          }
        }
        if (!salary && selectors.salary) {
          for (const sSel of selectors.salary) {
            const el = cardContainer.querySelector<HTMLElement>(sSel);
            if (el) { salary = el.innerText?.trim() || ''; if (salary) break; }
          }
        }
      }
    }
  }

  // 2. Fall back to document-wide extraction if scoping fails to find essential fields
  if (!company || !description) {
    const fallbackInfo = extractJobInfo();
    if (!company) company = fallbackInfo.company;
    if (!role) role = fallbackInfo.role;
    if (!description) description = fallbackInfo.description || '';
    if (!salary) salary = fallbackInfo.salary || '';
    if (!location) location = fallbackInfo.location || '';
  }

  company = company.split('\n')[0].replace(/•.*/, '').trim().substring(0, 100);
  role = role.split('\n')[0].trim().substring(0, 100);

  return {
    company,
    role,
    url,
    platform,
    description: description.substring(0, 5000),
    salary: salary.substring(0, 100),
    location: location.substring(0, 100),
    clippedAt: Date.now()
  };
}

export function injectClipper(): void {
  if (!isJobPage()) return;

  const platform = detectPlatform(window.location.href);
  let titleElements: HTMLElement[] = [];

  if (platform === 'internshala') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>(
      '.internship-heading h1, .profile h3, .heading_3.profile, .heading_4_5.profile, .profile_heading, .company-name, .job-title-href'
    ));
  } else if (platform === 'linkedin') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>(
      '.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title'
    ));
  } else if (platform === 'unstop') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>('h1.opportunity-title, h1'));
  } else if (platform === 'greenhouse') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>('h1.app-title, h1'));
  } else if (platform === 'lever') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>('.posting-headline h2, h2'));
  } else if (platform === 'workday') {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>('[data-automation-id="jobPostingHeader"], h1'));
  } else {
    titleElements = Array.from(document.querySelectorAll<HTMLElement>('h1'));
  }

  const CONTAINER_SELECTOR = '.individual_internship, .internship_meta, #application_form, #application_form_container, .modal-content, .popup_container, .job-card-container, .job-search-card, .jobs-search-results-list__list-item, .jobs-search-two-pane__details';

  titleElements.forEach((titleEl) => {
    if (titleEl.getAttribute('data-af-injected') === 'true') return;

    // Check closest container first to avoid duplicate buttons inside the same card or details modal
    const cardContainer = titleEl.closest(CONTAINER_SELECTOR);
    if (cardContainer && cardContainer.querySelector('.af-inline-save-btn')) return;

    if (titleEl.parentElement?.querySelector('.af-inline-save-btn')) return;
    if (titleEl.querySelector('.af-inline-save-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'af-inline-save-btn';
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background-color: #4a6cf7;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(74, 108, 247, 0.2);
      transition: all 0.2s ease;
      margin-top: 8px;
      margin-bottom: 8px;
      vertical-align: middle;
    `;
    btn.innerHTML = `<span>📌</span><span>Save Job</span>`;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const resObj = await chrome.storage.local.get('settings') as { settings?: { userEmail?: string } };
        const userEmail = resObj?.settings?.userEmail;
        if (!userEmail) {
          alert('Please sign in to ApplyFlow first using the extension sidebar or options page!');
          return;
        }
      } catch (err) {
        console.error('[ApplyFlow Clipper] Failed to check authentication state:', err);
      }

      btn.innerHTML = `<span>⏳</span><span>Saving...</span>`;
      btn.disabled = true;

      try {
        const jobInfo = extractJobInfoForElement(titleEl);
        const newApp: Application = {
          id: Math.random().toString(36).substring(2, 11),
          company: jobInfo.company || 'Unknown Company',
          role: jobInfo.role || 'Position',
          url: jobInfo.url,
          platform: jobInfo.platform,
          status: 'saved',
          appliedAt: Date.now(),
          notes: `Clipped from ${new Date().toLocaleDateString()}`,
          salary: jobInfo.salary,
          location: jobInfo.location,
          jobDescription: jobInfo.description,
          submissionConfirmed: false
        };

        chrome.runtime.sendMessage({ type: 'CLIP_JOB', payload: newApp });

        btn.style.backgroundColor = '#10b981';
        btn.innerHTML = `<span>✅</span><span>Saved!</span>`;
      } catch (err) {
        console.error('[ApplyFlow Clipper]', err);
        btn.style.backgroundColor = '#ef4444';
        btn.innerHTML = `<span>⚠️</span><span>Error</span>`;
        btn.disabled = false;
      }
    });

    titleEl.setAttribute('data-af-injected', 'true');
    titleEl.parentNode?.insertBefore(btn, titleEl.nextSibling);
  });
}

// ─── Check if clipper is enabled before injecting ────────────────────────────

let lastContextStr = '';

function notifySidePanelOfContext(): void {
  try {
    if (!isJobPage()) return;
    const info = extractJobInfo();
    if (info.role) {
      const contextStr = JSON.stringify({ role: info.role, company: info.company });
      if (contextStr !== lastContextStr) {
        lastContextStr = contextStr;
        chrome.runtime.sendMessage({
          type: 'JOB_CONTEXT_UPDATED',
          payload: {
            url: info.url,
            platform: info.platform,
            company: info.company,
            role: info.role,
            jobDescription: info.description
          }
        });
      }
    }
  } catch (err) {
    // ignore
  }
}

async function init(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = (result.settings || {}) as { showClipButton?: boolean };
    const showClip = settings.showClipButton !== false; // default true
    if (!showClip) return;
  } catch {
    // storage not available in this context; skip
    return;
  }

  // Delay slightly to let the page settle
  setTimeout(() => {
    injectClipper();
    notifySidePanelOfContext();
  }, 1000);

  // Re-check on SPA navigations
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const existing = document.querySelectorAll('.af-inline-save-btn');
      existing.forEach(el => el.remove());
      setTimeout(() => {
        injectClipper();
        notifySidePanelOfContext();
      }, 1000);
    } else {
      if (isJobPage()) {
        injectClipper();
        notifySidePanelOfContext();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();

