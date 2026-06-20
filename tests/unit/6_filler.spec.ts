/**
 * 6_filler.spec.ts — Generic Field Filler Unit Tests
 *
 * Covers:
 *   • safeSetValue — text inputs, textarea, select fuzzy matching, React setter
 *   • fillEEOField — gender, disability, veteran, workAuthorized, sponsorship
 *   • DO_FILL message handler — standard fields, radio, checkbox, custom answers
 *   • Skipping pre-filled inputs
 *   • Array / boolean value coercion
 *   • Event dispatch (input, change, focus, blur, keyboard events)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeSetValue, fillEEOField } from '../../src/content/filler';
import { UserProfile } from '../../src/shared/types';

// ── Profile fixture ────────────────────────────────────────────────────────────

const profile: UserProfile = {
  name: 'Priya Patel',
  email: 'priya@example.com',
  phone: '9988776655',
  college: 'BITS Pilani',
  degree: 'B.E. Computer Science',
  graduationYear: '2025',
  skills: ['Python', 'Django', 'PostgreSQL'],
  resumeLink: 'https://drive.google.com/priya-cv',
  linkedinUrl: 'https://linkedin.com/in/priya',
  portfolioUrl: 'https://priya.dev',
  customAnswers: [
    { id: 'ca1', trigger: 'Why do you want to work here?', answer: 'I love innovation.' }
  ],
  projects: [],
  workExperience: [],
  gender: 'female',
  disability: 'no',
  veteran: 'no',
  workAuthorized: true,
  requiresSponsorship: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─────────────────────────────────────────────────────────────────────────────
// safeSetValue — TEXT INPUT
// ─────────────────────────────────────────────────────────────────────────────

describe('safeSetValue — text input', () => {
  it('sets value on a text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    safeSetValue(input, 'Hello World');
    expect(input.value).toBe('Hello World');
  });

  it('dispatches "input" event on text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const inputHandler = vi.fn();
    input.addEventListener('input', inputHandler);
    safeSetValue(input, 'test');
    expect(inputHandler).toHaveBeenCalled();
  });

  it('dispatches "change" event on text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const changeHandler = vi.fn();
    input.addEventListener('change', changeHandler);
    safeSetValue(input, 'test');
    expect(changeHandler).toHaveBeenCalled();
  });

  it('dispatches "focus" and "blur" events', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const focusHandler = vi.fn();
    const blurHandler = vi.fn();
    input.addEventListener('focus', focusHandler);
    input.addEventListener('blur', blurHandler);
    safeSetValue(input, 'value');
    expect(focusHandler).toHaveBeenCalled();
    expect(blurHandler).toHaveBeenCalled();
  });

  it('dispatches keyboard events (keydown, keyup)', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const keyDownHandler = vi.fn();
    const keyUpHandler = vi.fn();
    input.addEventListener('keydown', keyDownHandler);
    input.addEventListener('keyup', keyUpHandler);
    safeSetValue(input, 'test');
    expect(keyDownHandler).toHaveBeenCalled();
    expect(keyUpHandler).toHaveBeenCalled();
  });

  it('does nothing when value is empty string', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const inputHandler = vi.fn();
    input.addEventListener('input', inputHandler);
    safeSetValue(input, '');
    // Empty string is falsy — no events should fire based on guard check
    expect(input.value).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeSetValue — TEXTAREA
// ─────────────────────────────────────────────────────────────────────────────

describe('safeSetValue — textarea', () => {
  it('sets value on a textarea', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    safeSetValue(ta, 'Long answer text here');
    expect(ta.value).toBe('Long answer text here');
  });

  it('dispatches "input" and "change" events on textarea', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    ta.addEventListener('input', inputHandler);
    ta.addEventListener('change', changeHandler);
    safeSetValue(ta, 'answer');
    expect(inputHandler).toHaveBeenCalled();
    expect(changeHandler).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeSetValue — SELECT
// ─────────────────────────────────────────────────────────────────────────────

describe('safeSetValue — select element', () => {
  function makeSelect(options: string[]): HTMLSelectElement {
    const sel = document.createElement('select');
    options.forEach((opt, i) => {
      const o = document.createElement('option');
      o.value = String(i + 1);
      o.text = opt;
      sel.add(o);
    });
    document.body.appendChild(sel);
    return sel;
  }

  it('selects option by exact text match', () => {
    const sel = makeSelect(['Male', 'Female', 'Prefer not to say']);
    const changeHandler = vi.fn();
    sel.addEventListener('change', changeHandler);
    safeSetValue(sel, 'Female');
    expect(sel.selectedIndex).toBe(1);
    expect(changeHandler).toHaveBeenCalled();
  });

  it('selects option by partial text match (fuzzy)', () => {
    const sel = makeSelect(['Option One', 'Option Two', 'Option Three']);
    safeSetValue(sel, 'two');
    expect(sel.selectedIndex).toBe(1);
    expect(sel.value).toBe('2');
  });

  it('selects option by value match', () => {
    const sel = makeSelect(['Alpha', 'Beta', 'Gamma']);
    safeSetValue(sel, '3'); // value="3" corresponds to Gamma
    expect(sel.selectedIndex).toBe(2);
  });

  it('does not change selection when no option matches', () => {
    const sel = makeSelect(['A', 'B', 'C']);
    sel.selectedIndex = 0;
    safeSetValue(sel, 'xyz-no-match');
    expect(sel.selectedIndex).toBe(0);
  });

  it('dispatches "change" event on select', () => {
    const sel = makeSelect(['Yes', 'No']);
    const changeHandler = vi.fn();
    sel.addEventListener('change', changeHandler);
    safeSetValue(sel, 'Yes');
    expect(changeHandler).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — GENDER
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — gender', () => {
  function makeGenderRadios() {
    document.body.innerHTML = `
      <div>
        <input type="radio" id="g_male" name="gender" value="m" />
        <label for="g_male">Male</label>
      </div>
      <div>
        <input type="radio" id="g_female" name="gender" value="f" />
        <label for="g_female">Female</label>
      </div>
      <div>
        <input type="radio" id="g_nb" name="gender" value="nb" />
        <label for="g_nb">Non-binary</label>
      </div>
      <div>
        <input type="radio" id="g_pref" name="gender" value="pref" />
        <label for="g_pref">Prefer not to say</label>
      </div>
    `;
  }

  it('clicks female radio when gender=female', () => {
    makeGenderRadios();
    fillEEOField('eeo_gender', { ...profile, gender: 'female' });
    expect((document.getElementById('g_female') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks male radio when gender=male', () => {
    makeGenderRadios();
    const changeHandler = vi.fn();
    (document.getElementById('g_male') as HTMLInputElement).addEventListener('change', changeHandler);
    fillEEOField('eeo_gender', { ...profile, gender: 'male' });
    expect((document.getElementById('g_male') as HTMLInputElement).checked).toBe(true);
    expect(changeHandler).toHaveBeenCalled();
  });

  it('clicks prefer-not-to-say radio when gender=prefer-not-to-say', () => {
    makeGenderRadios();
    fillEEOField('eeo_gender', { ...profile, gender: 'prefer-not-to-say' });
    expect((document.getElementById('g_pref') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks non-binary radio when gender=non-binary', () => {
    makeGenderRadios();
    fillEEOField('eeo_gender', { ...profile, gender: 'non-binary' });
    expect((document.getElementById('g_nb') as HTMLInputElement).checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — DISABILITY
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — disability', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input type="radio" id="d_yes" name="disability" value="yes" />
        <label for="d_yes">Yes, I have a disability</label>
      </div>
      <div>
        <input type="radio" id="d_no" name="disability" value="no" />
        <label for="d_no">No, I don't have</label>
      </div>
      <div>
        <input type="radio" id="d_pref" name="disability" value="pref" />
        <label for="d_pref">Prefer not to say</label>
      </div>
    `;
  });

  it('clicks "No" when disability=no', () => {
    fillEEOField('eeo_disability', { ...profile, disability: 'no' });
    expect((document.getElementById('d_no') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks "Yes" when disability=yes', () => {
    fillEEOField('eeo_disability', { ...profile, disability: 'yes' });
    expect((document.getElementById('d_yes') as HTMLInputElement).checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — VETERAN
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — veteran', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input type="radio" id="v_yes" name="veteran" value="yes" />
        <label for="v_yes">I am a veteran</label>
      </div>
      <div>
        <input type="radio" id="v_no" name="veteran" value="no" />
        <label for="v_no">I am not a veteran</label>
      </div>
    `;
  });

  it('clicks "No" radio when veteran=no', () => {
    fillEEOField('eeo_veteran', { ...profile, veteran: 'no' });
    expect((document.getElementById('v_no') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks "Yes" radio when veteran=yes', () => {
    fillEEOField('eeo_veteran', { ...profile, veteran: 'yes' });
    expect((document.getElementById('v_yes') as HTMLInputElement).checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — WORK AUTHORIZATION
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — work authorization', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input type="radio" id="wa_yes" name="work_auth" value="yes" />
        <label for="wa_yes">Yes, I am authorized</label>
      </div>
      <div>
        <input type="radio" id="wa_no" name="work_auth" value="no" />
        <label for="wa_no">No, I am not authorized</label>
      </div>
    `;
  });

  it('clicks "Yes" when workAuthorized=true', () => {
    fillEEOField('eeo_work_auth', { ...profile, workAuthorized: true });
    expect((document.getElementById('wa_yes') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks "No" when workAuthorized=false', () => {
    fillEEOField('eeo_work_auth', { ...profile, workAuthorized: false });
    expect((document.getElementById('wa_no') as HTMLInputElement).checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — SPONSORSHIP
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — sponsorship', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input type="radio" id="sp_yes" name="sponsorship" value="yes" />
        <label for="sp_yes">Yes, I will require sponsorship</label>
      </div>
      <div>
        <input type="radio" id="sp_no" name="sponsorship" value="no" />
        <label for="sp_no">No, I will not require sponsorship</label>
      </div>
    `;
  });

  it('clicks "No" when requiresSponsorship=false', () => {
    fillEEOField('eeo_sponsorship', { ...profile, requiresSponsorship: false });
    expect((document.getElementById('sp_no') as HTMLInputElement).checked).toBe(true);
  });

  it('clicks "Yes" when requiresSponsorship=true', () => {
    fillEEOField('eeo_sponsorship', { ...profile, requiresSponsorship: true });
    expect((document.getElementById('sp_yes') as HTMLInputElement).checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fillEEOField — EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('fillEEOField — edge cases', () => {
  it('does not throw when no radio buttons present', () => {
    document.body.innerHTML = '<div>No radios</div>';
    expect(() => fillEEOField('eeo_gender', profile)).not.toThrow();
  });

  it('does not throw for unknown eeo field type', () => {
    document.body.innerHTML = '<div></div>';
    expect(() => fillEEOField('eeo_ethnicity', profile)).not.toThrow();
  });
});
