import { readFile, readdir, stat } from 'node:fs/promises'
import { heroCatalog } from '../src/heroCatalog'

const root = new URL('../data/', import.meta.url)
const normalized = new URL('./normalized/', root)
const rawPatches = new URL('./raw/patches/', root)
const events = JSON.parse(await readFile(new URL('./talent-events.json', normalized), 'utf8')) as Array<{ heroId: string; textZh: string | null; version: string }>
const initial = JSON.parse(await readFile(new URL('./initial-7.00-snapshot.json', normalized), 'utf8')) as Array<{ heroId: string }>
const baselines = JSON.parse(await readFile(new URL('./baseline-snapshots.json', normalized), 'utf8')) as Array<{ heroId: string; version: string; left: { textZh: string | null }; right: { textZh: string | null } }>
const earlyEvents = JSON.parse(await readFile(new URL('./early-talent-events.json', normalized), 'utf8')) as Array<{ textZh: string | null }>
const history = JSON.parse(await readFile(new URL('./talent-history.json', normalized), 'utf8')) as { events: unknown[]; coverage: { versionCount: number; eventCount: number } }
type SnapshotBranch = { abilityId?: string; textEn: string | null; textZh: string | null }
type SnapshotRow = { heroId: string; entity: string; level: number; left: SnapshotBranch; right: SnapshotBranch }
type Snapshot = { version: string; rows: SnapshotRow[]; variantTalents: Array<{ heroId: string; level: number; textEn: string; textZh?: string }> }
const snapshots = JSON.parse(await readFile(new URL('./version-snapshots.json', normalized), 'utf8')) as Snapshot[]
const snapshotReport = JSON.parse(await readFile(new URL('./snapshot-build-report.json', normalized), 'utf8')) as { criticalUnresolvedEvents: number; unresolvedCoveredByAnchors: number; finalCompleteHeroTrees: number }
const currentReport = JSON.parse(await readFile(new URL('./current-snapshot-report.json', normalized), 'utf8')) as { heroes: number; branches: number; unresolvedTemplates: number }
const currentOfficial = JSON.parse(await readFile(new URL('./current-official-talents.json', normalized), 'utf8')) as { version: string; heroes: Record<string, { en: { talents: Array<{ name: string }> } }> }
const report = JSON.parse(await readFile(new URL('./import-report.json', normalized), 'utf8')) as { patchCount: number; unmatchedHeroIds: number[] }
const list = JSON.parse(await readFile(new URL('./raw/patchnotes-list-en.json', root), 'utf8')) as { patches: Array<{ patch_number: string }> }
const indexedFiles = new Set(list.patches.flatMap(patch => [`${patch.patch_number}-en.json`, `${patch.patch_number}-zh.json`]))
const files = await readdir(rawPatches)
const patchFiles = files.filter(file => indexedFiles.has(file))
const emptyFiles = []
for (const file of patchFiles) if ((await stat(new URL(`./${file}`, rawPatches))).size < 100) emptyFiles.push(file)
const final = snapshots.at(-1)!
const finalHeroRows = final.rows.filter(row => row.entity === 'hero')
const finalIdsMatchOfficial = Object.entries(currentOfficial.heroes).every(([heroId, payload]) => {
  const ids = finalHeroRows.filter(row => row.heroId === heroId).sort((a, b) => a.level - b.level).flatMap(row => [row.left.abilityId, row.right.abilityId])
  return JSON.stringify(ids) === JSON.stringify(payload.en.talents.map(talent => talent.name))
})
const allResolvedBranches = snapshots.every(snapshot => snapshot.rows.every(row => [row.left, row.right].every(branch =>
  (branch.textEn && branch.textZh) || snapshot.variantTalents.some(talent => talent.heroId === row.heroId && talent.level === row.level)
)))
const allVariantsBilingual = snapshots.every(snapshot => snapshot.variantTalents.every(talent => talent.textEn && talent.textZh))

