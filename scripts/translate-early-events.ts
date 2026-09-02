import { mkdir, readFile, writeFile } from 'node:fs/promises'

type Event = { id: string; textEn: string; textZh: string | null; translationStatus: string }
const root = new URL('../data/', import.meta.url)
const normalizedFile = new URL('./normalized/early-talent-events.json', root)
const cacheFile = new URL('./translations/early-zh.json', root)
const events = JSON.parse(await readFile(normalizedFile, 'utf8')) as Event[]
let cache: Record<string, string> = {}
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) } catch {}

const pending = events.filter(event => !event.textZh && !cache[event.id])
let cursor = 0
async function worker() {
  while (cursor < pending.length) {
    const event = pending[cursor++]
    const url = new URL('https://translate.googleapis.com/translate_a/single')
    url.searchParams.set('client', 'gtx'); url.searchParams.set('sl', 'en'); url.searchParams.set('tl', 'zh-CN'); url.searchParams.set('dt', 't'); url.searchParams.set('q', event.textEn)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Translation failed ${response.status}: ${event.id}`)
    const payload = await response.json() as Array<unknown>
    const translated = (payload[0] as Array<[string]>).map(segment => segment[0]).join('').trim()
    if (!translated) throw new Error(`Empty translation: ${event.id}`)
    cache[event.id] = translated
    if (cursor % 25 === 0) console.log(`${Math.min(cursor, pending.length)}/${pending.length}`)
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()))

for (const event of events) if (!event.textZh && cache[event.id]) {
  event.textZh = cache[event.id]
  event.translationStatus = 'machine-reviewed'
}
await mkdir(new URL('./translations/', root), { recursive: true })
await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n')
await writeFile(normalizedFile, JSON.stringify(events, null, 2) + '\n')
console.log(JSON.stringify({ translated: Object.keys(cache).length, bilingual: events.filter(event => event.textZh).length, total: events.length }, null, 2))
