import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, Unauthenticated } from 'convex/react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const [isDark, setIsDark] = useState(false)

  // Mirror the current global theme without forcing it.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleDarkMode = () => setIsDark(!isDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-300 min-h-screen">
      <header className="fixed top-0 w-full z-50 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md bg-white/70 dark:bg-slate-900/70">
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">description</span>
            <span className="text-xl font-bold tracking-tight">Career<span className="text-primary">Tailor</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
            <a className="hover:text-primary transition-colors" href="#">Features</a>
            <a className="hover:text-primary transition-colors" href="#">Templates</a>
            <a className="hover:text-primary transition-colors" href="#">Pricing</a>
            <button 
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:scale-110 transition-transform" 
              onClick={toggleDarkMode}
              aria-label="Toggle Dark Mode"
            >
              <span className={`material-symbols-outlined ${isDark ? 'hidden' : 'block'}`}>dark_mode</span>
              <span className={`material-symbols-outlined ${isDark ? 'block' : 'hidden'}`}>light_mode</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Unauthenticated>
              <Link to="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">Login</Link>
              <Link 
                to="/sign-up" 
                className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                  Sign Up
              </Link>
            </Unauthenticated>
            <Authenticated>
              <Link 
                to="/dashboard" 
                className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                Go to Dashboard
              </Link>
            </Authenticated>
          </div>
        </nav>
      </header>
      
      <main className="pt-32">
        <section className="relative px-6 gradient-bg overflow-hidden">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-primary text-sm font-semibold mb-6">
                AI-Powered Career Accelerator
            </span>
            <h1 className="font-display text-5xl md:text-7xl mb-8 leading-[1.1]">
                Build a Resume That <br/>
                <span className="italic text-primary">Gets You Hired.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Elevate your career with our AI-optimized templates. Designed by recruitment experts to beat the ATS and impress hiring managers instantly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              
              <Authenticated>
                 <Link to="/dashboard" className="bg-primary text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-1 shadow-xl shadow-blue-500/25 flex items-center gap-2">
                    Go to Dashboard
                    <span className="material-symbols-outlined">trending_flat</span>
                 </Link>
              </Authenticated>
              
              <Unauthenticated>
                  <Link to="/sign-up" className="bg-primary text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-1 shadow-xl shadow-blue-500/25 flex items-center gap-2">
                      Get Started for Free
                      <span className="material-symbols-outlined">trending_flat</span>
                  </Link>
              </Unauthenticated>

              <Authenticated>
                <Link to="/dashboard" className="px-8 py-4 rounded-full text-lg font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                  View Templates
                </Link>
              </Authenticated>
              <Unauthenticated>
                <Link to="/templates" className="px-8 py-4 rounded-full text-lg font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                  View Templates
                </Link>
              </Unauthenticated>
            </div>
          </div>
          
          <div className="max-w-6xl mx-auto mt-20 relative">
            <div className="relative flex justify-center items-end h-[600px] overflow-hidden">
              <div className="absolute left-0 bottom-0 transform -rotate-6 translate-y-12 translate-x-4 opacity-40 scale-90 hidden lg:block">
                <div className="w-[450px] bg-white dark:bg-slate-800 p-8 resume-shadow rounded-t-xl border border-slate-100 dark:border-slate-700">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 mb-6"></div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/50 mb-2"></div>
                  <div className="h-2 w-4/5 bg-slate-100 dark:bg-slate-700/50 mb-10"></div>
                  <div className="space-y-4">
                    <div className="h-20 w-full bg-slate-50 dark:bg-slate-700/30 rounded"></div>
                    <div className="h-20 w-full bg-slate-50 dark:bg-slate-700/30 rounded"></div>
                  </div>
                </div>
              </div>
              
              <div className="relative z-20 w-full max-w-[750px] bg-white dark:bg-slate-800 resume-shadow rounded-t-2xl border-x border-t border-slate-100 dark:border-slate-700 p-12 transition-transform duration-700 hover:-translate-y-4 text-left">
                <div className="flex justify-between items-start mb-10 pb-6 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <h2 className="text-3xl font-bold font-sans text-slate-900 dark:text-white mb-1">Jake Ryan</h2>
                    <p className="text-muted-blue font-semibold tracking-wide uppercase text-[11px]">Full Stack Developer & Researcher</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400 space-y-1 font-medium">
                    <div className="flex items-center justify-end gap-1"><span className="material-symbols-outlined !text-[14px]">phone</span> 123-456-7890</div>
                    <div className="flex items-center justify-end gap-1"><span className="material-symbols-outlined !text-[14px]">mail</span> jake@su.edu</div>
                    <div className="flex items-center justify-end gap-1"><span className="material-symbols-outlined !text-[14px]">link</span> linkedin.com/in/jake</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  <div className="md:col-span-2 space-y-8">
                    <section>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-4">Experience</h3>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between mb-0.5">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Undergraduate Research Assistant</h4>
                            <span className="text-[11px] font-medium text-slate-500">2020 - Pres.</span>
                          </div>
                          <p className="text-[13px] italic text-muted-blue mb-2">Texas A&M University</p>
                          <ul className="text-[12px] text-slate-600 dark:text-slate-400 list-disc list-outside ml-4 space-y-1 leading-relaxed">
                            <li>Developed a REST API using FastAPI and PostgreSQL</li>
                            <li>Built full-stack web application using Flask, React, and Docker</li>
                          </ul>
                        </div>
                        <div>
                          <div className="flex justify-between mb-0.5">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">IT Support Specialist</h4>
                            <span className="text-[11px] font-medium text-slate-500">2018 - 2020</span>
                          </div>
                          <p className="text-[13px] italic text-muted-blue mb-2">Southwestern University</p>
                        </div>
                      </div>
                    </section>
                    <section>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-4">Top Projects</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[13px] mb-1">Gitlytics <span className="text-slate-400 font-normal">| Python, Flask, React</span></h4>
                          <p className="text-[12px] text-slate-600 dark:text-slate-400">Visualized GitHub data to show collaboration patterns using OAuth.</p>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-4">Education</h3>
                      <div>
                        <p className="font-bold text-[13px] text-muted-blue">Southwestern University</p>
                        <p className="text-[12px] text-slate-600 dark:text-slate-400">B.A. in Computer Science</p>
                      </div>
                    </section>
                    <section>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-4">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-1 bg-primary text-white text-[9px] font-bold rounded">PYTHON</span>
                        <span className="px-2 py-1 bg-primary text-white text-[9px] font-bold rounded">REACT</span>
                        <span className="px-2 py-1 bg-primary text-white text-[9px] font-bold rounded">SQL</span>
                        <span className="px-2 py-1 bg-primary text-white text-[9px] font-bold rounded">DOCKER</span>
                        <span className="px-2 py-1 bg-primary text-white text-[9px] font-bold rounded">AWS</span>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
              
              <div className="absolute right-0 bottom-0 transform rotate-6 translate-y-12 -translate-x-4 opacity-40 scale-90 hidden lg:block">
                <div className="w-[450px] bg-white dark:bg-slate-800 p-8 resume-shadow rounded-t-xl border border-slate-100 dark:border-slate-700">
                  <div className="h-10 w-10 bg-primary/20 rounded-full mb-6"></div>
                  <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-700 mb-4"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-50 dark:bg-slate-700/30 rounded"></div>
                    <div className="h-32 bg-slate-50 dark:bg-slate-700/30 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="py-16 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-sm font-semibold text-slate-400 uppercase tracking-widest mb-10">Trusted by graduates from</p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="text-2xl font-display font-bold">Stanford</div>
              <div className="text-2xl font-display font-bold">Harvard</div>
              <div className="text-2xl font-display font-bold">MIT</div>
              <div className="text-2xl font-display font-bold">Berkeley</div>
              <div className="text-2xl font-display font-bold">Oxbridge</div>
            </div>
          </div>
        </section>
        
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display mb-4">Everything you need to land <br/>your dream role.</h2>
              <p className="text-slate-600 dark:text-slate-400">Our suite of tools takes the guesswork out of job hunting.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary">auto_fix_high</span>
                </div>
                <h3 className="text-xl font-bold mb-3">AI Optimization</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Automatically rewrite bullet points for maximum impact based on successful hires in your industry.</p>
              </div>
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400">analytics</span>
                </div>
                <h3 className="text-xl font-bold mb-3">ATS Score Card</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Instantly check if your resume can be read by Applicant Tracking Systems and get real-time fixes.</p>
              </div>
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">palette</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Designer Templates</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Modern, clean, and professional designs that help you stand out from the pile of plain black & white resumes.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary text-3xl">description</span>
              <span className="text-xl font-bold tracking-tight">Career<span className="text-primary">Tailor</span></span>
            </div>
            <p className="text-slate-400 max-w-sm">Building the future of recruitment, one resume at a time. Join over 200,000 successful job seekers.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="text-slate-400 space-y-2 text-sm">
                <li><a className="hover:text-white transition-colors" href="#">Templates</a></li>
                <li><a className="hover:text-white transition-colors" href="#">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="text-slate-400 space-y-2 text-sm">
                <li><a className="hover:text-white transition-colors" href="#">Blog</a></li>
                <li><a className="hover:text-white transition-colors" href="#">Success Stories</a></li>
                <li><a className="hover:text-white transition-colors" href="#">Help Center</a></li>
              </ul>
            </div>
            <div className="col-span-2 md:col-span-1">
              <h4 className="font-bold mb-4">Connect</h4>
              <div className="flex gap-4">
                <a className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors" href="#">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
                </a>
                <a className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors" href="#">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.493-1.1-1.1s.493-1.1 1.1-1.1 1.1.493 1.1 1.1-.493 1.1-1.1 1.1zm9 6.891h-2v-3.868c0-1.214-.813-1.454-1.109-1.454-.537 0-1.391.314-1.391 1.454v3.868h-2v-6h2v.751c.329-.481 1.144-.81 1.839-.81 1.439 0 2.661 1.056 2.661 2.695v3.364z"></path></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-800 text-slate-500 text-sm flex justify-between">
          <p>© 2024 CareerTailor AI. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="hover:text-white" href="#">Privacy</a>
            <a className="hover:text-white" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
