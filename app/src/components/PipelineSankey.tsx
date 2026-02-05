import { useMemo, useState } from 'react'

type SankeyNodeInput = {
  id: string
  name: string
  color: string
}

type SankeyLinkInput = {
  source: string
  target: string
  value: number
}

type SankeyNodeLayout = SankeyNodeInput & {
  col: number
  value: number
  x0: number
  x1: number
  y0: number
  y1: number
}

type SankeyLinkLayout = {
  source: SankeyNodeLayout
  target: SankeyNodeLayout
  value: number
  path: string
}

type HoverState =
  | { kind: 'none' }
  | {
      kind: 'node'
      x: number
      y: number
      node: { id: string; name: string; value: number }
    }
  | {
      kind: 'link'
      x: number
      y: number
      link: { sourceId: string; targetId: string; source: string; target: string; value: number }
    }

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatCount(value: number) {
  return value.toLocaleString()
}

function bandPath(params: {
  x0: number
  x1: number
  y0a: number
  y0b: number
  y1a: number
  y1b: number
  curvature: number
}) {
  const { x0, x1, y0a, y0b, y1a, y1b, curvature } = params
  const dx = x1 - x0
  const c0 = x0 + dx * curvature
  const c1 = x1 - dx * curvature

  return [
    `M ${x0} ${y0a}`,
    `C ${c0} ${y0a}, ${c1} ${y1a}, ${x1} ${y1a}`,
    `L ${x1} ${y1b}`,
    `C ${c1} ${y1b}, ${c0} ${y0b}, ${x0} ${y0b}`,
    'Z',
  ].join(' ')
}

