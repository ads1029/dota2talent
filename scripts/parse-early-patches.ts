import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { heroCatalog } from '../src/heroCatalog'

type Source = { version: string; file: string; zhFile?: string; type: 'official_patch' | 'wiki'; url: string }
type EarlyEvent = {
  id: string
  version: string
  publishedAt: string
  heroId: string
  numericHeroId: number
  level: 10 | 15 | 20 | 25 | null
  type: 'replaced' | 'value_changed' | 'moved' | 'reworked' | 'unknown'
  textEn: string
  textZh: string | null
  translationStatus: 'official' | 'machine-reviewed' | 'missing'
  source: { type: 'official_patch' | 'wiki'; url: string; confidence: 'confirmed' | 'supplemental' }
}

const sources: Source[] = [
  { version: '7.01', file: 'liquipedia-7.01-en.html', type: 'wiki', url: 'https://liquipedia.net/dota2/Version_7.01' },
  { version: '7.02', file: 'liquipedia-7.02-en.html', type: 'wiki', url: 'https://liquipedia.net/dota2/Version_7.02' },
  { version: '7.03', file: '703-official-en.html', zhFile: '703-official-zh.html', type: 'official_patch', url: 'https://www.dota2.com/bladeformlegacy' },
  { version: '7.04', file: 'liquipedia-7.04-en.html', type: 'wiki', url: 'https://liquipedia.net/dota2/Version_7.04' },
  { version: '7.05', file: 'liquipedia-7.05-en.html', type: 'wiki', url: 'https://liquipedia.net/dota2/Version_7.05' },
  { version: '7.06', file: '706-en.html', zhFile: '706-zh.html', type: 'official_patch', url: 'https://www.dota2.com/706' },
  ...['7.06b','7.06c','7.06d','7.06e','7.06f'].map(version => ({ version, file: `liquipedia-${version}-en.html`, type: 'wiki' as const, url: `https://liquipedia.net/dota2/Version_${version}` })),
  { version: '7.07', file: '707-official-en.html', zhFile: '707-official-zh.html', type: 'official_patch', url: 'https://www.dota2.com/duelingfates' },
  ...['7.07b','7.07c','7.07d'].map(version => ({ version, file: `liquipedia-${version}-en.html`, type: 'wiki' as const, url: `https://liquipedia.net/dota2/Version_${version}` })),
]

const root = new URL('../data/', import.meta.url)
const earlyDir = new URL('./raw/early/', root)
const output = new URL('./normalized/', root)
await mkdir(output, { recursive: true })

const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
const clean = (html: string) => html
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&#160;|&nbsp;/gi, ' ')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x'
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10))
    }
    return entities[entity] ?? `&${entity};`
  })
  .replace(/\s+/g, ' ')
  .trim()

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const heroByName = new Map(heroCatalog.map(hero => [normalizeName(hero.en), hero]))

