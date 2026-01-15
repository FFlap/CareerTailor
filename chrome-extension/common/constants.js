export const RESUME_TEMPLATES = {
  basic_resume: {
    id: "basic_resume",
    label: "Basic Resume",
    format: "typst",
    path: "templates/basic-resume/main.typ",
    assets: []
  },
  simple_technical_resume: {
    id: "simple_technical_resume",
    label: "Simple Technical Resume",
    format: "typst",
    path: "templates/simple-technical-resume/main.typ",
    assets: []
  },
  modern_cv: {
    id: "modern_cv",
    label: "Modern CV",
    format: "typst",
    path: "templates/modern-cv/resume.typ",
    assets: ["templates/modern-cv/profile.png"]
  },
  neat_cv: {
    id: "neat_cv",
    label: "Neat CV",
    format: "typst",
    path: "templates/neat-cv/cv.typ",
    assets: ["templates/neat-cv/profile.png", "templates/neat-cv/publications.yml"]
  },
  metronic: {
    id: "metronic",
    label: "Metronic Resume",
    format: "typst",
    path: "templates/metronic/main.typ",
    assets: []
  },
  impressive_impression: {
    id: "impressive_impression",
    label: "Impressive Impression CV",
    format: "typst",
    path: "templates/impressive-impression/cv.typ",
    assets: [
      "templates/impressive-impression/utils.typ",
      "templates/impressive-impression/theme.typ",
      "templates/impressive-impression/assets/profile.png",
      "templates/impressive-impression/assets/signature.svg",
      "templates/impressive-impression/assets/flags/fr.svg",
      "templates/impressive-impression/assets/flags/gb.svg",
      "templates/impressive-impression/assets/flags/gr.svg"
    ]
  }
};

export const COVER_TEMPLATES = {
  modern_cv_cover: {
    id: "modern_cv_cover",
    label: "Modern CV Cover",
    format: "typst",
    path: "templates/modern-cv/coverletter.typ",
    assets: ["templates/modern-cv/profile.png"]
  },
  modern_cv_cover_alt: {
    id: "modern_cv_cover_alt",
    label: "Modern CV Cover Alt",
    format: "typst",
    path: "templates/modern-cv/coverletter2.typ",
    assets: ["templates/modern-cv/profile.png"]
  },
  neat_cv_letter: {
    id: "neat_cv_letter",
    label: "Neat CV Letter",
    format: "typst",
    path: "templates/neat-cv/letter.typ",
    assets: ["templates/neat-cv/profile.png"]
  }
};

export const DOC_TYPES = [
  { id: "resume", label: "Resume or CV" },
  { id: "cover_letter", label: "Cover Letter" },
  { id: "both", label: "Both" }
];

export const GEMINI_MODEL = "gemini-2.5-flash-lite";

export const DEFAULT_RESUME_TEMPLATE_ID = "basic_resume";
export const DEFAULT_COVER_TEMPLATE_ID = "modern_cv_cover";
