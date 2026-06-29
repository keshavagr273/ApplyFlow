// ─── Platform Detection Utilities ─────────────────────────────────────────────
// Shared between popup, side panel, content scripts, and background SW.

export function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com'))          return 'linkedin';
  if (u.includes('internshala.com'))       return 'internshala';
  if (u.includes('unstop.com'))            return 'unstop';
  if (u.includes('naukri.com'))            return 'naukri';
  if (u.includes('indeed.com'))            return 'indeed';
  if (u.includes('angel.co'))              return 'angellist';
  if (u.includes('wellfound.com'))         return 'wellfound';
  if (u.includes('myworkdayjobs.com') || u.includes('workday.com')) return 'workday';
  if (u.includes('greenhouse.io') || u.includes('grnh.se')) return 'greenhouse';
  if (u.includes('lever.co'))              return 'lever';
  if (u.includes('smartrecruiters.com'))   return 'smartrecruiters';
  if (u.includes('icims.com'))             return 'icims';
  if (u.includes('bamboohr.com'))          return 'bamboohr';
  if (u.includes('jobvite.com'))           return 'jobvite';
  if (u.includes('taleo.net'))             return 'taleo';
  return 'company_site';
}

export function isJobPage(url: string): boolean {
  const u = url.toLowerCase();

  // Internshala: detail page, application form page, submit success page, or listing pages
  if (u.includes('internshala.com')) {
    return u.includes('/internship/') || u.includes('/internships/') || u.includes('/job/') || u.includes('/jobs/') || u.includes('/application/form/') || u.includes('/application/submit/');
  }
  // LinkedIn: must be a specific job view page
  if (u.includes('linkedin.com')) {
    return u.includes('/jobs/view/') || u.includes('/jobs/collections/');
  }
  // Unstop
  if (u.includes('unstop.com')) {
    const path = u.split('unstop.com')[1] || '';
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[0] === 'jobs' || parts[0] === 'opportunities' || parts[0] === 'internships';
    }
    return false;
  }
  // Greenhouse
  if (u.includes('greenhouse.io') || u.includes('grnh.se')) {
    return u.includes('/jobs/') || u.includes('/careers/');
  }
  // Lever
  if (u.includes('lever.co')) {
    const path = u.split('lever.co')[1] || '';
    const parts = path.split('/').filter(Boolean);
    return parts.length >= 2;
  }
  // Workday
  if (u.includes('myworkdayjobs.com')) {
    return u.includes('/job/');
  }
  // General ATS patterns
  const isListingPage = u.endsWith('/jobs') || u.endsWith('/jobs/') || u.endsWith('/careers') || u.endsWith('/careers/');
  if (isListingPage) return false;

  const jobUrlPatterns = [
    '/jobs/', '/job/', '/careers/', '/career/', '/apply/', '/opening/',
    '/position/', '/vacancy/', '/internship/', '/opportunity/',
    'job-detail', 'job_detail', 'jobdetail', 'jobid=', 'job_id=',
    'indeed.com/viewjob', 'bamboohr.com', 'jobvite.com/jobs'
  ];
  return jobUrlPatterns.some(p => u.includes(p));
}

export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    internshala: 'Internshala', unstop: 'Unstop',
    naukri: 'Naukri', indeed: 'Indeed', angellist: 'AngelList', wellfound: 'Wellfound',
    workday: 'Workday', greenhouse: 'Greenhouse', lever: 'Lever',
    smartrecruiters: 'SmartRecruiters', icims: 'iCIMS',
    bamboohr: 'BambooHR', jobvite: 'Jobvite', taleo: 'Taleo',
    company_site: 'Company Site', other: 'Website',
    linkedin: 'LinkedIn',
  };
  return names[platform] || platform;
}
