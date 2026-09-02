import { mkdir, readFile, writeFile } from 'node:fs/promises'

type Branch = { textEn: string | null; textZh: string | null; translationStatus?: string }
type Row = { heroId: string; entity: string; level: 10 | 15 | 20 | 25; left: Branch; right: Branch }
type Variant = { heroId: string; facetId: string; facetTitle: string | null; level: number; textEn: string; textZh?: string; translationStatus?: string }
type Snapshot = { version: string; publishedAt: string | null; rows: Row[]; variantTalents: Variant[] }
type Event = { version: string; heroId: string; level: number | null; type: string; textEn: string; textZh: string | null; variant?: { title: string | null } | null }

const normalized = new URL('../data/normalized/', import.meta.url)
const snapshots = JSON.parse(await readFile(new URL('./version-snapshots.json', normalized), 'utf8')) as Snapshot[]
const history = JSON.parse(await readFile(new URL('./talent-history.json', normalized), 'utf8')) as { events: Event[] }
const labelIds = new Map<string, number>()
const labels: Array<[string, string, string]> = []

function labelId(branch: Branch) {
  if (!branch.textEn) return null
  if (!branch.textZh) throw new Error(`Missing Chinese label: ${branch.textEn}`)
  const key = `${branch.textEn}\u0000${branch.textZh}`
  let id = labelIds.get(key)
  if (id == null) {
    id = labels.length
    labelIds.set(key, id)
    labels.push([branch.textEn, branch.textZh, branch.translationStatus ?? 'machine'])
  }
  return id
}

const trees: Record<string, Record<string, Array<number | null>>> = {}
const variants: Record<string, Array<[string, string, number, number]>> = {}
for (const snapshot of snapshots) {
  const byHero: Record<string, Array<number | null>> = {}
  for (const row of snapshot.rows.filter(row => row.entity === 'hero').sort((a, b) => a.level - b.level)) {
    const tree = byHero[row.heroId] ??= []
    tree.push(labelId(row.left), labelId(row.right))
  }
  trees[snapshot.version] = byHero
  variants[snapshot.version] = (snapshot.variantTalents ?? []).map(talent => [
    talent.heroId, talent.facetTitle ?? talent.facetId, talent.level,
    labelId({ textEn: talent.textEn, textZh: talent.textZh ?? null, translationStatus: talent.translationStatus })!,
  ])
}

const events: Record<string, Array<[string, number | null, string, string, string, string | null]>> = {}
for (const event of history.events) {
  const list = events[event.heroId] ??= []
  list.push([event.version, event.level, event.type, event.textEn, event.textZh ?? event.textEn, event.variant?.title ?? null])
}

const output = {
  generatedAt: new Date().toISOString(),
  versions: snapshots.map(snapshot => [snapshot.version, snapshot.publishedAt]),
  labels, trees, variants, events,
}
const destination = new URL('../src/generated/', import.meta.url)
await mkdir(destination, { recursive: true })
await writeFile(new URL('./talent-archive.json', destination), JSON.stringify(output))
console.log(JSON.stringify({ versions: snapshots.length, labels: labels.length, heroes: Object.keys(trees[snapshots.at(-1)!.version]).length, events: history.events.length }, null, 2))
