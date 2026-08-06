'use client'

import { useState } from 'react'
import Link from 'next/link'
import '../vitrine.css'
import './test-maturite.css'
import { LEVIERS, NIVEAU_CONFIG } from '@/lib/maturite'
import {
  QUESTIONS_TEST, REPONSES_OPTIONS, calculerResultat, PALIER_PUBLIC, EXPLICATION_LEVIER,
  type ResultatTest,
} from '@/lib/maturite-test'
import type { NiveauMaturite } from '@/lib/types'

const InfinityMark = () => (
  <svg viewBox="0 0 340 250" role="img" aria-hidden="true">
    <path
      d="M70 90 C70 48, 130 48, 170 90 C210 132, 270 132, 270 90 C270 48, 210 48, 170 90 C130 132, 70 132, 70 90 Z"
      fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round"
    />
    <circle cx="70" cy="90" r="13" fill="currentColor" />
  </svg>
)

const NB_LEVIERS = LEVIERS.length
const ETAPE_CAPTURE = NB_LEVIERS
const ETAPE_RESULTAT = NB_LEVIERS + 1

const QUESTIONS_PAR_LEVIER = LEVIERS.map(({ champ, label }) => ({
  champ,
  label,
  indices: QUESTIONS_TEST
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.levier === champ)
    .map(({ i }) => i),
}))

