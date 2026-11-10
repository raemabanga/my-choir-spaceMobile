// Bottom sheets de l'écran « Comptes & Rôles » : détail d'un compte, création, modification,
// attribution de rôle et affichage du mot de passe temporaire.
// Équivalent mobile des modales du web (components/portail/modals/*compte*, *role*, *mdp*).

import { Ban, Check, Eye, EyeOff, KeyRound, Pencil, RotateCcw, ShieldPlus, Trash2 } from "lucide-react-native"
import React, { useState, useSyncExternalStore } from "react"
import { Pressable, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import {
  ApiError,
  attribuerRole,
  createCompte,
  modifierCompte,
  reinitialiserMotDePasse,
  revoquerRole,
  setCompteActif,
  supprimerCompte,
  type Compte,
} from "../../lib/api"
import { dataChanged } from "../../lib/offline"
import { compteRepository } from "../../lib/offline/entities"
import { BASIC_ROLES, INITIAL_ROLES, MANDATE_ROLES, ROLE_LABEL } from "../../lib/roles"
import type { Role } from "../../types"
import { Button, Card, cx, Field, FormRow2, KeyValue, Muted, Pill, RowBetween, SectionHeader, Select, SheetTitle } from "../ui"

/* ------------------------------------ Liste partagée ------------------------------------ */

// Le contenu d'un sheet est figé au moment de `openSheet` : il ne suit pas l'état de l'écran.
// La liste des comptes vit donc dans ce petit store, lu par l'écran et par les sheets.
// Mode hors ligne : la liste est la copie enregistrée sur le téléphone (lisible sans réseau) ;
// chaque compte renvoyé par l'API après une modification y est rangé.
let comptesState: Compte[] = []
const listeners = new Set<() => void>()

/** Relit les comptes enregistrés sur le téléphone. */
function relireComptes() {
  try {
    comptesState = compteRepository.getAll().map((r) => r.data)
  } catch {
    comptesState = [] // Mode hors ligne indisponible (base non ouverte).
  }
  listeners.forEach((l) => l())
}

// Téléchargement ou modification : la liste suit la copie locale.
dataChanged.subscribe((entity) => {
  if (entity === "comptes" || entity === "*") relireComptes()
})

export const comptesStore = {
  get: () => comptesState,
  /** Relit la copie locale (à l'ouverture de l'écran). */
  reload: relireComptes,
  /** Range un compte renvoyé par l'API (modification faite en ligne). */
  replace(compte: Compte) {
    compteRepository.syncFromServer([{ serverId: compte.id, data: compte }])
  },
  add(compte: Compte) {
    compteRepository.syncFromServer([{ serverId: compte.id, data: compte }])
  },
  /** Retire un compte supprimé sur le serveur. */
  remove(compteId: number) {
    const record = compteRepository.getByServerId(compteId)
    if (record) compteRepository.purgeLocal(record.localId)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useComptes() {
  return useSyncExternalStore(comptesStore.subscribe, comptesStore.get, comptesStore.get)
}

/* ------------------------------------ Droits sur un compte ------------------------------------ */

/** Mêmes règles que l'API et le portail web. */
export function useDroitsCompte() {
  const { session, can } = useApp()
  const full = can("comptesFull")
  const base = can("comptes")

  return (compte: Compte) => {
    const estMoi = session !== null && compte.membershipId === session.membershipId
    // Le compte d'un Admin de chorale se gère depuis le back-office.
    const estAdminProtege = !estMoi && compte.roles.includes("admin_chorale")
    // Le secrétaire ne gère que les comptes Choriste / Commissions.
    const roleGerable = full || compte.roles.every((r) => BASIC_ROLES.includes(r))
    const gerable = base && roleGerable && !estAdminProtege
    return {
      estMoi,
      estAdminProtege,
      peutModifier: gerable || (base && estMoi),
      peutChangerStatut: gerable && !estMoi,
      peutReinitialiser: full && gerable && !estMoi,
      peutGererRoles: full && !estAdminProtege,
      peutSupprimer: full && !estMoi && !estAdminProtege,
    }
  }
}

/* ------------------------------------ Utilitaires ------------------------------------ */

/** "07.01-02 03 04" → "0701020304" (le « + » initial est conservé). */
export function normaliserTelephone(tel: string) {
  return tel.trim().replace(/(?!^\+)[^\d]/g, "")
}

/** "0701020304" → "07 01 02 03 04" ; un numéro international est gardé tel que saisi. */
export function formaterTelephone(tel: string) {
  if (tel.trim().startsWith("+")) return tel.trim().replace(/\s+/g, " ")
  return normaliserTelephone(tel).replace(/(\d{2})(?=\d)/g, "$1 ")
}

/** "2026-03-14" → "14/03/2026" (sans passer par Date : pas de décalage de fuseau). */
function dateCourte(iso: string) {
  const [a, m, j] = iso.split("-")
  return a && m && j ? `${j}/${m}/${a}` : iso
}

const messageErreur = (e: unknown) => (e instanceof ApiError ? e.message : "Une erreur est survenue. Réessayez.")

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Générateur aléatoire sûr, s'il est disponible sur l'appareil (pas de Math.random pour un mot de passe). */
const secureRandom = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
const PASSWORD_CHARACTERS = "abcdefghjkmnpqrstuvwxyz23456789"

/** 10 caractères sans caractères ambigus (l/1, o/0), faciles à dicter — comme le web. */
function genererMotDePasse() {
  if (!secureRandom?.getRandomValues) return null
  const out: string[] = []
  const bytes = new Uint8Array(16)
  const max = Math.floor(256 / PASSWORD_CHARACTERS.length) * PASSWORD_CHARACTERS.length
  while (out.length < 10) {
    secureRandom.getRandomValues(bytes)
    for (const b of bytes) {
      if (b < max) {
        out.push(PASSWORD_CHARACTERS[b % PASSWORD_CHARACTERS.length]!)
        if (out.length === 10) break
      }
    }
  }
  return out.join("")
}

/** Message d'erreur sous un champ. */
function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <Text className="mt-1 font-sans text-[11.5px] text-danger">{children}</Text>
}

/** Bandeau d'erreur dans un sheet. */
function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <View accessibilityLiveRegion="polite" className="mt-3 rounded-field border border-danger bg-danger-bg px-3 py-2.5">
      <Text className="font-sans text-[12.5px] text-danger">{message}</Text>
    </View>
  )
}

