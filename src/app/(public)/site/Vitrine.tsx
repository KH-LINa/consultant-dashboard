'use client'

import { useState } from 'react'
import './vitrine.css'

const InfinityMark = () => (
  <svg viewBox="0 0 340 250" role="img" aria-hidden="true">
    <path
      d="M70 90 C70 48, 130 48, 170 90 C210 132, 270 132, 270 90 C270 48, 210 48, 170 90 C130 132, 70 132, 70 90 Z"
      fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round"
    />
    <circle cx="70" cy="90" r="13" fill="currentColor" />
  </svg>
)

export default function Vitrine() {
  const [theme, setTheme] = useState<'' | 'light' | 'dark'>('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')

  function toggleTheme() {
    setTheme((cur) => {
      const effective =
        cur || (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      return effective === 'dark' ? 'light' : 'dark'
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    setStatus('sending')
    setMsg('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('err')
        setMsg(json.error ?? "Une erreur est survenue, réessayez plus tard.")
        return
      }
      setStatus('ok')
      setMsg('Merci ! Votre demande a bien été envoyée. Je vous réponds sous 48h.')
      form.reset()
    } catch {
      setStatus('err')
      setMsg('Impossible d’envoyer la demande. Vérifiez votre connexion et réessayez.')
    }
  }

  return (
    <div className="iav" data-theme={theme || undefined}>
      <header className="site-header">
        <div className="wrap nav">
          <a className="brand" href="#top" aria-label="i·a·infinity accueil">
            <InfinityMark />
            <b>i·a·infinity</b>
          </a>
          <nav className="nav-links">
            <a href="#methode">Méthode</a>
            <a href="#offres">Offres</a>
            <a href="#outils">Boîte à outils</a>
            <a href="#apropos">À propos</a>
          </nav>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Changer de thème" title="Changer de thème">◐</button>
            <a className="btn btn-primary" href="#contact">Diagnostic gratuit</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="blob a" />
          <div className="blob b" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Conseil Lean &amp; IA industrielle</span>
              <h1>Fluidifiez vos opérations.<br />Puis <span className="accent">amplifiez-les</span> avec l&apos;IA.</h1>
              <p className="lead">J&apos;accompagne les industriels français à stabiliser leurs processus par le Lean, avant d&apos;y déployer l&apos;intelligence artificielle — dans cet ordre, jamais l&apos;inverse.</p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="#contact">Demander un diagnostic gratuit</a>
                <a className="btn btn-ghost" href="#methode">Voir la méthode</a>
              </div>
              <p className="hero-note">Khelaf FEDILA · Consultant Lean &amp; IA Industrielle · PME · ETI · Groupes</p>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <svg className="loop" viewBox="0 0 340 180">
                <path className="track" d="M70 90 C70 40, 140 40, 170 90 C200 140, 270 140, 270 90 C270 40, 200 40, 170 90 C140 140, 70 140, 70 90 Z" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
                <path className="flow" d="M70 90 C70 40, 140 40, 170 90 C200 140, 270 140, 270 90 C270 40, 200 40, 170 90 C140 140, 70 140, 70 90 Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                <circle className="node" cx="70" cy="90" r="11" fill="currentColor" />
              </svg>
            </div>
          </div>
        </section>

        {/* POUR QUI */}
        <section className="section alt" id="pourqui">
          <div className="wrap">
            <div className="section-head" style={{ marginBottom: 26 }}>
              <span className="eyebrow">Pour qui</span>
              <h2>Des ateliers plus fluides, des équipes qui gardent la main.</h2>
              <p>Je m&apos;adresse aux dirigeants et responsables industriels qui veulent des gains concrets sur le terrain — sans se lancer dans une « transformation IA » hors-sol.</p>
            </div>
            <div className="audience">
              <span>PME industrielles</span>
              <span>ETI</span>
              <span>Groupes &amp; sites de production</span>
              <span>Responsables production / méthodes</span>
              <span>Directions amélioration continue</span>
            </div>
          </div>
        </section>

        {/* MÉTHODE */}
        <section className="section" id="methode">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">La méthode</span>
              <h2>Comprendre, stabiliser, puis amplifier.</h2>
              <p>Une progression en trois temps. Chaque étape prépare la suivante — on ne saute jamais une marche.</p>
            </div>
            <div className="method">
              <div className="step">
                <h3>Comprendre avant d&apos;agir</h3>
                <p>Observation terrain (Gemba), cartographie des flux et mesure de l&apos;existant. On identifie les vrais gaspillages avant de toucher à quoi que ce soit.</p>
              </div>
              <div className="step">
                <h3>Stabiliser &amp; standardiser</h3>
                <p>Mise en place des standards Lean (5S, résolution de problèmes, pilotage visuel). Un processus fiable et répétable, tenu par les équipes.</p>
              </div>
              <div className="step">
                <h3>Amplifier avec l&apos;IA</h3>
                <p>Une fois le socle stable, on automatise : agents et RAG <em>(une IA qui répond à partir de vos propres documents internes)</em> pour démultiplier ce qui marche déjà.</p>
              </div>
            </div>
            <div className="rule-callout">
              <span className="k">Principe</span>
              <p>Jamais de déploiement IA sur un processus instable. Automatiser le désordre ne fait que produire du désordre plus vite — la stabilisation Lean vient toujours d&apos;abord.</p>
            </div>
          </div>
        </section>

        {/* OFFRES */}
        <section className="section alt" id="offres">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Les offres</span>
              <h2>Trois façons de travailler ensemble.</h2>
              <p>De l&apos;accompagnement terrain ponctuel à la solution complète Lean + IA, selon votre maturité.</p>
            </div>
            <div className="offers">
              <div className="offer">
                <span className="tag">01 — Consulting</span>
                <h3>Accompagnement Lean terrain</h3>
                <p>Diagnostic, chantiers d&apos;amélioration et montée en compétence de vos équipes sur les fondamentaux de l&apos;excellence opérationnelle.</p>
                <ul>
                  <li>Diagnostic flux &amp; gaspillages</li>
                  <li>Chantiers 5S, SMED, QRQC</li>
                  <li>Formation &amp; animation terrain</li>
                </ul>
              </div>
              <div className="offer">
                <span className="tag">02 — Automatisation</span>
                <h3>IA &amp; automatisation ciblée</h3>
                <p>Sur des processus déjà stabilisés, je conçois des automatisations utiles : agents, assistants documentaires, connexions entre vos outils.</p>
                <ul>
                  <li>Agents &amp; workflows automatisés</li>
                  <li>RAG sur vos documents internes</li>
                  <li>Intégration à vos outils existants</li>
                </ul>
              </div>
              <div className="offer">
                <span className="tag">03 — Solution globale</span>
                <h3>Lean + IA, de bout en bout</h3>
                <p>L&apos;accompagnement complet : on stabilise vos opérations, puis on les amplifie avec l&apos;IA, dans une même démarche cohérente et pilotée.</p>
                <ul>
                  <li>Feuille de route Lean → IA</li>
                  <li>Déploiement &amp; pilotage</li>
                  <li>Transfert d&apos;autonomie aux équipes</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* BOÎTE À OUTILS */}
        <section className="section" id="outils">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Boîte à outils</span>
              <h2>Des méthodes éprouvées, expliquées simplement.</h2>
              <p>Le vocabulaire de l&apos;amélioration continue, sans jargon inutile.</p>
            </div>
            <div className="tools">
              <div className="tool"><b>5S</b><span>Organiser et tenir un poste de travail propre et efficace.</span></div>
              <div className="tool"><b>VSM</b><span>Cartographier le flux pour voir où le temps se perd.</span></div>
              <div className="tool"><b>SMED</b><span>Réduire les temps de changement de série.</span></div>
              <div className="tool"><b>AMDEC</b><span>Anticiper les défaillances avant qu&apos;elles arrivent.</span></div>
              <div className="tool"><b>QRQC</b><span>Résoudre vite les problèmes, au plus près du terrain.</span></div>
              <div className="tool"><b>AIC</b><span>Animer la performance au quotidien, en équipe.</span></div>
              <div className="tool"><b>TRS</b><span>Mesurer le vrai rendement de vos équipements.</span></div>
              <div className="tool"><b>Agents &amp; RAG</b><span>L&apos;IA qui s&apos;appuie sur vos propres données internes.</span></div>
            </div>
          </div>
        </section>

        {/* À PROPOS */}
        <section className="section alt" id="apropos">
          <div className="wrap about">
            <div className="portrait">[À COMPLÉTER : photo de Khelaf FEDILA]</div>
            <div>
              <span className="eyebrow">À propos</span>
              <h2>Khelaf FEDILA</h2>
              <p>Consultant Lean &amp; IA Industrielle, j&apos;aide les entreprises industrielles à conjuguer deux mondes qui se parlent rarement : l&apos;amélioration continue héritée du terrain, et les possibilités concrètes de l&apos;intelligence artificielle.</p>
              <p>Ma conviction : l&apos;IA n&apos;a de valeur que posée sur des processus sains. C&apos;est pourquoi j&apos;interviens d&apos;abord comme praticien du Lean, avant d&apos;introduire l&apos;automatisation là où elle apporte un vrai gain.</p>
              <p style={{ marginTop: 20, fontSize: 15 }}><span className="placeholder">[À COMPLÉTER : parcours, années d&apos;expérience, secteurs / clients de référence]</span></p>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className="section contact" id="contact">
          <div className="wrap contact-grid">
            <div className="contact-copy">
              <span className="eyebrow">Parlons-en</span>
              <h2>Demandez votre diagnostic gratuit.</h2>
              <p>Décrivez-moi votre contexte en quelques lignes. Je vous réponds sous 48h pour cadrer un premier échange, sans engagement.</p>
              <div className="contact-list">
                <div><span className="lbl">Email</span><span className="placeholder">[À COMPLÉTER : email pro]</span></div>
                <div><span className="lbl">Téléphone</span><span className="placeholder">[À COMPLÉTER : téléphone]</span></div>
                <div><span className="lbl">LinkedIn</span><span className="placeholder">[À COMPLÉTER : profil LinkedIn]</span></div>
              </div>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              {/* Honeypot anti-bot : invisible pour les humains */}
              <div className="hp" aria-hidden="true">
                <label htmlFor="website">Ne pas remplir</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="nom">Nom complet *</label>
                  <input id="nom" name="nom" type="text" placeholder="Jean Dupont" required />
                </div>
                <div className="field">
                  <label htmlFor="entreprise">Entreprise *</label>
                  <input id="entreprise" name="entreprise" type="text" placeholder="Nom de votre société" required />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="email">Email *</label>
                  <input id="email" name="email" type="email" placeholder="jean@entreprise.fr" required />
                </div>
                <div className="field">
                  <label htmlFor="telephone">Téléphone</label>
                  <input id="telephone" name="telephone" type="tel" placeholder="+33 6 00 00 00 00" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="besoin">Votre besoin</label>
                <select id="besoin" name="besoin" defaultValue="Diagnostic gratuit">
                  <option>Diagnostic gratuit</option>
                  <option>Consulting — accompagnement Lean</option>
                  <option>Automatisation / IA</option>
                  <option>Solution globale Lean + IA</option>
                  <option>Autre / je ne sais pas encore</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="message">Votre contexte</label>
                <textarea id="message" name="message" placeholder="En quelques lignes : votre activité, votre enjeu principal…" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? 'Envoi…' : 'Envoyer ma demande'}
              </button>
              {status === 'ok' && <div className="toast ok" role="status">{msg}</div>}
              {status === 'err' && <div className="toast err" role="alert">{msg}</div>}
              {status !== 'ok' && (
                <p className="form-note">Vos coordonnées créent une demande directement transmise à Khelaf FEDILA.</p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap foot">
          <a className="brand" href="#top">
            <InfinityMark />
            <b>i·a·infinity</b>
          </a>
          <div className="legal">
            Khelaf FEDILA — Consultant Lean &amp; IA Industrielle<br />
            Auto-entrepreneur · SIRET [À COMPLÉTER] · TVA non applicable, art. 293 B du CGI<br />
            © {new Date().getFullYear()} i·a·infinity — Tous droits réservés
          </div>
        </div>
      </footer>
    </div>
  )
}
