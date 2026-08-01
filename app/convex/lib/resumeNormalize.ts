import { enforceResumeLength, Preferences } from './preferences'

export function normalizeForComparison(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function profileHasCompany(profile: any, company: string) {
  const targetCompany = normalizeForComparison(company)
  if (!targetCompany) return true
  const experience = Array.isArray(profile?.experience) ? profile.experience : []
  return experience.some(
    (role: any) => normalizeForComparison(role?.company) === targetCompany,
  )
}

/** Drop hallucinated target-employer rows unless the profile already has that company. */
export function removeUnsupportedTargetCompanyExperience(
  resume: any,
  profile: any,
  job: any,
) {
  const targetCompany = normalizeForComparison(job?.company)
  if (!targetCompany || profileHasCompany(profile, job?.company)) return resume
  if (!Array.isArray(resume?.experience)) return resume

  return {
    ...resume,
    experience: resume.experience.filter(
      (role: any) => normalizeForComparison(role?.company) !== targetCompany,
    ),
  }
}

export function hasProjectContent(project: any) {
  return Boolean(
    String(project?.name ?? '').trim() ||
      String(project?.link ?? '').trim() ||
      (Array.isArray(project?.technologies) && project.technologies.length) ||
      (Array.isArray(project?.bullets) && project.bullets.length),
  )
}

/** Keep all profile projects; model may reword/reorder but not drop them. */
export function mergeGeneratedProjectsWithProfile(resume: any, profile: any) {
  const profileProjects = Array.isArray(profile?.projects)
    ? profile.projects.filter(hasProjectContent)
    : []
  if (!profileProjects.length) return resume

  const generatedProjects = Array.isArray(resume?.projects)
    ? resume.projects.filter(hasProjectContent)
    : []

  const mergedProjects = profileProjects.map((profileProject: any) => {
    const profileName = normalizeForComparison(profileProject?.name)
    const generatedProject = generatedProjects.find(
      (project: any) =>
        profileName && normalizeForComparison(project?.name) === profileName,
    )
    if (!generatedProject) return profileProject

    return {
      ...profileProject,
      ...generatedProject,
      name: profileProject.name || generatedProject.name || '',
      technologies:
        Array.isArray(generatedProject.technologies) &&
        generatedProject.technologies.length
          ? generatedProject.technologies
          : profileProject.technologies || [],
      link: profileProject.link || generatedProject.link || '',
      bullets:
        Array.isArray(generatedProject.bullets) && generatedProject.bullets.length
          ? generatedProject.bullets
          : profileProject.bullets || [],
    }
  })

  return {
    ...resume,
    projects: mergedProjects,
  }
}

export function normalizeGeneratedResume(
  resume: any,
  profile: any,
  job: any,
  preferences?: Preferences,
) {
  const merged = mergeGeneratedProjectsWithProfile(
    removeUnsupportedTargetCompanyExperience(resume, profile, job),
    profile,
  )
  return preferences ? enforceResumeLength(merged, preferences.targetLength) : merged
}
