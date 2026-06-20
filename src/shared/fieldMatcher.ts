import { UserProfile } from './types';

// ─── Signal interface ─────────────────────────────────────────────────────────

export interface FieldSignals {
  labelText: string;
  placeholder: string;
  nameAttr: string;
  idAttr: string;
  ariaLabel: string;
  ariaDescribedBy: string;
  precedingText: string;
  autocomplete: string;
  inputType: string;    // 'text' | 'radio' | 'checkbox' | 'select' | 'textarea'
}

// ─── Keyword Map ──────────────────────────────────────────────────────────────
// Maps UserProfile keys to arrays of keyword signals.
// Scored by source: autocomplete=95, name=80, id=75, label=70, placeholder=60, aria=65, preceding=40

const FIELD_KEYWORDS: Partial<Record<keyof UserProfile | 'eeo_gender' | 'eeo_work_auth' | 'eeo_sponsorship' | 'eeo_disability' | 'eeo_veteran' | 'eeo_ethnicity', string[]>> = {
  // ── Personal ──
  name: [
    'full name', 'fullname', 'full_name', 'your name', 'name', 'applicant name',
    'candidate name', 'legal name', 'legalname', 'fname', 'first last'
  ],
  email: [
    'email', 'e-mail', 'mail', 'email address', 'emailaddress',
    'work email', 'personal email'
  ],
  phone: [
    'phone', 'mobile', 'contact number', 'whatsapp', 'ph no', 'phone number',
    'mobile number', 'cell', 'telephone', 'tel', 'contact'
  ],
  alternatePhone: [
    'alternate phone', 'alternate mobile', 'secondary phone', 'other phone'
  ],

  // ── Education ──
  college: [
    'college', 'university', 'institution', 'school', 'institute',
    'college name', 'university name', 'school name'
  ],
  degree: [
    'degree', 'qualification', 'course', 'program', 'field of study',
    'education level', 'highest degree', 'highest education'
  ],
  graduationYear: [
    'graduation', 'passing year', 'batch', 'year of passing', 'grad year',
    'graduation year', 'expected graduation', 'completion year', 'passout year'
  ],
  cgpa: [
    'cgpa', 'gpa', 'percentage', 'marks', 'grade', 'score',
    'academic score', 'aggregate'
  ],
  tenthPercent: [
    '10th', 'tenth', 'ssc', 'matriculation', '10th percentage', '10th marks', 'ssc_marks'
  ],
  twelfthPercent: [
    '12th', 'twelfth', 'hsc', 'intermediate', '12th percentage', '12th marks', 'hsc_percentage'
  ],

  // ── Professional Links ──
  resumeLink: [
    'resume link', 'resume url', 'cv link', 'portfolio link', 'drive link',
    'resume drive', 'upload resume link', 'cv url', 'resume/cv'
  ],
  linkedinUrl: [
    'linkedin', 'linkedin url', 'linkedin profile', 'linkedin link'
  ],
  portfolioUrl: [
    'portfolio', 'personal website', 'website url', 'personal url', 'website'
  ],
  githubUrl: [
    'github', 'github url', 'github profile', 'github link'
  ],

  // ── Skills ──
  skills: [
    'skills', 'technologies', 'tech stack', 'expertise', 'tools',
    'technical skills', 'key skills', 'competencies'
  ],

  // ── Address & Location ──
  address: [
    'address', 'street', 'street address', 'current address', 'address line 1',
    'address line1', 'line 1', 'residence'
  ],
  currentCity: [
    'city', 'current city', 'location', 'town', 'city name', 'place'
  ],
  currentState: [
    'state', 'province', 'state/province', 'current state', 'state name'
  ],
  currentCountry: [
    'country', 'country of residence', 'nationality country', 'current country'
  ],
  postalCode: [
    'postal code', 'pin code', 'pincode', 'zip', 'zip code', 'postcode'
  ],
  nationality: [
    'nationality', 'citizenship', 'citizen of', 'country of citizenship'
  ],

  // ── Professional preferences ──
  noticePeriod: [
    'notice period', 'notice', 'available from', 'joining time',
    'when can you join', 'availability', 'start date', 'available date',
    'notice in days', 'joining availability'
  ],
  expectedSalary: [
    'expected salary', 'salary expectation', 'ctc expectation', 'expected ctc',
    'salary range', 'expected compensation', 'desired salary', 'pay expectation',
    'expected pay', 'current ctc', 'current salary'
  ],
  yearsOfExperience: [
    'years of experience', 'experience', 'total experience', 'work experience years',
    'experience in years', 'exp', 'relevant experience'
  ],
  preferredRole: [
    'preferred role', 'job title', 'desired role', 'position', 'role applying',
    'role', 'designation'
  ],

  // ── EEO / Demographics ──
  eeo_gender: [
    'gender', 'sex', 'gender identity', 'gender (optional)',
    'please identify gender'
  ],
  eeo_work_auth: [
    'authorized to work', 'work authorization', 'legally authorized',
    'eligible to work', 'right to work', 'authorized without sponsorship',
    'work permit', 'valid work permit', 'can you work'
  ],
  eeo_sponsorship: [
    'sponsorship', 'visa sponsorship', 'require sponsorship',
    'need sponsorship', 'employment visa', 'require employment authorization',
    'h1b', 'h-1b', 'work visa'
  ],
  eeo_disability: [
    'disability', 'disabled', 'disability status', 'physically challenged',
    'differently abled', 'section 503'
  ],
  eeo_veteran: [
    'veteran', 'military', 'protected veteran', 'veteran status',
    'military service', 'armed forces'
  ],
  eeo_ethnicity: [
    'ethnicity', 'race', 'ethnic', 'racial', 'hispanic', 'latino',
    'diversity', 'eeo', 'equal opportunity'
  ],

  // ── Empty / unused fields (prevent false matches) ──
  customAnswers: [],
  createdAt: [],
  updatedAt: [],
  projects: [],
  workExperience: [],
  education: [],
};

