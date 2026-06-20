import { Storage } from '../shared/storage';
import { UserProfile } from '../shared/types';
import { extractJobInfo as extractClipperJobInfo } from './clipper';

(async () => {
  try {
    const url = window.location.href.toLowerCase();
    const JOB_URL_PATTERNS = [
      'linkedin.com/jobs/view', 'linkedin.com/jobs/collections',
      'internshala.com/internship/detail', 'internshala.com/job/detail',
      'unstop.com/jobs', 'unstop.com/opportunities',
      'myworkdayjobs.com/job', 'greenhouse.io/jobs', 'grnh.se',
      'lever.co/', 'smartrecruiters.com/job', 'naukri.com/job-listings',
      'indeed.com/viewjob', 'bamboohr.com'
    ];
    const isJobPage = JOB_URL_PATTERNS.some(p => url.includes(p));
    if (!isJobPage) return;

    const settings = await Storage.getSettings();
    if (!settings?.userEmail) return;

    const profile = await Storage.getProfile();
    if (!profile) return;

    const clipperInfo = extractClipperJobInfo();
    const jobInfo = {
      company: clipperInfo.company || 'Company',
      role: clipperInfo.role || 'Software Engineer',
      jobDescription: clipperInfo.description || ''
    };
    const apiKey = settings?.geminiApiKey || '';
    const isDemo = settings?.demoMode ?? true;

    const analysis = await analyzeJob(profile, jobInfo.jobDescription, apiKey, isDemo);
    injectOverlay(analysis, jobInfo, profile);
  } catch (e) {
    console.error('[ApplyFlow Overlay] Init error:', e);
  }
})();

export function extractJobInfo() {
  const info = extractClipperJobInfo();
  return {
    company: info.company,
    role: info.role,
    jobDescription: info.description || ''
  };
}

