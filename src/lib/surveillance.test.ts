import { describe, it, expect } from 'vitest'
import {
  alertesProjet, alertesTousProjets, nbAlertes, conflitsCollaborateurs, conflitsRessourcesModule,
  conflitsIndisponibilite, conflitsIndisponibiliteCollaborateurs, conflitsIndisponibiliteJalons,
  indisponibiliteChevauchante, recapsRessources,
} from './surveillance'
import { feriesSet } from './jours-ouvres'
import type {
  Project, ProjectTask, ProjectPhase, ProjectMilestone, TaskDependency, PhaseDependency,
  Collaborateur, Resource, ResourceAssignment, ResourceUnavailability, ResourceUnavailabilityMotif,
  CollaborateurUnavailability,
} from './types'

const feries = feriesSet(2026, 2026)
const AUJ = '2026-07-24' // vendredi
const DANS3J = '2026-07-27'

function projet(id: string, statut: Project['statut'] = 'en_cours'): Project {
  return { id, quote_id: null, contact_id: 'c1', titre: `Projet ${id}`, statut, date_debut: null, date_fin_prevue: null, created_at: '' }
}

function tache(
  id: string, dateFin: string | null, statut: ProjectTask['statut'] = 'a_faire', projectId = 'p1'
): ProjectTask {
  return {
    id, project_id: projectId, phase_id: null, parent_task_id: null, responsable_id: null,
    titre: id, date_debut: dateFin, date_fin: dateFin, heure_debut: null, heure_fin: null,
    statut, avancement: 0, ordre: 0, created_at: '', serie_id: null, pert_x: null, pert_y: null,
  }
}

function jalon(
  id: string, dateEcheance: string | null, statut: ProjectMilestone['statut'] = 'a_faire', projectId = 'p1',
  responsableId: string | null = null
): ProjectMilestone {
  return {
    id, project_id: projectId, titre: id, date_echeance: dateEcheance, statut, livrable: null, ordre: 0,
    created_at: '', responsable_id: responsableId,
  }
}

function phase(id: string, debut: string, fin: string, projectId = 'p1'): ProjectPhase {
  return { id, project_id: projectId, titre: id, date_debut: debut, date_fin: fin, couleur: '#000', ordre: 0, created_at: '' }
}

// Tâche avec début/fin distincts et un responsable — pour les tests de chevauchement.
function tachePeriode(
  id: string, debut: string, fin: string, projectId = 'p1', responsableId: string | null = null,
  heureDebut: string | null = null, heureFin: string | null = null
): ProjectTask {
  return {
    id, project_id: projectId, phase_id: null, parent_task_id: null, responsable_id: responsableId,
    titre: id, date_debut: debut, date_fin: fin, heure_debut: heureDebut, heure_fin: heureFin,
    statut: 'a_faire', avancement: 0, ordre: 0, created_at: '', serie_id: null, pert_x: null, pert_y: null,
  }
}

function collaborateur(id: string, nom: string): Collaborateur {
  return {
    id, nom, email: null, telephone: null, role: null, couleur: '#000',
    code_collaborateur: null, notes: null, actif: true, resource_id: null, created_at: '',
    date_entree: null, type_contrat: null, cout_horaire: 0, competences: [], photo_url: null,
  }
}

function resource(id: string, nom: string, email: string | null = null, type: Resource['type'] = 'humain'): Resource {
  return { id, nom, type, cout_horaire: 0, notes: null, email, created_at: '' }
}

function affectation(
  id: string, resourceId: string, projectId: string, taskId: string | null, heures = 0, budget = 0
): ResourceAssignment {
  return { id, resource_id: resourceId, project_id: projectId, task_id: taskId, heures, budget, created_at: '' }
}

function indisponibilite(
  id: string, resourceId: string, debut: string, fin: string, motif: ResourceUnavailabilityMotif = 'conge'
): ResourceUnavailability {
  return { id, resource_id: resourceId, date_debut: debut, date_fin: fin, motif, note: null, created_at: '' }
}

function indisponibiliteCollab(
  id: string, collaborateurId: string, debut: string, fin: string, motif: ResourceUnavailabilityMotif = 'conge'
): CollaborateurUnavailability {
  return { id, collaborateur_id: collaborateurId, date_debut: debut, date_fin: fin, motif, note: null, created_at: '' }
}

