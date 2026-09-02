import { mkdir, readFile, writeFile } from 'node:fs/promises'

type Translation = { textZh: string; status: 'official' | 'reviewed' | 'machine' }
const root = new URL('../data/', import.meta.url)
const cacheFile = new URL('./translations/talent-labels-zh.json', root)
const baselines = JSON.parse(await readFile(new URL('./normalized/baseline-snapshots.json', root), 'utf8'))
const releases = JSON.parse(await readFile(new URL('./supplemental/release-baselines.json', root), 'utf8'))
const snapshots = JSON.parse(await readFile(new URL('./normalized/version-snapshots.json', root), 'utf8'))
const history = JSON.parse(await readFile(new URL('./normalized/talent-history.json', root), 'utf8'))
let cache: Record<string, Translation> = {}
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) } catch {}

for (const row of baselines) for (const branch of [row.left, row.right]) if (branch.textEn && branch.textZh) cache[branch.textEn] = { textZh: branch.textZh, status: 'official' }
for (const release of releases) for (const row of release.rows) for (const branch of [row.left, row.right]) if (branch.textEn && branch.textZh) cache[branch.textEn] = { textZh: branch.textZh, status: 'reviewed' }
for (const event of history.events) {
  const en = event.textEn.match(/replaced\s+(?:with|by)\s+(.+?)\.?$/i)?.[1]?.trim()
  const zh = event.textZh?.match(/(?:改为|替换为)(.+?)。?$/)?.[1]?.trim()
  if (en && zh) cache[en] = { textZh: zh, status: 'official' }

  const body = event.textEn.replace(/^Talent:\s*/i, '').replace(/\.$/, '').trim()
  let change = body.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i)
  if (change) {
    const before = change[1].trim()
    let after = change[2].trim()
    const short = after.match(/^([+-]?\d+(?:\.\d+)?(?:%|s|x)?)$/i)
    const oldNumber = before.match(/[+-]?\d+(?:\.\d+)?(?:%|s|x)?/i)
    if (short && oldNumber) after = before.replace(oldNumber[0], short[1])
    const zhChange = event.textZh?.replace(/^\d+级天赋/, '').match(/^从(.+?)(?:提升|降低|减少|增加|削弱|改善|改良)至(.+)$/)
    if (zhChange) {
      const oldZh = zhChange[1].trim()
      const newNumber = zhChange[2].match(/[+-]?\d+(?:\.\d+)?/i)?.[0]
      const oldZhNumber = oldZh.match(/[+-]?\d+(?:\.\d+)?/i)?.[0]
      if (newNumber && oldZhNumber) cache[after] = { textZh: oldZh.replace(oldZhNumber, newNumber), status: 'official' }
    }
  }
}
const current = snapshots.at(-1)
for (const row of current?.rows ?? []) for (const branch of [row.left, row.right]) {
  if (branch.textEn && branch.textZh && branch.translationStatus === 'official') cache[branch.textEn] = { textZh: branch.textZh, status: 'official' }
}

const labels = new Set<string>()
for (const snapshot of snapshots) {
  for (const row of snapshot.rows) for (const branch of [row.left, row.right]) if (branch.textEn) labels.add(branch.textEn)
  for (const talent of snapshot.variantTalents ?? []) if (talent.textEn) labels.add(talent.textEn)
}
const normalized = (label: string) => label.toLowerCase().replace(/cooldown reduction/g, 'cooldown')
  .replace(/[+-]?\d+(?:\.\d+)?%?/g, ' ').replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim()
const equivalents = new Map<string, string>()
for (const label of Object.keys(cache)) if (!equivalents.has(normalized(label))) equivalents.set(normalized(label), label)
for (const label of labels) {
  if (cache[label]) continue
  const source = equivalents.get(normalized(label))
  if (!source) continue
  const sourceNumbers = source.match(/[+-]?\d+(?:\.\d+)?/g) ?? []
  const targetNumbers = label.match(/[+-]?\d+(?:\.\d+)?/g) ?? []
  const zhNumbers = cache[source].textZh.match(/[+-]?\d+(?:\.\d+)?/g) ?? []
  if (sourceNumbers.length !== targetNumbers.length || zhNumbers.length !== targetNumbers.length) continue
  let index = 0
  const textZh = cache[source].textZh.replace(/[+-]?\d+(?:\.\d+)?/g, () => targetNumbers[index++])
  cache[label] = { textZh, status: cache[source].status }
}
const pending = [...labels].filter(label => !cache[label])
if (process.env.TRANSLATION_DRY_RUN === '1') {
  await mkdir(new URL('./translations/', root), { recursive: true })
  await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n')
  console.log(JSON.stringify({ labels: labels.size, cached: Object.keys(cache).length, pending: pending.length }, null, 2))
  process.exit(0)
}
let cursor = 0, completed = 0
await mkdir(new URL('./translations/', root), { recursive: true })

async function save() { await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n') }
async function worker() {
  while (cursor < pending.length) {
    const label = pending[cursor++]
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', label); url.searchParams.set('langpair', 'en|zh-CN')
    let translated = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(url)
      if (response.ok) {
        const payload = await response.json() as any
        translated = payload.responseData?.translatedText?.trim() ?? ''
        if (payload.quotaFinished) translated = ''
        if (translated) break
      }
      await Bun.sleep(1000 * (attempt + 1))
    }
    if (!translated) throw new Error(`Translation failed: ${label}`)
    cache[label] = { textZh: translated, status: 'machine' }
    completed++
    if (completed % 100 === 0) { console.log(`${completed}/${pending.length}`); await save() }
  }
}
await Promise.all(Array.from({ length: 2 }, () => worker()))
await save()
console.log(JSON.stringify({ labels: labels.size, cached: Object.keys(cache).length, translated: pending.length }, null, 2))
