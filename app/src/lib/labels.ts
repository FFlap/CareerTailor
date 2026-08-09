export function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/** Board names are proper nouns; a bare hostname is already how it is written. */
const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  ziprecruiter: "ZipRecruiter",
  monster: "Monster",
  dice: "Dice",
  wellfound: "Wellfound",
  simplyhired: "SimplyHired",
  seek: "SEEK",
  extension: "Extension",
  manual: "Added by hand",
};

export function sourceLabel(key: string) {
  const known = SOURCE_LABEL[key.toLowerCase()];
  if (known) return known;
  return key.includes(".") ? key : titleCase(key);
}
