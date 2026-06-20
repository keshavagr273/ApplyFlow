// ─── Core Profile & Resume ─────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  description: string;
  techStack?: string;
  githubUrl: string;
  deploymentUrl: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  isCurrentRole?: boolean;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  grade?: string; // CGPA or percentage
}

export interface CustomAnswer {
  id: string;
  trigger: string;   // "Why should we hire you"
  answer: string;
}

// ─── Full User Profile ──────────────────────────────────────────────────────

export interface UserProfile {
  // Basic contact info
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;

  // Education (primary)
  college: string;
  degree: string;
  graduationYear: string;
  cgpa?: string;            // CGPA / Percentage
  tenthPercent?: string;    // 10th grade %
  twelfthPercent?: string;  // 12th grade %

  // Skills & links
  skills: string[];
  resumeLink: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl?: string;

  // Address & location
  address?: string;
  currentCity?: string;
  currentState?: string;
  currentCountry?: string;
  postalCode?: string;
  nationality?: string;      // e.g. "Indian"

  // Professional preferences
  noticePeriod?: string;     // e.g. "Immediate", "15 days", "1 month"
  expectedSalary?: string;   // e.g. "5-8 LPA" or "60,000 USD"
  preferredRole?: string;    // e.g. "Software Engineer", "Product Manager"
  yearsOfExperience?: string;

  // EEO / Visa / Authorization (required for global ATS forms)
  workAuthorized?: boolean;        // Authorized to work without sponsorship?
  requiresSponsorship?: boolean;   // Do you need visa sponsorship?
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | '';
  disability?: 'yes' | 'no' | 'prefer-not-to-say' | '';
  veteran?: 'yes' | 'no' | 'prefer-not-to-say' | '';
  ethnicity?: string;              // e.g. "South Asian", "Decline to State"

  // Rich profile content
  customAnswers: CustomAnswer[];
  projects?: Project[];
  workExperience?: WorkExperience[];
  education?: Education[];         // Multiple education entries

  // AI-generated summary fields
  resumeText?: string;
  experienceSummary?: string;
  educationSummary?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

// ─── Application Tracking ───────────────────────────────────────────────────

export type ApplicationStatus =
  | 'saved'       // Clipped from a job listing, not yet applied
  | 'applied'     // Application submitted
  | 'assessment'  // Online test / assignment received
  | 'interview'   // Interview scheduled or completed
  | 'offer'       // Offer received
  | 'rejected'    // Application rejected
  | 'withdrawn';  // Candidate withdrew

export interface Application {
  id: string;
  company: string;
  role: string;
  url: string;
  platform: 'internshala' | 'linkedin' | 'unstop' | 'company_site' | 'other' | 'naukri' | 'indeed' | 'workday' | 'greenhouse' | 'lever' | 'smartrecruiters' | 'icims' | 'bamboohr' | 'jobvite' | 'taleo' | 'angellist' | 'wellfound';
  status: ApplicationStatus;
  appliedAt: number;
  notes: string;
  salary?: string;
  location?: string;
  jobDescription?: string;         // Stored job description for AI use
  matchScore?: number;             // AI match score at time of application
  remindAt?: number;               // Reminder timestamp
  reminderSent?: boolean;
  contactName?: string;            // Recruiter / HR contact
  contactEmail?: string;
  submissionConfirmed?: boolean;   // Whether submission was auto-confirmed
}

// ─── Content Script Types ───────────────────────────────────────────────────

export interface DetectedField {
  elementId: string;
  label: string;
  mappedTo: keyof UserProfile | 'custom_answer' | 'eeo_gender' | 'eeo_work_auth' | 'eeo_sponsorship' | 'eeo_disability' | 'eeo_veteran' | 'eeo_ethnicity' | null;
  confidence: number;
  inputType: string;               // 'text' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'tel' | 'email'
  currentValue: string;
  contextText?: string;
  options?: string[];              // For radio/select: available options
}

export interface ScanResult {
  url: string;
  title: string;
  platform: string;                // Detected ATS platform
  company?: string;
  role?: string;
  jobDescription?: string;
  fields: DetectedField[];
  hasCaptcha: boolean;
  scannedAt: number;
}

// ─── AI Response Types ──────────────────────────────────────────────────────

export interface JobAnalysis {
  matchScore: number;
  strongSkills: string[];
  missingSkills: string[];
  role?: string;
  company?: string;
  salaryRange?: string;
  keyRequirements?: string[];
}

export interface InterviewQuestion {
  question: string;
  answer: string;
  category?: 'technical' | 'behavioral' | 'company-specific';
}

export interface ResumeOptimization {
  score: number;
  suggestions: string[];
  keywordsMissing?: string[];
}

// ─── Extension Settings ─────────────────────────────────────────────────────

export type AutofillMode = 'ai' | 'heuristic' | 'ats-first';

export interface AIServiceSettings {
  geminiApiKey: string;
  demoMode: boolean;
  enableOverlay: boolean;
  autofillMode: AutofillMode;
  logOnlyAfterSubmission: boolean; // Whether to wait for submission confirmation
  showClipButton: boolean;         // Whether to show the web clipper button
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseSyncEnabled: boolean;
  // Auth details
  userEmail?: string;
  userDisplayName?: string;
  userAvatar?: string;
  isPremium?: boolean;
  licenseKey?: string;
  theme?: 'light' | 'dark';
}

export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_quarterly' | 'ultimate_yearly';

export interface UserBilling {
  userEmail: string;
  plan: SubscriptionPlan;
  creditsAllocated: number;
  creditsUsed: number;
  creditsPurchased: number;
  premiumUntil: number | null;
  subscriptionStatus: 'active' | 'paused' | 'cancelled' | 'expired';
}

export interface UsageStats {
  dailyFillsUsed: number;
  dailyFillsLimit: number;
  totalFills: number;
  lastUsedTimestamp: number;
  creditsUsed: number;
  creditsAllocated: number;
  creditsPurchased: number;
}

// ─── Web Clipper ─────────────────────────────────────────────────────────────

export interface ClippedJob {
  company: string;
  role: string;
  url: string;
  description?: string;
  salary?: string;
  location?: string;
  platform: Application['platform'];
  clippedAt: number;
}

// ─── UI Types ───────────────────────────────────────────────────────────────

export type Screen = 'dashboard' | 'assistant' | 'profile' | 'tracker' | 'analytics' | 'settings';

// ─── Chat / AI Assistant ─────────────────────────────────────────────────────

export type ChatMessageType =
  | 'text'
  | 'job_analysis'
  | 'cover_letter'
  | 'interview_prep'
  | 'resume_score'
  | 'suggestion_chips'
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: ChatMessageType;
  content: string;                       // Plain text content
  data?: Record<string, any>;           // Structured data (analysis, score, etc.)
  createdAt: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  jobContext?: {
    company: string;
    role: string;
    platform: string;
    jobDescription: string;
    matchScore?: number;
  };
  createdAt: number;
  updatedAt: number;
}

// ─── Tab Context ─────────────────────────────────────────────────────────────

export interface TabContext {
  url: string;
  title: string;
  platform: string;
  isJobPage: boolean;
  company: string;
  role: string;
  jobDescription: string;
}

// ─── Resume History ──────────────────────────────────────────────────────────

export interface ParsedResume {
  id: string;
  filename: string;
  parsedAt: number;
  profileData: Partial<UserProfile>;
  resumeText: string;
}

