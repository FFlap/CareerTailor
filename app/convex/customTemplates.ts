import { action, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'

import { requireUserId } from './lib/auth'
import { callOpenRouterChat, safeJsonParse } from './lib/openrouter'

const MAX_TYPST_SOURCE_LENGTH = 400_000
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000
const IMAGE_TEMPLATE_MODEL = 'allenai/molmo-2-8b:free'

const templateTypeValidator = v.union(
  v.literal('resume'),
  v.literal('cover_letter'),
)

type LayoutTokens = {
  page?: { margin_pt?: { top?: number; right?: number; bottom?: number; left?: number } }
  typography?: {
    body_font?: string
    heading_font?: string
    body_size_pt?: number
    heading_size_pt?: number
    name_size_pt?: number
  }
  header?: { align?: 'left' | 'center' | 'right'; spacing_pt?: number }
  accents?: { color?: string }
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizeFontName(value?: string) {
  const raw = (value || '').toLowerCase()
  if (raw.includes('roboto')) return 'Roboto'
  if (raw.includes('source sans 3') || raw.includes('sourcesans3')) return 'Source Sans 3'
  if (raw.includes('source sans')) return 'Source Sans Pro'
  return 'Source Sans 3'
}

function normalizeAlign(value?: string) {
  const raw = (value || '').toLowerCase()
  if (raw.includes('center')) return 'center'
  if (raw.includes('right')) return 'right'
  return 'left'
}

function normalizeColor(value?: string) {
  if (!value) return '#4f46e5'
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`
  return '#4f46e5'
}

function buildResumeTemplateFromTokens(tokens: LayoutTokens) {
  const margins = tokens.page?.margin_pt || {}
  const bodyFont = normalizeFontName(tokens.typography?.body_font)
  const headingFont = normalizeFontName(tokens.typography?.heading_font || bodyFont)
  const bodySize = normalizeNumber(tokens.typography?.body_size_pt, 10.5)
  const headingSize = normalizeNumber(tokens.typography?.heading_size_pt, 12)
  const nameSize = normalizeNumber(tokens.typography?.name_size_pt, 20)
  const align = normalizeAlign(tokens.header?.align)
  const spacing = normalizeNumber(tokens.header?.spacing_pt, 6)
  const accent = normalizeColor(tokens.accents?.color)

  return [
    `#set page(margin: (top: ${normalizeNumber(margins.top, 36)}pt, right: ${normalizeNumber(margins.right, 36)}pt, bottom: ${normalizeNumber(margins.bottom, 36)}pt, left: ${normalizeNumber(margins.left, 36)}pt))`,
    `#set text(font: "${bodyFont}", size: ${bodySize}pt)`,
    '#set heading(numbering: none)',
    `#show heading: set text(font: "${headingFont}", size: ${headingSize}pt, weight: "bold", fill: rgb("${accent}"))`,
    `#let accent = rgb("${accent}")`,
    '#let header = resume.header',
    '',
    `#align(${align})[`,
    `  #text(size: ${nameSize}pt, weight: "bold")[#header.name]`,
    `  #v(${spacing}pt)`,
    '  #if header.email != "" [#header.email]',
    '  #if header.phone != "" [#header.phone]',
    '  #if header.location != "" [#header.location]',
    '  #for link in header.links [',
    '    #if link.label != "" [#link.label ": "]',
    '    #if link.url != "" [#link.url]',
    '  ]',
    ']',
    '',
    '#heading[Summary]',
    '#resume.summary',
    '',
    '#heading[Skills]',
    '#for group in resume.skills [',
    '  #text(weight: "bold")[#group.category]',
    '  #for item in group.items [',
    '    - #item',
    '  ]',
    ']',
    '',
    '#heading[Experience]',
    '#for role in resume.experience [',
    '  #text(weight: "bold")[#role.title] - #role.company',
    '  #text(size: 9pt, fill: rgb("#64748b"))[#role.location]',
    '  #text(size: 9pt, fill: rgb("#64748b"))[#role.start " – " #role.end]',
    '  #for bullet in role.bullets [',
    '    - #bullet',
    '  ]',
    '  #v(6pt)',
    ']',
    '',
    '#heading[Projects]',
    '#for project in resume.projects [',
    '  #text(weight: "bold")[#project.name]',
    '  #if project.link != "" [#project.link]',
    '  #for bullet in project.bullets [',
    '    - #bullet',
    '  ]',
    '  #v(6pt)',
    ']',
    '',
    '#heading[Education]',
    '#for edu in resume.education [',
    '  #text(weight: "bold")[#edu.degree " in " #edu.major]',
    '  #text(size: 9pt, fill: rgb("#64748b"))[#edu.institution]',
    '  #text(size: 9pt, fill: rgb("#64748b"))[#edu.location]',
    '  #text(size: 9pt, fill: rgb("#64748b"))[#edu.start " – " #edu.end]',
    ']',
  ].join('\n')
}

function buildCoverTemplateFromTokens(tokens: LayoutTokens) {
  const margins = tokens.page?.margin_pt || {}
  const bodyFont = normalizeFontName(tokens.typography?.body_font)
  const headingFont = normalizeFontName(tokens.typography?.heading_font || bodyFont)
  const bodySize = normalizeNumber(tokens.typography?.body_size_pt, 11)
  const nameSize = normalizeNumber(tokens.typography?.name_size_pt, 18)
  const align = normalizeAlign(tokens.header?.align)
  const spacing = normalizeNumber(tokens.header?.spacing_pt, 8)
  const accent = normalizeColor(tokens.accents?.color)

  return [
    `#set page(margin: (top: ${normalizeNumber(margins.top, 42)}pt, right: ${normalizeNumber(margins.right, 42)}pt, bottom: ${normalizeNumber(margins.bottom, 42)}pt, left: ${normalizeNumber(margins.left, 42)}pt))`,
    `#set text(font: "${bodyFont}", size: ${bodySize}pt)`,
    `#let accent = rgb("${accent}")`,
    `#let heading-font = "${headingFont}"`,
    '',
    `#align(${align})[`,
    `  #text(font: heading-font, size: ${nameSize}pt, weight: "bold")[#sender.name]`,
    `  #v(${spacing}pt)`,
    '  #if sender.email != "" [#sender.email]',
    '  #if sender.phone != "" [#sender.phone]',
    '  #if sender.location != "" [#sender.location]',
    '  #for link in sender.links [',
    '    #if link.label != "" [#link.label ": "]',
    '    #if link.url != "" [#link.url]',
    '  ]',
    ']',
    '',
    '#v(12pt)',
    '#if cover_letter.recipient_name != "" [#cover_letter.recipient_name]',
    '#if cover_letter.recipient_title != "" [#cover_letter.recipient_title]',
    '#if cover_letter.company_name != "" [#cover_letter.company_name]',
    '#v(12pt)',
    '#text(weight: "bold", fill: accent)[#cover_letter.greeting]',
    '#v(8pt)',
    '#for paragraph in cover_letter.body_paragraphs [',
    '  #paragraph',
    '  #v(6pt)',
    ']',
    '#v(8pt)',
    '#cover_letter.closing',
    '#v(12pt)',
    '#cover_letter.signature_name',
  ].join('\n')
}

export const listMyTemplates = query({
  args: { type: v.optional(templateTypeValidator) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const type = args.type
    if (type) {
      return await ctx.db
        .query('customTemplates')
        .withIndex('by_user_type', (q) =>
          q.eq('userId', userId).eq('type', type),
        )
        .order('desc')
        .collect()
    }
    return await ctx.db
      .query('customTemplates')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
  },
})

export const getMyTemplate = query({
  args: { templateId: v.id('customTemplates') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.userId !== userId) {
      return null
    }
    return template
  },
})

