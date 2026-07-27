import { describe, it, expect } from 'vitest'
import {
  datePaques, feriesFrance, feriesSet, estWeekend, estJourOuvre,
  prochainJourOuvre, precedentJourOuvre, addJoursOuvres, joursOuvresEntre,
} from './jours-ouvres'

describe('datePaques', () => {
  // Dimanches de Pâques connus (source : calendriers officiels)
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2000, '2000-04-23'],
  ])('Pâques %i = %s', (annee, attendu) => {
    expect(datePaques(annee)).toBe(attendu)
  })
})

describe('feriesFrance', () => {
  it('contient les 11 fériés légaux et les fêtes mobiles 2026', () => {
    const f = feriesFrance(2026)
    expect(f).toHaveLength(11)
    const dates = f.map((x) => x.date)
    expect(dates).toContain('2026-01-01') // Jour de l'an
    expect(dates).toContain('2026-04-06') // Lundi de Pâques (Pâques 05-04 + 1)
    expect(dates).toContain('2026-05-14') // Ascension (Pâques + 39)
    expect(dates).toContain('2026-05-25') // Lundi de Pentecôte (Pâques + 50)
    expect(dates).toContain('2026-07-14') // Fête nationale
    expect(dates).toContain('2026-12-25') // Noël
  })
})

describe('jours ouvrés', () => {
  const feries = feriesSet(2026, 2026)

  it('week-end détecté', () => {
    expect(estWeekend('2026-07-25')).toBe(true)  // samedi
    expect(estWeekend('2026-07-26')).toBe(true)  // dimanche
    expect(estWeekend('2026-07-24')).toBe(false) // vendredi
  })

  it('un férié n’est pas un jour ouvré', () => {
    expect(estJourOuvre('2026-07-14', feries)).toBe(false) // Fête nationale (mardi)
    expect(estJourOuvre('2026-07-13', feries)).toBe(true)  // lundi ouvré
  })

  it('prochainJourOuvre saute week-end et férié', () => {
    // samedi 2026-07-11 → lundi 2026-07-13
    expect(prochainJourOuvre('2026-07-11', feries)).toBe('2026-07-13')
    // 2026-07-14 (férié mardi) → mercredi 2026-07-15
    expect(prochainJourOuvre('2026-07-14', feries)).toBe('2026-07-15')
  })

  it('precedentJourOuvre recule sur week-end', () => {
    // dimanche 2026-07-12 → vendredi 2026-07-10
    expect(precedentJourOuvre('2026-07-12', feries)).toBe('2026-07-10')
  })

  it('addJoursOuvres saute le week-end', () => {
    // vendredi + 1 ouvré = lundi
    expect(addJoursOuvres('2026-07-24', 1, feries)).toBe('2026-07-27')
    // vendredi + 0 = le vendredi lui-même
    expect(addJoursOuvres('2026-07-24', 0, feries)).toBe('2026-07-24')
  })

  it('addJoursOuvres saute un férié intercalé', () => {
    // lundi 2026-07-13 + 1 ouvré : mardi 14 est férié → mercredi 15
    expect(addJoursOuvres('2026-07-13', 1, feries)).toBe('2026-07-15')
  })

  it('addJoursOuvres recule (n négatif)', () => {
    // lundi 2026-07-27 - 1 ouvré = vendredi 2026-07-24
    expect(addJoursOuvres('2026-07-27', -1, feries)).toBe('2026-07-24')
  })

  it('joursOuvresEntre exclut week-ends et fériés (bornes incluses)', () => {
    // lundi 13 → vendredi 17 juillet 2026 = 5 jours calendaires, mais le 14
    // est férié → 4 jours ouvrés
    expect(joursOuvresEntre('2026-07-13', '2026-07-17', feries)).toBe(4)
    // un seul jour ouvré
    expect(joursOuvresEntre('2026-07-13', '2026-07-13', feries)).toBe(1)
    // plage entièrement week-end
    expect(joursOuvresEntre('2026-07-25', '2026-07-26', feries)).toBe(0)
    // fin avant début
    expect(joursOuvresEntre('2026-07-17', '2026-07-13', feries)).toBe(0)
  })
})
