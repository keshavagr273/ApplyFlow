import React, { useState, useCallback } from 'react';
import { useStore } from '../../shared/store';
import { UserProfile, Project, WorkExperience } from '../../shared/types';
import { ResumeUploader } from '../../popup/components/profile/ResumeUploader';
import { FileText, User as UserIcon, MapPin, GraduationCap, Zap, Briefcase, Lock, MessageSquare, FolderGit2, History, Trash2, Calendar } from 'lucide-react';

// ─── Accordion Section ────────────────────────────────────────────────────────

interface AccordionSectionProps {
  id: string;
  icon: React.ComponentType<any>;
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ icon: Icon, title, badge, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div className={`border rounded-2xl transition-all shrink-0 ${isOpen ? 'border-brand-500/30 bg-surface-dark50' : 'border-white/8 bg-surface-dark50/50 hover:border-white/12 overflow-hidden'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <Icon size={16} className="text-brand-400 shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-200">{title}</span>
          {badge && <span className="ml-2 text-[10px] text-gray-500 font-medium">{badge}</span>}
        </div>
        <span className={`text-gray-600 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/6 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({ label, value, onChange, placeholder, type = 'text', disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="input-field-dark text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ─── Profile Screen ────────────────────────────────────────────────────────────

export default function Profile() {
  const { profile, updateProfile, showToast, settings } = useStore();
  const [openSection, setOpenSection] = useState<string>('resume');
  const [isSaving, setIsSaving] = useState(false);
  const [localProfile, setLocalProfile] = useState<Partial<UserProfile>>(profile || {});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const toggle = (id: string) => setOpenSection(prev => prev === id ? '' : id);

  const update = (field: keyof UserProfile, value: any) => {
    setLocalProfile(prev => ({ ...prev, [field]: value }));
  };

  const saveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProfile(localProfile);
      showToast('Profile saved!', 'success');
    } catch {
      showToast('Failed to save profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [localProfile, updateProfile, showToast]);

  const p = localProfile;

  const skillsCount = (p.skills || []).length;
  const expCount = (p.workExperience || []).length;
  const projCount = (p.projects || []).length;
  const eduCount = (p.education || []).length;
  const answersCount = (p.customAnswers || []).length;

  return (
    <div className="flex flex-col h-full bg-surface-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/6">
        <div>
          <h1 className="text-base font-bold text-white">My Profile</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {p.name ? `${p.name} · ${p.college || 'No college set'}` : 'Set up your profile to enable autofill'}
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={isSaving}
          className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-60 transition-all"
        >
          {isSaving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">

        {/* Resume Upload */}
        <AccordionSection id="resume" icon={FileText} title="Resume"
          badge={p.resumeText ? '✓ Uploaded' : 'Upload to auto-fill profile'}
          isOpen={openSection === 'resume'} onToggle={() => toggle('resume')}
        >
          <ResumeUploader
            isUploading={isUploading}
            setIsUploading={setIsUploading}
            uploadStatus={uploadStatus}
            setUploadStatus={setUploadStatus}
            settings={settings}
            setFormData={setLocalProfile}
          />
          <ResumeHistoryList setFormData={setLocalProfile} />
        </AccordionSection>

        {/* Personal Info */}
        <AccordionSection id="personal" icon={UserIcon} title="Personal Info"
          badge={p.name ? `${p.name}` : 'Incomplete'}
          isOpen={openSection === 'personal'} onToggle={() => toggle('personal')}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <FieldRow label="Full Name" value={p.name || ''} onChange={v => update('name', v)} placeholder="Kesha Vagrawal" />
            <FieldRow label="Email" value={p.email || ''} onChange={v => update('email', v)} placeholder="you@email.com" type="email" />
            <FieldRow label="Phone" value={p.phone || ''} onChange={v => update('phone', v)} placeholder="+91 9876543210" />
            <FieldRow label="Alternate Phone" value={p.alternatePhone || ''} onChange={v => update('alternatePhone', v)} placeholder="Optional" />
            <FieldRow label="LinkedIn URL" value={p.linkedinUrl || ''} onChange={v => update('linkedinUrl', v)} placeholder="linkedin.com/in/..." />
            <FieldRow label="Portfolio URL" value={p.portfolioUrl || ''} onChange={v => update('portfolioUrl', v)} placeholder="yoursite.com" />
            <FieldRow label="GitHub URL" value={p.githubUrl || ''} onChange={v => update('githubUrl', v)} placeholder="github.com/..." />
            <FieldRow label="Resume Link" value={p.resumeLink || ''} onChange={v => update('resumeLink', v)} placeholder="Drive/Notion link" />
          </div>
        </AccordionSection>

        {/* Location */}
        <AccordionSection id="location" icon={MapPin} title="Location"
          badge={p.currentCity || 'Not set'}
          isOpen={openSection === 'location'} onToggle={() => toggle('location')}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <FieldRow label="City" value={p.currentCity || ''} onChange={v => update('currentCity', v)} placeholder="Mumbai" />
            <FieldRow label="State" value={p.currentState || ''} onChange={v => update('currentState', v)} placeholder="Maharashtra" />
            <FieldRow label="Country" value={p.currentCountry || ''} onChange={v => update('currentCountry', v)} placeholder="India" />
            <FieldRow label="Postal Code" value={p.postalCode || ''} onChange={v => update('postalCode', v)} placeholder="400001" />
            <FieldRow label="Address" value={p.address || ''} onChange={v => update('address', v)} placeholder="Street address" />
            <FieldRow label="Nationality" value={p.nationality || ''} onChange={v => update('nationality', v)} placeholder="Indian" />
          </div>
        </AccordionSection>

        {/* Education */}
        <AccordionSection id="education" icon={GraduationCap} title="Education"
          badge={p.college || (eduCount > 0 ? `${eduCount} entries` : 'Not set')}
          isOpen={openSection === 'education'} onToggle={() => toggle('education')}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <FieldRow label="College / University" value={p.college || ''} onChange={v => update('college', v)} placeholder="IIT Bombay" />
            <FieldRow label="Degree" value={p.degree || ''} onChange={v => update('degree', v)} placeholder="B.Tech CS" />
            <FieldRow label="Graduation Year" value={p.graduationYear || ''} onChange={v => update('graduationYear', v)} placeholder="2026" />
            <FieldRow label="CGPA / Grade" value={p.cgpa || ''} onChange={v => update('cgpa', v)} placeholder="8.5" />
            <FieldRow label="10th %" value={p.tenthPercent || ''} onChange={v => update('tenthPercent', v)} placeholder="95%" />
            <FieldRow label="12th %" value={p.twelfthPercent || ''} onChange={v => update('twelfthPercent', v)} placeholder="92%" />
          </div>
        </AccordionSection>

        {/* Skills */}
        <AccordionSection id="skills" icon={Zap} title="Skills"
          badge={`${skillsCount} skills`}
          isOpen={openSection === 'skills'} onToggle={() => toggle('skills')}
        >
          <div className="mt-2">
            <SkillsEditor skills={p.skills || []} onChange={s => update('skills', s)} />
          </div>
        </AccordionSection>

        {/* Work Experience */}
        <AccordionSection id="experience" icon={Briefcase} title="Work Experience"
          badge={`${expCount} entries`}
          isOpen={openSection === 'experience'} onToggle={() => toggle('experience')}
        >
          <div className="mt-2">
            <ExperienceEditor experience={p.workExperience || []} onChange={e => update('workExperience', e)} />
          </div>
        </AccordionSection>

        {/* Projects */}
        <AccordionSection id="projects" icon={FolderGit2} title="Projects"
          badge={`${projCount} projects`}
          isOpen={openSection === 'projects'} onToggle={() => toggle('projects')}
        >
          <div className="mt-2">
            <ProjectsEditor projects={p.projects || []} onChange={pr => update('projects', pr)} />
          </div>
        </AccordionSection>

        {/* Work Preferences */}
        <AccordionSection id="prefs" icon={Briefcase} title="Work Preferences"
          badge={p.noticePeriod || 'Not set'}
          isOpen={openSection === 'prefs'} onToggle={() => toggle('prefs')}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <FieldRow label="Notice Period" value={p.noticePeriod || ''} onChange={v => update('noticePeriod', v)} placeholder="Immediate / 1 month" />
            <FieldRow label="Expected Salary" value={p.expectedSalary || ''} onChange={v => update('expectedSalary', v)} placeholder="5-8 LPA" />
            <FieldRow label="Preferred Role" value={p.preferredRole || ''} onChange={v => update('preferredRole', v)} placeholder="SWE / PM" />
            <FieldRow label="Years of Experience" value={p.yearsOfExperience || ''} onChange={v => update('yearsOfExperience', v)} placeholder="1 / Fresher" />
          </div>
        </AccordionSection>

        {/* Work Authorization (EEO) */}
        <AccordionSection id="workauth" icon={Lock} title="Work Authorization"
          badge={p.workAuthorized !== undefined ? (p.workAuthorized ? 'Authorized' : 'Not authorized') : 'Not set'}
          isOpen={openSection === 'workauth'} onToggle={() => toggle('workauth')}
        >
          <div className="flex flex-col gap-3 mt-2">
            {[
              { label: 'Authorized to work without visa sponsorship', field: 'workAuthorized' as const },
              { label: 'Requires visa sponsorship', field: 'requiresSponsorship' as const },
            ].map(({ label, field }) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-9 h-5 rounded-full transition-all ${(p as any)[field] ? 'bg-brand-600' : 'bg-white/10'}`}
                  onClick={() => update(field as keyof UserProfile, !(p as any)[field])}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${(p as any)[field] ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-gray-300 font-medium">{label}</span>
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Gender</label>
                <select value={p.gender || ''} onChange={e => update('gender', e.target.value)}
                  className="input-field-dark text-xs">
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Disability</label>
                <select value={p.disability || ''} onChange={e => update('disability', e.target.value)}
                  className="input-field-dark text-xs">
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* Custom Answers */}
        <AccordionSection id="answers" icon={MessageSquare} title="Custom Answers"
          badge={`${answersCount} answers`}
          isOpen={openSection === 'answers'} onToggle={() => toggle('answers')}
        >
          <div className="mt-2">
            <CustomAnswersEditor answers={p.customAnswers || []} onChange={a => update('customAnswers', a)} />
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}

// ─── Skills Editor ─────────────────────────────────────────────────────────────

function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    onChange([...skills, trimmed]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {skills.map(s => (
          <span key={s} className="flex items-center gap-1.5 chip-brand cursor-default">
            {s}
            <button onClick={() => onChange(skills.filter(x => x !== s))} className="text-brand-400 hover:text-red-400 transition-colors font-bold leading-none">×</button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-gray-600">No skills added yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add skill (Enter to add)"
          className="input-field-dark flex-1 text-xs"
        />
        <button onClick={add} className="gradient-premium text-white text-xs font-bold px-3 py-2 rounded-xl hover:opacity-90 transition-all">+</button>
      </div>
    </div>
  );
}

// ─── Custom Answers Editor ─────────────────────────────────────────────────────

function CustomAnswersEditor({ answers, onChange }: { answers: Array<{ id: string; trigger: string; answer: string }>; onChange: (a: any[]) => void }) {
  const add = () => onChange([...answers, { id: crypto.randomUUID(), trigger: '', answer: '' }]);
  const update = (id: string, field: 'trigger' | 'answer', value: string) =>
    onChange(answers.map(a => a.id === id ? { ...a, [field]: value } : a));
  const remove = (id: string) => onChange(answers.filter(a => a.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {answers.map(a => (
        <div key={a.id} className="bg-white/5 border border-white/8 rounded-xl p-3 flex flex-col gap-2">
          <input value={a.trigger} onChange={e => update(a.id, 'trigger', e.target.value)}
            placeholder="Trigger phrase (e.g. Why should we hire you)"
            className="input-field-dark text-xs" />
          <textarea value={a.answer} onChange={e => update(a.id, 'answer', e.target.value)}
            placeholder="Your answer..."
            rows={3}
            className="input-field-dark text-xs resize-none" />
          <button onClick={() => remove(a.id)} className="text-[10px] text-red-500 hover:text-red-400 transition-colors self-end font-semibold">Remove</button>
        </div>
      ))}
      <button onClick={add} className="border border-dashed border-white/20 rounded-xl py-2.5 text-xs text-gray-500 hover:border-brand-500/40 hover:text-brand-400 transition-all font-semibold">
        + Add Custom Answer
      </button>
    </div>
  );
}

// ─── Experience Editor ─────────────────────────────────────────────────────────

function ExperienceEditor({ experience, onChange }: { 
  experience: WorkExperience[]; 
  onChange: (exp: WorkExperience[]) => void 
}) {
  const add = () => onChange([...experience, { 
    id: crypto.randomUUID(), company: '', role: '', startDate: '', endDate: '', description: '', isCurrentRole: false 
  }]);
  const update = (id: string, field: keyof WorkExperience, value: any) =>
    onChange(experience.map(e => e.id === id ? { ...e, [field]: value } : e));
  const remove = (id: string) => onChange(experience.filter(e => e.id !== id));

  return (
    <div className="flex flex-col gap-4">
      {experience.map(exp => (
        <div key={exp.id} className="bg-white/5 border border-white/8 rounded-xl p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Company" value={exp.company} onChange={v => update(exp.id, 'company', v)} placeholder="e.g. Google" />
            <FieldRow label="Role / Title" value={exp.role} onChange={v => update(exp.id, 'role', v)} placeholder="e.g. Software Engineer" />
            <FieldRow label="Start Date" value={exp.startDate} onChange={v => update(exp.id, 'startDate', v)} placeholder="e.g. Jan 2024" />
            <FieldRow label="End Date" value={exp.isCurrentRole ? 'Present' : exp.endDate} onChange={v => update(exp.id, 'endDate', v)} placeholder="e.g. Dec 2024" type="text" disabled={exp.isCurrentRole} />
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-9 h-5 rounded-full transition-all ${exp.isCurrentRole ? 'bg-brand-600' : 'bg-white/10'}`}
              onClick={() => update(exp.id, 'isCurrentRole', !exp.isCurrentRole)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${exp.isCurrentRole ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-gray-300 font-medium">I am currently working in this role</span>
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea 
              value={exp.description} 
              onChange={e => update(exp.id, 'description', e.target.value)}
              placeholder="Describe your responsibilities, key achievements, technologies used..."
              rows={6}
              className="input-field-dark text-xs min-h-[100px] resize-y" 
            />
          </div>
          
          <button onClick={() => remove(exp.id)} className="text-[10px] text-red-500 hover:text-red-400 transition-colors self-end font-semibold">Remove</button>
        </div>
      ))}
      <button onClick={add} className="border border-dashed border-white/20 rounded-xl py-2.5 text-xs text-gray-500 hover:border-brand-500/40 hover:text-brand-400 transition-all font-semibold">
        + Add Work Experience
      </button>
    </div>
  );
}

// ─── Projects Editor ───────────────────────────────────────────────────────────

function ProjectsEditor({ projects, onChange }: { 
  projects: Project[]; 
  onChange: (proj: Project[]) => void 
}) {
  const add = () => onChange([...projects, { 
    id: crypto.randomUUID(), title: '', description: '', techStack: '', githubUrl: '', deploymentUrl: '' 
  }]);
  const update = (id: string, field: keyof Project, value: string) =>
    onChange(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  const remove = (id: string) => onChange(projects.filter(p => p.id !== id));

  return (
    <div className="flex flex-col gap-4">
      {projects.map(proj => (
        <div key={proj.id} className="bg-white/5 border border-white/8 rounded-xl p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Project Title" value={proj.title} onChange={v => update(proj.id, 'title', v)} placeholder="e.g. E-Commerce Platform" />
            <FieldRow label="Tech Stack" value={proj.techStack || ''} onChange={v => update(proj.id, 'techStack', v)} placeholder="e.g. React, Node.js, MongoDB" />
            <FieldRow label="GitHub URL" value={proj.githubUrl} onChange={v => update(proj.id, 'githubUrl', v)} placeholder="github.com/..." />
            <FieldRow label="Deployment URL" value={proj.deploymentUrl} onChange={v => update(proj.id, 'deploymentUrl', v)} placeholder="e.g. myproject.vercel.app" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea 
              value={proj.description} 
              onChange={e => update(proj.id, 'description', e.target.value)}
              placeholder="Describe what you built, what problem it solved, and the key features..."
              rows={6}
              className="input-field-dark text-xs min-h-[100px] resize-y" 
            />
          </div>
          
          <button onClick={() => remove(proj.id)} className="text-[10px] text-red-500 hover:text-red-400 transition-colors self-end font-semibold">Remove</button>
        </div>
      ))}
      <button onClick={add} className="border border-dashed border-white/20 rounded-xl py-2.5 text-xs text-gray-500 hover:border-brand-500/40 hover:text-brand-400 transition-all font-semibold">
        + Add Project
      </button>
    </div>
  );
}

// ─── Resume History List ─────────────────────────────────────────────────────

interface ResumeHistoryListProps {
  setFormData: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
}

function ResumeHistoryList({ setFormData }: ResumeHistoryListProps) {
  const { resumeHistory, deleteResumeFromHistory, showToast } = useStore();

  const handleApply = (resume: any) => {
    if (confirm(`Load profile details from "${resume.filename}"? This will replace your current edits with this resume's parsed structure.`)) {
      setFormData(prev => ({
        ...prev,
        ...resume.profileData
      }));
      showToast(`Restored details from ${resume.filename}`, 'success');
    }
  };

  if (!resumeHistory || resumeHistory.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/6 pt-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <History size={13} className="text-brand-400" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resume History</span>
      </div>
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {resumeHistory.map((res: any) => {
          const formattedDate = new Date(res.parsedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          return (
            <div 
              key={res.id} 
              className="bg-white/5 border border-white/8 hover:border-white/12 rounded-xl p-2.5 flex items-center justify-between gap-3 group transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-200 truncate" title={res.filename}>
                  {res.filename}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-gray-500 font-semibold mt-0.5">
                  <Calendar size={10} />
                  <span>Parsed on {formattedDate}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleApply(res)}
                  className="bg-brand-600/20 border border-brand-500/30 text-brand-400 hover:bg-brand-600 hover:text-white font-bold px-2 py-1 rounded-lg text-[9px] transition-all"
                >
                  Use This
                </button>
                <button
                  onClick={() => deleteResumeFromHistory(res.id)}
                  className="text-gray-500 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/5 transition-all"
                  title="Delete from history"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