export default function TestMaturite() {
  const [etape, setEtape] = useState(0)
  const [reponses, setReponses] = useState<(NiveauMaturite | null)[]>(
    Array(QUESTIONS_TEST.length).fill(null)
  )
  const [resultat, setResultat] = useState<ResultatTest | null>(null)
  const [form, setForm] = useState({ nom: '', email: '', entreprise: '', website: '' })
  const [envoi, setEnvoi] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [erreur, setErreur] = useState('')

  function repondre(indexQuestion: number, valeur: NiveauMaturite) {
    setReponses((prev) => {
      const next = [...prev]
      next[indexQuestion] = valeur
      return next
    })
  }

  const leverActuel = etape < NB_LEVIERS ? QUESTIONS_PAR_LEVIER[etape] : null
  const leverComplet = leverActuel ? leverActuel.indices.every((i) => reponses[i] !== null) : false

  function suivant() {
    if (etape < NB_LEVIERS - 1) {
      setEtape((e) => e + 1)
      return
    }
    const r = calculerResultat(reponses as NiveauMaturite[])
    setResultat(r)
    setEtape(ETAPE_CAPTURE)
  }

  function precedent() {
    if (etape > 0) setEtape((e) => e - 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resultat) return
    if (form.website.trim() !== '') {
      // Honeypot : bot détecté, on affiche le résultat sans rien envoyer.
      setEnvoi('ok')
      setEtape(ETAPE_RESULTAT)
      return
    }
    setEnvoi('sending')
    setErreur('')
    try {
      const res = await fetch('/api/test-maturite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom, email: form.email, entreprise: form.entreprise,
          niveaux: resultat.niveaux, score: resultat.score, recommandation: resultat.recommandation,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEnvoi('err')
        setErreur(json.error ?? 'Une erreur est survenue, réessayez plus tard.')
        return
      }
      setEnvoi('ok')
      setEtape(ETAPE_RESULTAT)
    } catch {
      setEnvoi('err')
      setErreur('Impossible d\'envoyer votre résultat. Vérifiez votre connexion et réessayez.')
    }
  }

  const progression = Math.round((Math.min(etape, NB_LEVIERS) / NB_LEVIERS) * 100)

  return (
    <div className="iav tm">
      <header className="site-header">
        <div className="wrap nav">
          <Link className="brand" href="/site" aria-label="Yndra accueil">
            <InfinityMark />
            <b>Yndra</b>
          </Link>
          <Link className="btn btn-ghost tm-back" href="/site">← Retour au site</Link>
        </div>
      </header>

      <main className="tm-main">
        <div className="wrap tm-wrap">
          {etape <= NB_LEVIERS - 1 && (
            <>
              <div className="tm-progress">
                <div className="tm-progress-bar"><div style={{ width: `${progression}%` }} /></div>
                <span>Levier {etape + 1} / {NB_LEVIERS}</span>
              </div>

              <div className="section-head" style={{ marginBottom: 28 }}>
                <span className="eyebrow">Test de maturité IA</span>
                <h1>{leverActuel!.label}</h1>
              </div>

              <div className="tm-questions">
                {leverActuel!.indices.map((i) => (
                  <div className="tm-question" key={i}>
                    <p>{QUESTIONS_TEST[i].texte}</p>
                    <div className="tm-options">
                      {REPONSES_OPTIONS.map((opt) => (
                        <button
                          key={opt.valeur}
                          type="button"
                          className={`tm-option ${reponses[i] === opt.valeur ? 'active' : ''}`}
                          onClick={() => repondre(i, opt.valeur)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="tm-nav">
                {etape > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={precedent}>Précédent</button>
                ) : <span />}
                <button type="button" className="btn btn-primary" disabled={!leverComplet} onClick={suivant}>
                  {etape < NB_LEVIERS - 1 ? 'Suivant' : 'Voir mon résultat'}
                </button>
              </div>
            </>
          )}

          {etape === ETAPE_CAPTURE && resultat && (
            <div className="tm-capture">
              <span className="eyebrow">Votre résultat</span>
              <h1>{PALIER_PUBLIC[resultat.recommandation].titre}</h1>
              <p className="lead">Recevez votre analyse détaillée, levier par levier, et gardez une trace de ce résultat.</p>

              <form onSubmit={handleSubmit} noValidate className="tm-form">
                <div className="hp" aria-hidden="true">
                  <label htmlFor="tm-website">Ne pas remplir</label>
                  <input id="tm-website" type="text" tabIndex={-1} autoComplete="off"
                    value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                </div>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="tm-nom">Nom complet *</label>
                    <input id="tm-nom" type="text" placeholder="Jean Dupont" required
                      value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="tm-entreprise">Entreprise</label>
                    <input id="tm-entreprise" type="text" placeholder="Nom de votre société"
                      value={form.entreprise} onChange={(e) => setForm((f) => ({ ...f, entreprise: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="tm-email">Email *</label>
                  <input id="tm-email" type="email" placeholder="jean@entreprise.fr" required
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={envoi === 'sending'}>
                  {envoi === 'sending' ? 'Envoi…' : 'Voir mon analyse détaillée'}
                </button>
                {envoi === 'err' && <div className="toast err" role="alert">{erreur}</div>}
                <p className="form-note">Vos coordonnées créent un contact directement transmis à Khelaf FEDILA.</p>
              </form>
            </div>
          )}

          {etape === ETAPE_RESULTAT && resultat && (
            <div className="tm-resultat">
              <span className="eyebrow">Votre analyse détaillée</span>
              <h1>{PALIER_PUBLIC[resultat.recommandation].titre}</h1>
              <p className="lead">{PALIER_PUBLIC[resultat.recommandation].texte}</p>

              <div className="tm-leviers">
                {LEVIERS.map(({ champ, label }) => {
                  const niveau = resultat.niveaux[champ]
                  return (
                    <div className="tm-levier-card" key={champ}>
                      <div className="tm-levier-head">
                        <b>{label}</b>
                        <span className={`tm-badge ${niveau}`}>{NIVEAU_CONFIG[niveau].label}</span>
                      </div>
                      <p>{EXPLICATION_LEVIER[champ][niveau]}</p>
                    </div>
                  )
                })}
              </div>

              <div className="tm-cta">
                <p>Envie d&apos;en discuter directement ?</p>
                <div className="hero-cta">
                  <a className="btn btn-primary" href="mailto:k.fedila@gmail.com">Écrire un email</a>
                  <a className="btn btn-ghost" href="tel:+33651235074">Appeler</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap foot">
          <Link className="brand" href="/site">
            <InfinityMark />
            <b>Yndra</b>
          </Link>
          <div className="legal">
            Khelaf FEDILA — Consultant Lean &amp; IA Industrielle<br />
            [STATUT JURIDIQUE À COMPLÉTER] · SIRET [À COMPLÉTER] · TVA non applicable, art. 293 B du CGI<br />
            © {new Date().getFullYear()} Yndra — Tous droits réservés
          </div>
        </div>
      </footer>
    </div>
  )
}
