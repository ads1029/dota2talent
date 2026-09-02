import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../data/', import.meta.url)
const normalized = new URL('./normalized/', root)

const baselines = JSON.parse(await readFile(new URL('./baseline-snapshots.json', normalized), 'utf8'))
const earlyEvents = JSON.parse(await readFile(new URL('./early-talent-events.json', normalized), 'utf8'))
const officialEvents = JSON.parse(await readFile(new URL('./talent-events.json', normalized), 'utf8'))
const patchList = JSON.parse(await readFile(new URL('./raw/patchnotes-list-en.json', root), 'utf8'))

const earlyVersions = [
  ['7.00', '2016-12-12'], ['7.01', '2016-12-20'], ['7.02', '2017-02-08'],
  ['7.03', '2017-03-15'], ['7.04', '2017-03-23'], ['7.05', '2017-04-09'],
  ['7.06', '2017-05-15'], ['7.06b', '2017-05-21'], ['7.06c', '2017-05-29'],
  ['7.06d', '2017-06-11'], ['7.06e', '2017-07-02'], ['7.06f', '2017-08-20'],
  ['7.07', '2017-10-31'], ['7.07b', '2017-11-05'], ['7.07c', '2017-11-17'],
  ['7.07d', '2017-12-19'],
].map(([version, date]) => ({ version, publishedAt: `${date}T00:00:00.000Z`, sourceType: version === '7.00' || version === '7.07' ? 'official_baseline' : 'patch' }))

const officialVersions = patchList.patches.map((patch: Record<string, unknown>) => ({
  version: String(patch.patch_number),
  publishedAt: typeof patch.patch_timestamp === 'number' ? new Date(patch.patch_timestamp * 1000).toISOString() : null,
  sourceType: 'official_patch',
}))

const versions = [...earlyVersions, ...officialVersions]
  .filter((item, index, all) => all.findIndex(candidate => candidate.version === item.version) === index)

const events = [...earlyEvents, ...officialEvents].sort((a, b) =>
  a.publishedAt.localeCompare(b.publishedAt) || a.heroId.localeCompare(b.heroId) || (a.level ?? 99) - (b.level ?? 99),
)

const dataset = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  languages: ['en', 'zh-Hans'],
  versions,
  baselines,
  events,
  coverage: {
    firstVersion: versions[0]?.version,
    lastVersion: versions.at(-1)?.version,
    versionCount: versions.length,
    baselineRows: baselines.length,
    eventCount: events.length,
    officialEventCount: officialEvents.length,
    supplementalEarlyEventCount: earlyEvents.length,
    bilingualEventCount: events.filter(event => event.textZh).length,
    pendingEarlyTranslations: earlyEvents.filter(event => !event.textZh).length,
  },
}

await mkdir(normalized, { recursive: true })
await writeFile(new URL('./talent-history.json', normalized), JSON.stringify(dataset, null, 2) + '\n')
await writeFile(new URL('./talent-history-report.json', normalized), JSON.stringify(dataset.coverage, null, 2) + '\n')
console.log(JSON.stringify(dataset.coverage, null, 2))
