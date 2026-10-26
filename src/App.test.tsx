import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { archive, eventsForHero, heroes, talentsForHero, versions } from './data'
import { growthSnapshot, growthValue, heroGrowthRows, sortHeroGrowth, type GrowthColumn } from './heroGrowth'

afterEach(cleanup)

describe('Ancient Archive full dataset', () => {
  it('contains every patch and a complete current tree for every hero', () => {
    expect(versions).toHaveLength(133)
    expect(versions[0]).toBe('7.00')
    expect(versions.at(-1)).toBe('7.41e')
    expect(heroes).toHaveLength(127)
    expect(heroes.every(hero => talentsForHero('7.41e', hero.id).length === 8)).toBe(true)
    expect(Object.values(archive.events).flat()).toHaveLength(4614)
  })
  it('can find a newly released hero and show the imported current tree', () => {
    render(<App />)
    expect(document.querySelector('.roster-count')?.textContent).toContain('127 / 127 名英雄')
    const search = screen.getByPlaceholderText('搜索 127 名英雄…')
    fireEvent.change(search, { target: { value: 'Largo' } })
    expect(screen.getByRole('button', { name: '朗戈' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '朗戈' }))
    expect(screen.getByText('+15 蛙力千钧伤害')).toBeTruthy()
    expect(document.querySelectorAll('.talent-cell')).toHaveLength(8)
  })
  it('switches between hero archive and generic index', () => {
    render(<App />)
    expect(screen.getByText('+50 极寒领域伤害')).toBeTruthy()
    fireEvent.click(screen.getByText('通用天赋索引'))
    expect(screen.getByText('跨英雄比较可量化的通用属性天赋。独特、复合型天赋不会进入排名。')).toBeTruthy()
  })
  it('sorts generic talents by numeric value', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '通用天赋索引' }))
    const tableRows = document.querySelectorAll('.table-row')
    const heroImages = document.querySelectorAll('.table-hero-image img')
    expect(heroImages).toHaveLength(tableRows.length)
    expect([...heroImages].every(image => image.getAttribute('src')?.includes('/heroes/'))).toBe(true)
    expect(document.querySelectorAll('.table-hero i')).toHaveLength(0)
    const values = [...document.querySelectorAll('.value')].map(x => Number(x.textContent?.replace('%','')))
    expect(values[0]).toBeGreaterThanOrEqual(values[1])
    fireEvent.click(screen.getByText('从高到低'))
    const ascValues = [...document.querySelectorAll('.value')].map(x => Number(x.textContent?.replace('%','')))
    expect(ascValues[0]).toBeLessThanOrEqual(ascValues[1])
  })
  it('renders only the selected language and formats timeline talent text', () => {
    render(<App />)
    expect(screen.queryByText('Crystal Maiden')).toBeNull()
    fireEvent.click(screen.getByText('变更时间线'))
    expect(document.querySelector('.timeline-copy')).toBeTruthy()
    expect(document.querySelector('.talent-token')).toBeTruthy()
    const resistanceChange = [...document.querySelectorAll('.timeline-copy')].find(node => node.textContent?.includes('奥术光环魔法抗性减少至+6%'))
    expect(resistanceChange?.querySelector('.before-token')?.textContent).toBe('+8% 奥术光环魔法抗性')
    expect(resistanceChange?.querySelector('.after-token')?.textContent).toBe('+6%')
    expect([...document.querySelectorAll('.timeline-copy')].every(node => !/^天赋\s*[:：]/.test(node.textContent ?? ''))).toBe(true)
    expect(document.body.textContent).not.toContain('unknown')
    fireEvent.click(screen.getByRole('button', { name: /EN/ }))
    expect(screen.queryByText('水晶室女')).toBeNull()
    expect([...document.querySelectorAll('.timeline-copy')].every(node => !/^Talent\s*:/i.test(node.textContent ?? ''))).toBe(true)
  })
  it('classifies the former 7.02 unknown records as talent replacements', () => {
    const antiMage702 = eventsForHero('anti-mage').filter(event => event.version === '7.02')
    expect(antiMage702).toHaveLength(3)
    expect(antiMage702.every(event => event.type === 'replaced')).toBe(true)
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('搜索 127 名英雄…'), { target: { value: 'Anti-Mage' } })
    fireEvent.click(screen.getByRole('button', { name: '敌法师' }))
    fireEvent.click(screen.getByText('变更时间线'))
    expect(screen.getAllByText('天赋替换').length).toBeGreaterThan(0)
  })
  it('shows the newest timeline patch first and reverses the order on demand', () => {
    const events = eventsForHero('crystal-maiden')
    render(<App />)
    fireEvent.click(screen.getByText('变更时间线'))
    const firstVisibleVersion = () => document.querySelector('.time-meta b')?.textContent
    expect(screen.getByText('最新 → 最旧')).toBeTruthy()
    expect(firstVisibleVersion()).toBe(events.at(-1)?.version)
    fireEvent.click(screen.getByRole('button', { name: '切换时间线顺序' }))
    expect(screen.getByText('最旧 → 最新')).toBeTruthy()
    expect(firstVisibleVersion()).toBe(events[0].version)
  })
  it('ranks all heroes numerically in both directions for every growth column', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '属性成长排名' }))
    const table = screen.getByRole('table')
    const rows = () => within(table).getAllByRole('row').slice(1)
    expect(rows()).toHaveLength(127)
    expect(new Set(rows().map(row => within(row).getByRole('rowheader').textContent)).size).toBe(127)
    const values = (index: number) => rows().map(row => Number(within(row).getAllByRole('cell')[index].textContent))
    expect(values(3)).toEqual([...values(3)].sort((a, b) => b - a))
    for (const [index, column] of ['力量成长', '敏捷成长', '智力成长', '总成长'].entries()) {
      for (const direction of ['升序', '降序']) {
        const button = screen.getByRole('button', { name: `${column} ${direction}` })
        fireEvent.click(button)
        expect(button.getAttribute('aria-pressed')).toBe('true')
        expect(within(table).getAllByRole('button', { pressed: true })).toHaveLength(1)
        expect(within(table).getByRole('columnheader', { name: new RegExp(column) }).getAttribute('aria-sort')).toBe(direction === '升序' ? 'ascending' : 'descending')
        expect(values(index)).toEqual([...values(index)].sort((a, b) => direction === '升序' ? a - b : b - a))
      }
    }
    for (const row of rows()) {
      const [str, agi, int, total] = within(row).getAllByRole('cell').map(cell => Number(cell.textContent))
      expect(total).toBeCloseTo(str + agi + int, 4)
    }
    fireEvent.click(screen.getByRole('button', { name: /EN/ }))
    expect(screen.getByRole('heading', { name: 'Attribute growth' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Total Ascending' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hero archive' }))
    expect(screen.getByText('+50 Freezing Field Damage')).toBeTruthy()
  })
  it('has complete official growth data and preserves zero while sorting missing data last', () => {
    expect(growthSnapshot.officialHeroCount).toBe(heroes.length)
    expect(Object.keys(growthSnapshot.heroes).sort()).toEqual(heroes.map(hero => hero.id).sort())
    for (const row of heroGrowthRows) {
      expect(growthSnapshot.heroes[row.hero.id].numericId).toBe(row.hero.numericId)
      for (const column of ['strength', 'agility', 'intelligence', 'total'] as GrowthColumn[]) {
        expect(Number.isFinite(growthValue(row.values, column))).toBe(true)
      }
    }
    expect(growthValue({ strength: 0, agility: 1.1, intelligence: 2.2 }, 'total')).toBe(3.3)
    expect(growthValue({ strength: null, agility: 1, intelligence: 2 }, 'total')).toBeNull()
    const missing = { ...heroGrowthRows[0], values: { strength: null, agility: null, intelligence: null } }
    const zero = { ...heroGrowthRows[1], values: { strength: 0, agility: 0, intelligence: 0 } }
    for (const direction of ['asc', 'desc'] as const) {
      expect(sortHeroGrowth([missing, zero], 'total', direction)).toEqual([zero, missing])
    }
  })
})
