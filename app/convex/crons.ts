import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'mark applied jobs needing an update',
  { hourUTC: 8, minuteUTC: 17 },
  internal.jobs.markStaleApplications,
  {},
)

export default crons
