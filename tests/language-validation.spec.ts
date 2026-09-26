import '@angular/compiler';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { differentLanguagesValidator } from '../src/app/shared/utils/language-validation';

describe('differentLanguagesValidator', () => {
  it('rejects equal source and target languages', () => {
    const form = new FormGroup({
      sourceLanguageId: new FormControl('en'),
      targetLanguageId: new FormControl('en'),
    });
    expect(differentLanguagesValidator(form)).toEqual({ sameLanguage: true });
  });

  it('accepts different or incomplete language selections', () => {
    const different = new FormGroup({
      sourceLanguageId: new FormControl('en'),
      targetLanguageId: new FormControl('vi'),
    });
    const incomplete = new FormGroup({
      sourceLanguageId: new FormControl('en'),
      targetLanguageId: new FormControl(''),
    });
    expect(differentLanguagesValidator(different)).toBeNull();
    expect(differentLanguagesValidator(incomplete)).toBeNull();
  });
});