describe('alertesProjet', () => {
  it('aucune alerte quand tout est à jour', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-08-01')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(nbAlertes(a)).toBe(0)
  })

  it('détecte une tâche en retard (statut pas fait, date passée)', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-07-20', 'en_cours')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(a.tachesEnRetard).toHaveLength(1)
    expect(a.tachesEnRetard[0].joursRetard).toBe(4)
  })

  it('une tâche en retard mais déjà "fait" ne compte pas', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-07-20', 'fait')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(a.tachesEnRetard).toHaveLength(0)
  })

  it('détecte un jalon en retard (statut pas atteint, date passée)', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-22', 'a_faire')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsEnRetard).toHaveLength(1)
    expect(a.jalonsEnRetard[0].joursRetard).toBe(2)
  })

  it('détecte un jalon proche (dans les 3 jours, pas encore atteint)', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-26', 'a_faire')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsProches).toHaveLength(1)
  })

  it('un jalon proche mais déjà atteint ne compte pas', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-26', 'atteint')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsProches).toHaveLength(0)
  })

  it('détecte un conflit de dépendance entre tâches', () => {
    const tasks = [tache('a', '2026-07-24'), tache('b', '2026-07-23')]
    const deps: TaskDependency[] = [{ id: 'd1', predecessor_id: 'a', successor_id: 'b', type: 'FS', lag_days: 0, created_at: '' }]
    const a = alertesProjet(projet('p1'), tasks, [], [], deps, [], AUJ, DANS3J, feries)
    expect(a.conflitsTaches).toHaveLength(1)
  })

  it('détecte un conflit de dépendance entre phases', () => {
    const phases = [phase('ph1', '2026-07-20', '2026-07-24'), phase('ph2', '2026-07-22', '2026-07-28')]
    const deps: PhaseDependency[] = [{ id: 'd1', predecessor_id: 'ph1', successor_id: 'ph2', type: 'FS', lag_days: 0, created_at: '' }]
    const a = alertesProjet(projet('p1'), [], phases, [], [], deps, AUJ, DANS3J, feries)
    expect(a.conflitsPhases).toHaveLength(1)
  })
})

describe('alertesTousProjets', () => {
  it('ne garde que les projets ayant au moins une alerte', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      tache('t1', '2026-07-20', 'en_cours', 'p1'), // en retard
      tache('t2', '2026-08-15', 'a_faire', 'p2'),  // à jour
    ]
    const result = alertesTousProjets(projects, tasks, [], [], [], [], AUJ, DANS3J, feries)
    expect(result).toHaveLength(1)
    expect(result[0].projet.id).toBe('p1')
  })

  it('les dépendances et tâches d\'un autre projet ne polluent pas le calcul', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      tache('a', '2026-07-24', 'a_faire', 'p1'), tache('b', '2026-07-23', 'a_faire', 'p1'),
      tache('c', '2026-07-24', 'a_faire', 'p2'), tache('d', '2026-07-23', 'a_faire', 'p2'),
    ]
    // Un lien croisé entre projets (ne devrait matcher aucun des deux, faute de tâches communes)
    const deps: TaskDependency[] = [
      { id: 'd1', predecessor_id: 'a', successor_id: 'b', type: 'FS', lag_days: 0, created_at: '' },
      { id: 'd2', predecessor_id: 'c', successor_id: 'd', type: 'FS', lag_days: 0, created_at: '' },
    ]
    const result = alertesTousProjets(projects, tasks, [], [], deps, [], AUJ, DANS3J, feries)
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.projet.id === 'p1')!.conflitsTaches).toHaveLength(1)
    expect(result.find((r) => r.projet.id === 'p2')!.conflitsTaches).toHaveLength(1)
  })

  it('aucun projet actif → tableau vide', () => {
    expect(alertesTousProjets([], [], [], [], [], [], AUJ, DANS3J, feries)).toHaveLength(0)
  })
})

