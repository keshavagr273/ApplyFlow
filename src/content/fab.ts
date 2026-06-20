// ─── ApplyFlow FAB (Floating Action Button) ────────────────────────────────────
// Injects a round button on every page that opens the Side Panel when clicked.
// On supported job pages, it uses a smaller pill style.

(function () {
  if (document.getElementById('applyflow-fab')) return;

  // Detect if this is a job page
  const url = window.location.href.toLowerCase();
  const JOB_DOMAINS = [
    'linkedin.com/jobs', 'internshala.com/internship', 'internshala.com/job',
    'unstop.com/jobs', 'unstop.com/opportunities', 'myworkdayjobs.com',
    'greenhouse.io', 'lever.co', 'smartrecruiters.com', 'icims.com',
    'bamboohr.com', 'jobvite.com', 'naukri.com', 'indeed.com/viewjob',
    'angel.co', 'wellfound.com', '/jobs/', '/job/', '/careers/', '/apply/'
  ];
  const isJobPage = JOB_DOMAINS.some(d => url.includes(d));

  // Create FAB
  const fab = document.createElement('div');
  fab.id = 'applyflow-fab';
  fab.setAttribute('data-applyflow', 'fab');

  // FAB styles
  Object.assign(fab.style, {
    position: 'fixed',
    bottom: '24px',
    right: '20px',
    zIndex: '2147483646',
    cursor: 'pointer',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#4a6cf7',
    boxShadow: '0 4px 20px rgba(74,108,247,0.3), 0 2px 8px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
    backdropFilter: 'none',
    border: '2px solid rgba(255,255,255,0.2)',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box',
    padding: '6px',
  });

  // Icon — ApplyFlow logo image
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icons/icon128.png');
  icon.alt = 'ApplyFlow';
  Object.assign(icon.style, {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'contain',
    display: 'block',
  });
  fab.appendChild(icon);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.textContent = isJobPage ? 'Open ApplyFlow' : 'Open ApplyFlow';
  Object.assign(tooltip.style, {
    position: 'absolute',
    right: '56px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#1e2536',
    color: '#e2e8f0',
    fontSize: '11px',
    fontWeight: '600',
    padding: '5px 10px',
    borderRadius: '8px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.15s ease',
    border: '1px solid rgba(255,255,255,0.1)',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  });
  fab.appendChild(tooltip);

  // Hover effects
  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'scale(1.12)';
    fab.style.boxShadow = '0 6px 28px rgba(74,108,247,0.45), 0 4px 12px rgba(0,0,0,0.2)';
    tooltip.style.opacity = '1';
  });

  fab.addEventListener('mouseleave', () => {
    fab.style.transform = 'scale(1)';
    fab.style.boxShadow = '0 4px 20px rgba(74,108,247,0.3), 0 2px 8px rgba(0,0,0,0.15)';
    tooltip.style.opacity = '0';
  });

  // Click — toggle side panel
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    fab.style.transform = 'scale(0.9)';
    setTimeout(() => { fab.style.transform = 'scale(1)'; }, 150);
    chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' });
  });

  // Active press effect
  fab.addEventListener('mousedown', () => {
    fab.style.transform = 'scale(0.9)';
  });
  fab.addEventListener('mouseup', () => {
    fab.style.transform = 'scale(1.12)';
  });

  // Insert into page
  document.body.appendChild(fab);

  // On job pages, add a subtle pulse ring to indicate it's active
  if (isJobPage) {
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute',
      inset: '-4px',
      borderRadius: '50%',
      border: '2px solid rgba(74,108,247,0.5)',
      animation: 'applyflow-ring 2s ease-in-out infinite',
      pointerEvents: 'none',
    });
    fab.style.position = 'fixed'; // ensure stacking
    fab.insertBefore(ring, icon);

    // Inject the ring animation style
    if (!document.getElementById('applyflow-fab-style')) {
      const style = document.createElement('style');
      style.id = 'applyflow-fab-style';
      style.textContent = `
        @keyframes applyflow-ring {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }
})();
