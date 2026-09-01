import basicResume from "@/generated/template-previews/basic_resume.svg?url";
import impressiveImpression from "@/generated/template-previews/impressive_impression.svg?url";
import metronic from "@/generated/template-previews/metronic.svg?url";
import modernCv from "@/generated/template-previews/modern_cv.svg?url";
import modernCvCover from "@/generated/template-previews/modern_cv_cover.svg?url";
import modernCvCoverAlt from "@/generated/template-previews/modern_cv_cover_alt.svg?url";
import neatCv from "@/generated/template-previews/neat_cv.svg?url";
import neatCvLetter from "@/generated/template-previews/neat_cv_letter.svg?url";
import simpleTechnicalResume from "@/generated/template-previews/simple_technical_resume.svg?url";

/** Build-time gallery images. Vite fingerprints these imports for caching. */
export const TEMPLATE_PREVIEWS: Readonly<Record<string, string>> = {
  basic_resume: basicResume,
  simple_technical_resume: simpleTechnicalResume,
  modern_cv: modernCv,
  neat_cv: neatCv,
  metronic,
  impressive_impression: impressiveImpression,
  modern_cv_cover: modernCvCover,
  modern_cv_cover_alt: modernCvCoverAlt,
  neat_cv_letter: neatCvLetter,
};