export async function analyzeJob(profile: UserProfile, jobDescription: string, apiKey: string, isDemo: boolean) {
  if (isDemo || !apiKey) {
    // Perform simulated semantic analysis
    const safeSkills = profile.skills || [];
    const pSkills = safeSkills.map(s => s.toLowerCase());
    const matched: string[] = [];
    const missing: string[] = ['Docker', 'AWS (S3/EC2)', 'CI/CD Pipelines'];

    pSkills.forEach(skill => {
      if (jobDescription.toLowerCase().includes(skill)) {
        matched.push(skill);
      }
    });

    // Provide generic mock if match list is small
    const strongSkills = matched.length > 0 ? matched.map(s => safeSkills.find(ps => ps.toLowerCase() === s) || s) : ['React', 'TypeScript', 'Node.js'];
    const matchScore = matched.length > 0 ? Math.min(60 + (matched.length * 8), 95) : 82;

    return { matchScore, strongSkills, missingSkills: missing };
  }

  try {
    const prompt = `
      Evaluate the applicant's profile (including skills and resume text) against this job description.
      Score their resume fit from 0 to 100, list strong matching skills, and list crucial missing skills.
      Return ONLY a valid JSON object matching this schema:
      {
        "matchScore": 84,
        "strongSkills": ["React", "TypeScript"],
        "missingSkills": ["Docker", "Kubernetes"]
      }

      PROFILE SKILLS: ${profile.skills.join(', ')}
      RESUME TEXT: ${profile.resumeText ? profile.resumeText.substring(0, 3000) : ""}
      JOB DESCRIPTION: ${jobDescription.substring(0, 2000)}
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (response.ok) {
      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);
        return {
          matchScore: parsed.matchScore ?? 78,
          strongSkills: parsed.strongSkills ?? profile.skills.slice(0, 3),
          missingSkills: parsed.missingSkills ?? []
        };
      }
    }
  } catch (err) {
    console.error("Overlay direct Gemini call failed, falling back to local mock:", err);
  }

  return {
    matchScore: 78,
    strongSkills: profile.skills.slice(0, 3),
    missingSkills: ['Cloud Deployment', 'Unit Testing']
  };
}

export function injectOverlay(
  analysis: { matchScore: number; strongSkills: string[]; missingSkills: string[] },
  jobInfo: { company: string; role: string; jobDescription: string },
  profile: UserProfile
) {
  // Check if already injected
  if (document.getElementById('af-overlay-container')) return;

  const container = document.createElement('div');
  container.id = 'af-overlay-container';
  
  // Attach shadow DOM to isolate CSS
  const shadow = container.attachShadow({ mode: 'open' });

  // Styles injection
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content/widget.css');
  shadow.appendChild(link);

  // Widget structure
  const widget = document.createElement('div');
  widget.className = 'af-widget floating-collapsed';
  
  widget.innerHTML = `
    <!-- Overlay Toast Notification -->
    <div class="af-overlay-toast hidden" id="af-widget-toast"></div>

    <!-- Collapsed Trigger Badge -->
    <div class="af-collapsed-trigger">
      <div class="af-badge-circle">
        <svg class="af-svg-ring" viewBox="0 0 36 36">
          <path class="af-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path class="af-ring-fill" stroke-dasharray="${analysis.matchScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span class="af-badge-score">${analysis.matchScore}%</span>
      </div>
    </div>

    <!-- Expanded Slide-out panel -->
    <div class="af-expanded-panel hidden">
      <div class="af-panel-header">
        <div class="af-panel-title">
          <img src="${chrome.runtime.getURL('icons/icon32.png')}" class="af-logo-img" alt="ApplyFlow Logo" />
          <div>
            <div class="af-main-title">ApplyFlow Match</div>
            <div class="af-sub-title">${jobInfo.company || 'Ready'} • ${jobInfo.role || 'Job'}</div>
          </div>
        </div>
        <button class="af-close-btn" title="Close overlay">&times;</button>
          ${(profile.projects || []).map(p => `
            <div class="af-ref-card">
              <span class="af-ref-title">${p.title}</span>
              <span class="af-ref-desc">${p.description}</span>
            </div>
          `).join('')}
          ${(profile.workExperience || []).map(e => `
            <div class="af-ref-card">
              <span class="af-ref-title">${e.role} @ ${e.company}</span>
              <span class="af-ref-desc">${e.description}</span>
            </div>
          `).join('')}
      </div>

      <div class="af-panel-body">
        <div class="af-score-section">
          <div class="af-big-score">${analysis.matchScore}%</div>
          <div class="af-score-label">Resume Compatibility Score</div>
        </div>

        <div class="af-skills-group">
          <div class="af-group-title">Strong Matching Skills</div>
          <div class="af-tags-container">
            ${(analysis.strongSkills || []).map(s => `<span class="af-tag tag-strong">${s}</span>`).join('')}
          </div>
        </div>

        <div class="af-skills-group">
          <div class="af-group-title">Missing Skills</div>
          <div class="af-tags-container">
            ${(analysis.missingSkills || []).map(s => `<span class="af-tag tag-missing">${s}</span>`).join('')}
          </div>
        </div>

        <button class="af-autofill-btn" id="af-autofill-action">
          <span class="af-btn-icon">⚡</span> Smart Autofill Page
        </button>
        <div class="af-footer">Auto-saved to log tracker upon filling.</div>
      </div>
    </div>
  `;

  shadow.appendChild(widget);
  document.body.appendChild(container);

  // Toggle handlers
  const collapsed = widget.querySelector('.af-collapsed-trigger') as HTMLElement;
  const expanded = widget.querySelector('.af-expanded-panel') as HTMLElement;
  const closeBtn = widget.querySelector('.af-close-btn') as HTMLButtonElement;
  const autofillBtn = widget.querySelector('#af-autofill-action') as HTMLButtonElement;

  collapsed.addEventListener('click', () => {
    widget.classList.remove('floating-collapsed');
    widget.classList.add('floating-expanded');
    collapsed.classList.add('hidden');
    expanded.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    widget.classList.remove('floating-expanded');
    widget.classList.add('floating-collapsed');
    expanded.classList.add('hidden');
    collapsed.classList.remove('hidden');
  });

  autofillBtn.addEventListener('click', async () => {
    autofillBtn.disabled = true;
    autofillBtn.innerHTML = `
      <span class="af-spinner"></span> Autofilling Form...
    `;

    try {
      // 1. Scan page fields
      const inputs = querySelectorAllDeep('input, select, textarea') as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
      const scannedFields = inputs
        .filter(el => !['hidden', 'submit', 'button', 'file', 'checkbox', 'radio'].includes(el.type))
        .map((el, index) => {
          const id = el.id || el.name || `af-field-${index}`;
          if (!el.id) el.id = id;

          let labelText = "";
          let currentEl: HTMLElement | null = el;
          while (currentEl && currentEl.tagName !== 'FORM' && currentEl !== document.body && currentEl.tagName !== 'HTML') {
            const ariaLabelledBy = currentEl.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
              const ariaLabelEl = querySelectorDeep(`#${ariaLabelledBy}`) as HTMLElement | null;
              if (ariaLabelEl) {
                labelText = ariaLabelEl.textContent || '';
                break;
              }
            }
            currentEl = currentEl.parentElement;
          }
          if (!labelText) {
            const labelEl = querySelectorDeep(`label[for="${id}"]`) as HTMLLabelElement;
            if (labelEl) labelText = labelEl.textContent || '';
          }

          return {
            elementId: id,
            label: labelText || el.getAttribute('placeholder') || el.name || el.getAttribute('data-automation-id') || 'Custom Answer',
            placeholder: el.getAttribute('placeholder') || '',
            precedingText: '',
            inputType: el.type || el.tagName.toLowerCase()
          };
        });

      if (scannedFields.length === 0) {
        showWidgetToast(widget, "No fillable application fields found on the page.");
        resetAutofillBtn(autofillBtn);
        return;
      }

      // 2. Query smart fill values
      // We simulate AI matchmaking here (or direct gemini smartMatchFields)
      const fieldValues = await smartMatchFieldsLocal(scannedFields, profile);

      // 3. Perform filling with human-like delays
      for (const field of fieldValues) {
        const el = querySelectorDeep(`#${field.elementId}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (el) {
          safeSetValueLocal(el, field.value);
          await delayLocal(Math.floor(Math.random() * 50) + 60);
        }
      }

      // 4. Log application to storage
      const newApp = {
        id: Math.random().toString(36).substring(2, 11),
        company: jobInfo.company || 'Unknown Company',
        role: jobInfo.role || 'Software Intern',
        url: window.location.href,
        platform: detectPlatform(),
        status: 'applied' as const,
        appliedAt: Date.now(),
        notes: `Automatically parsed & auto-filled via ApplyFlow LinkedIn Enhancer.`
      };
      
      await Storage.addApplication(newApp).catch(err => console.error(err));

      // 5. Success UI feedback
      autofillBtn.innerHTML = `✅ Successfully Filled!`;
      autofillBtn.style.background = '#10b981';
      setTimeout(() => {
        resetAutofillBtn(autofillBtn);
        // Collapse panel after 2.5s
        widget.classList.remove('floating-expanded');
        widget.classList.add('floating-collapsed');
        expanded.classList.add('hidden');
        collapsed.classList.remove('hidden');
      }, 2500);

    } catch (err) {
      console.error("Smart autofill failed:", err);
      showWidgetToast(widget, "Autofill failed due to page complexity.");
      resetAutofillBtn(autofillBtn);
    }
  });
}

function showWidgetToast(widget: HTMLElement, message: string) {
  const toast = widget.querySelector('#af-widget-toast') as HTMLElement;
  if (!toast) return;
  toast.textContent = `⚠️ ${message}`;
  toast.classList.remove('hidden');
  void toast.offsetHeight; // force reflow
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 250);
  }, 3000);
}

function resetAutofillBtn(btn: HTMLButtonElement) {
  btn.disabled = false;
  btn.style.background = 'var(--brand)';
  btn.innerHTML = `<span class="af-btn-icon">⚡</span> Smart Autofill Page`;
}

function detectPlatform(): 'linkedin' | 'internshala' | 'unstop' | 'company_site' | 'other' {
  const url = window.location.href.toLowerCase();
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('internshala.com')) return 'internshala';
  if (url.includes('unstop.com')) return 'unstop';
  return 'company_site';
}

function delayLocal(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Local quick matcher mimicking GroqAIService.smartMatchFields (Demo Mode)
async function smartMatchFieldsLocal(fields: Record<string, any>[], profile: UserProfile) {
  await delayLocal(1000);
  return fields.map(f => {
    const lbl = f.label.toLowerCase();
    const plc = f.placeholder.toLowerCase();
    
    let value: string;
    if (lbl.includes('name') || plc.includes('name')) {
      value = profile.name;
    } else if (lbl.includes('email') || plc.includes('email')) {
      value = profile.email;
    } else if (lbl.includes('phone') || lbl.includes('mobile') || plc.includes('phone')) {
      value = profile.phone;
    } else if (lbl.includes('college') || lbl.includes('university') || plc.includes('college')) {
      value = profile.college;
    } else if (lbl.includes('degree') || plc.includes('degree')) {
      value = profile.degree;
    } else if (lbl.includes('grad') || lbl.includes('year') || plc.includes('grad')) {
      value = profile.graduationYear;
    } else if (lbl.includes('linkedin')) {
      value = profile.linkedinUrl;
    } else if (lbl.includes('portfolio') || lbl.includes('github') || plc.includes('portfolio') || plc.includes('github')) {
      value = profile.portfolioUrl;
    } else if (lbl.includes('resume') || plc.includes('resume')) {
      value = profile.resumeLink;
    } else {
      if (lbl.includes('why') || lbl.includes('hire') || lbl.includes('work')) {
        value = `I am highly motivated to apply for this engineering role at your organization. Having extensively worked with ${profile.skills.slice(0, 3).join(', ')}, I am excited to bring my skills to build high-performance interfaces. My focus on clean code and robust systems will allow me to integrate smoothly and deliver value immediately.`;
      } else if (lbl.includes('about yourself') || lbl.includes('describe') || lbl.includes('introduce')) {
        value = `I'm a pre-final CS student at ${profile.college || 'my university'} specializing in web development. I'm proficient in ${profile.skills.slice(0, 4).join(', ')} and enjoy crafting fluid user interfaces backed by performant servers.`;
      } else {
        value = `Highly motivated full-stack engineer with hands-on experience in modern frontend technologies. Enthusiastic about creating beautiful user interfaces and scalable code structures.`;
      }
    }
    return { elementId: f.elementId, value };
  });
}

function safeSetValueLocal(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (el.tagName.toUpperCase() === 'SELECT') {
    const selectEl = el as HTMLSelectElement;
    const normalizedValue = value.toLowerCase().replace(/\s+/g, '');
    let bestMatchIndex = -1;
    for (let i = 0; i < selectEl.options.length; i++) {
      const optText = selectEl.options[i].text.toLowerCase().replace(/\s+/g, '');
      const optVal = selectEl.options[i].value.toLowerCase().replace(/\s+/g, '');
      if (!optText && !optVal) continue;
      if (optText === normalizedValue || optVal === normalizedValue || 
         (optText.length > 2 && normalizedValue.includes(optText)) || 
         (optVal.length > 1 && normalizedValue.includes(optVal)) ||
         (normalizedValue.length > 2 && optText.includes(normalizedValue))) {
        bestMatchIndex = i;
        break;
      }
    }
    if (bestMatchIndex !== -1) {
      selectEl.selectedIndex = bestMatchIndex;
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype :
    HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

function querySelectorAllDeep(selector: string, root: Document | Element | ShadowRoot = document): Element[] {
  const elements = Array.from(root.querySelectorAll(selector));
  const allNodes = Array.from(root.querySelectorAll('*'));
  for (const node of allNodes) {
    if (node.shadowRoot) {
      elements.push(...querySelectorAllDeep(selector, node.shadowRoot));
    }
  }
  return elements;
}

function querySelectorDeep(selector: string, root: Document | Element | ShadowRoot = document): Element | null {
  const el = root.querySelector(selector);
  if (el) return el;
  const allNodes = Array.from(root.querySelectorAll('*'));
  for (const node of allNodes) {
    if (node.shadowRoot) {
      const found = querySelectorDeep(selector, node.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