/** Encadré de confirmation dans le sheet de détail. */
function Confirmation({
  titre,
  texte,
  bouton,
  variant,
  busy,
  onConfirmer,
  onAnnuler,
}: {
  titre: string
  texte: string
  bouton: string
  variant: "primary" | "danger"
  busy: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}) {
  return (
    <Card className="mt-3 border-gold-35 bg-gold-soft">
      <Text className="mb-1 font-sans-bold text-[14px] text-navy">{titre}</Text>
      <Muted>{texte}</Muted>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Button title={busy ? "Patientez…" : bouton} variant={variant} disabled={busy} onPress={onConfirmer} />
        <Button title="Annuler" variant="ghost" disabled={busy} onPress={onAnnuler} />
      </View>
    </Card>
  )
}

/* ------------------------------------ Détail d'un compte ------------------------------------ */

type Demande = { type: "revoquer"; role: Role } | { type: "statut" } | { type: "mdp" } | { type: "supprimer" } | null

export function CompteDetailSheet({ compteId }: { compteId: number }) {
  const { openSheet, closeSheet } = useSheet()
  const { toast } = useToast()
  const comptes = useComptes()
  const droitsSur = useDroitsCompte()
  const [demande, setDemande] = useState<Demande>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const compte = comptes.find((c) => c.id === compteId)
  if (!compte) return null
  const d = droitsSur(compte)
  const actif = compte.statut === "actif"
  const aAttribuer = MANDATE_ROLES.filter((r) => !compte.roles.includes(r))
  const historique = [...compte.historique].sort((a, b) => b.debut.localeCompare(a.debut))

  async function executer(action: () => Promise<void>) {
    setBusy(true)
    setErreur(null)
    try {
      await action()
      setDemande(null)
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setBusy(false)
    }
  }

  const confirmerRevocation = (role: Role) =>
    executer(async () => {
      comptesStore.replace(await revoquerRole(compte.id, role))
      toast(`Rôle « ${ROLE_LABEL[role]} » révoqué`)
    })

  const confirmerStatut = () =>
    executer(async () => {
      comptesStore.replace(await setCompteActif(compte.id, !actif))
      toast(actif ? "Compte désactivé" : "Compte réactivé")
    })

  const confirmerSuppression = () =>
    executer(async () => {
      const nom = compte.nom
      await supprimerCompte(compte.id)
      closeSheet()
      comptesStore.remove(compte.id)
      toast(`Compte supprimé — ${nom}`)
    })

  const confirmerMotDePasse = () =>
    executer(async () => {
      const res = await reinitialiserMotDePasse(compte.id)
      comptesStore.replace(res.compte)
      openSheet(<MotDePasseSheet compteId={compte.id} nom={res.compte.nom} motDePasse={res.motDePasse} />)
    })

  const demander = (next: Demande) => {
    setErreur(null)
    setDemande(next)
  }

  const aucuneAction = !d.peutModifier && !d.peutChangerStatut && !d.peutReinitialiser

  return (
    <View>
      <SheetTitle>
        {compte.nom}
        {d.estMoi ? <Text className="font-sans text-[15px] text-ink-light"> (vous)</Text> : null}
      </SheetTitle>
      <View className="mb-1 flex-row flex-wrap gap-1.5">
        <Pill variant={actif ? "green" : "burg"}>{actif ? "Actif" : "Désactivé"}</Pill>
      </View>
      {d.estAdminProtege ? <Muted className="mt-1">Géré depuis le back-office.</Muted> : null}

      <SectionHeader title="Coordonnées" />
      <Card>
        <KeyValue first label="Prénom" value={compte.prenom || "—"} />
        <KeyValue label="Nom" value={compte.nomDeFamille || "—"} />
        <KeyValue label="Téléphone" value={compte.telephone || "—"} mono />
        <KeyValue label="Email" value={compte.email || "—"} />
      </Card>

      <SectionHeader title="Rôles actuels" />
      <Card>
        {compte.roles.map((r, i) => {
          const revocable = d.peutGererRoles && MANDATE_ROLES.includes(r)
          return (
            <RowBetween key={r} className={cx("min-h-touch", i > 0 && "border-t border-line-soft")}>
              <Pill variant={r === "choriste" ? "default" : "gold"}>{ROLE_LABEL[r]}</Pill>
              {revocable ? (
                <Button
                  small
                  variant="danger"
                  title="Révoquer"
                  disabled={busy}
                  onPress={() => demander({ type: "revoquer", role: r })}
                />
              ) : null}
            </RowBetween>
          )
        })}
        {d.peutGererRoles && aAttribuer.length > 0 ? (
          <Button
            title="Attribuer un rôle"
            icon={ShieldPlus}
            variant="outline"
            block
            className="mt-3"
            disabled={busy}
            onPress={() => openSheet(<AttribuerRoleSheet compteId={compte.id} />)}
          />
        ) : null}
        {d.peutGererRoles && aAttribuer.length === 0 ? <Muted className="mt-2">Ce compte détient déjà tous les rôles attribuables.</Muted> : null}
      </Card>

      {demande?.type === "revoquer" ? (
        <Confirmation
          titre={`Révoquer « ${ROLE_LABEL[demande.role]} » ?`}
          texte="Le compte repasse au statut Choriste pour ce mandat. Cette action est tracée dans l'historique."
          bouton="Révoquer"
          variant="danger"
          busy={busy}
          onConfirmer={() => confirmerRevocation(demande.role)}
          onAnnuler={() => setDemande(null)}
        />
      ) : null}

      <SectionHeader title="Historique des rôles" />
      <Card>
        {historique.length === 0 ? (
          <Muted>Aucun historique.</Muted>
        ) : (
          historique.map((h, i) => (
            <View key={`${h.role}-${h.debut}-${i}`} className={cx("py-2", i > 0 && "border-t border-line-soft")}>
              <RowBetween>
                <Text className="shrink font-sans-bold text-[13px] text-ink">{ROLE_LABEL[h.role]}</Text>
                {h.fin ? null : <Pill variant="green">En cours</Pill>}
              </RowBetween>
              <Text className="mt-0.5 font-sans text-[11.5px] tabular-nums text-ink-soft">
                du {dateCourte(h.debut)}
                {h.fin ? ` au ${dateCourte(h.fin)}` : ""}
              </Text>
              <Muted>par {h.auteur}</Muted>
            </View>
          ))
        )}
      </Card>

      {demande?.type === "statut" ? (
        <Confirmation
          titre={actif ? "Désactiver le compte ?" : "Réactiver le compte ?"}
          texte={
            actif
              ? "Le compte perdra l'accès au portail jusqu'à sa réactivation. Ses rôles et son historique sont conservés."
              : "Le compte retrouvera l'accès au portail avec ses rôles actuels."
          }
          bouton={actif ? "Désactiver" : "Réactiver"}
          variant={actif ? "danger" : "primary"}
          busy={busy}
          onConfirmer={confirmerStatut}
          onAnnuler={() => setDemande(null)}
        />
      ) : null}

      {demande?.type === "mdp" ? (
        <Confirmation
          titre="Réinitialiser le mot de passe ?"
          texte="Un nouveau mot de passe temporaire sera généré. L'actuel ne fonctionnera plus."
          bouton="Confirmer"
          variant="primary"
          busy={busy}
          onConfirmer={confirmerMotDePasse}
          onAnnuler={() => setDemande(null)}
        />
      ) : null}

      {demande?.type === "supprimer" ? (
        <Confirmation
          titre="Supprimer définitivement le compte ?"
          texte="Le compte, ses rôles et ses inscriptions aux événements seront supprimés. Un membre qui a des paiements enregistrés ne peut pas être supprimé : désactivez plutôt son compte."
          bouton="Supprimer"
          variant="danger"
          busy={busy}
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setDemande(null)}
        />
      ) : null}

      <ErrorBanner message={erreur} />

      {aucuneAction && !d.estAdminProtege ? (
        <Muted className="mt-4">Vous ne pouvez pas modifier ce compte : seuls l'Admin de chorale, le Bureau exécutif et le Secrétariat gèrent les comptes à mandat.</Muted>
      ) : null}

      <View className="mt-5 gap-2">
        {d.peutModifier ? (
          <Button
            title="Modifier les coordonnées"
            icon={Pencil}
            variant="outline"
            block
            disabled={busy}
            onPress={() => openSheet(<ModifierCompteSheet compteId={compte.id} />)}
          />
        ) : null}
        {d.peutChangerStatut ? (
          <Button
            title={actif ? "Désactiver le compte" : "Réactiver le compte"}
            icon={actif ? Ban : RotateCcw}
            variant={actif ? "danger" : "ghost"}
            block
            disabled={busy}
            onPress={() => demander({ type: "statut" })}
          />
        ) : null}
        {d.peutReinitialiser ? (
          <Button
            title="Réinitialiser le mot de passe"
            icon={KeyRound}
            variant="ghost"
            block
            disabled={busy}
            onPress={() => demander({ type: "mdp" })}
          />
        ) : null}
        {d.peutSupprimer ? (
          <Button
            title="Supprimer le compte"
            icon={Trash2}
            variant="danger"
            block
            disabled={busy}
            onPress={() => demander({ type: "supprimer" })}
          />
        ) : null}
        <Button title="Fermer" variant="ghost" block disabled={busy} onPress={closeSheet} />
      </View>
    </View>
  )
}

