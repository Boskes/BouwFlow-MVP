import { describe, expect, it } from 'vitest'
import { directCost, sellingTotal } from './domain'
import {
  buildOosterweelClass8DemoCalculation,
  OOSTERWEEL_DEMO_CHAPTER_COUNT,
  OOSTERWEEL_DEMO_ITEM_COUNT,
  OOSTERWEEL_DEMO_TARGET_DIRECT_COST,
} from './class8-demo-calculation'

describe('Oosterweel klasse-8-democalculatie', () => {
  const calculation = buildOosterweelClass8DemoCalculation()

  it('bevat exact de gevraagde schaal', () => {
    expect(calculation.chapters).toHaveLength(OOSTERWEEL_DEMO_CHAPTER_COUNT)
    expect(calculation.items).toHaveLength(OOSTERWEEL_DEMO_ITEM_COUNT)
    expect(new Set(calculation.chapters.map(chapter => chapter.id)).size).toBe(OOSTERWEEL_DEMO_CHAPTER_COUNT)
    expect(new Set(calculation.items.map(item => item.id)).size).toBe(OOSTERWEEL_DEMO_ITEM_COUNT)
    expect(new Set(calculation.items.map(item => item.code)).size).toBe(OOSTERWEEL_DEMO_ITEM_COUNT)
  })

  it('verdeelt alle posten over de 180 hoofdstukken', () => {
    const counts = new Map(calculation.chapters.map(chapter => [chapter.id, 0]))
    calculation.items.forEach(item => counts.set(item.chapterId!, (counts.get(item.chapterId!) ?? 0) + 1))
    expect([...counts.values()].every(count => count === 11 || count === 12)).toBe(true)
    expect(calculation.items.every(item => counts.has(item.chapterId!))).toBe(true)
  })

  it('levert een grote maar beheerste klasse-8-raming op', () => {
    expect(directCost(calculation)).toBeCloseTo(OOSTERWEEL_DEMO_TARGET_DIRECT_COST, -4)
    expect(sellingTotal(calculation)).toBeGreaterThan(800_000_000)
    expect(sellingTotal(calculation)).toBeLessThan(950_000_000)
    expect(calculation.items.every(item => item.quantity > 0 && item.labor >= 0 && item.material >= 0 && item.equipment >= 0 && item.subcontracting >= 0)).toBe(true)
  })
})
