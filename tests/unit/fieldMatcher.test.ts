import { describe, test, expect } from 'vitest';
import { matchField, EEO_VALUE_MAP, FieldSignals } from '../../src/shared/fieldMatcher';

describe('fieldMatcher', () => {
  const baseSignals: FieldSignals = {
    labelText: '',
    placeholder: '',
    nameAttr: '',
    idAttr: '',
    ariaLabel: '',
    ariaDescribedBy: '',
    precedingText: '',
    autocomplete: '',
    inputType: 'text'
  };

  test('should match name field with high confidence', () => {
    const nameSignals = {
      ...baseSignals,
      labelText: 'Full Name',
      nameAttr: 'applicant_name'
    };
    const result = matchField(nameSignals);
    expect(result.mappedTo).toBe('name');
    expect(result.confidence).toBeGreaterThanOrEqual(72);
  });

  test('should match email field', () => {
    const emailSignals = {
      ...baseSignals,
      labelText: 'Work Email Address',
      placeholder: 'email@example.com'
    };
    const result = matchField(emailSignals);
    expect(result.mappedTo).toBe('email');
    expect(result.confidence).toBeGreaterThanOrEqual(62);
  });

  test('should match phone field', () => {
    const phoneSignals = {
      ...baseSignals,
      labelText: 'Mobile Number',
      inputType: 'tel'
    };
    const result = matchField(phoneSignals);
    expect(result.mappedTo).toBe('phone');
    expect(result.confidence).toBeGreaterThanOrEqual(72);
  });

  test('should correctly match Workday specific fields (Regression)', () => {
    const workdayPhoneSignals = {
      ...baseSignals,
      ariaLabel: 'Phone Device Type',
      idAttr: 'input-4',
      nameAttr: '',
      // Workday usually hides the real label or uses aria
      precedingText: 'Phone'
    };
    const phoneResult = matchField(workdayPhoneSignals);
    expect(phoneResult.mappedTo).toBe('phone');

    const workdayEmailSignals = {
      ...baseSignals,
      ariaLabel: 'Email Address',
      idAttr: 'input-5',
      inputType: 'text' // sometimes workday uses text instead of email
    };
    const emailResult = matchField(workdayEmailSignals);
    expect(emailResult.mappedTo).toBe('email');
  });

  test('should match education fields', () => {
    const collegeSignals = {
      ...baseSignals,
      labelText: 'University Name'
    };
    expect(matchField(collegeSignals).mappedTo).toBe('college');

    const gradSignals = {
      ...baseSignals,
      labelText: 'Graduation Year'
    };
    expect(matchField(gradSignals).mappedTo).toBe('graduationYear');

    const cgpaSignals = {
      ...baseSignals,
      labelText: 'CGPA'
    };
    expect(matchField(cgpaSignals).mappedTo).toBe('cgpa');
  });

  test('should match professional links', () => {
    const linkedinSignals = {
      ...baseSignals,
      labelText: 'LinkedIn URL'
    };
    expect(matchField(linkedinSignals).mappedTo).toBe('linkedinUrl');

    const githubSignals = {
      ...baseSignals,
      labelText: 'GitHub Profile Link'
    };
    expect(matchField(githubSignals).mappedTo).toBe('githubUrl');

    const resumeSignals = {
      ...baseSignals,
      labelText: 'Upload Resume/CV'
    };
    expect(matchField(resumeSignals).mappedTo).toBe('resumeLink');
  });

  test('should match EEO and visa demographics', () => {
    const workAuthSignals = {
      ...baseSignals,
      labelText: 'Are you authorized to work in India?'
    };
    expect(matchField(workAuthSignals).mappedTo).toBe('eeo_work_auth');

    const sponsorSignals = {
      ...baseSignals,
      labelText: 'Will you now or in the future require visa sponsorship?'
    };
    expect(matchField(sponsorSignals).mappedTo).toBe('eeo_sponsorship');

    const genderSignals = {
      ...baseSignals,
      labelText: 'Select your gender'
    };
    expect(matchField(genderSignals).mappedTo).toBe('eeo_gender');

    const trickyWorkAuthSignals = {
      ...baseSignals,
      labelText: 'Are you legally authorized to work in the United States?'
    };
    expect(matchField(trickyWorkAuthSignals).mappedTo).toBe('eeo_work_auth');

    const trickyDisabilitySignals = {
      ...baseSignals,
      labelText: 'Form CC-305: Voluntary Self-Identification of Disability'
    };
    expect(matchField(trickyDisabilitySignals).mappedTo).toBe('eeo_disability');

    const trickyVeteranSignals = {
      ...baseSignals,
      labelText: 'Protected Veteran Status (Vietnam Era, Special Disabled)'
    };
    expect(matchField(trickyVeteranSignals).mappedTo).toBe('eeo_veteran');
  });

  test('should return null and 0 confidence for completely unrelated signals', () => {
    const unrelatedSignals = {
      ...baseSignals,
      labelText: 'Favourite ice cream flavour'
    };
    const result = matchField(unrelatedSignals);
    expect(result.mappedTo).toBeNull();
    expect(result.confidence).toBe(0);
  });

  test('should correctly expose EEO_VALUE_MAP mappings', () => {
    expect(EEO_VALUE_MAP.gender.male).toContain('male');
    expect(EEO_VALUE_MAP.disability.yes).toContain('yes');
    expect(EEO_VALUE_MAP.veteran.no).toContain('no');
    expect(EEO_VALUE_MAP.workAuthorized.true).toContain('yes');
    expect(EEO_VALUE_MAP.sponsorship.true).toContain('yes');
  });
});