/* ------------------------------------ Mot de passe temporaire ------------------------------------ */

/** Affiché une seule fois : le mot de passe n'est plus consultable après fermeture. */
export function MotDePasseSheet({ compteId, nom, motDePasse }: { compteId: number; nom: string; motDePasse: string }) {
  const { openSheet, closeSheet } = useSheet()
  return (
    <View>
      <SheetTitle>Mot de passe temporaire</SheetTitle>
      <Muted>{nom}</Muted>
      <View className="mt-4 items-center rounded-card border border-gold-35 bg-gold-soft px-4 py-5">
        <Text
          selectable
          accessibilityLabel={`Mot de passe temporaire : ${motDePasse.split("").join(" ")}`}
          className="font-mono-semibold text-[22px] tracking-[2px] text-navy"
        >
          {motDePasse}
        </Text>
      </View>
      <Text className="mt-3 font-sans-semibold text-[13px] text-ink">Transmettez ce mot de passe au membre.</Text>
      <Muted className="mt-1">
        Il devra en choisir un nouveau à sa prochaine connexion. Ce mot de passe ne sera plus affiché après la fermeture : notez-le maintenant
        (appui long pour le copier).
      </Muted>
      <Button title="J'ai transmis le mot de passe" icon={Check} block className="mt-5" onPress={() => openSheet(<CompteDetailSheet compteId={compteId} />)} />
      <Button title="Fermer" variant="ghost" block className="mt-2" onPress={closeSheet} />
    </View>
  )
}

