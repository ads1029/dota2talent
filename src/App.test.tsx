import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { archive, heroes, talentsForHero, versions } from './data'

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
    expect(screen.getByRole('button', { name: /朗戈.*Largo/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /朗戈.*Largo/ }))
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
    const values = [...document.querySelectorAll('.value')].map(x => Number(x.textContent?.replace('%','')))
    expect(values[0]).toBeGreaterThanOrEqual(values[1])
    fireEvent.click(screen.getByText('从高到低'))
    const ascValues = [...document.querySelectorAll('.value')].map(x => Number(x.textContent?.replace('%','')))
    expect(ascValues[0]).toBeLessThanOrEqual(ascValues[1])
  })
})
