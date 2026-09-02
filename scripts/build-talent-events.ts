import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { heroCatalog } from '../src/heroCatalog'

type Note = { indent_level: number; note: string; icon?: string }
type PatchSection = { title?: string; style?: string; facet?: string; hero_notes?: Note[]; talent_notes?: Note[]; abilities?: Array<{ ability_id: number; ability_notes?: Note[] }>; subsections?: PatchSection[] }
type PatchHero = PatchSection & { hero_id: number }
type Patch = { patch_number: string; patch_name: string; patch_timestamp: number; heroes?: PatchHero[]; success: boolean }
type RawEvent = {
  id: string
  version: string
  publishedAt: string
  heroId: string
  numericHeroId: number
  entity: 'hero' | 'spirit-bear'
  variant: { type: 'facet'; id: string; title: string | null } | null
  level: 10 | 15 | 20 | 25 | null
  type: 'added' | 'removed' | 'replaced' | 'value_changed' | 'moved' | 'reworked' | 'unknown'
  textEn: string
  textZh: string | null
  source: { type: 'official_patch'; url: string; confidence: 'confirmed' }
}

const root = new URL('../data/', import.meta.url)
const raw = new URL('./raw/', root)
const patchesDir = new URL('./patches/', raw)
const output = new URL('./normalized/', root)
await mkdir(output, { recursive: true })

const list = JSON.parse(await readFile(new URL('./patchnotes-list-en.json', raw), 'utf8')) as { patches: Array<{ patch_number: string }> }
const heroByNumericId = new Map(heroCatalog.map(hero => [hero.numericId, hero]))
const specialEntities = new Map([[1961, { hero: heroCatalog.find(hero => hero.id === 'lone-druid')!, entity: 'spirit-bear' as const }]])

const isTalentNote = (note: string) => /(?:^|\b)Talent(?:s)?\s*:/i.test(note) || /\b(?:Level\s+)?(?:10|15|20|25)\s+Talent\b/i.test(note)
const collectTalentNotes = (section: PatchSection, language: 'en' | 'zh', inheritedFacet: { id: string; title: string | null } | null = null): Array<{ note: Note; facet: { id: string; title: string | null } | null }> => {
  const facet = section.facet ? { id: section.facet, title: section.title ?? null } : inheritedFacet
  const direct = [
    ...(section.talent_notes ?? []),
    ...(section.hero_notes ?? []).filter(note => language === 'en' ? isTalentNote(note.note) : /天赋/.test(note.note)),
    ...(section.abilities ?? []).flatMap(ability => (ability.ability_notes ?? []).filter(note => language === 'en' ? /\bTalent\b/i.test(note.note) : /天赋/.test(note.note))),
  ].map(note => ({ note, facet }))
  return [...direct, ...(section.subsections ?? []).flatMap(child => collectTalentNotes(child, language, facet))]
}
const inferLevel = (note: string): RawEvent['level'] => {
  const match = note.match(/(?:Level\s+)?(10|15|20|25)(?:\s*级)?\s*(?:Talent|天赋)/i) ?? note.match(/(?:Talent|天赋)[^\d]{0,8}(10|15|20|25)/i)
  return match ? Number(match[1]) as RawEvent['level'] : null
}
const inferType = (note: string): RawEvent['type'] => {
  if (/removed|移除|删除/i.test(note)) return 'removed'
  if (/added|新增|Level\s+(?:10|15|20|25)\s+Talents\s*:/i.test(note)) return 'added'
  if (/swapped|moved|移至|调换|互换/i.test(note)) return 'moved'
  if (/reworked|重做/i.test(note)) return 'reworked'
  if (/changed from|changed to|replaced|改为|替换/i.test(note)) return 'replaced'
  if (/increased|decreased|reduced|rescaled|raised|提升|降低|减少|增加|从.*至/i.test(note)) return 'value_changed'
  if (/\bnow\b|no longer|现在|不再/i.test(note)) return 'reworked'
  return 'unknown'
}

const translationOverrides = new Map([
  ['7.30:legion-commander:Fixed Level 25 Talent AOE not working correctly with Self Cast', '修复25级范围型天赋与自身施法配合不正确的问题'],
  ['7.36:tinker:Blind now affects all enemies in the radius when the AoE talent is picked', '选择范围型天赋后，致盲现在会影响范围内所有敌人'],
])

const events: RawEvent[] = []
const unmatchedHeroes = new Set<number>()

for (const { patch_number } of list.patches) {
  const en = JSON.parse(await readFile(new URL(`./${patch_number}-en.json`, patchesDir), 'utf8')) as Patch
  const zh = JSON.parse(await readFile(new URL(`./${patch_number}-zh.json`, patchesDir), 'utf8')) as Patch
  const zhByHero = new Map((zh.heroes ?? []).map(hero => [hero.hero_id, hero]))
  for (const heroPatch of en.heroes ?? []) {
    const special = specialEntities.get(heroPatch.hero_id)
    const hero = special?.hero ?? heroByNumericId.get(heroPatch.hero_id)
    if (!hero) { unmatchedHeroes.add(heroPatch.hero_id); continue }
    const enNotes = collectTalentNotes(heroPatch, 'en')
    const zhHero = zhByHero.get(heroPatch.hero_id)
    const zhNotes = zhHero ? collectTalentNotes(zhHero, 'zh') : []
    for (const [index, item] of enNotes.entries()) {
      const note = item.note
      const identity = `${patch_number}:${hero.id}:${item.facet?.id ?? 'base'}:${index}:${note.note}`
      events.push({
        id: createHash('sha1').update(identity).digest('hex').slice(0, 16),
        version: patch_number,
        publishedAt: new Date(en.patch_timestamp * 1000).toISOString(),
        heroId: hero.id,
        numericHeroId: hero.numericId,
        entity: special?.entity ?? 'hero',
        variant: item.facet ? { type: 'facet', id: item.facet.id, title: item.facet.title } : null,
        level: inferLevel(note.note),
        type: inferType(note.note),
        textEn: note.note,
        textZh: zhNotes[index]?.note.note ?? translationOverrides.get(`${patch_number}:${hero.id}:${note.note}`) ?? null,
        source: { type: 'official_patch', url: `https://www.dota2.com/patches/${patch_number}`, confidence: 'confirmed' },
      })
    }
  }
}

events.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.heroId.localeCompare(b.heroId))
const byHero = Object.fromEntries(heroCatalog.map(hero => [hero.id, events.filter(event => event.heroId === hero.id)]))
const report = {
  generatedAt: new Date().toISOString(),
  patchCount: list.patches.length,
  eventCount: events.length,
  heroesWithEvents: Object.values(byHero).filter(list => list.length > 0).length,
  bilingualEvents: events.filter(event => event.textZh).length,
  missingLevel: events.filter(event => event.level === null).length,
  unknownType: events.filter(event => event.type === 'unknown').length,
  unmatchedHeroIds: [...unmatchedHeroes],
}

await writeFile(new URL('./talent-events.json', output), JSON.stringify(events, null, 2) + '\n')
await writeFile(new URL('./talent-events-by-hero.json', output), JSON.stringify(byHero, null, 2) + '\n')
await writeFile(new URL('./import-report.json', output), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