/* ------------------------------------ Attribution d'un rôle ------------------------------------ */

export function AttribuerRoleSheet({ compteId }: { compteId: number }) {
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const comptes = useComptes()
  const compte = comptes.find((c) => c.id === compteId)
  const options = MANDATE_ROLES.filter((r) => !compte?.roles.includes(r))
  const [role, setRole] = useState<Role | undefined>(options[0])
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  if (!compte) return null

  const retour = () => openSheet(<CompteDetailSheet compteId={compteId} />)

  async function attribuer() {
    if (!role) return
    setBusy(true)
    setErreur(null)
    try {
      comptesStore.replace(await attribuerRole(compteId, role))
      toast(`Rôle « ${ROLE_LABEL[role]} » attribué`)
      retour()
    } catch (e) {
      setErreur(messageErreur(e))
      setBusy(false)
    }
  }

  return (
    <View>
      <SheetTitle>Attribuer un rôle</SheetTitle>
      <Muted>{compte.nom}</Muted>
      {options.length === 0 || !role ? (
        <Muted className="mt-4">Ce compte détient déjà tous les rôles attribuables.</Muted>
      ) : (
        <Select label="Nouveau rôle" value={role} onChange={setRole} options={options.map((r) => ({ label: ROLE_LABEL[r], value: r }))} />
      )}
      <Muted className="mt-3">L'attribution est tracée dans l'historique des rôles. Une même personne peut cumuler plusieurs rôles.</Muted>
      <ErrorBanner message={erreur} />
      <Button title={busy ? "Attribution…" : "Attribuer"} icon={Check} block className="mt-5" disabled={busy || !role} onPress={attribuer} />
      <Button title="Annuler" variant="ghost" block className="mt-2" disabled={busy} onPress={retour} />
    </View>
  )
}

