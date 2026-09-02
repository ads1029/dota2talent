import { readFile, writeFile } from 'node:fs/promises'

type Branch = { abilityId?: string; textEn: string | null; textZh: string | null; translationStatus?: string }
type Row = { heroId: string; entity: string; level: number; left: Branch; right: Branch }
type Talent = { name: string; nameLoc: string; nameRendered?: string }

const normalized = new URL('../data/normalized/', import.meta.url)
const snapshots = JSON.parse(await readFile(new URL('./version-snapshots.json', normalized), 'utf8')) as Array<{ version: string; rows: Row[] }>
const official = JSON.parse(await readFile(new URL('./current-official-talents.json', normalized), 'utf8')) as {
  version: string
  heroes: Record<string, { en: { talents: Talent[] }; zh: { talents: Talent[] } }>
}
const final = snapshots.at(-1)
if (!final || final.version !== official.version) throw new Error(`Current snapshot ${final?.version} does not match official ${official.version}`)

const manual = new Map<string, string>([
  ['tinker:7', '-0.25s Time to Rearm'],
  ['silencer:1', '+7% Suffer In Silence Silenced Target Damage'],
])

function render(template: string, source: string) {
  const values = source.match(/[+-]?\d+(?:\.\d+)?/g) ?? []
  let cursor = 0
  return template.replace(/\{s:[^}]+\}/g, placeholder => {
    const value = values[cursor++]
    if (value == null) return placeholder
    return value.replace(/^[+-]/, '')
  })
}

let branches = 0
const unresolved: Array<{ heroId: string; index: number; source: string; en: string; zh: string }> = []
for (const [heroId, localized] of Object.entries(official.heroes)) {
  if (localized.en.talents.length !== 8 || localized.zh.talents.length !== 8) throw new Error(`${heroId}: official current tree is not eight talents`)
  const rows = final.rows.filter(row => row.entity === 'hero' && row.heroId === heroId).sort((a, b) => a.level - b.level)
  if (rows.length !== 4) throw new Error(`${heroId}: reconstructed current tree is not four rows`)
  const reconstructed = rows.flatMap(row => [row.left, row.right])
  for (let index = 0; index < 8; index++) {
    const target = reconstructed[index]
    const en = localized.en.talents[index]
    const zh = localized.zh.talents[index]
    const source = manual.get(`${heroId}:${index}`) ?? target.textEn ?? en.nameRendered ?? en.nameLoc
    const textEn = en.nameRendered && !en.nameRendered.includes('{') ? en.nameRendered : render(en.nameLoc, source)
    const textZh = zh.nameRendered && !zh.nameRendered.includes('{') ? zh.nameRendered : render(zh.nameLoc, source)
    if (textEn.includes('{') || textZh.includes('{')) unresolved.push({ heroId, index, source, en: en.nameLoc, zh: zh.nameLoc })
    target.abilityId = en.name
    target.textEn = textEn
    target.textZh = textZh
    target.translationStatus = 'official'
    branches++
  }
}

if (unresolved.length) throw new Error(`Unexpanded current official templates: ${JSON.stringify(unresolved, null, 2)}`)
await writeFile(new URL('./version-snapshots.json', normalized), JSON.stringify(snapshots, null, 2) + '\n')
await writeFile(new URL('./current-snapshot-report.json', normalized), JSON.stringify({ version: final.version, heroes: Object.keys(official.heroes).length, branches, unresolvedTemplates: 0 }, null, 2) + '\n')
console.log(JSON.stringify({ version: final.version, heroes: Object.keys(official.heroes).length, branches, unresolvedTemplates: 0 }, null, 2))
