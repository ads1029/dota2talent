import archiveJson from './generated/talent-archive.json'
import { heroCatalog, type Hero, type HeroId } from './heroCatalog'

export type { Hero, HeroId, PrimaryAttribute } from './heroCatalog'
export type Language = 'zh' | 'en'
export type TalentCategory = 'health' | 'damage' | 'attack-speed' | 'movement-speed' | 'cast-range' | 'magic-resistance' | 'attack-range' | 'other'
export type Talent = { hero: HeroId; level: 10 | 15 | 20 | 25; side: 'left' | 'right'; en: string; zh: string; generic: boolean; category?: TalentCategory; value?: number; unit?: 'flat' | 'percent' | 'seconds' }
export type ArchiveEvent = { version: string; level: number | null; type: string; en: string; zh: string; facet: string | null }
export type VariantTalent = { hero: HeroId; facet: string; level: number; en: string; zh: string }
type Archive = {
  generatedAt: string
  versions: Array<[string, string | null]>
  labels: Array<[string, string, string]>
  trees: Record<string, Record<string, Array<number | null>>>
  variants: Record<string, Array<[string, string, number, number]>>
  events: Record<string, Array<[string, number | null, string, string, string, string | null]>>
}

export const archive = archiveJson as unknown as Archive
export const heroes: readonly Hero[] = heroCatalog
export const versions = archive.versions.map(([version]) => version)
const levels = [10, 15, 20, 25] as const
const genericPatterns: Array<[RegExp, TalentCategory]> = [
  [/^[+-]?\d+(?:\.\d+)?\s+Health$/i, 'health'],
  [/^[+-]?\d+(?:\.\d+)?\s+(?:Base )?Damage$/i, 'damage'],
  [/^[+-]?\d+(?:\.\d+)?\s+Attack Speed$/i, 'attack-speed'],
  [/^[+-]?\d+(?:\.\d+)?\s+Movement Speed$/i, 'movement-speed'],
  [/^[+-]?\d+(?:\.\d+)?\s+Cast Range$/i, 'cast-range'],
  [/^[+-]?\d+(?:\.\d+)?%\s+Magic Resistance$/i, 'magic-resistance'],
  [/^[+-]?\d+(?:\.\d+)?\s+Attack Range$/i, 'attack-range'],
  [/^[+-]?\d+(?:\.\d+)?(?:%|s)?\s+(?:Strength|Agility|Intelligence|All Stats|Attributes|Armor|Evasion|Spell Amplification|Mana|Mana Regen|Health Regen|XP Gain|Gold\/Min|Respawn Time)$/i, 'other'],
]

function classify(en: string) {
  const match = genericPatterns.find(([pattern]) => pattern.test(en))
  if (!match) return { generic: false as const }
  const numeric = en.match(/[+-]?\d+(?:\.\d+)?/)?.[0]
  return { generic: true as const, category: match[1], value: numeric == null ? undefined : Math.abs(Number(numeric)), unit: (en.includes('%') ? 'percent' : /\d(?:\.\d+)?s\b/i.test(en) ? 'seconds' : 'flat') as Talent['unit'] }
}

export function talentsForHero(version: string, hero: HeroId): Talent[] {
  const ids = archive.trees[version]?.[hero] ?? []
  return ids.flatMap((id, index) => {
    if (id == null) return []
    const [en, zh] = archive.labels[id]
    return [{ hero, level: levels[Math.floor(index / 2)], side: index % 2 ? 'right' : 'left', en, zh, ...classify(en) } as Talent]
  })
}

export function talentsForVersion(version: string) {
  return Object.keys(archive.trees[version] ?? {}).flatMap(hero => talentsForHero(version, hero as HeroId))
}

export function variantsForHero(version: string, hero: HeroId): VariantTalent[] {
  return (archive.variants[version] ?? []).filter(item => item[0] === hero).map(([, facet, level, id]) => {
    const [en, zh] = archive.labels[id]
    return { hero, facet, level, en, zh }
  })
}

export function eventsForHero(hero: HeroId): ArchiveEvent[] {
  return (archive.events[hero] ?? []).map(([version, level, type, en, zh, facet]) => ({ version, level, type, en, zh, facet }))
}

export const categoryLabels: Record<TalentCategory, { zh: string; en: string }> = {
  health:{zh:'生命值',en:'Health'}, damage:{zh:'攻击力',en:'Damage'}, 'attack-speed':{zh:'攻击速度',en:'Attack Speed'},
  'movement-speed':{zh:'移动速度',en:'Movement Speed'}, 'cast-range':{zh:'施法距离',en:'Cast Range'},
  'magic-resistance':{zh:'魔法抗性',en:'Magic Resistance'}, 'attack-range':{zh:'攻击距离',en:'Attack Range'}, other:{zh:'其他属性',en:'Other attributes'}
}