/* ------------------------------------ Formulaires création / modification ------------------------------------ */

type Erreurs = Partial<Record<"prenom" | "nom" | "telephone" | "email" | "motDePasse", string>>

/** Mêmes contrôles que le web ; `ignorerId` : compte en cours de modification. */
function valider(
  champs: { prenom: string; nom: string; telephone: string; email: string; motDePasse?: string },
  comptes: Compte[],
  ignorerId?: number
): Erreurs {
  const e: Erreurs = {}
  const tel = normaliserTelephone(champs.telephone)
  const chiffres = tel.replace("+", "")
  if (!champs.prenom.trim()) e.prenom = "Le prénom est obligatoire."
  if (!champs.nom.trim()) e.nom = "Le nom est obligatoire."
  if (!tel) e.telephone = "Le numéro de téléphone est obligatoire."
  else if (chiffres.length < 8 || chiffres.length > 15) e.telephone = "Numéro invalide (8 à 15 chiffres)."
  else {
    const doublon = comptes.find((c) => c.id !== ignorerId && c.telephone && normaliserTelephone(c.telephone) === tel)
    if (doublon) e.telephone = `Ce numéro est déjà utilisé par ${doublon.nom}.`
  }
  if (champs.email.trim() && !EMAIL_RE.test(champs.email.trim())) e.email = "Adresse email invalide."
  if (champs.motDePasse !== undefined && champs.motDePasse.length < 8) e.motDePasse = "8 caractères minimum."
  return e
}

