import { mkdir, rename, writeFile } from 'node:fs/promises'
import { heroCatalog } from '../src/heroCatalog'

const api = 'https://www.dota2.com/datafeed'
const rosterUrl = `${api}/herolist?language=english`
const patchListUrl = `${api}/patchnoteslist?language=english`
const outputFile = new URL('../src/generated/hero-attribute-growth.json', import.meta.url)

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error}`)
      await Bun.sleep(attempt * 500)
    }
  }
}

const [rosterPayload, patchPayload] = await Promise.all([fetchJson(rosterUrl), fetchJson(patchListUrl)])
const roster: Array<{ id: number }> = rosterPayload.result?.data?.heroes ?? []
const officialIds = new Set(roster.map(hero => hero.id))
const catalogIds = new Set<number>(heroCatalog.map(hero => hero.numericId))
if (!roster.length || officialIds.size !== roster.length || roster.length !== catalogIds.size ||
    roster.some(hero => !catalogIds.has(hero.id)) || heroCatalog.some(hero => !officialIds.has(hero.numericId))) {
  throw new Error('Official roster differs from heroCatalog. Update the catalog before importing; existing snapshot was not changed.')
}
const patches = patchPayload.patches as Array<{ patch_number: string; patch_timestamp: number }>
if (!patches?.length) throw new Error('Official patch list is empty')
const latestListedPatch = [...patches].sort((a, b) => b.patch_timestamp - a.patch_timestamp)[0].patch_number
const records: Record<string, { numericId: number; strength: number; agility: number; intelligence: number }> = {}

let cursor = 0
async function worker() {
  while (cursor < heroCatalog.length) {
    const hero = heroCatalog[cursor++]
    const url = `${api}/herodata?language=english&hero_id=${hero.numericId}`
    const payload = await fetchJson(url)
    const record = payload.result?.data?.heroes?.find((item: { id: number }) => item.id === hero.numericId)
    const values = [record?.str_gain, record?.agi_gain, record?.int_gain]
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
      throw new Error(`Missing or invalid growth values for ${hero.id}; existing snapshot was not changed`)
    }
    records[hero.id] = { numericId: hero.numericId, strength: values[0], agility: values[1], intelligence: values[2] }
    if (Object.keys(records).length % 20 === 0) console.log(`${Object.keys(records).length}/${heroCatalog.length}`)
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
// Do not label a snapshot with a patch inferred from unrelated talent data.
// herodata exposes current values but does not return a patch version.
const snapshot = {
  source: 'Valve Dota 2 datafeed',
  heroDataUrl: `${api}/herodata?language=english&hero_id={id}`,
  rosterUrl,
  patchListUrl,
  generatedAt: new Date().toISOString(),
  patchVersion: null,
  latestListedPatch,
  officialHeroCount: roster.length,
  heroes: Object.fromEntries(heroCatalog.map(hero => [hero.id, records[hero.id]])),
}
await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true })
await writeFile(`${outputFile.pathname}.tmp`, JSON.stringify(snapshot, null, 2) + '\n')
await rename(`${outputFile.pathname}.tmp`, outputFile)
console.log(`Synced ${roster.length} official hero growth records; latest listed patch ${latestListedPatch}, payload version unspecified`)