describe('conflitsCollaborateurs', () => {
  it('détecte un même collaborateur sur des tâches qui se chevauchent, sur 2 projets différents', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p2', 'c1'),
    ]
    const conflits = conflitsCollaborateurs(tasks, projects, collabs)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].nom).toBe('Lina')
    expect(conflits[0].a.projetTitre).toBe('Projet p1')
    expect(conflits[0].b.projetTitre).toBe('Projet p2')
  })

  it('pas de conflit si les périodes ne se chevauchent pas', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-26', 'p1', 'c1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p2', 'c1'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(0)
  })

  it('pas de conflit si le chevauchement est sur le MÊME projet', () => {
    const projects = [projet('p1')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p1', 'c1'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(0)
  })

  it('pas de conflit entre collaborateurs différents', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina'), collaborateur('c2', 'Khelaf')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p2', 'c2'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(0)
  })

  it('ignore les tâches sans responsable ou sans dates', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      { ...tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', null) },
      { ...tachePeriode('t2', '2026-07-27', '2026-07-29', 'p2', 'c1'), date_debut: null },
    ]
    expect(conflitsCollaborateurs(tasks, projects, [collaborateur('c1', 'Lina')])).toHaveLength(0)
  })

  it('même jour, heures disjointes des deux côtés → pas de conflit (affiné à l\'heure)', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-25', 'p1', 'c1', '09:00', '11:00'),
      tachePeriode('t2', '2026-07-25', '2026-07-25', 'p2', 'c1', '14:00', '16:00'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(0)
  })

  it('même jour, heures qui se chevauchent des deux côtés → conflit', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-25', 'p1', 'c1', '09:00', '11:00'),
      tachePeriode('t2', '2026-07-25', '2026-07-25', 'p2', 'c1', '10:00', '12:00'),
    ]
    const conflits = conflitsCollaborateurs(tasks, projects, collabs)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].a.heureDebut).toBe('09:00')
  })

  it('même jour, heures qui se touchent exactement (10h-11h et 11h-12h) → pas de conflit', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-25', 'p1', 'c1', '10:00', '11:00'),
      tachePeriode('t2', '2026-07-25', '2026-07-25', 'p2', 'c1', '11:00', '12:00'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(0)
  })

  it('heure précisée d\'un seul côté → pas assez d\'info pour affiner, on garde le conflit jour entier', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-25', 'p1', 'c1', '09:00', '11:00'),
      tachePeriode('t2', '2026-07-25', '2026-07-25', 'p2', 'c1'), // pas d'heure précisée
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(1)
  })

  it('tâche sur plusieurs jours avec heures : les heures ne s\'appliquent pas, le chevauchement de jours suffit', () => {
    const projects = [projet('p1'), projet('p2')]
    const collabs = [collaborateur('c1', 'Lina')]
    const tasks = [
      // t1 dure 2 jours (25→26), même si des heures sont renseignées elles ne réduisent pas la période
      tachePeriode('t1', '2026-07-25', '2026-07-26', 'p1', 'c1', '09:00', '11:00'),
      tachePeriode('t2', '2026-07-26', '2026-07-26', 'p2', 'c1', '14:00', '16:00'),
    ]
    expect(conflitsCollaborateurs(tasks, projects, collabs)).toHaveLength(1)
  })
})

describe('conflitsRessourcesModule', () => {
  it('détecte une même ressource affectée à des tâches qui se chevauchent, sur 2 projets différents', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p2'),
    ]
    const resources = [resource('r1', 'Pelleteuse')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1'), affectation('a2', 'r1', 'p2', 't2')]
    const conflits = conflitsRessourcesModule(assignments, tasks, projects, resources)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].nom).toBe('Pelleteuse')
    expect(conflits[0].type).toBe('ressource')
  })

  it('ignore les affectations sans task_id (pas de date propre)', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1')]
    const resources = [resource('r1', 'Pelleteuse')]
    // a2 est une affectation au niveau projet entier, sans tâche → aucune date exploitable
    const assignments = [affectation('a1', 'r1', 'p1', 't1'), affectation('a2', 'r1', 'p2', null)]
    expect(conflitsRessourcesModule(assignments, tasks, projects, resources)).toHaveLength(0)
  })

  it('pas de conflit si le chevauchement est sur le MÊME projet', () => {
    const projects = [projet('p1')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1'),
      tachePeriode('t2', '2026-07-27', '2026-07-29', 'p1'),
    ]
    const resources = [resource('r1', 'Pelleteuse')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1'), affectation('a2', 'r1', 'p1', 't2')]
    expect(conflitsRessourcesModule(assignments, tasks, projects, resources)).toHaveLength(0)
  })
})