export function CompteFormSheet() {
  const { can } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const comptes = useComptes()
  const full = can("comptesFull")
  const roles = full ? INITIAL_ROLES : BASIC_ROLES

  const [prenom, setPrenom] = useState("")
  const [nom, setNom] = useState("")
  const [telephone, setTelephone] = useState("")
  const [email, setEmail] = useState("")
  const [motDePasse, setMotDePasse] = useState("")
  const [voir, setVoir] = useState(false)
  const [role, setRole] = useState<Role>("choriste")
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const effacer = (champ: keyof Erreurs) => setErreurs((x) => ({ ...x, [champ]: undefined }))

  async function creer() {
    const e = valider({ prenom, nom, telephone, email, motDePasse }, comptes)
    setErreurs(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setErreur(null)
    try {
      const compte = await createCompte({
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: formaterTelephone(telephone),
        email: email.trim(),
        motDePasse,
        role,
      })
      comptesStore.add(compte)
      closeSheet()
      toast(`Compte de ${compte.nom} créé`)
    } catch (err) {
      setErreur(messageErreur(err))
      setBusy(false)
    }
  }

  const generer = () => {
    const mdp = genererMotDePasse()
    if (!mdp) return
    setMotDePasse(mdp)
    setVoir(true)
    effacer("motDePasse")
  }

  return (
    <View>
      <SheetTitle>Créer un compte</SheetTitle>
      <Muted>Le membre se connecte avec son téléphone (ou son email) et le mot de passe temporaire que vous lui transmettez.</Muted>
      <FormRow2>
        <View>
          <Field label="Prénom" value={prenom} onChangeText={(v) => (setPrenom(v), effacer("prenom"))} placeholder="Ex. Julie" autoCapitalize="words" />
          <FieldError>{erreurs.prenom}</FieldError>
        </View>
        <View>
          <Field label="Nom" value={nom} onChangeText={(v) => (setNom(v), effacer("nom"))} placeholder="Ex. Nkomo" autoCapitalize="words" />
          <FieldError>{erreurs.nom}</FieldError>
        </View>
      </FormRow2>
      <Field
        label="Téléphone"
        mono
        value={telephone}
        onChangeText={(v) => (setTelephone(v), effacer("telephone"))}
        onBlur={() => telephone.trim() && setTelephone(formaterTelephone(telephone))}
        placeholder="07 01 02 03 04"
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <FieldError>{erreurs.telephone}</FieldError>
      <Field
        label="Email (facultatif)"
        value={email}
        onChangeText={(v) => (setEmail(v), effacer("email"))}
        placeholder="julie.nkomo@mail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <FieldError>{erreurs.email}</FieldError>
      <Field
        label="Mot de passe temporaire"
        mono
        value={motDePasse}
        onChangeText={(v) => (setMotDePasse(v), effacer("motDePasse"))}
        placeholder="8 caractères minimum"
        secureTextEntry={!voir}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        right={
          <Pressable
            onPress={() => setVoir((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="min-h-touch min-w-touch items-center justify-center"
          >
            {voir ? <EyeOff size={17} color={colors.inkLight} /> : <Eye size={17} color={colors.inkLight} />}
          </Pressable>
        }
      />
      {erreurs.motDePasse ? (
        <FieldError>{erreurs.motDePasse}</FieldError>
      ) : (
        <Muted className="mt-1 text-[11.5px]">Notez-le avant de valider : il ne sera plus affiché ensuite. Le membre devra en choisir un nouveau à sa première connexion.</Muted>
      )}
      {secureRandom?.getRandomValues ? <Button title="Générer un mot de passe" variant="ghost" small className="mt-2" onPress={generer} /> : null}
      <Select label="Rôle initial" value={role} onChange={setRole} options={roles.map((r) => ({ label: ROLE_LABEL[r], value: r }))} />
      {!full ? (
        <Muted className="mt-2 text-[11.5px]">
          En tant que Secrétaire, l'attribution de mandats (Bureau, Trésorier, Secrétaire) reste réservée à l'Admin de chorale et au Bureau exécutif.
        </Muted>
      ) : null}
      <ErrorBanner message={erreur} />
      <Button title={busy ? "Création…" : "Créer le compte"} icon={Check} block className="mt-5" disabled={busy} onPress={creer} />
      <Button title="Annuler" variant="ghost" block className="mt-2" disabled={busy} onPress={closeSheet} />
    </View>
  )
}

export function ModifierCompteSheet({ compteId }: { compteId: number }) {
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const comptes = useComptes()
  const compte = comptes.find((c) => c.id === compteId)

  const [prenom, setPrenom] = useState(compte?.prenom ?? "")
  const [nom, setNom] = useState(compte?.nomDeFamille ?? "")
  const [telephone, setTelephone] = useState(compte?.telephone ?? "")
  const [email, setEmail] = useState(compte?.email ?? "")
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!compte) return null

  const effacer = (champ: keyof Erreurs) => setErreurs((x) => ({ ...x, [champ]: undefined }))
  const retour = () => openSheet(<CompteDetailSheet compteId={compteId} />)

  async function enregistrer() {
    const e = valider({ prenom, nom, telephone, email }, comptes, compteId)
    setErreurs(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setErreur(null)
    try {
      comptesStore.replace(
        await modifierCompte(compteId, { prenom: prenom.trim(), nom: nom.trim(), telephone: formaterTelephone(telephone), email: email.trim() })
      )
      toast("Coordonnées enregistrées")
      retour()
    } catch (err) {
      setErreur(messageErreur(err))
      setBusy(false)
    }
  }

  return (
    <View>
      <SheetTitle>Modifier le compte</SheetTitle>
      <Muted>Le téléphone et l'email servent d'identifiants de connexion.</Muted>
      <FormRow2>
        <View>
          <Field label="Prénom" value={prenom} onChangeText={(v) => (setPrenom(v), effacer("prenom"))} autoCapitalize="words" />
          <FieldError>{erreurs.prenom}</FieldError>
        </View>
        <View>
          <Field label="Nom" value={nom} onChangeText={(v) => (setNom(v), effacer("nom"))} autoCapitalize="words" />
          <FieldError>{erreurs.nom}</FieldError>
        </View>
      </FormRow2>
      <Field
        label="Téléphone"
        mono
        value={telephone}
        onChangeText={(v) => (setTelephone(v), effacer("telephone"))}
        onBlur={() => telephone.trim() && setTelephone(formaterTelephone(telephone))}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <FieldError>{erreurs.telephone}</FieldError>
      <Field
        label="Email (facultatif)"
        value={email}
        onChangeText={(v) => (setEmail(v), effacer("email"))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <FieldError>{erreurs.email}</FieldError>
      {compte.email && !email.trim() ? <Muted className="mt-1 text-[11.5px]">Sans email, le membre se connectera avec son téléphone.</Muted> : null}
      <ErrorBanner message={erreur} />
      <Button title={busy ? "Enregistrement…" : "Enregistrer"} icon={Check} block className="mt-5" disabled={busy} onPress={enregistrer} />
      <Button title="Annuler" variant="ghost" block className="mt-2" disabled={busy} onPress={retour} />
    </View>
  )
}
