import { ValidatorFn } from '@angular/forms';

export const differentLanguagesValidator: ValidatorFn = (control) => {
  const sourceLanguageId = control.get('sourceLanguageId')?.value;
  const targetLanguageId = control.get('targetLanguageId')?.value;
  return sourceLanguageId && targetLanguageId && sourceLanguageId === targetLanguageId
    ? { sameLanguage: true }
    : null;
};