// ─── Scoring function ─────────────────────────────────────────────────────────

export function matchField(signals: FieldSignals): {
  mappedTo: keyof UserProfile | 'eeo_gender' | 'eeo_work_auth' | 'eeo_sponsorship' | 'eeo_disability' | 'eeo_veteran' | 'eeo_ethnicity' | null;
  confidence: number;
} {
  let bestMatch: keyof UserProfile | 'eeo_gender' | 'eeo_work_auth' | 'eeo_sponsorship' | 'eeo_disability' | 'eeo_veteran' | 'eeo_ethnicity' | null = null;
  let highestScore = 0;

  const lowerAutocomplete = signals.autocomplete.toLowerCase();
  const lowerName        = signals.nameAttr.toLowerCase();
  const lowerId          = signals.idAttr.toLowerCase();
  const lowerLabel       = signals.labelText.toLowerCase();
  const lowerPlaceholder = signals.placeholder.toLowerCase();
  const lowerAriaLabel   = signals.ariaLabel.toLowerCase();
  const lowerPreceding   = signals.precedingText.toLowerCase();


  for (const [key, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (!keywords || keywords.length === 0) continue;

    let score = 0;

    for (const keyword of keywords) {
      if (lowerAutocomplete.includes(keyword)) { score += 95; break; }
      if (lowerName === keyword)                { score += 85; break; }
      if (lowerId === keyword)                  { score += 80; break; }
      if (lowerLabel.includes(keyword))         { score += 72; }
      if (lowerPlaceholder.includes(keyword))   { score += 62; }
      if (lowerAriaLabel.includes(keyword))     { score += 67; }
      if (lowerPreceding.includes(keyword))     { score += 42; }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = key as any;
    }
  }

  highestScore = Math.min(highestScore, 100);

  return {
    mappedTo: highestScore >= 50 ? bestMatch : null,
    confidence: highestScore >= 50 ? highestScore : 0
  };
}

// ─── EEO Value Mapping ────────────────────────────────────────────────────────
// Maps profile EEO values to common option text seen in ATS forms.

export const EEO_VALUE_MAP = {
  gender: {
    male:              ['male', 'man', 'm'],
    female:            ['female', 'woman', 'f'],
    'non-binary':      ['non-binary', 'non binary', 'nonbinary', 'other', 'prefer to self-describe'],
    'prefer-not-to-say': ['prefer not', 'decline', 'not specified', "i don't wish", 'choose not']
  },
  disability: {
    yes:               ['yes', 'i have a disability', 'yes, i have'],
    no:                ['no', "i don't have", 'no, i do not'],
    'prefer-not-to-say': ['prefer not', 'decline', "i don't wish", 'choose not']
  },
  veteran: {
    yes:               ['yes', 'veteran', 'protected veteran', 'i am a veteran'],
    no:                ['no', "i'm not", 'not a veteran', 'i am not'],
    'prefer-not-to-say': ['prefer not', 'decline', "i don't wish"]
  },
  workAuthorized: {
    true:              ['yes', 'authorized', 'eligible', 'i am authorized', 'i am eligible'],
    false:             ['no', 'not authorized', 'not eligible']
  },
  sponsorship: {
    true:              ['yes', 'i will require', 'i need', 'require sponsorship'],
    false:             ['no', "i won't", 'i do not need', 'will not require']
  }
};