export function PipelineSankey({
  width,
  height,
  nodes,
  links,
  nodeColumns,
  className,
}: {
  width: number
  height: number
  nodes: SankeyNodeInput[]
  links: SankeyLinkInput[]
  // Defines the visual columns for nodes, left -> right.
  nodeColumns: string[][]
  className?: string
}) {
  const [hover, setHover] = useState<HoverState>({ kind: 'none' })

  const layout = useMemo(() => {
    const outerPadX = 18
    const outerPadY = 18
    const nodeWidth = 14
    const nodeGap = 14
    const curvature = 0.58

    const safeWidth = Math.max(0, width)
    const safeHeight = Math.max(0, height)
    const innerWidth = Math.max(0, safeWidth - outerPadX * 2)
    const innerHeight = Math.max(0, safeHeight - outerPadY * 2)

    const colByNodeId = new Map<string, number>()
    nodeColumns.forEach((col, idx) => {
      col.forEach((id) => colByNodeId.set(id, idx))
    })

    // Build initial node values from flow.
    const incoming = new Map<string, number>()
    const outgoing = new Map<string, number>()
    for (const link of links) {
      const v = Number.isFinite(link.value) ? Math.max(0, link.value) : 0
      if (v <= 0) continue
      incoming.set(link.target, (incoming.get(link.target) ?? 0) + v)
      outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + v)
    }

    const nodesLayout: SankeyNodeLayout[] = nodes
      .map((n) => {
        const col = colByNodeId.get(n.id)
        if (col === undefined) return null
        const value = Math.max(incoming.get(n.id) ?? 0, outgoing.get(n.id) ?? 0)
        if (value <= 0) return null
        return {
          ...n,
          col,
          value,
          x0: 0,
          x1: 0,
          y0: 0,
          y1: 0,
        } satisfies SankeyNodeLayout
      })
      .filter(Boolean) as SankeyNodeLayout[]

    const cols = nodeColumns.length
    const colSpacing = cols > 1 ? (innerWidth - nodeWidth) / (cols - 1) : 0

    // Compute a scale that guarantees nodes + gaps fit in every column.
    const nodesInColumn: SankeyNodeLayout[][] = Array.from({ length: cols }, () => [])
    for (const node of nodesLayout) nodesInColumn[node.col].push(node)
    for (const col of nodesInColumn) col.sort((a, b) => a.id.localeCompare(b.id))

    let scale = 0
    const scaleCandidates: number[] = []
    for (let c = 0; c < cols; c += 1) {
      const colNodes = nodesInColumn[c]
      if (colNodes.length === 0) continue
      const sum = colNodes.reduce((acc, n) => acc + n.value, 0)
      const gaps = Math.max(0, colNodes.length - 1) * nodeGap
      if (sum <= 0) continue
      const candidate = (innerHeight - gaps) / sum
      if (Number.isFinite(candidate) && candidate > 0) scaleCandidates.push(candidate)
    }
    scale = scaleCandidates.length ? Math.min(...scaleCandidates) : 0

    // Place nodes per column, centered vertically.
    for (let c = 0; c < cols; c += 1) {
      const colNodeIds = nodeColumns[c]
      const colNodes = colNodeIds
        .map((id) => nodesLayout.find((n) => n.id === id))
        .filter(Boolean) as SankeyNodeLayout[]

      const colValueSum = colNodes.reduce((sum, n) => sum + n.value, 0)
      const colContentHeight = colValueSum * scale + Math.max(0, colNodes.length - 1) * nodeGap
      let cursorY = outerPadY + (innerHeight - colContentHeight) / 2

      for (const node of colNodes) {
        const h = Math.max(2, node.value * scale)
        node.x0 = outerPadX + c * colSpacing
        node.x1 = node.x0 + nodeWidth
        node.y0 = cursorY
        node.y1 = cursorY + h
        cursorY += h + nodeGap
      }
    }

    const nodesByIdLayout = new Map<string, SankeyNodeLayout>()
    for (const n of nodesLayout) nodesByIdLayout.set(n.id, n)

    // Determine per-node link ordering (stable) to reduce crossings.
    const outgoingLinks = new Map<string, SankeyLinkInput[]>()
    for (const link of links) {
      const v = Number.isFinite(link.value) ? Math.max(0, link.value) : 0
      if (v <= 0) continue
      const source = nodesByIdLayout.get(link.source)
      const target = nodesByIdLayout.get(link.target)
      if (!source || !target) continue
      ;(outgoingLinks.get(source.id) ?? outgoingLinks.set(source.id, []).get(source.id)!).push({
        ...link,
        value: v,
      })
    }

    const outOffset = new Map<string, number>()
    const inOffset = new Map<string, number>()

    const linksLayout: SankeyLinkLayout[] = []
    for (let c = 0; c < cols; c += 1) {
      const colNodeIds = nodeColumns[c]
      for (const sourceId of colNodeIds) {
        const source = nodesByIdLayout.get(sourceId)
        if (!source) continue
        const list = outgoingLinks.get(source.id) ?? []
        list.sort((a, b) => {
          const ta = nodesByIdLayout.get(a.target)
          const tb = nodesByIdLayout.get(b.target)
          return (ta?.y0 ?? 0) - (tb?.y0 ?? 0)
        })

        for (const link of list) {
          const target = nodesByIdLayout.get(link.target)
          const v = Number.isFinite(link.value) ? Math.max(0, link.value) : 0
          if (!target || v <= 0) continue

          // Thickness matches node scale so outgoing bands never exceed node height.
          const thickness = Math.max(1, v * scale)

          const so = outOffset.get(source.id) ?? 0
          const to = inOffset.get(target.id) ?? 0

          const y0a = source.y0 + so
          const y0b = source.y0 + so + thickness
          const y1a = target.y0 + to
          const y1b = target.y0 + to + thickness

          outOffset.set(source.id, so + thickness)
          inOffset.set(target.id, to + thickness)

          const x0 = source.x1
          const x1 = target.x0

          const path = bandPath({
            x0,
            x1,
            y0a,
            y0b,
            y1a,
            y1b,
            curvature,
          })

          linksLayout.push({
            source,
            target,
            value: v,
            path,
          })
        }
      }
    }

    return {
      nodes: nodesLayout,
      links: linksLayout,
    }
  }, [height, links, nodeColumns, nodes, width])

  const tooltip = hover.kind === 'none' ? null : (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{
        transform: `translate(${clampNumber(hover.x, 0, Math.max(0, width - 220))}px, ${clampNumber(hover.y, 0, Math.max(0, height - 64))}px)`,
      }}
    >
      <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-800 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100">
        {hover.kind === 'node' ? (
          <>
            <p className="font-semibold">{hover.node.name}</p>
            <p className="text-slate-600 dark:text-slate-300">{formatCount(hover.node.value)} roles</p>
          </>
        ) : (
          <>
            <p className="font-semibold">
              {hover.link.source} -&gt; {hover.link.target}
            </p>
            <p className="text-slate-600 dark:text-slate-300">{formatCount(hover.link.value)} roles</p>
          </>
        )}
      </div>
    </div>
  )

  const hoveredLinkKey =
    hover.kind === 'link' ? `${hover.link.sourceId}::${hover.link.targetId}` : null
  const hoveredNodeId = hover.kind === 'node' ? hover.node.id : null

  return (
    <div className={['relative', className].filter(Boolean).join(' ')} style={{ width, height }}>
      {tooltip}
      <svg width={width} height={height} role="img" aria-label="Pipeline Sankey chart">
        <defs>
          <filter id="sankeyShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Links (draw first) */}
        {layout.links.map((link, idx) => {
          const bandColor = link.source.color
          const linkKey = `${link.source.id}::${link.target.id}`
          const isFocused =
            (hoveredLinkKey !== null && hoveredLinkKey === linkKey) ||
            (hoveredNodeId !== null && (hoveredNodeId === link.source.id || hoveredNodeId === link.target.id))
          const isDimmed = (hoveredLinkKey !== null || hoveredNodeId !== null) && !isFocused
          return (
            <g key={`${link.source.id}-${link.target.id}-${idx}`}>
              <path
                d={link.path}
                fill={bandColor}
                fillOpacity={isDimmed ? 0.18 : isFocused ? 0.55 : 0.38}
                stroke={isFocused ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)'}
                strokeWidth={isFocused ? 2.6 : 2.2}
                onMouseEnter={(event) => {
                  const bounds = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({
                    kind: 'link',
                    x: event.clientX - bounds.left + 14,
                    y: event.clientY - bounds.top + 14,
                    link: {
                      sourceId: link.source.id,
                      targetId: link.target.id,
                      source: link.source.name,
                      target: link.target.name,
                      value: link.value,
                    },
                  })
                }}
                onMouseMove={(event) => {
                  const bounds = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({
                    kind: 'link',
                    x: event.clientX - bounds.left + 14,
                    y: event.clientY - bounds.top + 14,
                    link: {
                      sourceId: link.source.id,
                      targetId: link.target.id,
                      source: link.source.name,
                      target: link.target.name,
                      value: link.value,
                    },
                  })
                }}
                onMouseLeave={() => setHover({ kind: 'none' })}
                style={{ cursor: 'pointer' }}
              />
            </g>
          )
        })}

        {/* Nodes (on top) */}
        {layout.nodes.map((node) => {
          const label = `${node.name}: ${formatCount(node.value)}`
          const isFocused =
            hoveredNodeId === node.id ||
            (hoveredLinkKey !== null && (hoveredLinkKey.startsWith(`${node.id}::`) || hoveredLinkKey.endsWith(`::${node.id}`)))
          const isDimmed = (hoveredLinkKey !== null || hoveredNodeId !== null) && !isFocused
          const labelWidth = 156
          const labelHeight = 28
          const labelX = node.x1 + 10
          const labelY = node.y0 + (node.y1 - node.y0) / 2 - labelHeight / 2

          return (
            <g key={node.id} filter="url(#sankeyShadow)">
              <rect
                x={node.x0}
                y={node.y0}
                width={Math.max(10, node.x1 - node.x0)}
                height={Math.max(10, node.y1 - node.y0)}
                rx={8}
                fill={node.color}
                opacity={isDimmed ? 0.42 : 0.98}
                stroke={isFocused ? 'rgba(255,255,255,0.9)' : 'transparent'}
                strokeWidth={isFocused ? 2 : 0}
                onMouseEnter={(event) => {
                  const bounds = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({
                    kind: 'node',
                    x: event.clientX - bounds.left + 14,
                    y: event.clientY - bounds.top + 14,
                    node: { id: node.id, name: node.name, value: node.value },
                  })
                }}
                onMouseMove={(event) => {
                  const bounds = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({
                    kind: 'node',
                    x: event.clientX - bounds.left + 14,
                    y: event.clientY - bounds.top + 14,
                    node: { id: node.id, name: node.name, value: node.value },
                  })
                }}
                onMouseLeave={() => setHover({ kind: 'none' })}
                style={{ cursor: 'pointer' }}
              />

              <foreignObject
                x={clampNumber(labelX, 6, Math.max(6, width - labelWidth - 6))}
                y={clampNumber(labelY, 6, Math.max(6, height - labelHeight - 6))}
                width={labelWidth}
                height={labelHeight}
                style={{ pointerEvents: 'none' }}
              >
                <div className="pointer-events-none h-full w-full rounded-md bg-white/70 px-2 py-1 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur dark:bg-slate-950/60 dark:text-white">
                  {label}
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
