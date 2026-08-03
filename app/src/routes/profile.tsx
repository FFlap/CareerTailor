import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'

import SidebarLayout from '@/components/SidebarLayout'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/page'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import { extractTextFromResume } from '@/lib/extractText'
import { DEFAULT_MODEL } from '@/lib/models'
import { isAcceptedMimeType, type ResumeUploadState } from '@/lib/resumeUpload'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
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

const SECTIONS = [
  { id: 'personal', label: 'Personal Details', icon: 'person' },
  { id: 'social', label: 'Social Links', icon: 'link' },
  { id: 'summary', label: 'Professional Summary', icon: 'description' },
  { id: 'experience', label: 'Work Experience', icon: 'work' },
  { id: 'education', label: 'Education', icon: 'school' },
  { id: 'skills', label: 'Skills', icon: 'psychology' },
  { id: 'projects', label: 'Projects', icon: 'code' },
]

function ProfilePage() {
  return (
    <SidebarLayout>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <AuthLoading>
          <div className="flex justify-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>
          </div>
        </AuthLoading>

        <Unauthenticated>
          <EmptyState
            title="Create an account to build your profile"
            description="Your profile is the source every generated document draws from."
            action={
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                Create account
              </Link>
            }
          />
        </Unauthenticated>

        <Authenticated>
          <ProfileContent />
        </Authenticated>
      </div>
    </SidebarLayout>
  )
}

/** Fills blanks from the parsed resume; never overwrites what is already there. */
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

