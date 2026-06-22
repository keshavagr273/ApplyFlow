import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../shared/store';
import { ChatMessage, ChatMessageType } from '../../shared/types';
import { GroqAIService } from '../../shared/aiService';
import PremiumGate from '../components/common/PremiumGate';
import { Bot, AlertTriangle } from 'lucide-react';
import { t } from '../../shared/i18n';

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="chat-bubble-user px-3.5 py-2.5 max-w-[80%] text-sm text-white font-medium leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  // AI bubble
  const renderContent = () => {
    switch (msg.type) {
      case 'job_analysis': {
        const d = msg.data || {};
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-300 leading-relaxed">{msg.content}</p>
            {d.matchScore !== undefined && (
              <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="text-3xl font-black text-brand-400">{d.matchScore}%</div>
                <div>
                  <div className="text-xs font-bold text-gray-400">{t('ai_analysis_score_label')}</div>
                  <div className="w-24 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${d.matchScore}%` }} />
                  </div>
                </div>
              </div>
            )}
            {d.strongSkills?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t('ai_analysis_strong_skills')}</div>
                <div className="flex flex-wrap gap-1.5">{d.strongSkills.map((s: string) => <span key={s} className="chip-success">{s}</span>)}</div>
              </div>
            )}
            {d.missingSkills?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t('ai_analysis_missing_skills')}</div>
                <div className="flex flex-wrap gap-1.5">{d.missingSkills.map((s: string) => <span key={s} className="chip-warning">{s}</span>)}</div>
              </div>
            )}
          </div>
        );
      }

      case 'cover_letter': {
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-300">{msg.content}</p>
            <div className="bg-black/30 rounded-xl p-3 border border-white/10 max-h-52 overflow-y-auto">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">{msg.data?.text}</pre>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copy(msg.data?.text || '')} className="flex-1 bg-white/8 border border-white/12 text-gray-300 text-xs font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-white/12 transition-all">
                {copied ? t('ai_analysis_copied') : t('ai_analysis_copy')}
              </button>
              <button onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([msg.data?.text || ''], { type: 'text/plain' }));
                a.download = 'Cover_Letter.txt';
                a.click();
              }} className="flex-1 bg-white/8 border border-white/12 text-gray-300 text-xs font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-white/12 transition-all">
                {t('ai_analysis_download')}
              </button>
            </div>
          </div>
        );
      }

      case 'interview_prep': {
        const questions: Array<{ question: string; answer: string }> = msg.data?.questions || [];
        return (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-300 mb-1">{msg.content}</p>
            {questions.map((q, i) => (
              <div key={i} className="bg-white/5 rounded-xl border border-white/8 overflow-hidden">
                <button onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))} className="w-full text-left px-3.5 py-2.5 flex justify-between items-start gap-2">
                  <span className="text-xs font-semibold text-gray-200 leading-snug">{q.question}</span>
                  <span className="text-brand-400 text-xs shrink-0">{revealed[i] ? '▲' : '▼'}</span>
                </button>
                {revealed[i] && (
                  <div className="px-3.5 pb-3 pt-1 border-t border-white/5">
                    <p className="text-xs text-gray-400 leading-relaxed">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      case 'resume_score': {
        const d = msg.data || {};
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <div className="text-3xl font-black text-brand-400">{d.score}%</div>
              <div>
                <div className="text-xs font-bold text-gray-400">{t('ai_analysis_score_label')}</div>
                <div className="text-[10px] text-gray-600">{t('ai_analysis_vs_desc')}</div>
              </div>
            </div>
            {d.suggestions && (
              <ul className="flex flex-col gap-1.5">
                {d.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="text-brand-400 font-bold shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }

      case 'error':
        return <p className="text-sm text-red-400">{msg.content}</p>;

      default:
        return <p className="text-sm text-gray-300 leading-relaxed">{msg.content}</p>;
    }
  };

  return (
    <div className="flex gap-2.5 max-w-[92%]">
      <div className="w-6 h-6 rounded-full bg-white border border-white/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
        <img 
          src={chrome.runtime.getURL('icons/icon128.png')} 
          alt="ApplyFlow Logo" 
          className="w-full h-full object-cover rounded-full" 
        />
      </div>
      <div className="chat-bubble-ai px-3.5 py-3 flex-1 animate-scale-in">
        {renderContent()}
      </div>
    </div>
  );
}

// ─── Suggestion Chips ─────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  { label: 'Cover Letter', prompt: 'Generate a cover letter for this job' },
  { label: 'Analyze Job', prompt: 'Analyze this job description and my match score' },
  { label: 'Custom Answers', prompt: 'Generate answers for common application questions' },
  { label: 'Tailor Resume', prompt: 'How can I optimize my resume for this role?' },
  { label: 'Interview Prep', prompt: 'Generate interview questions for this role' },
];

// ─── AI Assistant Screen ──────────────────────────────────────────────────────

export default function AIAssistant() {
  const { profile, settings, tabContext, chatSessions, currentSessionId, createChatSession, addChatMessage, clearChatSession, showToast } = useStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get or create a session
  const currentSession = chatSessions.find(s => s.id === sessionId) || chatSessions[0];
  const messages: ChatMessage[] = currentSession?.messages || [];

  useEffect(() => {
    // Create a new session if none exists
    if (!currentSession) {
      const sess = createChatSession(tabContext?.isJobPage ? {
        company: tabContext.company,
        role: tabContext.role,
        platform: tabContext.platform,
        jobDescription: tabContext.jobDescription,
      } : undefined);
      setSessionId(sess.id);

      // Auto-greet
      const greeting: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: tabContext?.isJobPage && tabContext.role
          ? (tabContext.company
              ? t('job_details_detected_intro', tabContext.role, tabContext.company)
              : t('job_details_detected_no_company', tabContext.role))
          : t('job_details_not_detected_intro'),
        createdAt: Date.now(),
      };
      addChatMessage(sess.id, greeting);
    } else {
      setSessionId(currentSession.id);
    }
  }, []);

  useEffect(() => {
    // Check for intent from Dashboard
    chrome.storage.local.get('assistantIntent', (data) => {
      if (data.assistantIntent === 'cover_letter' && tabContext?.isJobPage) {
        chrome.storage.local.remove('assistantIntent');
        handleSpecialPrompt('Generate a cover letter for this job');
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sid = sessionId || currentSession?.id;

  const addUserMsg = async (content: string) => {
    if (!sid) return;
    const msg: ChatMessage = { id: crypto.randomUUID(), role: 'user', type: 'text', content, createdAt: Date.now() };
    await addChatMessage(sid, msg);
    return msg;
  };

  const addAiMsg = async (type: ChatMessageType, content: string, data?: Record<string, any>) => {
    if (!sid) return;
    const msg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', type, content, data, createdAt: Date.now() };
    await addChatMessage(sid, msg);
  };

  const handleSpecialPrompt = useCallback(async (prompt: string) => {
    if (!profile) {
      showToast(t('profile_warning_assistant'), 'error');
      return;
    }

    // Check if the prompt requires a job context but we don't have one loaded
    const isJobSpecificPrompt = prompt.includes('this job') || 
                                prompt.includes('this role') || 
                                prompt.includes('this job description') ||
                                prompt.includes('for this role') ||
                                prompt.includes('optimize my resume for this') ||
                                prompt.includes('Analyze this job');

    if (isJobSpecificPrompt && !tabContext?.isJobPage) {
      showToast(t('job_page_warning_assistant'), 'warning');
      return;
    }

    if (!sid) return;
    setIsLoading(true);
    await addUserMsg(prompt);

    try {
      const jd = tabContext?.jobDescription || '';
      const company = tabContext?.company || '';
      const role = tabContext?.role || '';
      const apiKey = settings?.geminiApiKey || '';
      const isDemo = settings?.demoMode ?? true;

      if (prompt.includes('cover letter') && jd) {
        const cl = await GroqAIService.generateCoverLetter(company, role, profile, jd, apiKey, isDemo);
        await addAiMsg('cover_letter', t('ai_analysis_cover_letter_intro'), { text: cl });

      } else if ((prompt.includes('analyze') || prompt.includes('match score')) && jd) {
        const res = await GroqAIService.analyzeJobDescription(profile.resumeText || '', jd, apiKey, isDemo);
        await addAiMsg('job_analysis', t('ai_analysis_compatible', String(res.matchScore)), res);

      } else if (prompt.includes('interview') && jd) {
        const prep = await GroqAIService.generateInterviewPrep(jd || 'General Software Engineering', apiKey, isDemo);
        await addAiMsg('interview_prep', t('ai_analysis_questions_intro', String(prep.length)), { questions: prep });

      } else if ((prompt.includes('resume') || prompt.includes('optimize') || prompt.includes('tailor')) && jd) {
        const res = await GroqAIService.optimizeResume(profile, jd, apiKey, isDemo);
        await addAiMsg('resume_score', t('ai_analysis_resume_score_intro', String(res.score)), res);

      } else if ((prompt.includes('answers') || prompt.includes('application questions')) && jd) {
        const answer = await GroqAIService.generateAnswer(prompt, profile, jd, apiKey, isDemo);
        await addAiMsg('text', answer);

      } else {
        // Generic answer (used when no job context is present, e.g. general questions typed by user)
        const answer = await GroqAIService.generateAnswer(prompt, profile, jd, apiKey, isDemo);
        await addAiMsg('text', answer);
      }
    } catch (err: any) {
      console.error('[AIAssistant] Error in handleSpecialPrompt:', err);
      await addAiMsg('error', t('ai_analysis_something_went_wrong'));
    } finally {
      setIsLoading(false);
    }
  }, [profile, settings, tabContext, sid]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    if (!profile) {
      showToast(t('profile_warning_assistant'), 'error');
      return;
    }
    setInput('');
    await handleSpecialPrompt(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearSession = async () => {
    if (!sid) return;
    await clearChatSession(sid);
    const sess = createChatSession();
    setSessionId(sess.id);
    const greeting: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant', type: 'text',
      content: t('chat_cleared_msg'), createdAt: Date.now()
    };
    addChatMessage(sess.id, greeting);
  };

  return (
    <div className="flex flex-col h-full bg-surface-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/6">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Bot size={18} className="text-brand-400" /> {t('ai_copilot_title')}
            <span className="text-[9px] font-bold bg-brand-600/30 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Llama 3.3
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {tabContext?.isJobPage ? t('context_label', tabContext.company || tabContext.role || 'Job page') : t('general_copilot_subtitle')}
          </p>
        </div>
        <button onClick={handleClearSession} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors font-medium">
          {t('new_chat')}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {!profile && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300 font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-amber-400" />
            <span>{t('setup_profile_warning')}</span>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-white border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              <img 
                src={chrome.runtime.getURL('icons/icon128.png')} 
                alt="ApplyFlow Logo" 
                className="w-full h-full object-cover rounded-full" 
              />
            </div>
            <div className="chat-bubble-ai px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
          {SUGGESTION_CHIPS.map(chip => {
            const getChipLabel = (label: string) => {
              if (label === 'Cover Letter') return t('cover_letter');
              if (label === 'Analyze Job') return t('analyze_job');
              if (label === 'Custom Answers') return t('custom_answers_title');
              if (label === 'Tailor Resume') return t('resume_title');
              if (label === 'Interview Prep') return t('interview_status');
              return label;
            };
            return (
              <button
                key={chip.label}
                onClick={() => handleSpecialPrompt(chip.prompt)}
                disabled={isLoading}
                className="suggestion-chip text-[10px] font-semibold transition-all disabled:opacity-40"
              >
                {getChipLabel(chip.label)}
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/6">
        <div className="flex gap-2 bg-surface-dark100 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-brand-500/50 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={profile ? t('ask_anything_placeholder') : t('setup_profile_placeholder')}
            disabled={isLoading}
            rows={1}
            className="chat-textarea flex-1 bg-transparent text-sm text-gray-200 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-7 h-7 bg-brand-600 hover:bg-brand-700 rounded-lg flex items-center justify-center text-white text-sm disabled:opacity-40 hover:opacity-90 transition-all shrink-0 self-end"
          >
            ↑
          </button>
        </div>
        <p className="chat-helper-text text-[9px] mt-1.5 text-center">
          {t('press_enter_hint')}
        </p>
      </div>
    </div>
  );
}