export const createTemplateFromSource = mutation({
  args: {
    name: v.string(),
    type: templateTypeValidator,
    source: v.string(),
    origin: v.optional(v.union(v.literal('typst'), v.literal('image'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const name = args.name.trim()
    if (!name) {
      throw new Error('Template name is required.')
    }
    if (args.source.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error('Typst source too large.')
    }
    const now = Date.now()
    return await ctx.db.insert('customTemplates', {
      userId,
      name,
      type: args.type,
      source: args.source,
      origin: args.origin ?? 'typst',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteTemplate = mutation({
  args: { templateId: v.id('customTemplates') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.userId !== userId) {
      throw new Error('Template not found.')
    }
    await ctx.db.delete(args.templateId)
    return { ok: true }
  },
})

const createTemplateFromSourceRef = makeFunctionReference<'mutation'>(
  'customTemplates:createTemplateFromSource',
)

export const createTemplateFromImage = action({
  args: {
    name: v.string(),
    type: templateTypeValidator,
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) {
      throw new Error('Missing OPENROUTER_API_KEY server env var.')
    }

    const imageDataUrl = args.imageDataUrl.trim()
    if (!imageDataUrl.startsWith('data:image/')) {
      throw new Error('Image must be a data URL.')
    }
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error('Image is too large.')
    }

    const analysisPrompt = [
      'Analyze the layout in this image and return JSON only.',
      'Focus on fonts, font sizes, spacing, margins, header placement, section hierarchy, and alignment.',
      'Return JSON with keys: page (size, margins), typography (primary_font, secondary_font, sizes),',
      'header (position, alignment, columns), sections (order, titles, spacing), accents (colors, rules).',
    ].join('\n')

    const layoutRaw = await callOpenRouterChat({
      apiKey: openRouterKey,
      model: IMAGE_TEMPLATE_MODEL,
      messages: [
        { role: 'system', content: 'You analyze document layouts for resume and cover letters.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      maxTokens: 2048,
    })

    let layoutSpec: unknown
    try {
      layoutSpec = safeJsonParse(layoutRaw)
    } catch {
      layoutSpec = { notes: layoutRaw }
    }

    const tokenPrompt = [
      'Convert the layout spec into JSON design tokens. Return JSON only.',
      'Schema:',
      '{"page": {"margin_pt": {"top": 36, "right": 36, "bottom": 36, "left": 36}},',
      '"typography": {"body_font": "Source Sans 3", "heading_font": "Source Sans 3", "body_size_pt": 10.5, "heading_size_pt": 12, "name_size_pt": 20},',
      '"header": {"align": "left", "spacing_pt": 6},',
      '"accents": {"color": "#4F46E5"}}',
      'Use pt units as numbers. Use hex colors like #RRGGBB.',
      `Layout spec: ${JSON.stringify(layoutSpec)}`,
    ].join('\n')

    let tokens: LayoutTokens = {}
    try {
      const tokenRaw = await callOpenRouterChat({
        apiKey: openRouterKey,
        model: IMAGE_TEMPLATE_MODEL,
        messages: [
          { role: 'system', content: 'You map layout specs into design tokens.' },
          { role: 'user', content: tokenPrompt },
        ],
        temperature: 0.2,
        maxTokens: 1200,
      })
      tokens = safeJsonParse(tokenRaw) as LayoutTokens
    } catch {
      tokens = {}
    }

    const typstSource =
      args.type === 'resume'
        ? buildResumeTemplateFromTokens(tokens)
        : buildCoverTemplateFromTokens(tokens)

    if (typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error('Generated template is too large.')
    }

    return await ctx.runMutation(createTemplateFromSourceRef, {
      name: args.name,
      type: args.type,
      source: typstSource,
      origin: 'image',
    })
  },
})
