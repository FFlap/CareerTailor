export const DEFAULT_PROFILE = {
  personal: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    links: []
  },
  summary: "",
  education: [],
  experience: [],
  skills: [],
  projects: []
};

export const DEFAULT_SETTINGS = {
  resumeTemplate: "basic_resume",
  coverTemplate: "modern_cv_cover",
  tone: "professional",
  targetLength: "1_page",
  renderer: {
    mode: "wasm",
    endpointUrl: ""
  }
};

export const DEFAULT_USAGE_STATS = {
  total_calls: 0,
  success_calls: 0,
  error_calls: 0,
  rate_limit_errors: 0,
  token_total: 0,
  token_prompt: 0,
  token_candidates: 0,
  daily: {},
  weekly: {},
  last_errors: []
};

export const DEFAULT_STORAGE = {
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  jobs: {},
  api: {
    geminiKey: ""
  },
  usage_stats: DEFAULT_USAGE_STATS,
  current_job: null,
  preview_payload: null
};