function ProfileContent() {
  const profileDoc = useQuery(api.profiles.myProfile, {})
  const upsert = useMutation(api.profiles.upsertMyProfile)
  const parseResume = useAction(api.resumeParsing.parseResumeText)
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE)
  const [status, setStatus] = useState<string>('')
  const [uploadState, setUploadState] = useState<ResumeUploadState>({ status: 'idle' })
  const initialized = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function scrollToSection(id: string) {
    const element = document.getElementById(id)
    if (element) {
      const headerOffset = 100
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  useEffect(() => {
    if (profileDoc === undefined || initialized.current) return
    const existing = (profileDoc as any)?.profile
    setProfile((existing as ProfileDraft) || EMPTY_PROFILE)
    initialized.current = true
  }, [profileDoc])

  async function save() {
    setStatus('Saving...')
    try {
      await upsert({ profile })
      setStatus('Saved successfully')
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

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
      const parsed = await parseResume({ resumeText: text, model: DEFAULT_MODEL })

      setProfile((prev) => mergeProfileData(prev, parsed))
      setUploadState({ status: 'success', fileName: file.name })
    } catch (error) {
      setUploadState({
        status: 'error',
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Failed to parse resume',
      })
    }

    // Clearing the value lets the same file be picked again.
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (profileDoc === undefined) {
    return null
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Everything generated here is written from this page. Upload a résumé to fill it in, or type it out."
      />
      <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white p-6 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
        <div className="flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Start from an existing résumé
          </h3>
          <p className="mb-4 mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">
            A PDF or DOCX is read once to fill in the fields below. You can change
            anything afterwards.
          </p>

          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              disabled={uploadState.status === 'extracting' || uploadState.status === 'parsing'}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <span className="pointer-events-none inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Choose a file
            </span>
          </div>

          {uploadState.status !== 'idle' && (
            <div
              className={`mt-3 flex items-center gap-2 text-xs ${
                uploadState.status === 'error'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {uploadState.status === 'extracting' && (
                <>Extracting text…</>
              )}
              {uploadState.status === 'parsing' && (
                <>Reading it with AI…</>
              )}
              {uploadState.status === 'success' && (
                <>Filled in from {uploadState.fileName}.</>
              )}
              {uploadState.status === 'error' && (
                <>{uploadState.error}</>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block sticky top-24">
          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="grid gap-4 lg:col-span-9">
        <Panel id="personal">
          <PanelHeader title="Personal Details" />
          <div className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Alex Rivera"
                  className="bg-white dark:bg-slate-950"
                  value={profile.personal.fullName}
                  onChange={(e) => setProfile(p => ({ ...p, personal: { ...p.personal, fullName: e.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. alex@example.com"
                  className="bg-white dark:bg-slate-950"
                  value={profile.personal.email}
                  onChange={(e) => setProfile(p => ({ ...p, personal: { ...p.personal, email: e.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="e.g. (555) 123-4567"
                  className="bg-white dark:bg-slate-950"
                  value={profile.personal.phone}
                  onChange={(e) => setProfile(p => ({ ...p, personal: { ...p.personal, phone: e.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium text-slate-700 dark:text-slate-300">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. San Francisco, CA"
                  className="bg-white dark:bg-slate-950"
                  value={profile.personal.location}
                  onChange={(e) => setProfile(p => ({ ...p, personal: { ...p.personal, location: e.target.value } }))}
                />
              </div>
            </div>
          </div>
        </Panel>
        <Panel id="social">
          <PanelHeader
            title="Social Links"
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setProfile(p => ({...p, personal: {...p.personal, links: [...p.personal.links, { label: '', url: '' }]}}))}>
                Add link
              </Button>}
          />
          <div className="space-y-4 p-4">
            {profile.personal.links.length > 0 ? (
              profile.personal.links.map((link, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-1/3">
                    <Input placeholder="Label (e.g. LinkedIn)" value={link.label} onChange={(e) => {
                      const next = [...profile.personal.links]; next[idx].label = e.target.value;
                      setProfile(p => ({...p, personal: {...p.personal, links: next}}));
                    }} />
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input placeholder="URL" value={link.url} onChange={(e) => {
                      const next = [...profile.personal.links]; next[idx].url = e.target.value;
                      setProfile(p => ({...p, personal: {...p.personal, links: next}}));
                    }} />
                    <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => {
                      const next = profile.personal.links.filter((_, i) => i !== idx);
                      setProfile(p => ({...p, personal: {...p.personal, links: next}}));
                    }}>
                      <span aria-hidden>×</span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
               <p className="text-sm text-slate-500 italic">No links added. Add your LinkedIn, GitHub, or Portfolio.</p>
            )}
          </div>
        </Panel>
        <Panel id="summary">
          <PanelHeader title="Professional Summary" />
          <div className="p-4">
            <Textarea 
              value={profile.summary} 
              onChange={(e) => setProfile(p => ({...p, summary: e.target.value}))} 
              className="min-h-[120px] resize-none bg-white dark:bg-slate-950"
              placeholder="Briefly describe your background, key strengths, and what you’re looking for..." 
            />
          </div>
        </Panel>
        <Panel id="experience">
          <PanelHeader
            title="Work Experience"
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setProfile(p => ({...p, experience: [...p.experience, { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] }]}))}>
                Add Job
              </Button>}
          />
          <div className="space-y-4 p-4">
            {profile.experience.length > 0 ? (
              profile.experience.map((exp, idx) => (
                <div key={idx} className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-2 h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={() => setProfile(p => ({...p, experience: p.experience.filter((_, i) => i !== idx)}))}
                  >
                    </Button>
                  
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job Title</Label>
                      <Input value={exp.title} onChange={(e) => {
                        const next = [...profile.experience]; next[idx].title = e.target.value;
                        setProfile(p => ({...p, experience: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Senior Product Designer" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</Label>
                      <Input value={exp.company} onChange={(e) => {
                         const next = [...profile.experience]; next[idx].company = e.target.value;
                         setProfile(p => ({...p, experience: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Acme Corp" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</Label>
                      <Input value={exp.startDate} onChange={(e) => {
                         const next = [...profile.experience]; next[idx].startDate = e.target.value;
                         setProfile(p => ({...p, experience: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Mar 2021" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</Label>
                      <Input value={exp.endDate} onChange={(e) => {
                         const next = [...profile.experience]; next[idx].endDate = e.target.value;
                         setProfile(p => ({...p, experience: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Present" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Key Achievements</Label>
                       <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => {
                          const next = [...profile.experience]; next[idx].bullets.push('');
                          setProfile(p => ({...p, experience: next}));
                       }}>+ Add Bullet</Button>
                    </div>
                    {exp.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <Input 
                          value={bullet} 
                          onChange={(e) => {
                            const next = [...profile.experience]; next[idx].bullets[bIdx] = e.target.value;
                            setProfile(p => ({...p, experience: next}));
                          }}
                          className="bg-white dark:bg-slate-950" 
                          placeholder="Describe an impact you made..."
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-slate-300 hover:text-red-500" onClick={() => {
                           const next = [...profile.experience]; next[idx].bullets = next[idx].bullets.filter((_, i) => i !== bIdx);
                           setProfile(p => ({...p, experience: next}));
                        }}>
                          <span aria-hidden>×</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 italic">No experience added yet.</p>
            )}
          </div>
        </Panel>
        <Panel id="education">
          <PanelHeader
            title="Education"
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setProfile(p => ({...p, education: [...p.education, { degree: '', major: '', institution: '', location: '', startDate: '', endDate: '', bullets: [] }]}))}>
                Add Education
              </Button>}
          />
          <div className="space-y-4 p-4">
             {profile.education.length > 0 ? (
              profile.education.map((edu, idx) => (
                <div key={idx} className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-2 h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={() => setProfile(p => ({...p, education: p.education.filter((_, i) => i !== idx)}))}
                  >
                    </Button>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Institution</Label>
                      <Input value={edu.institution} onChange={(e) => {
                         const next = [...profile.education]; next[idx].institution = e.target.value;
                         setProfile(p => ({...p, education: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Stanford University" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Degree</Label>
                       <Input value={edu.degree} onChange={(e) => {
                         const next = [...profile.education]; next[idx].degree = e.target.value;
                         setProfile(p => ({...p, education: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Bachelor of Science" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</Label>
                      <Input value={edu.startDate} onChange={(e) => {
                         const next = [...profile.education]; next[idx].startDate = e.target.value;
                         setProfile(p => ({...p, education: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. Sep 2018" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</Label>
                      <Input value={edu.endDate} onChange={(e) => {
                         const next = [...profile.education]; next[idx].endDate = e.target.value;
                         setProfile(p => ({...p, education: next}));
                      }} className="bg-white dark:bg-slate-950" placeholder="e.g. May 2022" />
                    </div>
                  </div>
                </div>
              ))
             ) : (
                <p className="text-sm text-slate-500 italic">No education added yet.</p>
             )}
          </div>
        </Panel>
        <Panel id="skills">
          <PanelHeader
            title="Skills"
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setProfile(p => ({...p, skills: [...p.skills, { category: '', items: [] }]}))}>
                Add Category
              </Button>}
          />
           <div className="space-y-4 p-4">
            {profile.skills.length > 0 ? (
               profile.skills.map((skill, idx) => (
                 <div key={idx} className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => setProfile(p => ({...p, skills: p.skills.filter((_, i) => i !== idx)}))}
                    >
                      </Button>
                    <div className="grid gap-4 md:grid-cols-3">
                       <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</Label>
                          <Input value={skill.category} onChange={(e) => {
                            const next = [...profile.skills]; next[idx].category = e.target.value;
                            setProfile(p => ({...p, skills: next}));
                          }} className="bg-white dark:bg-slate-950" placeholder="e.g. Languages" />
                       </div>
                       <div className="md:col-span-2 space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Skills (comma separated)</Label>
                          <Input value={skill.items.join(', ')} onChange={(e) => {
                             const next = [...profile.skills]; next[idx].items = e.target.value.split(',').map(s=>s.trim());
                             setProfile(p => ({...p, skills: next}));
                          }} className="bg-white dark:bg-slate-950" placeholder="e.g. Python, SQL, React" />
                       </div>
                    </div>
                 </div>
               ))
            ) : (
               <p className="text-sm text-slate-500 italic">No skills added yet.</p>
            )}
           </div>
        </Panel>
        <Panel id="projects">
           <PanelHeader
            title="Projects"
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setProfile(p => ({...p, projects: [...p.projects, { name: '', technologies: [], link: '', bullets: [''] }]}))}>
                Add Project
              </Button>}
          />
           <div className="space-y-4 p-4">
              {profile.projects.length > 0 ? (
                 profile.projects.map((proj, idx) => (
                    <div key={idx} className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                       <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-2 h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => setProfile(p => ({...p, projects: p.projects.filter((_, i) => i !== idx)}))}
                        >
                          </Button>
                        <div className="grid gap-4 md:grid-cols-2">
                           <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project Name</Label>
                              <Input value={proj.name} onChange={(e) => {
                                 const next = [...profile.projects]; next[idx].name = e.target.value;
                                 setProfile(p => ({...p, projects: next}));
                              }} className="bg-white dark:bg-slate-950" placeholder="e.g. CareerTailor" />
                           </div>
                           <div className="space-y-2">
                               <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project Link</Label>
                               <Input value={proj.link} onChange={(e) => {
                                 const next = [...profile.projects]; next[idx].link = e.target.value;
                                 setProfile(p => ({...p, projects: next}));
                              }} className="bg-white dark:bg-slate-950" placeholder="https://..." />
                           </div>
                           <div className="md:col-span-2 space-y-2">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Technologies (comma separated)</Label>
                              <Input value={proj.technologies.join(', ')} onChange={(e) => {
                                 const next = [...profile.projects]; next[idx].technologies = e.target.value.split(',').map(s=>s.trim());
                                 setProfile(p => ({...p, projects: next}));
                              }} className="bg-white dark:bg-slate-950" placeholder="React, Convex, Tailwind" />
                           </div>
                        </div>
                    </div>
                 ))
              ) : (
                 <p className="text-sm text-slate-500 italic">No projects added yet.</p>
              )}
           </div>
        </Panel>

        </div>
      </div>
      <div className="sticky bottom-6 z-10 flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
         <div className="flex items-center gap-3">
            <span className={`flex h-2 w-2 rounded-full ${status === 'Saving...' ? 'bg-yellow-400 animate-pulse' : status ? 'bg-green-500' : 'bg-slate-300'}`} />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{status || 'Ready to save'}</p>
         </div>
         <div className="flex gap-4">
             <Link to="/dashboard" className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Cancel
             </Link>
             <Button onClick={save} disabled={status === 'Saving...'} className="min-w-[120px] bg-primary hover:bg-primary/90">
                {status === 'Saving...' ? 'Saving...' : 'Save Profile'}
             </Button>
         </div>
      </div>
    </div>
  )
}