describe('conflitsIndisponibilite', () => {
  it('détecte une ressource affectée à une tâche pendant une période où elle est indisponible', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1')]
    const resources = [resource('r1', 'Madjid')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1')]
    const indispos = [indisponibilite('u1', 'r1', '2026-07-20', '2026-07-26', 'conge')]
    const conflits = conflitsIndisponibilite(assignments, tasks, resources, indispos, projects)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].ressourceNom).toBe('Madjid')
    expect(conflits[0].motif).toBe('conge')
    expect(conflits[0].projetTitre).toBe('Projet p1')
  })

  it('pas de conflit si la période d\'indisponibilité ne chevauche pas la tâche', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1')]
    const resources = [resource('r1', 'Madjid')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1')]
    const indispos = [indisponibilite('u1', 'r1', '2026-08-01', '2026-08-05', 'conge')]
    expect(conflitsIndisponibilite(assignments, tasks, resources, indispos, projects)).toHaveLength(0)
  })

  it('ignore les indisponibilités d\'une AUTRE ressource', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1')]
    const resources = [resource('r1', 'Madjid'), resource('r2', 'Lina')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1')]
    const indispos = [indisponibilite('u1', 'r2', '2026-07-25', '2026-07-28', 'maladie')]
    expect(conflitsIndisponibilite(assignments, tasks, resources, indispos, projects)).toHaveLength(0)
  })

  it('ignore les affectations sans task_id (pas de date propre)', () => {
    const projects = [projet('p1')]
    const resources = [resource('r1', 'Madjid')]
    const assignments = [affectation('a1', 'r1', 'p1', null)]
    const indispos = [indisponibilite('u1', 'r1', '2026-07-01', '2026-12-31', 'conge')]
    expect(conflitsIndisponibilite(assignments, [], resources, indispos, projects)).toHaveLength(0)
  })
})

describe('indisponibiliteChevauchante', () => {
  it('renvoie la période qui chevauche', () => {
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-20', '2026-07-26', 'conge')]
    expect(indisponibiliteChevauchante('2026-07-25', '2026-07-28', indispos)?.id).toBe('u1')
  })

  it('renvoie null si aucune période ne chevauche', () => {
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-08-01', '2026-08-05', 'conge')]
    expect(indisponibiliteChevauchante('2026-07-25', '2026-07-28', indispos)).toBeNull()
  })
})

describe('conflitsIndisponibiliteCollaborateurs', () => {
  it('détecte un collaborateur responsable d\'une tâche pendant son propre congé', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1')]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-20', '2026-07-26', 'conge')]
    const conflits = conflitsIndisponibiliteCollaborateurs(tasks, projects, collaborateurs, indispos)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].collaborateurNom).toBe('Madjid')
    expect(conflits[0].motif).toBe('conge')
    expect(conflits[0].projetTitre).toBe('Projet p1')
  })

  it('pas de conflit si la période ne chevauche pas la tâche', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1')]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-08-01', '2026-08-05', 'conge')]
    expect(conflitsIndisponibiliteCollaborateurs(tasks, projects, collaborateurs, indispos)).toHaveLength(0)
  })

  it('ignore les indisponibilités d\'un AUTRE collaborateur', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', 'c1')]
    const collaborateurs = [collaborateur('c1', 'Madjid'), collaborateur('c2', 'Lina')]
    const indispos = [indisponibiliteCollab('u1', 'c2', '2026-07-25', '2026-07-28', 'maladie')]
    expect(conflitsIndisponibiliteCollaborateurs(tasks, projects, collaborateurs, indispos)).toHaveLength(0)
  })

  it('ignore les tâches sans responsable ou sans dates', () => {
    const projects = [projet('p1')]
    const tasks = [
      tachePeriode('t1', '2026-07-25', '2026-07-28', 'p1', null),
      { ...tachePeriode('t2', '2026-07-25', '2026-07-28', 'p1', 'c1'), date_debut: null },
    ]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-01', '2026-12-31', 'conge')]
    expect(conflitsIndisponibiliteCollaborateurs(tasks, projects, collaborateurs, indispos)).toHaveLength(0)
  })
})

