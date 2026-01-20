import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import { extractTextFromResume } from '@/lib/extractText'
import { isAcceptedMimeType, type ResumeUploadState } from '@/lib/resumeUpload'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

type ProfileDraft = {
  personal: {
    fullName: string
    email: string
    phone: string
    location: string
    links: Array<{ label: string; url: string }>
  }
  summary: string
  education: Array<{
    degree: string
    major: string
    institution: string
    location: string
    startDate: string
    endDate: string
    bullets: string[]
  }>
  experience: Array<{
    title: string
    company: string
    location: string
    startDate: string
    endDate: string
    bullets: string[]
  }>
  skills: Array<{ category: string; items: string[] }>
  projects: Array<{
    name: string
    technologies: string[]
    link: string
    bullets: string[]
  }>
}

const EMPTY_PROFILE: ProfileDraft = {
  personal: { fullName: '', email: '', phone: '', location: '', links: [] },
  summary: '',
  education: [],
  experience: [],
  skills: [],
  projects: [],
}

function OnboardingPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AuthLoading>

      <Unauthenticated>
        <p>
          You need to <Link to="/sign-up">create an account</Link> to start.
        </p>
      </Unauthenticated>

      <Authenticated>
        <OnboardingContent />
      </Authenticated>
    </main>
  )
}

// Merge parsed resume data into profile, preserving existing non-empty values
function mergeProfileData(existing: ProfileDraft, parsed: unknown): ProfileDraft {
  const p = parsed as Partial<ProfileDraft>
  return {
    personal: {
      fullName: p.personal?.fullName || existing.personal.fullName,
      email: p.personal?.email || existing.personal.email,
      phone: p.personal?.phone || existing.personal.phone,
      location: p.personal?.location || existing.personal.location,
      links: p.personal?.links?.length ? p.personal.links : existing.personal.links,
    },
    summary: p.summary || existing.summary,
    education: p.education?.length ? p.education.map((edu) => ({
      degree: edu.degree || '',
      major: edu.major || '',
      institution: edu.institution || '',
      location: edu.location || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      bullets: edu.bullets || [],
    })) : existing.education,
    experience: p.experience?.length ? p.experience.map((exp) => ({
      title: exp.title || '',
      company: exp.company || '',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      bullets: exp.bullets || [],
    })) : existing.experience,
    skills: p.skills?.length ? p.skills.map((skill) => ({
      category: skill.category || '',
      items: skill.items || [],
    })) : existing.skills,
    projects: p.projects?.length ? p.projects.map((proj) => ({
      name: proj.name || '',
      technologies: proj.technologies || [],
      link: proj.link || '',
      bullets: proj.bullets || [],
    })) : existing.projects,
  }
}