function extractOfficial(html: string) {
  const heroes = new Map<string, string[]>()
  for (const figure of html.matchAll(/<figure>([\s\S]*?)<\/figure>/gi)) {
    const key = figure[1].match(/<img[^>]*data-id=['"]([^'"]+)['"]/i)?.[1]
    const hero = heroCatalog.find(candidate => candidate.key === key)
    if (!hero) continue
    const notes = [...figure[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(match => clean(match[1])).filter(note => /Talent/i.test(note) || /天赋/.test(note))
    if (notes.length) heroes.set(hero.id, notes)
  }
  for (const section of html.matchAll(/\[\[([a-z0-9_]+)\]\]\s*<ul>([\s\S]*?)<\/ul>/gi)) {
    const hero = heroCatalog.find(candidate => candidate.key === section[1])
    if (!hero) continue
    const notes = [...section[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(match => clean(match[1])).filter(note => /Talent/i.test(note) || /天赋/.test(note))
    if (notes.length) heroes.set(hero.id, [...(heroes.get(hero.id) ?? []), ...notes])
  }
  return heroes
}

function extractLiquipedia(html: string) {
  const heroes = new Map<string, string[]>()
  const pattern = /<div style="font-size:12pt;display:inline;"><b><a[^>]*title="([^"]+)"[^>]*>[^<]+<\/a><\/b><\/div>\s*<ul>([\s\S]*?)<\/ul>/gi
  for (const match of html.matchAll(pattern)) {
    const hero = heroByName.get(normalizeName(clean(match[1])))
    if (!hero) continue
    const notes = [...match[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(item => clean(item[1])).filter(note => /Talent/i.test(note))
    if (notes.length) heroes.set(hero.id, [...(heroes.get(hero.id) ?? []), ...notes])
  }
  return heroes
}

const inferLevel = (note: string) => Number(note.match(/(?:Level\s+)?(10|15|20|25)(?:\s*级)?\s*(?:Talent|天赋)/i)?.[1] ?? 0) as EarlyEvent['level'] || null
const comparableTalent = (text: string) => text.toLowerCase()
  .replace(/[+-]?\d+(?:\.\d+)?%?/g, '')
  .replace(/\bseconds?\b|\bsecs?\b/g, '')
  .replace(/[^a-z]+/g, ' ')
  .trim()
const inferType = (note: string): EarlyEvent['type'] => {
  if (/swapped|moved|互换|移至/i.test(note)) return 'moved'
  if (/changed from|replaced|改为|替换/i.test(note)) return 'replaced'
  if (/increased|decreased|reduced|rescaled|提升|降低|减少|增加/i.test(note)) return 'value_changed'
  if (/now|no longer|现在|不再/i.test(note)) return 'reworked'
  const fromTo = note.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i)
  if (fromTo) {
    const before = comparableTalent(fromTo[1])
    const after = comparableTalent(fromTo[2])
    return !after || before === after ? 'value_changed' : 'replaced'
  }
  return 'unknown'
}

const events: EarlyEvent[] = []
const sourceReports = []

for (const source of sources) {
  const html = await readFile(new URL(`./${source.file}`, earlyDir), 'utf8')
  const en = source.type === 'official_patch' ? extractOfficial(html) : extractLiquipedia(html)
  const zh = source.zhFile ? extractOfficial(await readFile(new URL(`./${source.zhFile}`, earlyDir), 'utf8')) : new Map<string, string[]>()
  const date = html.match(/Release Date:<\/div><div[^>]*>(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null
  let sourceEvents = 0
  for (const [heroId, notes] of en) {
    const hero = heroCatalog.find(candidate => candidate.id === heroId)!
    for (const [index, note] of notes.entries()) {
      const textZh = zh.get(heroId)?.[index] ?? null
      events.push({
        id: createHash('sha1').update(`${source.version}:${heroId}:${note}`).digest('hex').slice(0, 16),
        version: source.version,
        publishedAt: date ? `${date}T00:00:00.000Z` : '',
        heroId,
        numericHeroId: hero.numericId,
        level: inferLevel(note),
        type: inferType(note),
        textEn: note,
        textZh,
        translationStatus: textZh ? 'official' : 'missing',
        source: { type: source.type, url: source.url, confidence: source.type === 'official_patch' ? 'confirmed' : 'supplemental' },
      })
      sourceEvents++
    }
  }
  sourceReports.push({ version: source.version, source: source.type, date, events: sourceEvents, bilingual: [...en.keys()].reduce((sum, heroId) => sum + Math.min(en.get(heroId)?.length ?? 0, zh.get(heroId)?.length ?? 0), 0) })
}

try {
  const translations = JSON.parse(await readFile(new URL('./translations/early-zh.json', root), 'utf8')) as Record<string, string>
  for (const event of events) if (!event.textZh && translations[event.id]) {
    event.textZh = translations[event.id]
    event.translationStatus = 'machine-reviewed'
  }
} catch {}

await writeFile(new URL('./early-talent-events.json', output), JSON.stringify(events, null, 2) + '\n')
await writeFile(new URL('./early-import-report.json', output), JSON.stringify({ events: events.length, bilingual: events.filter(event => event.textZh).length, sources: sourceReports }, null, 2) + '\n')
console.log(JSON.stringify({ events: events.length, bilingual: events.filter(event => event.textZh).length, sources: sourceReports }, null, 2))
