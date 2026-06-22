import scannerScript from '../content/scanner.ts?script';
import fillerScript  from '../content/filler.ts?script';
import atsFillerScript from '../content/atsFiller.ts?script';
import { Storage } from '../shared/storage';
import type { Application } from '../shared/types';
import { isJobPage } from '../shared/platformUtils';

// ─── Track which tabs have pending applications ───────────────────────────────

const pendingApplications = new Map<number, Application>();
const pendingAtsFills = new Map<number, any>();

// ─── Alarms for reminders ─────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reminder-')) {
    const appId = alarm.name.replace('reminder-', '');
    const apps = await Storage.getApplications();
    const app = apps.find(a => a.id === appId);
    if (app) {
      chrome.notifications.create(`reminder-${appId}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '⏰ ApplyFlow Reminder',
        message: `Time to follow up on your ${app.role} application at ${app.company}!`,
        buttons: [{ title: 'Open Tracker' }],
        requireInteraction: true
      });
    }
  }
});

chrome.notifications.onButtonClicked.addListener((notifId) => {
  if (notifId.startsWith('reminder-')) {
    // Open side panel instead of options page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
        } else {
          chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
      }
    });
  }
});

// ─── Storage change listener ──────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.profile) {
    console.log('[ApplyFlow SW] Profile updated');
  }
});

// ─── On install/update → set side panel behavior ────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Allow the side panel to open from any tab
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

// ─── Auto-open side panel on job pages ────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (isJobPage(tab.url)) {
    // Auto-open side panel on job pages
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
    // Notify the side panel to switch to dashboard/job mode
    chrome.runtime.sendMessage({ type: 'JOB_PAGE_DETECTED', url: tab.url }).catch(() => {});
  }
});

// ─── webNavigation: Submission Confirmation Detection ─────────────────────────

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only top-level frame
  const tabId = details.tabId;

  // Check if we have a pending application on this tab
  if (!pendingApplications.has(tabId)) return;

  // Check the settings
  const settings = await Storage.getSettings();
  if (!settings.logOnlyAfterSubmission) return;

  // Inject a check script to see if the current page shows a success indicator
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const url = window.location.href.toLowerCase();
        const body = document.body?.innerText?.toLowerCase() || '';
        const successUrlPatterns = ['/success', '/confirmation', '/thank-you', '/thankyou', '/submitted', '/applied', '/complete'];
        const successBodyPatterns = ['thank you for applying', 'your application has been submitted', 'application received', 'successfully submitted', 'we have received your application'];
        for (const p of successUrlPatterns) if (url.includes(p)) return true;
        for (const p of successBodyPatterns) if (body.includes(p)) return true;
        return false;
      }
    });

    const isSuccess = results?.[0]?.result as boolean;
    if (isSuccess) {
      const pendingApp = pendingApplications.get(tabId)!;
      pendingApplications.delete(tabId);

      // Log the application
      await Storage.addApplication({
        ...pendingApp,
        status: 'applied',
        submissionConfirmed: true
      });

      // Notify the popup
      chrome.runtime.sendMessage({
        type: 'APPLICATION_CONFIRMED',
        payload: pendingApp
      }).catch(() => {});
    }
  } catch {
    // Page might not be accessible
  }
});

// ─── Message Router ───────────────────────────────────────────────────────────

let isSidePanelOpen = false;

chrome.runtime.onMessage.addListener((
  message: { type: string; payload?: any; message?: string },
  sender,
  sendResponse
) => {
  // SECURITY: Only accept messages from this extension itself.
  // Reject messages from web pages or other extensions.
  if (sender.id !== chrome.runtime.id) return;

  if (message.type === 'OPEN_OPTIONS') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#billing') });
    return true;
  }

  // ── SIDE_PANEL Lifecycle ──
  if (message.type === 'SIDE_PANEL_MOUNTED') {
    isSidePanelOpen = true;
    return true;
  }
  if (message.type === 'SIDE_PANEL_UNMOUNTED') {
    isSidePanelOpen = false;
    return true;
  }

  // ── TOGGLE_SIDE_PANEL ──
  if (message.type === 'TOGGLE_SIDE_PANEL') {
    if (isSidePanelOpen) {
      chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' }).catch(() => {});
      isSidePanelOpen = false;
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const handleToggle = (tab: chrome.tabs.Tab) => {
          const tabId = tab?.id;
          if (tabId) {
            if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
              chrome.sidePanel.open({ tabId }).then(() => {
                isSidePanelOpen = true;
              }).catch(() => {});
            } else if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser.sidebarAction && (globalThis as any).browser.sidebarAction.open) {
              (globalThis as any).browser.sidebarAction.open().then(() => {
                isSidePanelOpen = true;
              }).catch(() => {});
            }
          }
        };
        if (!tabs || tabs.length === 0) {
          chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
            if (fallbackTabs?.[0]) handleToggle(fallbackTabs[0]);
          });
        } else {
          handleToggle(tabs[0]);
        }
      });
    }
    return true;
  }

  // ── OPEN_SIDE_PANEL ──
  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const handleOpen = (tab: chrome.tabs.Tab) => {
        const tabId = tab?.id;
        if (tabId) {
          if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
            chrome.sidePanel.open({ tabId }).catch(() => {});
          } else if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser.sidebarAction && (globalThis as any).browser.sidebarAction.open) {
            (globalThis as any).browser.sidebarAction.open().catch(() => {});
          }
        }
      };
      if (!tabs || tabs.length === 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          if (fallbackTabs?.[0]) handleOpen(fallbackTabs[0]);
        });
      } else {
        handleOpen(tabs[0]);
      }
    });
    return true;
  }

  // ── SCAN_PAGE ──
  if (message.type === 'SCAN_PAGE') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const handleScan = (tab: chrome.tabs.Tab) => {
        const tabId = tab?.id;
        const url   = tab?.url || '';

        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
          chrome.runtime.sendMessage({ type: 'SCAN_ERROR', message: 'Cannot scan browser internal pages.' }).catch(() => {});
          return;
        }
        if (!tabId) return;

        chrome.scripting.executeScript({
          target: { tabId },
          files: [scannerScript]
        }).catch((err) => {
          console.error('[ApplyFlow SW] Scanner inject error:', err);
          chrome.runtime.sendMessage({ type: 'SCAN_ERROR', message: err.message }).catch(() => {});
        });
      };
      if (!tabs || tabs.length === 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          if (fallbackTabs?.[0]) handleScan(fallbackTabs[0]);
        });
      } else {
        handleScan(tabs[0]);
      }
    });
    return true;
  }

  // ── SCAN_RESULT (forward to popup) ──
  if (message.type === 'SCAN_RESULT') {
    chrome.runtime.sendMessage({ type: 'FORWARD_SCAN_RESULT', payload: message.payload }).catch(() => {});
    return true;
  }

  // ── FILL_FIELDS ──
  if (message.type === 'FILL_FIELDS') {
    const { fields, profile, pendingApp } = message.payload;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const handleFill = (tab: chrome.tabs.Tab) => {
        const tabId = tab?.id;
        if (!tabId) return;

        // Store pending application for submission detection
        if (pendingApp) {
          pendingApplications.set(tabId, pendingApp);
        }

        chrome.scripting.executeScript({
          target: { tabId },
          files: [fillerScript]
        }).then(() => {
          chrome.tabs.sendMessage(tabId, { type: 'DO_FILL', payload: { fields, profile } });
        }).catch((err) => {
          console.error('[ApplyFlow SW] Filler inject error:', err);
        });
      };
      if (!tabs || tabs.length === 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          if (fallbackTabs?.[0]) handleFill(fallbackTabs[0]);
        });
      } else {
        handleFill(tabs[0]);
      }
    });
    return true;
  }

  // ── ATS_FILL (run atsFiller directly on page) ──
  if (message.type === 'ATS_FILL') {
    if (import.meta.env.DEV) console.log('[ApplyFlow SW] Received ATS_FILL message');
    const { profile, pendingApp } = message.payload;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (import.meta.env.DEV) console.log('[ApplyFlow SW] Query active lastFocusedWindow tabs count:', tabs?.length);
      const handleTab = (tab: chrome.tabs.Tab) => {
        const tabId = tab?.id;
        if (!tabId) {
          console.warn('[ApplyFlow SW] No tab ID found for active tab');
          return;
        }

        if (pendingApp) {
          if (import.meta.env.DEV) console.log('[ApplyFlow SW] Setting pending application for tab:', tabId);
          pendingApplications.set(tabId, pendingApp);
        }

        // Store pending fill context
        pendingAtsFills.set(tabId, profile);

        if (import.meta.env.DEV) console.log('[ApplyFlow SW] Injecting atsFillerScript onto tab:', tabId);
        chrome.scripting.executeScript({
          target: { tabId },
          files: [atsFillerScript]
        }).then(() => {
          if (import.meta.env.DEV) console.log('[ApplyFlow SW] Injected atsFillerScript successfully. Sending DO_ATS_FILL...');
          // Try sending immediately for tabs where the script is already loaded and listening
          chrome.tabs.sendMessage(tabId, { type: 'DO_ATS_FILL', payload: { profile } })
            .catch((err) => {
              if (import.meta.env.DEV) console.log('[ApplyFlow SW] Immediate send failed (expected if not loaded yet):', err.message);
            });
        }).catch((err) => {
          console.error('[ApplyFlow SW] ATS fill inject error:', err);
        });
      };

      if (!tabs || tabs.length === 0) {
        if (import.meta.env.DEV) console.log('[ApplyFlow SW] lastFocusedWindow query returned nothing. Retrying with currentWindow: true...');
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          if (import.meta.env.DEV) console.log('[ApplyFlow SW] Query active currentWindow tabs count:', fallbackTabs?.length);
          if (fallbackTabs?.[0]) handleTab(fallbackTabs[0]);
        });
      } else {
        handleTab(tabs[0]);
      }
    });
    return true;
  }

  // ── ATS_FILLER_READY (filler script signals it is loaded and ready) ──
  if (message.type === 'ATS_FILLER_READY') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const handleReadyTab = (tab: chrome.tabs.Tab) => {
        const tabId = tab?.id;
        if (tabId && pendingAtsFills.has(tabId)) {
          const profile = pendingAtsFills.get(tabId);
          pendingAtsFills.delete(tabId);
          if (import.meta.env.DEV) console.log('[ApplyFlow SW] ATS_FILLER_READY received. Sending pending profile to tab:', tabId);
          chrome.tabs.sendMessage(tabId, { type: 'DO_ATS_FILL', payload: { profile } })
            .catch((err) => console.error('[ApplyFlow SW] Error sending DO_ATS_FILL to ready filler:', err));
        }
      };

      if (!tabs || tabs.length === 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          if (fallbackTabs?.[0]) handleReadyTab(fallbackTabs[0]);
        });
      } else {
        handleReadyTab(tabs[0]);
      }
    });
    return true;
  }

  // ── CLIP_JOB (save job from clipper) ──
  if (message.type === 'CLIP_JOB') {
    Storage.addApplication(message.payload)
      .then(() => {
        chrome.runtime.sendMessage({ type: 'JOB_CLIPPED', payload: message.payload }).catch(() => {});
      })
      .catch(err => console.error('[ApplyFlow SW] Clip job error:', err));
    return true;
  }

  // ── IMMEDIATE_LOG (log without waiting for submission) ──
  if (message.type === 'IMMEDIATE_LOG') {
    Storage.addApplication(message.payload).catch(err => console.error(err));
    return true;
  }

  // ── SET_REMINDER ──
  if (message.type === 'SET_REMINDER') {
    const { appId, remindAt } = message.payload;
    const delayInMinutes = Math.max(1, Math.round((remindAt - Date.now()) / 60000));
    chrome.alarms.create(`reminder-${appId}`, { delayInMinutes });
    return true;
  }

  // ── ANALYZE_JOB (proxy Gemini call from overlay — key stays in SW) ──
  // SECURITY: The overlay routes its Gemini fetch here so the API key never
  // appears in the content-script network tab visible to the page's DevTools.
  if (message.type === 'ANALYZE_JOB') {
    const { prompt, apiKey } = message.payload;
    if (!apiKey) {
      sendResponse({ error: 'no_api_key' });
      return false;
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ error: response.status });
        chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_RESULT', error: response.status }).catch(() => {});
        return;
      }
      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(rawText);
        sendResponse(parsed);
        chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_RESULT', payload: parsed }).catch(() => {});
      } catch {
        sendResponse({ error: 'parse_error' });
        chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_RESULT', error: 'parse_error' }).catch(() => {});
      }
    }).catch((err) => {
      console.error('[ApplyFlow SW] Gemini proxy error:', err);
      sendResponse({ error: 'fetch_error' });
      chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_RESULT', error: 'fetch_error' }).catch(() => {});
    });
    return true;
  }

  return true;
});
