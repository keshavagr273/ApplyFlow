/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./side-panel.html",
    "./options.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'hsl(230, 100%, 97%)',
          100: 'hsl(230, 95%, 93%)',
          200: 'hsl(230, 90%, 86%)',
          300: 'hsl(231, 87%, 77%)',
          400: 'hsl(232, 88%, 68%)',
          500: 'hsl(232, 89%, 62%)',
          600: '#4a6cf7',
          700: 'hsl(232, 89%, 50%)',
          800: '#2340c4',
          900: '#1a2f9e',
        },
        accent: {
          400: 'hsl(270, 75%, 65%)',
          500: '#aa3bff',
          600: 'hsl(270, 85%, 50%)',
        },
        surface: {
          0:      '#ffffff',
          50:     '#f8f9fc',
          100:    '#f0f2f8',
          200:    '#e4e8f4',
          dark:   '#0f1117',
          dark50: '#161b27',
          dark100:'#1e2536',
          dark200:'#252d40',
          border: 'rgba(99, 115, 210, 0.15)',
          'border-dark': 'rgba(255, 255, 255, 0.08)',
        },
        success:  '#10b981',
        warning:  '#f59e0b',
        error:    '#ef4444',
        info:     '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'micro': ['10px', { lineHeight: '1.4', fontWeight: '600' }],
        'caption': ['11px', { lineHeight: '1.5', fontWeight: '500' }],
        'body': ['13px', { lineHeight: '1.6' }],
        'body-sm': ['12px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        'sm':   '6px',
        'md':   '10px',
        'lg':   '14px',
        'xl':   '20px',
        '2xl':  '24px',
        'full': '9999px',
      },
      boxShadow: {
        'sm':   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'md':   '0 4px 12px rgba(74,108,247,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'lg':   '0 12px 32px rgba(74,108,247,0.12), 0 4px 8px rgba(0,0,0,0.06)',
        'xl':   '0 20px 60px rgba(74,108,247,0.18), 0 8px 16px rgba(0,0,0,0.08)',
        'glow-brand': '0 0 20px rgba(74,108,247,0.4)',
        'glow-success': '0 0 20px rgba(16,185,129,0.4)',
        'inner': 'inset 0 1px 3px rgba(0,0,0,0.1)',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-up': 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'ping-once': 'ping 0.5s cubic-bezier(0, 0, 0.2, 1)',
      },
      keyframes: {
        slideInRight: {
          'from': { transform: 'translateX(24px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          'from': { transform: 'translateY(16px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        scaleIn: {
          'from': { transform: 'scale(0.92)', opacity: '0' },
          'to': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '20px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
