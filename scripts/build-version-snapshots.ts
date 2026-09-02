import { mkdir, readFile, writeFile } from 'node:fs/promises'

type Branch = { abilityId?: string; textEn: string | null; textZh: string | null; translationStatus?: 'official' | 'reviewed' | 'machine' }
type Row = { heroId: string; entity: string; level: 10 | 15 | 20 | 25; left: Branch; right: Branch }
type Event = { id: string; version: string; heroId: string; entity?: string; variant?: { type: 'facet'; id: string; title: string | null } | null; level: Row['level'] | null; type: string; textEn: string; textZh: string | null }

const root = new URL('../data/', import.meta.url)
const normalized = new URL('./normalized/', root)
const history = JSON.parse(await readFile(new URL('./talent-history.json', normalized), 'utf8')) as { versions: Array<{ version: string; publishedAt: string | null }>; events: Event[] }
const baselines = JSON.parse(await readFile(new URL('./baseline-snapshots.json', normalized), 'utf8')) as Array<Omit<Row, 'entity'> & { version: string }>
const anchors = JSON.parse(await readFile(new URL('./snapshot-anchors.json', normalized), 'utf8')) as Array<Omit<Row, 'entity'> & { version: string }>
const releases = JSON.parse(await readFile(new URL('./supplemental/release-baselines.json', root), 'utf8')) as Array<{ version: string; heroId: string; rows: Array<{ level: Row['level']; left: Branch; right: Branch }> }>
let labelTranslations: Record<string, { textZh: string; status: Branch['translationStatus'] }> = {}
try { labelTranslations = JSON.parse(await readFile(new URL('./translations/talent-labels-zh.json', root), 'utf8')) } catch {}