function OnboardingContent() {
  const profileDoc = useQuery(api.profiles.myProfile, {})
  const upsert = useMutation(api.profiles.upsertMyProfile)
  const parseResume = useAction(api.resumeParsing.parseResumeText)
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE)
  const [status, setStatus] = useState<string>('')
  const [uploadState, setUploadState] = useState<ResumeUploadState>({ status: 'idle' })
  const initialized = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profileDoc === undefined || initialized.current) return
    const existing = (profileDoc as any)?.profile
    setProfile((existing as ProfileDraft) || EMPTY_PROFILE)
    initialized.current = true
  }, [profileDoc])

  async function save() {
    setStatus('Saving…')
    try {
      await upsert({ profile })
      setStatus('Saved. You can generate now.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // MIME type validation
    if (!isAcceptedMimeType(file.type)) {
      setUploadState({
        status: 'error',
        fileName: file.name,
        error: 'Please upload a PDF or DOCX file',
      })
      return
    }

    try {
      setUploadState({ status: 'extracting', fileName: file.name })
      const text = await extractTextFromResume(file)

      setUploadState({ status: 'parsing', fileName: file.name })
      const parsed = await parseResume({ resumeText: text, model: 'xiaomi/mimo-v2-flash:free' })

      // Merge parsed data into profile state
      setProfile((prev) => mergeProfileData(prev, parsed))
      setUploadState({ status: 'success', fileName: file.name })
    } catch (error) {
      setUploadState({
        status: 'error',
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Failed to parse resume',
      })
    }

    // Reset file input so same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>

      {/* Resume Upload Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upload Existing Resume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your current resume to auto-fill the form below.
          </p>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              disabled={uploadState.status === 'extracting' || uploadState.status === 'parsing'}
              className="max-w-xs"
            />
            {uploadState.status !== 'idle' && (
              <span className={`text-sm ${uploadState.status === 'error' ? 'text-destructive' : uploadState.status === 'success' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {uploadState.status === 'extracting' && 'Extracting text...'}
                {uploadState.status === 'parsing' && 'Parsing with AI...'}
                {uploadState.status === 'success' && 'Form filled!'}
                {uploadState.status === 'error' && uploadState.error}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resume Details Form */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resume Details</CardTitle>
        </CardHeader>
          <CardContent className="space-y-6">
            {profileDoc === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-sm font-medium">Personal</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        value={profile.personal.fullName}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            personal: { ...p.personal, fullName: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={profile.personal.email}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            personal: { ...p.personal, email: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profile.personal.phone}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            personal: { ...p.personal, phone: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={profile.personal.location}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            personal: { ...p.personal, location: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Links</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          personal: {
                            ...p.personal,
                            links: [...p.personal.links, { label: '', url: '' }],
                          },
                        }))
                      }
                    >
                      Add link
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {profile.personal.links.length ? (
                      profile.personal.links.map((link, idx) => (
                        <div key={idx} className="grid gap-3 md:grid-cols-5">
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Label</Label>
                            <Input
                              value={link.label}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.personal.links]
                                  next[idx] = { ...next[idx], label: e.target.value }
                                  return { ...p, personal: { ...p.personal, links: next } }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2 md:col-span-3">
                            <Label>URL</Label>
                            <div className="flex gap-2">
                              <Input
                                value={link.url}
                                onChange={(e) =>
                                  setProfile((p) => {
                                    const next = [...p.personal.links]
                                    next[idx] = { ...next[idx], url: e.target.value }
                                    return { ...p, personal: { ...p.personal, links: next } }
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setProfile((p) => {
                                    const next = p.personal.links.filter((_, i) => i !== idx)
                                    return { ...p, personal: { ...p.personal, links: next } }
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Optional (LinkedIn, GitHub, website).
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-medium">Summary</h2>
                  <Textarea
                    value={profile.summary}
                    onChange={(e) => setProfile((p) => ({ ...p, summary: e.target.value }))}
                    className="min-h-[120px]"
                    placeholder="2–3 sentences about your background and strengths."
                  />
                </section>

                {/* Experience Section */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Experience</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          experience: [
                            ...p.experience,
                            { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] },
                          ],
                        }))
                      }
                    >
                      Add experience
                    </Button>
                  </div>
                  {profile.experience.length ? (
                    profile.experience.map((exp, idx) => (
                      <div key={idx} className="space-y-3 rounded-md border p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Job title</Label>
                            <Input
                              value={exp.title}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.experience]
                                  next[idx] = { ...next[idx], title: e.target.value }
                                  return { ...p, experience: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Company</Label>
                            <Input
                              value={exp.company}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.experience]
                                  next[idx] = { ...next[idx], company: e.target.value }
                                  return { ...p, experience: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Location</Label>
                            <Input
                              value={exp.location}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.experience]
                                  next[idx] = { ...next[idx], location: e.target.value }
                                  return { ...p, experience: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                              <Label>Start date</Label>
                              <Input
                                placeholder="Jan 2023"
                                value={exp.startDate}
                                onChange={(e) =>
                                  setProfile((p) => {
                                    const next = [...p.experience]
                                    next[idx] = { ...next[idx], startDate: e.target.value }
                                    return { ...p, experience: next }
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>End date</Label>
                              <Input
                                placeholder="Present"
                                value={exp.endDate}
                                onChange={(e) =>
                                  setProfile((p) => {
                                    const next = [...p.experience]
                                    next[idx] = { ...next[idx], endDate: e.target.value }
                                    return { ...p, experience: next }
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Bullets (achievements)</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setProfile((p) => {
                                  const next = [...p.experience]
                                  next[idx] = { ...next[idx], bullets: [...next[idx].bullets, ''] }
                                  return { ...p, experience: next }
                                })
                              }
                            >
                              Add bullet
                            </Button>
                          </div>
                          {exp.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-2">
                              <Input
                                value={bullet}
                                placeholder="Describe an achievement or responsibility"
                                onChange={(e) =>
                                  setProfile((p) => {
                                    const next = [...p.experience]
                                    const bullets = [...next[idx].bullets]
                                    bullets[bIdx] = e.target.value
                                    next[idx] = { ...next[idx], bullets }
                                    return { ...p, experience: next }
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setProfile((p) => {
                                    const next = [...p.experience]
                                    next[idx] = { ...next[idx], bullets: next[idx].bullets.filter((_, i) => i !== bIdx) }
                                    return { ...p, experience: next }
                                  })
                                }
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setProfile((p) => ({
                              ...p,
                              experience: p.experience.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove experience
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No experience added yet.</p>
                  )}
                </section>

                {/* Education Section */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Education</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          education: [
                            ...p.education,
                            { degree: '', major: '', institution: '', location: '', startDate: '', endDate: '', bullets: [] },
                          ],
                        }))
                      }
                    >
                      Add education
                    </Button>
                  </div>
                  {profile.education.length ? (
                    profile.education.map((edu, idx) => (
                      <div key={idx} className="space-y-3 rounded-md border p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Degree</Label>
                            <Input
                              placeholder="Bachelor of Science"
                              value={edu.degree}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], degree: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Major</Label>
                            <Input
                              placeholder="Computer Science"
                              value={edu.major}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], major: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Institution</Label>
                            <Input
                              value={edu.institution}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], institution: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Location</Label>
                            <Input
                              value={edu.location}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], location: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Start date</Label>
                            <Input
                              placeholder="Sep 2020"
                              value={edu.startDate}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], startDate: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>End date</Label>
                            <Input
                              placeholder="May 2024"
                              value={edu.endDate}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.education]
                                  next[idx] = { ...next[idx], endDate: e.target.value }
                                  return { ...p, education: next }
                                })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setProfile((p) => ({
                              ...p,
                              education: p.education.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove education
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No education added yet.</p>
                  )}
                </section>

                {/* Skills Section */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Skills</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          skills: [...p.skills, { category: '', items: [] }],
                        }))
                      }
                    >
                      Add skill category
                    </Button>
                  </div>
                  {profile.skills.length ? (
                    profile.skills.map((skill, idx) => (
                      <div key={idx} className="space-y-3 rounded-md border p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Category</Label>
                            <Input
                              placeholder="Programming Languages"
                              value={skill.category}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.skills]
                                  next[idx] = { ...next[idx], category: e.target.value }
                                  return { ...p, skills: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Items (comma-separated)</Label>
                            <Input
                              placeholder="Python, JavaScript, TypeScript"
                              value={skill.items.join(', ')}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.skills]
                                  next[idx] = { ...next[idx], items: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                                  return { ...p, skills: next }
                                })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setProfile((p) => ({
                              ...p,
                              skills: p.skills.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove category
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No skills added yet.</p>
                  )}
                </section>

                {/* Projects Section */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Projects</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          projects: [...p.projects, { name: '', technologies: [], link: '', bullets: [''] }],
                        }))
                      }
                    >
                      Add project
                    </Button>
                  </div>
                  {profile.projects.length ? (
                    profile.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-3 rounded-md border p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Project name</Label>
                            <Input
                              value={proj.name}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.projects]
                                  next[idx] = { ...next[idx], name: e.target.value }
                                  return { ...p, projects: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Link (optional)</Label>
                            <Input
                              placeholder="https://github.com/..."
                              value={proj.link}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.projects]
                                  next[idx] = { ...next[idx], link: e.target.value }
                                  return { ...p, projects: next }
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Technologies (comma-separated)</Label>
                            <Input
                              placeholder="React, Node.js, PostgreSQL"
                              value={proj.technologies.join(', ')}
                              onChange={(e) =>
                                setProfile((p) => {
                                  const next = [...p.projects]
                                  next[idx] = { ...next[idx], technologies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                                  return { ...p, projects: next }
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Description bullets</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setProfile((p) => {
                                  const next = [...p.projects]
                                  next[idx] = { ...next[idx], bullets: [...next[idx].bullets, ''] }
                                  return { ...p, projects: next }
                                })
                              }
                            >
                              Add bullet
                            </Button>
                          </div>
                          {proj.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-2">
                              <Input
                                value={bullet}
                                placeholder="Describe what you built or achieved"
                                onChange={(e) =>
                                  setProfile((p) => {
                                    const next = [...p.projects]
                                    const bullets = [...next[idx].bullets]
                                    bullets[bIdx] = e.target.value
                                    next[idx] = { ...next[idx], bullets }
                                    return { ...p, projects: next }
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setProfile((p) => {
                                    const next = [...p.projects]
                                    next[idx] = { ...next[idx], bullets: next[idx].bullets.filter((_, i) => i !== bIdx) }
                                    return { ...p, projects: next }
                                  })
                                }
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setProfile((p) => ({
                              ...p,
                              projects: p.projects.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove project
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No projects added yet.</p>
                  )}
                </section>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={save}>
                    Save
                  </Button>
                  <Button asChild type="button" variant="secondary">
                    <Link to="/generate">Continue to generate</Link>
                  </Button>
                  <span className="text-sm text-muted-foreground">{status}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </>
  )
}