describe('conflitsIndisponibiliteJalons', () => {
  it('détecte un jalon dont l\'échéance tombe pendant le congé de son responsable', () => {
    const projects = [projet('p1')]
    const milestones = [jalon('m1', '2026-07-25', 'a_faire', 'p1', 'c1')]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-20', '2026-07-26', 'conge')]
    const conflits = conflitsIndisponibiliteJalons(milestones, projects, collaborateurs, indispos)
    expect(conflits).toHaveLength(1)
    expect(conflits[0].collaborateurNom).toBe('Madjid')
    expect(conflits[0].jalonTitre).toBe('m1')
  })

  it('pas de conflit si l\'échéance ne tombe pas dans la période', () => {
    const projects = [projet('p1')]
    const milestones = [jalon('m1', '2026-08-10', 'a_faire', 'p1', 'c1')]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-20', '2026-07-26', 'conge')]
    expect(conflitsIndisponibiliteJalons(milestones, projects, collaborateurs, indispos)).toHaveLength(0)
  })

  it('ignore les jalons sans responsable ou sans échéance', () => {
    const projects = [projet('p1')]
    const milestones = [
      jalon('m1', '2026-07-25', 'a_faire', 'p1', null),
      jalon('m2', null, 'a_faire', 'p1', 'c1'),
    ]
    const collaborateurs = [collaborateur('c1', 'Madjid')]
    const indispos = [indisponibiliteCollab('u1', 'c1', '2026-07-01', '2026-12-31', 'conge')]
    expect(conflitsIndisponibiliteJalons(milestones, projects, collaborateurs, indispos)).toHaveLength(0)
  })
})

describe('recapsRessources', () => {
  it('inclut une affectation au niveau projet (sans tâche), avec heures/budget', () => {
    const projects = [projet('p1')]
    const resources = [resource('r1', 'Madjid', 'madjid@exemple.fr')]
    const assignments = [affectation('a1', 'r1', 'p1', null, 12, 500)]
    const recaps = recapsRessources(resources, assignments, [], projects)
    expect(recaps).toHaveLength(1)
    expect(recaps[0].resourceEmail).toBe('madjid@exemple.fr')
    expect(recaps[0].items).toEqual([
      { projetId: 'p1', projetTitre: 'Projet p1', tacheTitre: null, tacheDebut: null, tacheFin: null, tacheStatut: null, heures: 12, budget: 500 },
    ])
  })

  it('inclut une tâche pas encore faite, avec ses dates/statut', () => {
    const projects = [projet('p1')]
    const tasks = [tachePeriode('t1', '2026-08-01', '2026-08-05', 'p1')]
    const resources = [resource('r1', 'Madjid', 'madjid@exemple.fr')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1')]
    const recaps = recapsRessources(resources, assignments, tasks, projects)
    expect(recaps).toHaveLength(1)
    expect(recaps[0].items[0].tacheTitre).toBe('t1')
    expect(recaps[0].items[0].tacheStatut).toBe('a_faire')
  })

  it('omet une affectation liée à une tâche déjà "fait"', () => {
    const projects = [projet('p1')]
    const tasks = [tache('t1', '2026-08-01', 'fait', 'p1')]
    const resources = [resource('r1', 'Madjid', 'madjid@exemple.fr')]
    const assignments = [affectation('a1', 'r1', 'p1', 't1')]
    expect(recapsRessources(resources, assignments, tasks, projects)).toHaveLength(0)
  })

  it('ignore une ressource sans email', () => {
    const projects = [projet('p1')]
    const resources = [resource('r1', 'Madjid', null)]
    const assignments = [affectation('a1', 'r1', 'p1', null)]
    expect(recapsRessources(resources, assignments, [], projects)).toHaveLength(0)
  })

  it('ignore une ressource de type matériel même avec un email', () => {
    const projects = [projet('p1')]
    const resources = [resource('r1', 'Nacelle', 'contact@loueur.fr', 'materiel')]
    const assignments = [affectation('a1', 'r1', 'p1', null)]
    expect(recapsRessources(resources, assignments, [], projects)).toHaveLength(0)
  })

  it('ignore une affectation sur un projet absent de la liste (non actif)', () => {
    const projects = [projet('p1')] // p2 volontairement absent (ex. terminé/annulé)
    const resources = [resource('r1', 'Madjid', 'madjid@exemple.fr')]
    const assignments = [affectation('a1', 'r1', 'p2', null)]
    expect(recapsRessources(resources, assignments, [], projects)).toHaveLength(0)
  })

  it('une ressource sans aucune affectation à signaler est absente du résultat', () => {
    const resources = [resource('r1', 'Madjid', 'madjid@exemple.fr')]
    expect(recapsRessources(resources, [], [], [])).toHaveLength(0)
  })
})
