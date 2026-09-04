import type { CoverTemplateId, ResumeTemplateId } from "@/lib/templates";

export type AnswerKey = "goal" | "stage" | "field";

export type Answers = Partial<Record<AnswerKey, string>>;

export type Choice = {
  id: string;
  label: string;
  hint: string;
};

export type Question = {
  key: AnswerKey;
  
  eyebrow: string;
  title: string;
  
  note: string;
  choices: Choice[];
};

export const QUESTIONS: Question[] = [
  {
    key: "goal",
    eyebrow: "Why you're here",
    title: "What are you working on?",
    note: "This only changes what we put in front of you first.",
    choices: [
      {
        id: "hunting",
        label: "A full job hunt",
        hint: "Many roles, and a different résumé for each one.",
      },
      {
        id: "one_role",
        label: "One specific role",
        hint: "There is a posting open in another tab right now.",
      },
      {
        id: "refresh",
        label: "Refreshing an old résumé",
        hint: "It exists, it is out of date, and it shows.",
      },
      {
        id: "looking",
        label: "Having a look around",
        hint: "Show me what this does before I commit anything.",
      },
    ],
  },
  {
    key: "stage",
    eyebrow: "How much there is to fit",
    title: "How far into your career are you?",
    note: "Sets the default length, and how hard we trim to hold it.",
    choices: [
      {
        id: "student",
        label: "Student or new grad",
        hint: "Coursework and projects carry most of the page.",
      },
      {
        id: "early",
        label: "A few years in",
        hint: "One or two roles, and the work speaks for itself.",
      },
      {
        id: "mid",
        label: "Mid-career",
        hint: "Enough history that something has to be cut.",
      },
      {
        id: "senior",
        label: "Senior or leading a team",
        hint: "Scope and outcomes matter more than the task list.",
      },
    ],
  },
  {
    key: "field",
    eyebrow: "What the page has to look like",
    title: "What kind of work is it?",
    note: "Picks the template we start you on — you can change it next.",
    choices: [
      {
        id: "engineering",
        label: "Engineering",
        hint: "Dense, technical, stack-forward.",
      },
      {
        id: "design",
        label: "Design or creative",
        hint: "The layout is part of the argument.",
      },
      {
        id: "data",
        label: "Data or research",
        hint: "Methods, publications, and precise figures.",
      },
      {
        id: "business",
        label: "Business or operations",
        hint: "Conventional, and readable by a recruiter in ten seconds.",
      },
    ],
  },
];

const TEMPLATE_BY_FIELD: Record<
  string,
  { resume: ResumeTemplateId; cover: CoverTemplateId }
> = {
  engineering: { resume: "simple_technical_resume", cover: "modern_cv_cover" },
  design: { resume: "modern_cv", cover: "modern_cv_cover" },
  data: { resume: "neat_cv", cover: "neat_cv_letter" },
  business: { resume: "metronic", cover: "modern_cv_cover_alt" },
};

const FALLBACK = {
  resume: "basic_resume" as ResumeTemplateId,
  cover: "modern_cv_cover" as CoverTemplateId,
};


export function suggestedTemplates(answers: Answers) {
  return (answers.field && TEMPLATE_BY_FIELD[answers.field]) || FALLBACK;
}


export function suggestedLength(answers: Answers) {
  return answers.stage === "mid" || answers.stage === "senior"
    ? "2_pages"
    : "1_page";
}


export function closingLine(answers: Answers) {
  switch (answers.goal) {
    case "hunting":
      return "Keep postings as you find them, and write a tailored résumé against each one.";
    case "one_role":
      return "Paste that posting into Generate and you will have a tailored résumé in about a minute.";
    case "refresh":
      return "Your history is in now. Generate rewrites it against whatever role you point it at.";
    default:
      return "Generate a document from your profile alone, and see the whole thing work end to end.";
  }
}
