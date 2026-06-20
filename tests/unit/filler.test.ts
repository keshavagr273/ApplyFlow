import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeSetValue, fillEEOField } from '../../src/content/filler';
import { UserProfile } from '../../src/shared/types';

describe('filler', () => {
  const mockProfile: UserProfile = {
    name: 'Alex Mercer',
    email: 'alex.mercer@gmail.com',
    phone: '9876543211',
    college: 'IIT Kanpur',
    degree: 'B.Tech Mechanical',
    graduationYear: '2025',
    skills: [],
    resumeLink: '',
    linkedinUrl: '',
    portfolioUrl: '',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    gender: 'male',
    veteran: 'no',
    workAuthorized: true
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('safeSetValue', () => {
    it('should set text input value and dispatch events', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const changeMock = vi.fn();
      input.addEventListener('change', changeMock);

      safeSetValue(input, 'test value');
      
      expect(input.value).toBe('test value');
      expect(changeMock).toHaveBeenCalled();
    });

    it('should set select value by text or value matching', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="1">Option One</option>
        <option value="2">Option Two</option>
      `;
      document.body.appendChild(select);

      const changeMock = vi.fn();
      select.addEventListener('change', changeMock);

      safeSetValue(select, 'two'); // Should match "Option Two"
      
      expect(select.selectedIndex).toBe(1);
      expect(select.value).toBe('2');
      expect(changeMock).toHaveBeenCalled();
    });
  });

  describe('fillEEOField', () => {
    it('should click correct radio button for gender', () => {
      document.body.innerHTML = `
        <div>
          <input type="radio" id="g1" name="gender" value="f" />
          <label for="g1">Female</label>
        </div>
        <div>
          <input type="radio" id="g2" name="gender" value="m" />
          <label for="g2">Male</label>
        </div>
      `;

      const g2 = document.getElementById('g2') as HTMLInputElement;
      const changeMock = vi.fn();
      g2.addEventListener('change', changeMock);

      fillEEOField('eeo_gender', mockProfile); // Profile has gender: 'male'

      expect(g2.checked).toBe(true);
      expect(changeMock).toHaveBeenCalled();
    });
  });
});
