import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { heroCatalog } from '../src/heroCatalog'

type Branch = { textEn: string; textZh: string | null }
type Row = { heroId: string; version: '7.00' | '7.07'; level: 10 | 15 | 20 | 25; left: Branch; right: Branch; source: string }

const root = new URL('../data/', import.meta.url)
const baselineSources = [
  { version: '7.00' as const, en: '700-gameplay-en.html', zh: '700-gameplay-zh.html', url: 'https://www.dota2.com/700/gameplay' },
  { version: '7.07' as const, en: '707-official-en.html', zh: '707-official-zh.html', url: 'https://www.dota2.com/duelingfates/' },
]

// The official showcase pages omit the hero introduced by 7.00 and the two
// heroes introduced by 7.07. These rows come from the game-data snapshots
// shipped immediately after each release (hero ability slots + localization).
const supplementalRows: Row[] = [
  ...([
    [10, '+20 Attack Speed', '+20 攻击速度', '+5 Armor', '+5 护甲'],
    [15, '+275 Health', '+275 生命', '+20 Movement Speed', '+20 移动速度'],
    [20, '+40 Damage', '+40 攻击力', '+15 Strength', '+15 力量'],
    [25, '+25% Magic Resistance', '+25% 魔法抗性', '+50% Boundless Strike Crit', '+50% 棒击大地暴击'],
  ] as const).map(([level, leftEn, leftZh, rightEn, rightZh]) => ({
    heroId: 'monkey-king', version: '7.00' as const, level,
    left: { textEn: leftEn, textZh: leftZh }, right: { textEn: rightEn, textZh: rightZh },
    source: 'https://github.com/SteamTracking/GameTracking-Dota2/commit/0974c234e1e6fd9f9a2e0b84d78b101f7d96986f',
  })),
  ...([
    [10, '+20 Damage', '+20 攻击力', '+125 Cast Range', '+125 施法距离'],
    [15, '+90 Gold/Min', '+90 金钱/分', '+40 Movement Speed', '+40 移动速度'],
    [20, '10% Spell Lifesteal', '10% 技能吸血', '+300 Shadow Realm Max Damage', '+300 暗影之境最大伤害'],
    [25, '+200 Attack Speed', '+200 攻击速度', '+1 Terrorize Duration', '+1 恐吓持续时间'],
  ] as const).map(([level, leftEn, leftZh, rightEn, rightZh]) => ({
    heroId: 'dark-willow', version: '7.07' as const, level,
    left: { textEn: leftEn, textZh: leftZh }, right: { textEn: rightEn, textZh: rightZh },
    source: 'https://github.com/SteamTracking/GameTracking-Dota2/commit/5c233bdbac84c61db584c295167948f57868d68a',
  })),
  ...([
    [10, '+2 Mana Regen', '+2 魔法恢复', '+25 Movement Speed', '+25 移动速度'],
    [15, '2s Shield Crash CD in Ball', '圆球内甲盾冲击冷却为2秒', '+30 Attack Speed', '+30 攻击速度'],
    [20, '+30 Swashbuckle Damage', '+30 虚张声势伤害', '+20 Strength', '+20 力量'],
    [25, '-3s Swashbuckle Cooldown', '-3秒 虚张声势冷却', '-12s Rolling Thunder Cooldown', '-12秒 地雷滚滚冷却'],
  ] as const).map(([level, leftEn, leftZh, rightEn, rightZh]) => ({
    heroId: 'pangolier', version: '7.07' as const, level,
    left: { textEn: leftEn, textZh: leftZh }, right: { textEn: rightEn, textZh: rightZh },
    source: 'https://github.com/SteamTracking/GameTracking-Dota2/commit/5c233bdbac84c61db584c295167948f57868d68a',
  })),
]

const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
const clean = (html: string) => html
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x'
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10))
    }
    return entities[entity] ?? `&${entity};`
  })
  .replace(/\s+/g, ' ')
  .trim()

function extract(html: string) {
  const result = new Map<string, Map<number, [string, string]>>()
  for (const figure of html.matchAll(/<figure>([\s\S]*?)<\/figure>/gi)) {
    const key = figure[1].match(/<img[^>]*data-id=['"]([^'"]+)['"]/i)?.[1]
    if (!key) continue
    const levels = new Map<number, [string, string]>()
    for (const li of figure[1].matchAll(/<li>\s*(?:Level\s*)?(10|15|20|25)(?:级)?\s*[:：]\s*([\s\S]*?)<\/li>/gi)) {
      const branches = li[2].split(/<b>\s*(?:OR|或)\s*<\/b>|\s+OR\s+|\s+或\s+/i).map(clean)
      if (branches.length === 2) levels.set(Number(li[1]), [branches[0], branches[1]])
    }
    if (levels.size) result.set(key, levels)
  }
  return result
}

const heroByKey = new Map(heroCatalog.map(hero => [hero.key, hero]))
const rows: Row[] = []
const unmatchedKeys: string[] = []

for (const baseline of baselineSources) {
  const en = extract(await readFile(new URL(`./raw/early/${baseline.en}`, root), 'utf8'))
  const zh = extract(await readFile(new URL(`./raw/early/${baseline.zh}`, root), 'utf8'))
  for (const [key, levels] of en) {
    const hero = heroByKey.get(key)
    if (!hero) { unmatchedKeys.push(`${baseline.version}:${key}`); continue }
    for (const [level, branches] of levels) {
      const translated = zh.get(key)?.get(level)
      rows.push({
        heroId: hero.id,
        version: baseline.version,
        level: level as Row['level'],
        left: { textEn: branches[0], textZh: translated?.[0] ?? null },
        right: { textEn: branches[1], textZh: translated?.[1] ?? null },
        source: baseline.url,
      })
    }
  }
}

rows.push(...supplementalRows)

rows.sort((a, b) => a.version.localeCompare(b.version) || a.heroId.localeCompare(b.heroId) || a.level - b.level)
const rows700 = rows.filter(row => row.version === '7.00')
const report = {
  baselines: Object.fromEntries(baselineSources.map(source => {
    const baselineRows = rows.filter(row => row.version === source.version)
    return [source.version, { heroes: new Set(baselineRows.map(row => row.heroId)).size, talentRows: baselineRows.length, individualTalents: baselineRows.length * 2, bilingualRows: baselineRows.filter(row => row.left.textZh && row.right.textZh).length }]
  })),
  unmatchedKeys,
}
await mkdir(new URL('./normalized/', root), { recursive: true })
await writeFile(new URL('./normalized/initial-7.00-snapshot.json', root), JSON.stringify(rows700, null, 2) + '\n')
await writeFile(new URL('./normalized/baseline-snapshots.json', root), JSON.stringify(rows, null, 2) + '\n')
await writeFile(new URL('./normalized/initial-7.00-report.json', root), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
