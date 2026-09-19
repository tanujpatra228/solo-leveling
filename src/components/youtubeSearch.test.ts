import { describe, expect, it } from 'vitest'
import type { Exercise } from '../domain/types'
import { youtubeSearchUrlFor } from './youtubeSearch'

function exercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'test-exercise',
    name: 'Test Exercise',
    aliases: [],
    pattern: 'isolation',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 1,
    repRange: [8, 12],
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
    ...overrides,
  }
}

function queryOf(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('search_query') ?? '')
}

describe('youtubeSearchUrlFor', () => {
  it('always points at a YouTube search with the exercise name in the query', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Leg Raises' }))
    expect(url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/)
    expect(queryOf(url)).toContain('Leg Raises')
  })

  it('hints Michael Eckert for grip-trained exercises', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Dead Hang', primaryMuscles: ['grip'], equipment: ['pullup_bar'] }))
    expect(queryOf(url)).toContain('Michael Eckert')
  })

  it('hints Michael Eckert for any pull-up-bar exercise even without grip as a tracked muscle', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Pull-ups', primaryMuscles: ['lats'], equipment: ['pullup_bar'] }))
    expect(queryOf(url)).toContain('Michael Eckert')
  })

  it('hints Yellow Dude for bodyweight core exercises', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Leg Raises', pattern: 'core', equipment: ['bodyweight'] }))
    expect(queryOf(url)).toContain('Yellow Dude')
  })

  it('hints Hybrid Calisthenics for bodyweight exercises outside the core pattern', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Push-ups', pattern: 'horizontal_push', equipment: ['bodyweight'] }))
    expect(queryOf(url)).toContain('Hybrid Calisthenics')
  })

  it('hints Jeff Nippard for weighted gym equipment', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Barbell Squat', pattern: 'squat', equipment: ['barbell'] }))
    expect(queryOf(url)).toContain('Jeff Nippard')
  })

  it('classifies resistance bands as weighted, matching the domain\'s own LOAD_BEARING list, not as bodyweight', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Band Pull-Apart', pattern: 'isolation', equipment: ['bands'] }))
    expect(queryOf(url)).toContain('Jeff Nippard')
  })

  it('hints a calisthenics channel for a bench-assisted bodyweight exercise, since a bench adds no load', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Bench Dips', pattern: 'horizontal_push', equipment: ['bodyweight', 'bench'] }))
    expect(queryOf(url)).toContain('Hybrid Calisthenics')
  })

  it('adds no channel hint for cardio, and no channel name is silently attached', () => {
    const url = youtubeSearchUrlFor(exercise({ name: 'Treadmill Intervals', pattern: 'cardio', equipment: ['treadmill'] }))
    const query = queryOf(url)
    expect(query).toBe('Treadmill Intervals exercise')
  })

  it('percent-encodes spaces so an exercise name with an apostrophe still parses back to itself', () => {
    const url = youtubeSearchUrlFor(exercise({ name: "Farmer's Carry", pattern: 'carry', equipment: ['dumbbell'] }))
    expect(url).not.toContain(' ')
    expect(queryOf(url)).toContain("Farmer's Carry")
  })
})
