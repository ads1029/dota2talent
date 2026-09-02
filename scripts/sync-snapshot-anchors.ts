import { mkdir, readFile, writeFile } from 'node:fs/promises'

type Commit = { sha: string; commit: { author: { date: string }; message: string } }
type Anchor = { version: string; sha: string; date: string; message: string; files: Record<string, string> }

const root = new URL('../data/', import.meta.url)
const raw = new URL('./raw/dotaconstants/', root)
await mkdir(raw, { recursive: true })

const response = await fetch('https://api.github.com/repos/odota/dotaconstants/commits?path=build/hero_abilities.json&per_page=100')
if (!response.ok) throw new Error(`GitHub commits request failed: ${response.status}`)
const commits = await response.json() as Commit[]

const officialList = JSON.parse(await readFile(new URL('./raw/patchnotes-list-en.json', root), 'utf8')) as {
  patches: Array<{ patch_number: string; patch_timestamp: number }>
}
const earlyDates: Array<[string, string]> = [
  ['7.00', '2016-12-12'], ['7.01', '2016-12-20'], ['7.02', '2017-02-08'],
  ['7.03', '2017-03-15'], ['7.04', '2017-03-23'], ['7.05', '2017-04-09'],
  ['7.06', '2017-05-15'], ['7.06b', '2017-05-21'], ['7.06c', '2017-05-29'],
  ['7.06d', '2017-06-11'], ['7.06e', '2017-07-02'], ['7.06f', '2017-08-20'],
  ['7.07', '2017-10-31'], ['7.07b', '2017-11-05'], ['7.07c', '2017-11-17'], ['7.07d', '2017-12-19'],
]
const timeline = [
  ...earlyDates.map(([version, date]) => ({ version, timestamp: Date.parse(`${date}T00:00:00Z`) })),
  ...officialList.patches.map(patch => ({ version: patch.patch_number, timestamp: patch.patch_timestamp * 1000 })),
].sort((a, b) => a.timestamp - b.timestamp)

const selected = new Map<string, Commit>()
for (const commit of commits) {
  const commitTime = Date.parse(commit.commit.author.date)
  const version = timeline.filter(item => item.timestamp <= commitTime).at(-1)?.version
  // API results are newest first: retain the final known tree within each
  // numbered version, including unnumbered hotfixes made before the next one.
  if (version && !selected.has(version)) selected.set(version, commit)
}

const anchors: Anchor[] = []
for (const [version, commit] of [...selected].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
  const files: Record<string, string> = {}
  for (const name of ['hero_abilities.json', 'abilities.json']) {
    const url = `https://raw.githubusercontent.com/odota/dotaconstants/${commit.sha}/build/${name}`
    const file = `${name.replace('.json', '')}-${version}.json`
    const download = await fetch(url)
    if (!download.ok) throw new Error(`${url}: ${download.status}`)
    await writeFile(new URL(file, raw), new Uint8Array(await download.arrayBuffer()))
    files[name] = file
  }
  anchors.push({ version, sha: commit.sha, date: commit.commit.author.date, message: commit.commit.message.split('\n')[0], files })
  console.log(`${version}\t${commit.sha.slice(0, 10)}\t${commit.commit.author.date}`)
}

await writeFile(new URL('./snapshot-anchor-manifest.json', root), JSON.stringify({ generatedAt: new Date().toISOString(), anchors }, null, 2) + '\n')
console.log(`Synced ${anchors.length} full-tree anchors`)
