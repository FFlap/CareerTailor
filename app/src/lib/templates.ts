export const RESUME_TEMPLATES = [
  { id: 'basic_resume', label: 'Basic Resume' },
  { id: 'simple_technical_resume', label: 'Simple Technical Resume' },
  { id: 'modern_cv', label: 'Modern CV' },
  { id: 'neat_cv', label: 'Neat CV' },
  { id: 'metronic', label: 'Metronic Resume' },
  { id: 'impressive_impression', label: 'Impressive Impression CV' },
] as const

export const COVER_TEMPLATES = [
  { id: 'modern_cv_cover', label: 'Modern CV Cover' },
  { id: 'modern_cv_cover_alt', label: 'Modern CV Cover Alt' },
  { id: 'neat_cv_letter', label: 'Neat CV Letter' },
] as const

export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]['id']
export type CoverTemplateId = (typeof COVER_TEMPLATES)[number]['id']

