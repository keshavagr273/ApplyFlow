import { UserProfile, JobAnalysis, InterviewQuestion } from './types';
import { Storage } from './storage';

export const OpenRouterAIService = {
  /**
   * Helper to make direct requests to the OpenRouter API
   */
  async _callOpenRouter(prompt: string, apiKey: string, jsonMode = false): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 6000,
          messages: [
            {
              role: "system",
              content: jsonMode
                ? "You are a REST API server. You must respond ONLY with raw, valid JSON. Never include conversational text, markdown formatting, or code block backticks. Start your response immediately with '{'."
                : "You are ApplyFlow AI, a helpful and professional career coaching assistant. Respond directly, conversationally, and concisely to the user's message. Focus strictly on their specific question, keeping your answer short and targeted (under 120 words)."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const responseText = result.choices?.[0]?.message?.content;
      
      if (!responseText) {
        throw new Error("Empty response from OpenRouter");
      }
      
      // SECURITY: Never log full AI responses in production (may contain PII)
      if (import.meta.env.DEV) console.log("=== RAW AI OUTPUT ===", responseText);

      if (jsonMode) {
        let cleaned = responseText.trim();
        
        // Try to extract content inside markdown code blocks first
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          cleaned = codeBlockMatch[1].trim();
        } else {
          // Fallback: extract substring from first { or [ to last } or ]
          const firstBrace = cleaned.indexOf('{');
          const firstBracket = cleaned.indexOf('[');
          const lastBrace = cleaned.lastIndexOf('}');
          const lastBracket = cleaned.lastIndexOf(']');
          
          let firstIdx = -1;
          if (firstBrace !== -1 && firstBracket !== -1) firstIdx = Math.min(firstBrace, firstBracket);
          else if (firstBrace !== -1) firstIdx = firstBrace;
          else if (firstBracket !== -1) firstIdx = firstBracket;
          
          let lastIdx = -1;
          if (lastBrace !== -1 && lastBracket !== -1) lastIdx = Math.max(lastBrace, lastBracket);
          else if (lastBrace !== -1) lastIdx = lastBrace;
          else if (lastBracket !== -1) lastIdx = lastBracket;

          if (firstIdx !== -1 && lastIdx !== -1 && lastIdx > firstIdx) {
            cleaned = cleaned.substring(firstIdx, lastIdx + 1);
          }
        }
        
        try {
          return JSON.parse(cleaned);
        } catch (parseError) {
          console.error("=== FAILED TO PARSE THIS STRING AS JSON ===", cleaned);
          throw new Error("Failed to parse AI response: Invalid JSON", { cause: parseError });
        }
      }
      return responseText.trim();
    } catch (error: any) {
      if (error && typeof error === "object" && "name" in error && (error as Error).name === "AbortError") {
        console.error("OpenRouter API call timed out");
        throw new Error("OpenRouter API Error: Request timed out", { cause: error });
      }
      console.error("OpenRouter API call failed:", error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * 1. Parses raw resume text into a structured profile
   */
  async parseResume(pdfText: string, apiKey: string, isDemo = true): Promise<Partial<UserProfile>> {
    const success = await Storage.deductCredits(1, 'resume_parse');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1500)); // Simulate AI delay
      // Try to parse some details from the PDF text if available to make the mock look magical
      const nameMatch = pdfText.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
      const emailMatch = pdfText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = pdfText.match(/(\+?\d{10,12})/);
      
      return {
        name: nameMatch ? nameMatch[0] : 'Kushal Sen',
        email: emailMatch ? emailMatch[0] : 'kushal.sen@gmail.com',
        phone: phoneMatch ? phoneMatch[0] : '+91 9876543210',
        college: pdfText.toLowerCase().includes('iit') ? 'IIT Bombay' : 'BITS Pilani',
        degree: 'B.Tech in Computer Science',
        graduationYear: '2026',
        skills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'PostgreSQL', 'TailwindCSS', 'Python', 'Git'],
        resumeLink: 'https://drive.google.com/file/d/sample-resume/view',
        linkedinUrl: 'https://linkedin.com/in/kushal-sen',
        portfolioUrl: 'https://github.com/kushalsen',
        resumeText: pdfText.substring(0, 10000),
        projects: [
          {
            id: 'proj-1',
            title: 'E-Commerce Analytics Platform',
            description: 'Built a real-time web traffic and sales analytics dashboard using React, TailwindCSS, and Node.js. Integrated WebSocket connections for dynamic live updating graph visualizations, reducing page load overhead by 40%.',
            githubUrl: 'https://github.com/kushalsen/ecommerce-analytics',
            deploymentUrl: 'https://ecommerce-analytics-demo.vercel.app'
          },
          {
            id: 'proj-2',
            title: 'AI Smart Resume Tailor',
            description: 'Created a Chrome extension that structures raw text into professional schemas using Gemini models. Engineered a local PDF decompression engine in TypeScript to parse and index PDF stream objects without backend dependencies.',
            githubUrl: 'https://github.com/kushalsen/applyflow-extension',
            deploymentUrl: 'https://applyflow.ai'
          }
        ],
        workExperience: [
          {
            id: 'exp-1',
            company: 'TechSolutions India',
            role: 'Software Development Intern',
            startDate: 'May 2025',
            endDate: 'July 2025',
            description: 'Developed and optimized client-facing reusable React components for core web platforms. Collaborated in Agile cycles with UX engineers and engineered custom API integration endpoints, improving data retrieval efficiency by 30%.'
          },
          {
            id: 'exp-2',
            company: 'Open Source Community',
            role: 'Contributor',
            startDate: 'Dec 2024',
            endDate: 'Present',
            description: 'Refactored state structures using Zustand in multiple high-traffic community projects. Handled cross-browser compatibility issues, authored comprehensive technical documentation, and reviewed open pull requests.'
          }
        ]
      };
    }

    const prompt = `
You are an expert resume parser. The text below was extracted from a PDF using a basic text extraction tool.

IMPORTANT - The PDF text may be GARBLED due to font encoding issues:
- Words may have spaces inserted between every letter (e.g. "K e s h a" should be "Kesha", "V a g r a w a l" should be "Vagrawal")
- Email addresses may have spaces inside them (e.g. "j k e s h a 2 7 3 @ g m a i l . c o m" → reconstruct to "kesha273@gmail.com")
- Icon characters (j, w, k, etc.) may appear before section labels like LinkedIn, GitHub, Email — ignore them
- Reconstruct all names, emails, URLs by removing spurious spaces and joining letters
- The text after "Font Awesome version:" is garbage — ignore it entirely

CRITICAL for descriptions:
- Include ALL bullet points for each project and work experience. Do NOT summarize or truncate.
- Combine all bullet points into a single multi-sentence description field, preserving all details and metrics.
- Do not skip any achievement, tool, or metric mentioned in the resume.

Parse the resume into the following JSON schema. Return ONLY valid JSON with no markdown:

{
  "name": "Full Name (reconstruct from spaced letters)",
  "email": "email@domain.com (reconstruct from spaced text near phone/header)",
  "phone": "Phone Number",
  "college": "College / University Name",
  "degree": "Degree / Field of Study",
  "graduationYear": "Year of Graduation as a string",
  "cgpa": "CGPA or Percentage if found, else empty string",
  "skills": ["Skill1", "Skill2"],
  "linkedinUrl": "Full LinkedIn URL if found, else empty string",
  "portfolioUrl": "Full Portfolio URL if found, else empty string",
  "githubUrl": "Full GitHub URL if found, else empty string",
  "resumeLink": "",
  "projects": [
    {
      "title": "Project Title",
      "description": "ALL bullet points combined: what was built, all tools used, all metrics and achievements",
      "githubUrl": "",
      "deploymentUrl": ""
    }
  ],
  "workExperience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "description": "ALL bullet points combined: all responsibilities, tools, metrics and achievements — do not omit any"
    }
  ]
}

RESUME TEXT:
${pdfText}
    `;

    const parsed = await this._callOpenRouter(prompt, apiKey, true);
    parsed.resumeText = pdfText; // Save raw text for context
    return parsed;
  },

  /**
   * 2. Replaces basic field matching with AI context understanding
   */
  async smartMatchFields(
    fields: Array<{ elementId: string; label: string; placeholder: string; contextText?: string; inputType: string }>,
    profile: UserProfile,
    apiKey: string,
    isDemo = true
  ): Promise<Array<{ elementId: string; value: string; mappedTo: keyof UserProfile | 'custom_answer' }>> {
    const success = await Storage.deductCredits(1, 'smart_autofill');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      // Simulate fast matching
      await new Promise(r => setTimeout(r, 800));
      return fields.map(f => {
        const lbl = f.label.toLowerCase();
        const plc = f.placeholder.toLowerCase();
        
        let value: string;
        let mappedTo: keyof UserProfile | 'custom_answer';
        
        if (lbl.includes('name') || plc.includes('name')) {
          value = profile.name;
          mappedTo = 'name';
        } else if (lbl.includes('email') || plc.includes('email')) {
          value = profile.email;
          mappedTo = 'email';
        } else if (lbl.includes('phone') || lbl.includes('mobile') || plc.includes('phone')) {
          value = profile.phone;
          mappedTo = 'phone';
        } else if (lbl.includes('college') || lbl.includes('university') || plc.includes('college')) {
          value = profile.college;
          mappedTo = 'college';
        } else if (lbl.includes('degree') || plc.includes('degree')) {
          value = profile.degree;
          mappedTo = 'degree';
        } else if (lbl.includes('grad') || lbl.includes('year') || plc.includes('grad')) {
          value = profile.graduationYear;
          mappedTo = 'graduationYear';
        } else if (lbl.includes('linkedin')) {
          value = profile.linkedinUrl;
          mappedTo = 'linkedinUrl';
        } else if (lbl.includes('portfolio') || lbl.includes('github') || plc.includes('portfolio') || plc.includes('github')) {
          value = profile.portfolioUrl;
          mappedTo = 'portfolioUrl';
        } else if (lbl.includes('resume') || plc.includes('resume')) {
          value = profile.resumeLink;
          mappedTo = 'resumeLink';
        } else {
          // Essay / custom answers
          mappedTo = 'custom_answer';
          if (lbl.includes('why') || lbl.includes('hire') || lbl.includes('work')) {
            value = `I am highly motivated to join your esteemed organization as it perfectly aligns with my tech stack (React, Node.js) and career aspirations. I am eager to apply my problem-solving skills and contribute to engineering premium products that solve real-world problems.`;
          } else if (lbl.includes('about yourself') || lbl.includes('describe yourself') || lbl.includes('introduce')) {
            value = `I'm a pre-final year Computer Science undergraduate at ${profile.college || 'university'} specializing in full-stack web development. I'm proficient in ${profile.skills.slice(0, 4).join(', ')} and have built scalable web projects. I love building responsive UIs and crafting robust backend architectures.`;
          } else if (lbl.includes('challenge') || lbl.includes('project') || lbl.includes('experience')) {
            value = `During a recent hackathon, we faced severe latency issues in our live websocket dashboard due to redundant re-renders. I redesigned the state management using Zustand and optimized the component rendering pipeline, reducing loading times by 40% and securing a top-3 finish.`;
          } else {
            value = `Highly skilled full-stack developer with hands-on experience building premium React apps. Proficient in TypeScript, Node.js, and relational databases. Eager to bring clean code practices and dynamic problem-solving capabilities to the role.`;
          }
        }
        return { elementId: f.elementId, value, mappedTo };
      });
    }

    const prompt = `
      You are a smart browser assistant. Fill out form fields on a job application using the applicant's profile.
      Analyze the fields context (label, placeholder, input type, nearby text) and return a JSON mapping of each field's elementId to the correct answer.

      APPLICANT PROFILE:
      ${JSON.stringify({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        college: profile.college,
        degree: profile.degree,
        graduationYear: profile.graduationYear,
        skills: profile.skills,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
        resumeLink: profile.resumeLink,
        projects: profile.projects,
        workExperience: profile.workExperience,
        resumeText: profile.resumeText ? profile.resumeText.substring(0, 3000) : ""
      })}

      FORM FIELDS TO FILL:
      ${JSON.stringify(fields)}

      Return ONLY a JSON array matching this structure:
      [
        { "elementId": "input-id", "value": "Answer Text to fill", "mappedTo": "profile_field_key_or_custom_answer" }
      ]
    `;

    return await this._callOpenRouter(prompt, apiKey, true);
  },

  /**
   * 3. Job Description Analyzer
   */
  async analyzeJobDescription(
    resumeText: string,
    jobDescription: string,
    apiKey: string,
    isDemo = true
  ): Promise<JobAnalysis> {
    const success = await Storage.deductCredits(1, 'jd_analysis');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1200));
      return {
        matchScore: 84,
        strongSkills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'Python'],
        missingSkills: ['Docker', 'AWS (S3/EC2)', 'CI/CD Pipelines (GitHub Actions)']
      };
    }

    const prompt = `
      Compare the applicant's resume with the job description below.
      Assess the match percentage (0-100), list the applicant's strong matching skills, and list crucial missing skills from the job description that the applicant lacks.

      RESUME:
      ${resumeText.substring(0, 5000)}

      JOB DESCRIPTION:
      ${jobDescription.substring(0, 5000)}

      Return ONLY a JSON object matching this schema:
      {
        "matchScore": 84,
        "strongSkills": ["React", "TypeScript"],
        "missingSkills": ["Docker", "Kubernetes"]
      }
    `;

    return await this._callOpenRouter(prompt, apiKey, true);
  },

  /**
   * 4. AI Answers for application questions
   */
  async generateCustomAnswer(
    question: string,
    profile: UserProfile,
    jobDescription: string,
    apiKey: string,
    isDemo = true
  ): Promise<string> {
    const success = await Storage.deductCredits(3, 'essay_gen');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1000));
      if (question.toLowerCase().includes('why') || question.toLowerCase().includes('hire') || question.toLowerCase().includes('work')) {
        return `I want to work at your company because I am deeply inspired by your focus on innovative technical engineering. My strong background in ${profile.skills.slice(0, 3).join(' and ')} aligns perfectly with your job description. I am excited by the prospect of building scalable web apps with your brilliant engineering team, and I am confident that my passion for clean code and micro-animations will add immense value.`;
      }
      if (question.toLowerCase().includes('challenge') || question.toLowerCase().includes('difficult')) {
        return `A significant technical challenge I faced was optimizing real-time socket connections in a collaborative dashboard. Redundant states caused client-side lag. I solved this by implementing atomic state updates via Zustand and throttling database sync signals, successfully reducing socket re-renders by 60% and delivering a seamless, premium interface for users.`;
      }
      return `With a strong academic foundation from ${profile.college || 'my college'}, hands-on experience in full-stack engineering, and expertise in ${profile.skills.slice(0, 4).join(', ')}, I am well-prepared to excel in this role. I have a proven track record of writing maintainable, dry code, collaborating in agile structures, and solving complex problems with high speed and precision.`;
    }

    const prompt = `
      Generate a professional, compelling, and concise answer (100-150 words) to a job application question based on the applicant's profile and the job description.
      Write the response in the first person ("I"). Make it highly personalized to their actual background and highlight relevant skills matching the job description.

      APPLICANT PROFILE:
      ${JSON.stringify({
        name: profile.name,
        college: profile.college,
        degree: profile.degree,
        skills: profile.skills,
        projects: profile.projects,
        workExperience: profile.workExperience,
        resumeText: profile.resumeText ? profile.resumeText.substring(0, 3000) : ""
      })}

      JOB DESCRIPTION SUMMARY:
      ${jobDescription.substring(0, 1500)}

      APPLICATION QUESTION:
      "${question}"
    `;

    return await this._callOpenRouter(prompt, apiKey, false);
  },

  /**
   * 5. Cover letter generation
   */
  async generateCoverLetter(
    company: string,
    role: string,
    profile: UserProfile,
    jobDescription: string,
    apiKey: string,
    isDemo = true
  ): Promise<string> {
    const success = await Storage.deductCredits(5, 'cover_letter');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1500));
      return `Dear Hiring Manager,

I am writing to express my enthusiastic interest in the ${role || 'Software Engineer Intern'} position at ${company || 'your esteemed company'}. As a dedicated developer with extensive experience in ${profile.skills.slice(0, 4).join(', ')}, I am excited about the opportunity to contribute to your engineering team.

During my study at ${profile.college || 'my university'}, I developed a passion for writing clean, modular code and creating premium digital experiences. I have built several full-stack applications, integrating fast frontend architectures with secure database structures. For example, I successfully designed a real-time data sync pipeline that optimized client-side interactions, demonstrating my ability to analyze performance bottlenecks and optimize developer workflows.

Your job description outlines a need for expertise in ${profile.skills[0]} and robust problem-solving, which aligns perfectly with my qualifications. I am particularly drawn to ${company || 'your company'}'s technical culture and commitment to engineering excellence. I am confident that my technical skills, coupled with my agile team-player mindset, will enable me to deliver high-quality code and support your product roadmap immediately.

Thank you for your time and consideration. I look forward to the possibility of discussing how my background can support your engineering needs.

Sincerely,
${profile.name || 'Rahul Sharma'}`;
    }

    const prompt = `
      Write a highly tailored, professional, and convincing cover letter (300 words) from the applicant to a company for a specific job role.
      Integrate details from the applicant's resume/profile to showcase a strong fit with the job description. Keep the tone ambitious, professional, and authentic.

      APPLICANT:
      ${JSON.stringify({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        college: profile.college,
        degree: profile.degree,
        skills: profile.skills,
        projects: profile.projects,
        workExperience: profile.workExperience,
        resumeText: profile.resumeText ? profile.resumeText.substring(0, 4000) : ""
      })}

      COMPANY & ROLE:
      Company: ${company}
      Role: ${role}

      JOB DESCRIPTION SUMMARY:
      ${jobDescription.substring(0, 2000)}
    `;

    return await this._callOpenRouter(prompt, apiKey, false);
  },

  /**
   * 6. Resume Tailoring & Scoring
   */
  async optimizeResume(
    profile: UserProfile,
    jobDescription: string,
    apiKey: string,
    isDemo = true
  ): Promise<{ score: number; suggestions: string[] }> {
    const success = await Storage.deductCredits(2, 'resume_optimize');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1200));
      return {
        score: 72,
        suggestions: [
          'Add quantified achievements (e.g., "improved loading speeds by 40%", "boosted database queries by 25%").',
          'Explicitly mention Docker or Kubernetes, which are highly requested in the job description.',
          'Add REST APIs or microservices experience in your tech stack summary.',
          'Incorporate CI/CD pipelines under your professional experience description.'
        ]
      };
    }

    const prompt = `
      Evaluate the applicant's profile (including skills and resume text) against the job description.
      Score their resume fit from 0 to 100, and generate 4-5 bulleted, actionable suggestions on how they can tailor their resume (e.g. adding specific key technical skills, quantifying achievements, emphasizing specific projects).

      APPLICANT PROFILE:
      ${JSON.stringify({
        skills: profile.skills,
        resumeText: profile.resumeText ? profile.resumeText.substring(0, 4000) : ""
      })}

      JOB DESCRIPTION:
      ${jobDescription.substring(0, 3000)}

      Return ONLY a JSON object matching this schema:
      {
        "score": 72,
        "suggestions": [
          "Suggestion 1",
          "Suggestion 2"
        ]
      }
    `;

    return await this._callOpenRouter(prompt, apiKey, true);
  },

  /**
   * 7. Interview Prep Questions
   */
  async generateInterviewPrep(
    profileOrJobDescription: any,
    jobDescriptionOrApiKey?: string,
    apiKeyOrIsDemo?: any,
    isDemoOption?: boolean
  ): Promise<InterviewQuestion[]> {
    let jobDescription = '';
    let apiKey = '';
    let isDemo = true;

    if (typeof profileOrJobDescription === 'object' && profileOrJobDescription !== null) {
      jobDescription = jobDescriptionOrApiKey || '';
      apiKey = apiKeyOrIsDemo || '';
      isDemo = isDemoOption !== undefined ? !!isDemoOption : true;
    } else {
      jobDescription = profileOrJobDescription || '';
      apiKey = jobDescriptionOrApiKey || '';
      isDemo = apiKeyOrIsDemo !== undefined ? !!apiKeyOrIsDemo : true;
    }

    const success = await Storage.deductCredits(2, 'interview_prep');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 1000));
      return [
        {
          question: 'Explain the React virtual DOM and how rendering reconciliation works.',
          answer: 'React keeps a lightweight virtual representation of the UI in memory (Virtual DOM). When state changes, it generates a new Virtual DOM tree and compares it with the previous one using a diffing algorithm (Reconciliation). By identifying precisely which elements changed, it updates the actual DOM in batched cycles, maximizing browser rendering speed and minimizing expensive DOM writes.'
        },
        {
          question: 'What is state management in React, and when should you choose Zustand over Context API?',
          answer: 'State management coordinates data flow between components. React Context is great for static configuration (like themes or locales) but triggers global re-renders on all subscribers whenever unknown part of its value changes. Zustand, on the other hand, is an atomic store that uses selectors, allowing components to subscribe to small, specific slices of state. This prevents unnecessary renders, making it far superior for high-performance dashboards and complex state requirements.'
        },
        {
          question: 'How do you design and secure RESTful APIs?',
          answer: 'Design REST APIs using clear noun endpoints (e.g., /api/jobs), proper HTTP verbs (GET, POST, etc.), and status codes. Secure them using HTTPS for encryption, JWT/OAuth2 for token-based stateless authentication, rate limiting (throttling) to prevent DDoS, and CORS policies to control domain origins. Additionally, perform robust inputs validation and database query parameterization to prevent SQL injection.'
        }
      ];
    }

    const prompt = `
      Based on the following job description, generate 3 highly probable technical interview questions along with their comprehensive model answers.
      Focus on the key technologies, libraries, and frameworks mentioned in the description.

      JOB DESCRIPTION:
      ${jobDescription.substring(0, 3000)}

      Return ONLY a JSON array of objects matching this schema:
      [
        { "question": "Question text here?", "answer": "Detailed model answer here..." }
      ]
    `;

    return await this._callOpenRouter(prompt, apiKey, true);
  },

  /**
   * Generic answer generator — used for free-form chat in the AI Assistant.
   */
  async generateAnswer(
    userMessage: string,
    profile: UserProfile,
    jobDescription: string,
    apiKey: string,
    isDemo = true
  ): Promise<string> {
    const success = await Storage.deductCredits(1, 'ai_chat');
    if (!success) {
      throw new Error('Insufficient AI credits. Please purchase a top-up or upgrade your plan.');
    }
    if (isDemo || !apiKey) {
      await new Promise(r => setTimeout(r, 800));
      return `I recommend highlighting specific, quantified achievements in your projects and work experience that match the key requirements of the role. Let me know if you'd like me to tailor a specific section for you!`;
    }

    const prompt = `
Applicant Name: ${profile.name || 'the applicant'}
Applicant Skills: ${(profile.skills || []).slice(0, 15).join(', ')}
${jobDescription ? `Job Description Context:\n${jobDescription.substring(0, 1500)}` : ''}

User Message: ${userMessage}

Instructions:
1. You are ApplyFlow AI, a specialized career coaching assistant.
2. YOU MUST POLITELY REFUSE TO ANSWER any questions that are not strictly related to career advice, job applications, resumes, interviews, or professional development.
3. UNDER NO CIRCUMSTANCES should you write code, solve programming problems, or answer general knowledge questions. If asked for code (e.g. Java, Python, HTML), respond that you are a career assistant and cannot write code.
4. Answer the user's career-related question directly, concisely, and specifically.
5. Keep the response brief (maximum 120 words). Do not include verbose introductions (e.g., "Hi Keshav, I'd be happy to help...") or generic career advice summaries unless explicitly asked.
6. Respond in plain text with line breaks. Do NOT use JSON.
`;
    return await this._callOpenRouter(prompt, apiKey, false);
  }
};


