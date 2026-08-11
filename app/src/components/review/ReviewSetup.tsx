import { Check, Loader2, Upload } from 'lucide-react'
import { useState } from 'react'

import { EmptyState, Panel, PanelHeader } from '@/components/ui/page'
import { cn } from '@/lib/utils'

export function ReviewSetup({
  source,
  onSource,
  file,
  note,
  isExtracting,
  onFile,
  documents,
  selectedDocId,
  onSelectDoc,
}: {
  source: 'upload' | 'document'
  onSource: (next: 'upload' | 'document') => void
  file: File | null
  note: string
  isExtracting: boolean
  onFile: (file: File | null) => void
  documents: any[]
  selectedDocId: string
  onSelectDoc: (id: string) => void
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <>
      <Panel>
        <PanelHeader
          title="What to review"
          actions={
            <div className="flex items-center gap-0.5">
              <SourceChoice
                active={source === 'upload'}
                onClick={() => onSource('upload')}
              >
                Upload
              </SourceChoice>
              <SourceChoice
                active={source === 'document'}
                onClick={() => onSource('document')}
              >
                Yours
              </SourceChoice>
            </div>
          }
        />

        {source === 'upload' ? (
          <div className="space-y-3 p-4">
            <label
              onDragEnter={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return
                setDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                onFile(event.dataTransfer.files?.[0] ?? null)
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-center transition-colors motion-reduce:transition-none',
                dragging
                  ? 'border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900',
              )}
            >
              {isExtracting ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <Upload aria-hidden className="h-4 w-4 text-slate-400" />
              )}
              <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                {file ? file.name : 'Drop a PDF, or choose one'}
              </span>
              <span className="max-w-[36ch] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {isExtracting
                  ? 'Reading the text…'
                  : note ||
                    'PDF keeps the layout a parser sees. The file is saved with the review.'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => onFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="Nothing to review yet"
            description="Write a résumé first and it will show up here."
          />
        ) : (
          <ul className="max-h-[22rem] overflow-y-auto">
            {documents.map((doc: any) => {
              const active = doc._id === selectedDocId
              return (
                <li key={doc._id}>
                  <button
                    type="button"
                    onClick={() => onSelectDoc(doc._id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/15 dark:border-slate-800/70 dark:focus-visible:ring-slate-100/25',
                      active
                        ? 'bg-slate-50 dark:bg-slate-900/60'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-900/30',
                    )}
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        active
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-transparent',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-100">
                        {doc.job?.title || 'Untitled résumé'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {doc.job?.company || 'From your profile'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}

function SourceChoice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25',
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
      )}
    >
      {children}
    </button>
  )
}
