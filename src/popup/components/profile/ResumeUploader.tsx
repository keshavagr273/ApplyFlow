import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { OpenRouterAIService } from '../../../shared/aiService';
import { useStore } from '../../../shared/store';

export function ResumeUploader({
  isUploading,
  setIsUploading,
  uploadStatus,
  setUploadStatus,
  settings,
  setFormData,
}: {
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
  uploadStatus: string;
  setUploadStatus: (v: string) => void;
  settings: any;
  setFormData: React.Dispatch<React.SetStateAction<Partial<import('../../../shared/types').UserProfile>>>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useStore(state => state.showToast);
  const addResumeToHistory = useStore(state => state.addResumeToHistory);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Native C++ Decompression Stream PDF text extraction (fast, zero-dependency, handles FlateDecode compression!)
  const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('utf-8');
    
    let extractedText = "";
    const streamHeader = new TextEncoder().encode("stream");
    const streamFooter = new TextEncoder().encode("endstream");

    const indexOfBytes = (source: Uint8Array, target: Uint8Array, start: number): number => {
      for (let i = start; i <= source.length - target.length; i++) {
        let found = true;
        for (let j = 0; j < target.length; j++) {
          if (source[i + j] !== target[j]) {
            found = false;
            break;
          }
        }
        if (found) return i;
      }
      return -1;
    };

    const decompressFlate = async (data: Uint8Array): Promise<Uint8Array> => {
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      
      const writePromise = writer.write(data as any)
        .then(() => writer.close())
        .catch(() => {
          // Suppress write error
        });
      
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLength += value.length;
          }
        }
      } catch {
        // Catch trailing byte errors
      } finally {
        reader.releaseLock();
      }
      
      await writePromise;

      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    };

    let pos = 0;
    while (pos < bytes.length && pos < 2 * 1024 * 1024) { 
      const startIdx = indexOfBytes(bytes, streamHeader, pos);
      if (startIdx === -1) break;

      const endIdx = indexOfBytes(bytes, streamFooter, startIdx);
      if (endIdx === -1) break;

      let streamStart = startIdx + 6;
      if (bytes[streamStart] === 13) streamStart++; // \r
      if (bytes[streamStart] === 10) streamStart++; // \n

      const compressedBytes = bytes.subarray(streamStart, endIdx);
      
      try {
        const decompressed = await decompressFlate(compressedBytes);
        const decompressedText = textDecoder.decode(decompressed);
        
        const matches = decompressedText.match(/\(([^)]*)\)/g);
        if (matches) {
          extractedText += " " + matches.map(m => 
            m.slice(1, -1).replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          ).join(" ");
        }
      } catch {
        try {
          const rawText = textDecoder.decode(compressedBytes);
          const matches = rawText.match(/\(([^)]*)\)/g);
          if (matches) {
            extractedText += " " + matches.map(m => m.slice(1, -1)).join(" ");
          }
        } catch {
          // ignore error
        }
      }

      pos = endIdx + 9;
    }

    if (extractedText.trim().length < 80) {
      const binaryString = textDecoder.decode(bytes.slice(0, 1024 * 1024));
      let clean = "";
      for (let i = 0; i < binaryString.length && clean.length < 15000; i++) {
        const char = binaryString.charCodeAt(i);
        if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
          clean += binaryString[i];
        }
      }
      extractedText = clean.replace(/\s+/g, ' ').substring(0, 9000);
    }

    return extractedText.trim();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      showToast("Please upload a valid PDF resume file.", 'warning');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Extracting text layer...');
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const rawText = await extractTextFromPDF(arrayBuffer);

          // Cut off Font Awesome / font garbage that commonly appears at the end of PDF extractions
          const fontGarbageCutoff = rawText.search(/Font Awesome version:/i);
          const trimmedRaw = fontGarbageCutoff > 100 ? rawText.substring(0, fontGarbageCutoff) : rawText;

          // Sanitize: keep only printable ASCII + newlines, collapse whitespace, cap at 12000 chars
          const sanitized = trimmedRaw
            .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
            .replace(/\s{3,}/g, '  ')
            .substring(0, 12000)
            .trim();

          // De-ligature: collapse space-separated single letters into words
          // e.g. "K e s h a V a g r a w a l" -> "Keshav Agrawal"
          // This is caused by PDFs storing each glyph separately in ligature fonts
          const text = sanitized
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4$5$6$7$8$9')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4$5$6$7$8')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4$5$6$7')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4$5$6')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4$5')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3$4')
            .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3')
            .replace(/  +/g, ' ')
            .trim();

          console.log(`=== SANITIZED TEXT (${text.length} chars, was ${trimmedRaw.length}) ===`, text);
          
          setUploadStatus('Structuring with AI...');
          
          const apiKey = settings?.geminiApiKey || import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GROQ_API_KEY || '';
          const parsedProfile = await OpenRouterAIService.parseResume(
            text,
            apiKey,
            false
          );
          
          console.log("=== AI PARSED PROFILE ===", parsedProfile);

          const normKey = (key: string): string => {
            const lower = key.toLowerCase();
            if (lower === 'graduationyear') return 'graduationYear';
            if (lower === 'linkedinurl') return 'linkedinUrl';
            if (lower === 'portfoliourl') return 'portfolioUrl';
            if (lower === 'resumelink') return 'resumeLink';
            if (lower === 'workexperience') return 'workExperience';
            return lower;
          };

          const normalizedProfile: any = {};
          if (parsedProfile && typeof parsedProfile === 'object') {
            Object.keys(parsedProfile).forEach(key => {
              normalizedProfile[normKey(key)] = (parsedProfile as any)[key];
            });
          }

          const parsedProjects = (normalizedProfile.projects || []).map((p: any) => ({
            id: p.id || 'proj-' + Math.random().toString(36).substring(2, 11),
            title: p.title || p.name || '',
            description: p.description || '',
            githubUrl: p.githubUrl || '',
            deploymentUrl: p.deploymentUrl || ''
          }));

          const parsedWorkExp = (normalizedProfile.workExperience || []).map((e: any) => ({
            id: e.id || 'exp-' + Math.random().toString(36).substring(2, 11),
            company: e.company || '',
            role: e.role || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            description: e.description || ''
          }));

          const parsedData = {
            name: normalizedProfile.name,
            email: normalizedProfile.email,
            phone: normalizedProfile.phone,
            college: normalizedProfile.college,
            degree: normalizedProfile.degree,
            graduationYear: normalizedProfile.graduationYear,
            cgpa: normalizedProfile.cgpa,
            skills: normalizedProfile.skills && normalizedProfile.skills.length > 0 ? normalizedProfile.skills : [],
            linkedinUrl: normalizedProfile.linkedinUrl,
            portfolioUrl: normalizedProfile.portfolioUrl,
            githubUrl: normalizedProfile.githubUrl,
            projects: parsedProjects,
            workExperience: parsedWorkExp,
            resumeText: text
          };

          setFormData((prev: any) => ({
            ...prev,
            ...parsedData
          }));

          // Save parsed resume to local history
          addResumeToHistory(file.name, parsedData, text).catch(err => {
            console.error('Failed to add resume to history:', err);
          });

          setUploadStatus('Imported!');
          setTimeout(() => setIsUploading(false), 1500);
        } catch (err) {
          console.error(err);
          showToast("Failed to parse and structure PDF content.", 'error');
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      showToast("Error reading file.", 'error');
      setIsUploading(false);
    }
  };

  if (isUploading) {
    return (
      <div className="glass-card p-5 text-center flex flex-col items-center justify-center border-brand-400 bg-brand-50/20 py-6">
        <div className="w-8 h-8 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin mb-3"></div>
        <div className="text-xs font-bold text-brand-800">{uploadStatus}</div>
        <p className="text-[9px] text-gray-400 mt-1 font-semibold">Generating profile from PDF structure.</p>
      </div>
    );
  }

  return (
    <div 
      onClick={triggerFileInput}
      className="glass-card p-4 text-center border-dashed border-brand-300 hover:border-brand-500 cursor-pointer bg-brand-50/10 hover:bg-brand-50/30 transition-all py-5 flex flex-col items-center"
    >
      <Upload size={18} className="text-brand-600 mb-2 animate-bounce" />
      <h3 className="text-xs font-extrabold text-brand-900">Upload PDF Resume</h3>
      <p className="text-[9px] text-gray-400 font-semibold mt-0.5">Parse skills, education, and links in 1-click.</p>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".pdf" 
        className="hidden" 
      />
    </div>
  );
}

