import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { heroCatalog } from '../src/heroCatalog'

const root = new URL('../data/', import.meta.url)
const outputFile = new URL('./normalized/current-official-talents.json', root)
let output: Record<string, { en: unknown; zh: unknown }> = {}
try { output = JSON.parse(await readFile(outputFile, 'utf8')).heroes ?? {} } catch {}
const requested = new Set(Bun.argv.slice(2))
const heroes = requested.size ? heroCatalog.filter(hero => requested.has(hero.id)) : heroCatalog
const formatValue = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))

function compactHero(record: any) {
  const valuesByTalent = new Map<string, Record<string, number>>()
  for (const talent of record.talents ?? []) {
    const values: Record<string, number> = {}
    for (const special of talent.special_values ?? []) if (special.values_float?.length) values[special.name] = special.values_float[0]
    valuesByTalent.set(talent.name, values)
  }
  for (const ability of record.abilities ?? []) for (const special of ability.special_values ?? []) {
    for (const bonus of special.bonuses ?? []) {
      const values = valuesByTalent.get(bonus.name)
      if (!values) continue
      values[`bonus_${special.name}`] = bonus.value
      values[special.name] = bonus.value
    }
  }
  return {
    name: record.name_loc,
    facets: record.facets,
    talents: (record.talents ?? []).map((talent: any) => {
      const values = valuesByTalent.get(talent.name) ?? {}
      const nameRendered = talent.name_loc.replace(/\{s:([^}]+)\}/g, (placeholder: string, key: string) => {
        const value = values[key] ?? values[key.replace(/^bonus_/, '')]
        return value == null ? placeholder : formatValue(value)
      })
      return { id: talent.id, name: talent.name, nameLoc: talent.name_loc, nameRendered, values, facetsLoc: talent.facets_loc }
    }),
  }
}
let cursor = 0
async function worker() {
  while (cursor < heroes.length) {
    const hero = heroes[cursor++]
    const languages = await Promise.all(['english', 'schinese'].map(async language => {
      const url = `https://www.dota2.com/datafeed/herodata?language=${language}&hero_id=${hero.numericId}`
      let data: any
      for (let attempt = 1; attempt <= 8; attempt++) {
        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`${response.status}`)
          data = await response.json()
          if (data?.result?.data?.heroes?.[0]) break
          throw new Error('empty response')
        } catch (error) {
          if (attempt === 8) throw new Error(`${url}: ${error}`)
          await Bun.sleep(attempt * 500)
        }
      }
      const record = data.result?.data?.heroes?.[0]
      if (!record) throw new Error(`No hero data: ${hero.id}/${language}`)
      return compactHero(record)
    }))
    output[hero.id] = { en: languages[0], zh: languages[1] }
    await mkdir(new URL('./normalized/', root), { recursive: true })
    await writeFile(outputFile, JSON.stringify({ version: '7.41e', generatedAt: new Date().toISOString(), heroes: output }, null, 2) + '\n')
    if (cursor % 10 === 0 || cursor === heroes.length) console.log(`${Math.min(cursor, heroes.length)}/${heroes.length}`)
  }
}
await Promise.all(Array.from({ length: requested.size ? 1 : 4 }, () => worker()))
await mkdir(new URL('./normalized/', root), { recursive: true })
await writeFile(outputFile, JSON.stringify({ version: '7.41e', generatedAt: new Date().toISOString(), heroes: output }, null, 2) + '\n')
console.log(`Synced ${Object.keys(output).length} official current hero talent payloads`)