const clean = (value: string | null) => (value ?? '').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\bcooldown\b/g, 'cd')
  .replace(/[^a-z0-9%+.'/-]+/g, ' ').replace(/\s+/g, ' ').trim()
const keyOf = (heroId: string, entity: string, level: number) => `${heroId}:${entity}:${level}`
const cloneRow = (row: Row): Row => JSON.parse(JSON.stringify(row))
const eventOverrides = new Map<string, { level?: Row['level']; side?: 'left' | 'right' }>([
  ['7.23a:vengeful-spirit:Level 20 Talent reduced from +10 Attributes to +8', { side: 'right' }],
  ['7.27b:rubick:Level 10 Talent changed from +50 Damage to +50 Base Damage', { side: 'left' }],
  ['7.27b:rubick:Level 15 Talent changed from -80 Fade Bolt Hero Attack to Fade Bolt Steals Hero Damage', { side: 'left' }],
  ['7.30:rubick:Level 10 Talent Fade Bolt Borrows Hero Damage replaced with +10% Fade Bolt Damage Reduction', { side: 'right' }],
  ['7.35:void-spirit:Level 15 Talent Mana Regen increased from +1.5 to +1.75', { level: 10, side: 'left' }],
])

function transition(text: string): { before: string; after: string } | null {
  const body = text.replace(/^Talent:\s*/i, '').replace(/\.$/, '').trim()
  let match = body.match(/Level\s+(?:10|15|20|25)\s+Talent\s+(.+?)\s+(?:increased|reduced|decreased|improved)\s+from\s+(.+?)\s+to\s+(.+)$/i)
  if (match) return { before: `${match[2]} ${match[1]}`.trim(), after: `${match[3]} ${match[1]}`.trim() }
  match = body.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i)
  if (match) return { before: match[1].trim(), after: match[2].trim() }
  match = body.match(/Level\s+(?:10|15|20|25)\s+Talent\s+(.+?)\s+replaced\s+(?:with|by)\s+(.+)$/i)
  if (match) return { before: match[1].trim(), after: match[2].trim() }
  match = body.match(/Level\s+(?:10|15|20|25)\s+Talent\s+(?:increased|reduced|decreased|improved)\s+(.+?)\s+to\s+(.+)$/i)
  if (match) return { before: match[1].trim(), after: match[2].trim() }
  return null
}

function expandAfter(before: string, after: string) {
  const short = after.match(/^([+-]?\d+(?:\.\d+)?(?:%|s|x)?)$/i)
  if (!short) return after
  const token = before.match(/[+-]?\d+(?:\.\d+)?(?:%|s|x)?/i)
  return token ? before.replace(token[0], short[1]) : after
}

function branchScore(branch: string | null, before: string) {
  const a = clean(branch), b = clean(before)
  if (!a || !b) return 0
  if (a === b) return 1000
  if (a.includes(b) || b.includes(a)) return 700 + Math.min(a.length, b.length)
  const aw = new Set(a.split(' ')), bw = new Set(b.split(' '))
  const shared = [...aw].filter(word => bw.has(word)).length
  return shared / Math.max(aw.size, bw.size) * 100
}

const eventsByVersion = new Map<string, Event[]>()
for (const event of history.events) {
  const list = eventsByVersion.get(event.version) ?? []
  list.push(event); eventsByVersion.set(event.version, list)
}
const anchorsByVersion = new Map<string, typeof anchors>()
for (const anchor of anchors) {
  const list = anchorsByVersion.get(anchor.version) ?? []
  list.push(anchor); anchorsByVersion.set(anchor.version, list)
}
const baselinesByVersion = new Map<string, typeof baselines>()
for (const baseline of baselines) {
  const list = baselinesByVersion.get(baseline.version) ?? []
  list.push(baseline); baselinesByVersion.set(baseline.version, list)
}
for (const release of releases) {
  const list = baselinesByVersion.get(release.version) ?? []
  for (const row of release.rows) list.push({ version: release.version, heroId: release.heroId, ...row })
  baselinesByVersion.set(release.version, list)
}

const state = new Map<string, Row>()
type VariantTalent = { heroId: string; facetId: string; facetTitle: string | null; level: Row['level']; textEn: string; textZh?: string; translationStatus?: Branch['translationStatus']; sourceEventId: string }
const variantState = new Map<string, VariantTalent>()
const snapshots: Array<{ version: string; publishedAt: string | null; rows: Row[]; variantTalents: VariantTalent[] }> = []
const unresolved: Array<{ eventId: string; version: string; heroId: string; level: Row['level']; text: string; reason: string }> = []
const anchorMismatches: Array<{ version: string; heroId: string; level: number; side: string; previous: string | null; anchor: string }> = []
let applied = 0
let behavioral = 0

for (const version of history.versions) {
  const baseline = baselinesByVersion.get(version.version)
  if (baseline) {
    if (version.version === '7.07') state.clear()
    for (const row of baseline) state.set(keyOf(row.heroId, 'hero', row.level), { ...cloneRow({ ...row, entity: 'hero' }), entity: 'hero' })
  }

  for (const event of eventsByVersion.get(version.version) ?? []) {
    const entity = event.entity ?? 'hero'
    if (event.variant && event.level) {
      const change = transition(event.textEn)
      const assigned = event.textEn.match(/Level\s+(?:10|15|20|25)\s+Talent\s+is\s+(.+)$/i)?.[1]
      const textEn = change ? expandAfter(change.before, change.after) : assigned?.trim()
      if (textEn) {
        variantState.set(`${event.heroId}:${event.variant.id}:${event.level}`, {
          heroId: event.heroId, facetId: event.variant.id, facetTitle: event.variant.title,
          level: event.level, textEn, sourceEventId: event.id,
        })
        applied++
      } else behavioral++
      continue
    }
    const explicitPair = event.textEn.match(/Level\s+(10|15|20|25)\s+Talents?:\s*(.+?)\s+OR\s+(.+)$/i)
    if (explicitPair) {
      const level = Number(explicitPair[1]) as Row['level']
      state.set(keyOf(event.heroId, entity, level), {
        heroId: event.heroId, entity, level,
        left: { textEn: explicitPair[2].trim(), textZh: null },
        right: { textEn: explicitPair[3].trim(), textZh: null },
      })
      applied++; continue
    }
    const change = transition(event.textEn)
    const override = eventOverrides.get(`${event.version}:${event.heroId}:${event.textEn}`)
    const level = override?.level ?? event.level ?? Number(event.textEn.match(/Level\s+(10|15|20|25)/i)?.[1] ?? 0) as Row['level']
    if (!change || !level) { behavioral++; continue }
    const row = state.get(keyOf(event.heroId, entity, level))
    if (!row) {
      unresolved.push({ eventId: event.id, version: event.version, heroId: event.heroId, level, text: event.textEn, reason: 'missing-row' }); continue
    }
    const choices = [row.left, row.right]
    const scores = choices.map(branch => branchScore(branch.textEn, change.before))
    const side = override?.side ? (override.side === 'left' ? 0 : 1) : (scores[0] >= scores[1] ? 0 : 1)
    if (!override?.side && (scores[side] < 15 || scores[side] === scores[1 - side])) {
      unresolved.push({ eventId: event.id, version: event.version, heroId: event.heroId, level, text: event.textEn, reason: `no-branch-match:${scores.join(',')}` }); continue
    }
    choices[side].textEn = expandAfter(change.before, change.after)
    choices[side].textZh = null
    applied++
  }

  // Full game-data anchors are authoritative for labels and sides. Partial
  // anchors still validate/repair every resolved branch without deleting rows.
  for (const anchor of anchorsByVersion.get(version.version) ?? []) {
    const key = keyOf(anchor.heroId, 'hero', anchor.level)
    const row = state.get(key) ?? { heroId: anchor.heroId, entity: 'hero', level: anchor.level, left: { textEn: null, textZh: null }, right: { textEn: null, textZh: null } }
    for (const side of ['left', 'right'] as const) {
      const text = anchor[side].textEn
      if (!text) {
        if (anchor[side].abilityId?.includes('facet') && [...variantState.values()].some(item => item.heroId === anchor.heroId && item.level === anchor.level)) {
          row[side] = { abilityId: anchor[side].abilityId, textEn: null, textZh: null }
        }
        continue
      }
      if (row[side].textEn && clean(row[side].textEn) !== clean(text)) anchorMismatches.push({ version: version.version, heroId: anchor.heroId, level: anchor.level, side, previous: row[side].textEn, anchor: text })
      row[side].abilityId = anchor[side].abilityId
      row[side].textEn = text
    }
    state.set(key, row)
  }

  for (const row of state.values()) for (const branch of [row.left, row.right]) if (branch.textEn) {
    const translation = labelTranslations[branch.textEn]
    branch.textZh = translation?.textZh ?? null
    branch.translationStatus = translation?.status
  }
  for (const talent of variantState.values()) if (labelTranslations[talent.textEn]) {
    talent.textZh = labelTranslations[talent.textEn].textZh
    talent.translationStatus = labelTranslations[talent.textEn].status
  }

  snapshots.push({
    version: version.version,
    publishedAt: version.publishedAt,
    rows: [...state.values()].map(cloneRow).sort((a, b) => a.heroId.localeCompare(b.heroId) || a.entity.localeCompare(b.entity) || a.level - b.level),
    variantTalents: [...variantState.values()].map(value => ({ ...value })).sort((a, b) => a.heroId.localeCompare(b.heroId) || a.facetId.localeCompare(b.facetId) || a.level - b.level),
  })
}

const criticalUnresolved = unresolved.filter(item => !(anchorsByVersion.get(item.version) ?? []).some(anchor => anchor.heroId === item.heroId && anchor.level === item.level))
const report = {
  versionCount: snapshots.length,
  snapshotRows: snapshots.reduce((sum, snapshot) => sum + snapshot.rows.length, 0),
  appliedEvents: applied,
  behavioralEvents: behavioral,
  unresolvedEvents: unresolved.length,
  unresolvedCoveredByAnchors: unresolved.length - criticalUnresolved.length,
  criticalUnresolvedEvents: criticalUnresolved.length,
  anchorCorrectionCount: anchorMismatches.length,
  finalVersion: snapshots.at(-1)?.version,
  finalHeroes: new Set(snapshots.at(-1)?.rows.filter(row => row.entity === 'hero').map(row => row.heroId)).size,
  finalCompleteHeroTrees: [...new Set(snapshots.at(-1)?.rows.filter(row => row.entity === 'hero').map(row => row.heroId))].filter(heroId => {
    const rows = snapshots.at(-1)?.rows.filter(row => row.entity === 'hero' && row.heroId === heroId) ?? []
    return rows.length === 4 && rows.every(row => {
      const dynamic = snapshots.at(-1)?.variantTalents.some(item => item.heroId === heroId && item.level === row.level)
      return row.left.textEn && (row.right.textEn || dynamic)
    })
  }).length,
  finalFacetTalents: snapshots.at(-1)?.variantTalents.length ?? 0,
}

await mkdir(normalized, { recursive: true })
await writeFile(new URL('./version-snapshots.json', normalized), JSON.stringify(snapshots, null, 2) + '\n')
await writeFile(new URL('./snapshot-build-report.json', normalized), JSON.stringify({ ...report, unresolved, criticalUnresolved, anchorCorrections: anchorMismatches }, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
