import snapshot from './generated/hero-attribute-growth.json'
import { heroCatalog } from './heroCatalog'

export type GrowthValues = { strength: number | null; agility: number | null; intelligence: number | null }
export type GrowthColumn = keyof GrowthValues | 'total'
export type SortDirection = 'asc' | 'desc'
export const growthSnapshot = snapshot

export function growthValue(values: GrowthValues, column: GrowthColumn): number | null {
  const fields = column === 'total' ? [values.strength, values.agility, values.intelligence] : [values[column]]
  if (fields.some(value => typeof value !== 'number' || !Number.isFinite(value))) return null
  return Number((fields as number[]).reduce((sum, value) => sum + value, 0).toFixed(4))
}

const records: Partial<Record<string, GrowthValues>> = snapshot.heroes
export const heroGrowthRows = heroCatalog.map(hero => {
  const record = records[hero.id]
  return { hero, values: {
    strength: record?.strength ?? null,
    agility: record?.agility ?? null,
    intelligence: record?.intelligence ?? null,
  } }
})
export type GrowthRow = (typeof heroGrowthRows)[number]

export function sortHeroGrowth(rows: readonly GrowthRow[], column: GrowthColumn, direction: SortDirection) {
  return [...rows].sort((a, b) => {
    const left = growthValue(a.values, column), right = growthValue(b.values, column)
    // Missing records always follow valid values, in either direction.
    if (left === null) return right === null ? a.hero.numericId - b.hero.numericId : 1
    if (right === null) return -1
    return (direction === 'asc' ? left - right : right - left) || a.hero.numericId - b.hero.numericId
  })
}

const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })
export const formatGrowth = (value: number | null) => value === null ? '—' : numberFormat.format(value)