const assertions: Array<[boolean, string]> = [
  [report.patchCount === 117, `expected 117 indexed patches, got ${report.patchCount}`],
  [events.length >= 4000, `expected at least 4000 talent events, got ${events.length}`],
  [new Set(events.map(event => event.heroId)).size === heroCatalog.length, 'not every current hero has at least one event'],
  [events.every(event => event.textZh), 'some official events are missing Chinese text'],
  [new Set(initial.map(row => row.heroId)).size === 113, '7.00 baseline should contain all 113 release heroes'],
  [initial.length === 452, `7.00 baseline should contain 452 rows, got ${initial.length}`],
  [new Set(baselines.filter(row => row.version === '7.07').map(row => row.heroId)).size === 115, '7.07 baseline should contain all 115 release heroes'],
  [baselines.every(row => row.left.textZh && row.right.textZh), 'baseline rows must be bilingual'],
  [earlyEvents.length === 570, `expected 570 early events, got ${earlyEvents.length}`],
  [earlyEvents.every(event => event.textZh), 'some early events are missing Chinese text'],
  [history.events.length === events.length + earlyEvents.length, 'assembled event count does not match sources'],
  [history.coverage.versionCount >= 133, `expected at least 133 versions, got ${history.coverage.versionCount}`],
  [snapshots.length === 133, `expected 133 version snapshots, got ${snapshots.length}`],
  [snapshots[0].version === '7.00' && final.version === '7.41e', `snapshot range should be 7.00–7.41e, got ${snapshots[0].version}–${final.version}`],
  [snapshotReport.criticalUnresolvedEvents === 0, `critical unresolved events: ${snapshotReport.criticalUnresolvedEvents}`],
  [snapshotReport.finalCompleteHeroTrees === heroCatalog.length, `complete current trees: ${snapshotReport.finalCompleteHeroTrees}/${heroCatalog.length}`],
  [allResolvedBranches, 'some snapshot branches are missing English or Chinese text without a facet variant'],
  [allVariantsBilingual, 'some facet-specific talent history is not bilingual'],
  [currentReport.heroes === heroCatalog.length && currentReport.branches === heroCatalog.length * 8 && currentReport.unresolvedTemplates === 0, 'official current snapshot canonicalization is incomplete'],
  [Object.keys(currentOfficial.heroes).length === heroCatalog.length, 'official current payload does not contain every hero'],
  [finalIdsMatchOfficial, 'current snapshot talent IDs/order differ from the official current payload'],
  [finalHeroRows.every(row => [row.left, row.right].every(branch => branch.textEn && branch.textZh && !branch.textEn.includes('{') && !branch.textZh.includes('{'))), 'current snapshot has missing or unexpanded bilingual labels'],
  [report.unmatchedHeroIds.length === 0, `unmatched hero ids: ${report.unmatchedHeroIds.join(', ')}`],
  [patchFiles.length >= 234, `expected at least 234 raw patch files, got ${patchFiles.length}`],
  [emptyFiles.length === 0, `empty patch files: ${emptyFiles.join(', ')}`],
]

for (const [valid, message] of assertions) if (!valid) throw new Error(message)
console.log(JSON.stringify({
  currentHeroes: heroCatalog.length,
  initialHeroes: new Set(initial.map(row => row.heroId)).size,
  initialTalents: initial.length * 2,
  baseline707Heroes: new Set(baselines.filter(row => row.version === '7.07').map(row => row.heroId)).size,
  indexedPatches: report.patchCount,
  talentEvents: events.length,
  bilingualEvents: events.filter(event => event.textZh).length,
  earlyTalentEvents: earlyEvents.length,
  pendingEarlyTranslations: earlyEvents.filter(event => !event.textZh).length,
  assembledEvents: history.coverage.eventCount,
  assembledVersions: history.coverage.versionCount,
  snapshotVersions: snapshots.length,
  snapshotRows: snapshots.reduce((sum, snapshot) => sum + snapshot.rows.length, 0),
  criticalUnresolvedEvents: snapshotReport.criticalUnresolvedEvents,
  unresolvedCoveredByAnchors: snapshotReport.unresolvedCoveredByAnchors,
  currentOfficialBranches: currentReport.branches,
  rawPatchFiles: patchFiles.length,
}, null, 2))
