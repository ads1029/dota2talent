import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { heroCatalog } from '../src/heroCatalog'

type Manifest = { anchors: Array<{ version: string; sha: string; date: string; files: Record<string, string> }> }
type TalentRef = { name: string; level: number }
type HeroAbilities = Record<string, { talents?: TalentRef[] }>
type Ability = { dname?: string }

const root = new URL('../data/', import.meta.url)
const raw = new URL('./raw/dotaconstants/', root)
const normalized = new URL('./normalized/', root)
const manifest = JSON.parse(await readFile(new URL('./snapshot-anchor-manifest.json', root), 'utf8')) as Manifest
const heroByGameName = new Map(heroCatalog.map(hero => [`npc_dota_hero_${hero.key}`, hero]))

const rows = []
const reports = []
for (const anchor of manifest.anchors) {
  const heroes = JSON.parse(await readFile(new URL(anchor.files['hero_abilities.json'], raw), 'utf8')) as HeroAbilities
  const abilities = JSON.parse(await readFile(new URL(anchor.files['abilities.json'], raw), 'utf8')) as Record<string, Ability>
  let resolved = 0
  let unresolved = 0
  const heroIds = new Set<string>()
  for (const [gameName, definition] of Object.entries(heroes)) {
    const hero = heroByGameName.get(gameName)
    if (!hero) continue
    const talents = (definition.talents ?? []).filter(talent => talent.level >= 1 && talent.level <= 4)
    if (talents.length < 8) continue
    heroIds.add(hero.id)
    for (const levelIndex of [1, 2, 3, 4]) {
      const pair = talents.filter(talent => talent.level === levelIndex).slice(0, 2)
      if (pair.length !== 2) continue
      const text = pair.map(talent => abilities[talent.name]?.dname ?? null)
      const valid = text.map((value, index) => Boolean(
        pair[index].name.startsWith('special_bonus_') && value && !/\{[^}]+\}/.test(value),
      ))
      resolved += valid.filter(Boolean).length
      unresolved += valid.filter(value => !value).length
      rows.push({
        version: anchor.version,
        heroId: hero.id,
        level: ({ 1: 10, 2: 15, 3: 20, 4: 25 } as const)[levelIndex as 1 | 2 | 3 | 4],
        left: { abilityId: pair[0].name, textEn: valid[0] ? text[0] : null },
        right: { abilityId: pair[1].name, textEn: valid[1] ? text[1] : null },
        source: `https://github.com/odota/dotaconstants/commit/${anchor.sha}`,
      })
    }
  }
  reports.push({ version: anchor.version, heroes: heroIds.size, rows: rows.filter(row => row.version === anchor.version).length, resolved, unresolved })
}

await mkdir(normalized, { recursive: true })
await writeFile(new URL('./snapshot-anchors.json', normalized), JSON.stringify(rows, null, 2) + '\n')
await writeFile(new URL('./snapshot-anchor-report.json', normalized), JSON.stringify(reports, null, 2) + '\n')
console.log(JSON.stringify({ anchors: reports.length, rows: rows.length, fullyResolved: reports.filter(report => report.unresolved === 0).length, reports }, null, 2))
