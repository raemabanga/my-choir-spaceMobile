import { useState } from "react"
import { Text, View } from "react-native"
import { DateField } from "../DateField"
import { Avatar, Button, Card, Field, KeyValue, ListRow, Muted, Pill, ProgressBar, QrPlaceholder, RowBetween, SectionHeader, Select, SheetTitle } from "../ui"

import { fmt, MONTHS } from "../../lib/format"
import type { DetailsPaiement } from "../../lib/api"
import { errorMessage, useApp } from "../../context/AppContext"
import { parId } from "../../context/choraleData"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Recu } from "../../types"
import { RecordSyncBadge } from "../sync"


/**
 * Saisie du montant en Geist Mono à chiffres tabulaires. `Field` n'expose pas de className pour son
 * TextInput interne (un className y écraserait toutes ses classes) : police passée via sa prop `style`.
 */

/** Montant secondaire en Geist Mono (12,5px, muted) ; pas via <Numeric> pour éviter un conflit avec ses text-[13px]/text-ink. */
const MUTED_NUM = "font-sans-medium text-[12.5px] tabular-nums text-ink-light"

/** Boutons d'action en bas de sheet : principal à 20px du dernier champ, « Annuler » 8px dessous. */
function SheetActions({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <>
      <Button title={busy ? "Enregistrement…" : "Valider et générer le reçu"} onPress={onConfirm} disabled={busy} block className="mt-5" />
      <Button title="Annuler" variant="ghost" onPress={onCancel} block className="mt-2" />
    </>
  )
}

/**
 * Enregistre un paiement auprès de l'API : bouton désactivé pendant l'envoi,
 * erreur du serveur affichée telle quelle (ex. « Le mois de mars 2026 est déjà payé »).
 */
function usePaymentSubmit() {
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  async function submit(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      closeSheet()
      toast("Paiement enregistré — reçu généré")
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }
  return { busy, submit }
}

/** "AAAA-MM-JJ" en heure locale (toISOString décalerait la date selon le fuseau). */
function localISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Jour où le membre a payé et mode de règlement : envoyés au serveur avec le paiement
 * et imprimés sur le reçu. Modes : ceux de la chorale (Paramètres du portail web).
 */
function useDetailsPaiement() {
  const { parametres } = useApp()
  const modes = parametres.modesReglement
  const [date, setDate] = useState(new Date())
  const [mode, setMode] = useState(modes[0]?.code ?? "ESPECES")
  const details = (): DetailsPaiement => ({ datePaiement: localISODate(date), mode })
  const champs = (
    <>
      <DateField label="Date du paiement" value={date} onChange={setDate} maximumDate={new Date()} />
      <Select label="Mode de règlement" value={mode} onChange={setMode} options={modes.map((m) => ({ label: m.label, value: m.code }))} />
    </>
  )
  return { details, champs }
}

/* --------------------------- Paiement statutaire (mois précis) --------------------------- */

/** `year` : exercice de la carte affichée (année en cours par défaut, ou année passée pour un arriéré). */
export function PaymentSheet({ chorishId, monthIndex, year }: { chorishId: number; monthIndex: number; year?: number }) {
  const { chorists, confirmPaymentStatutaire, mensualite, annee: anneeCourante } = useApp()
  const annee = year ?? anneeCourante
  const { closeSheet } = useSheet()
  const { busy, submit } = usePaymentSubmit()
  const { details, champs } = useDetailsPaiement()
  const chorist = chorists.find((c) => c.id === chorishId)
  const [amount, setAmount] = useState(String(mensualite))

  function confirm() {
    submit(() => confirmPaymentStatutaire(chorishId, monthIndex, parseInt(amount) || mensualite, annee, details()))
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>
        Cotisation statutaire · {MONTHS[monthIndex]} <Text className="font-sans-medium tabular-nums">{annee}</Text>
      </Muted>
      <Field label="Choriste" value={chorist?.name ?? ""} editable={false} />
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" mono />
      {champs}
      <SheetActions onConfirm={confirm} onCancel={closeSheet} busy={busy} />
    </View>
  )
}

/* --------------------------- Confirmation d'un mois (carte de cotisation) --------------------------- */

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/**
 * Toucher un mois impayé de la carte : confirmation du paiement (mensualité, payée aujourd'hui,
 * mode de règlement par défaut). « Modifier » ouvre le formulaire complet (PaymentSheet).
 */
export function PaymentConfirmSheet({ chorishId, monthIndex, year }: { chorishId: number; monthIndex: number; year: number }) {
  const { chorists, confirmPaymentStatutaire, mensualite, parametres } = useApp()
  const { openSheet, closeSheet } = useSheet()
  const { busy, submit } = usePaymentSubmit()
  const chorist = chorists.find((c) => c.id === chorishId)
  const mode = parametres.modesReglement[0]
  const mois = MOIS_LONGS[monthIndex] + " " + year

  function confirm() {
    submit(() =>
      confirmPaymentStatutaire(chorishId, monthIndex, mensualite, year, {
        datePaiement: localISODate(new Date()),
        mode: mode?.code ?? "ESPECES",
      })
    )
  }

  return (
    <View>
      <SheetTitle>Confirmer la cotisation</SheetTitle>
      <Muted>
        Enregistrer le paiement de la cotisation de {mois} pour {chorist?.name ?? "ce choriste"} ? Le reçu est généré aussitôt.
      </Muted>
      <Card className="mt-3">
        <KeyValue label="Choriste" value={chorist?.name ?? "—"} first />
        <KeyValue label="Mois" value={mois.charAt(0).toUpperCase() + mois.slice(1)} />
        <KeyValue label="Montant" value={fmt(mensualite)} mono />
        <KeyValue label="Payé le" value={new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
        <KeyValue label="Mode de règlement" value={mode?.label ?? "Espèces"} />
      </Card>
      <Button title={busy ? "Enregistrement…" : "Confirmer le paiement"} onPress={confirm} disabled={busy} block className="mt-2" />
      <Button
        title="Modifier le montant, la date ou le mode"
        variant="outline"
        block
        className="mt-2"
        disabled={busy}
        onPress={() => openSheet(<PaymentSheet chorishId={chorishId} monthIndex={monthIndex} year={year} />)}
      />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block className="mt-2" />
    </View>
  )
}

/* --------------------------- Paiement rapide (choix choriste + mois) --------------------------- */

export function QuickPaymentSheet() {
  const { chorists, statutaire, confirmPaymentStatutaire, mensualite, annee } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const { busy, submit } = usePaymentSubmit()
  const { details, champs } = useDetailsPaiement()
  const isPaid = (id: number, i: number) => statutaire[id]?.[i] ?? false
  const firstUnpaid = (id: number) => Math.max(0, (statutaire[id] ?? []).findIndex((p) => !p))
  const [chorishId, setChorishId] = useState(chorists[0].id)
  const [monthIndex, setMonthIndex] = useState(firstUnpaid(chorists[0].id))
  const [amount, setAmount] = useState(String(mensualite))

  const monthOptions = MONTHS.map((m, i) => ({ label: `${m} ${annee}` + (isPaid(chorishId, i) ? " (déjà réglé)" : ""), value: i }))

  function confirm() {
    if (isPaid(chorishId, monthIndex)) {
      toast("Ce mois est déjà réglé")
      return
    }
    submit(() => confirmPaymentStatutaire(chorishId, monthIndex, parseInt(amount) || mensualite, annee, details()))
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Select
        label="Choriste"
        value={chorishId}
        onChange={(id) => {
          setChorishId(id)
          setMonthIndex(firstUnpaid(id))
        }}
        options={chorists.map((c) => ({ label: c.name, value: c.id }))}
      />
      <Select label="Mois à régler" value={monthIndex} onChange={setMonthIndex} options={monthOptions} />
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" mono />
      {champs}
      <SheetActions onConfirm={confirm} onCancel={closeSheet} busy={busy} />
    </View>
  )
}

/* --------------------------- Détail cotisation événementielle --------------------------- */

export function EventCotisationSheet({ eventId, chorishId }: { eventId: number; chorishId: number }) {
  const { events, chorists, can, recus } = useApp()
  const { openSheet, closeSheet } = useSheet()
  const ev = parId(events, eventId)
  const chorist = chorists.find((c) => c.id === chorishId)
  if (!ev || !chorist) return null

  const paid = ev.contributions[chorishId] || 0
  const remaining = Math.max(0, ev.cotisationMontant - paid)
  const canPay = can("paiements")
  // Reçu le plus récent de ce choriste pour cet événement.
  const receipt = recus.find((r) => r.chorishId === chorishId && (r.eventId != null ? r.eventId === ev.id : r.label === ev.titre))

  return (
    <View>
      <SheetTitle>{ev.titre}</SheetTitle>
      <Muted>
        Cotisation événementielle — <Text className={MUTED_NUM}>{fmt(ev.cotisationMontant)}</Text> par personne
      </Muted>

      <Card className="mt-3">
        <RowBetween>
          <Muted className="shrink">{chorist.name}</Muted>
          <Pill variant={remaining === 0 ? "green" : "default"}>{remaining === 0 ? "Réglé" : fmt(remaining) + " restant"}</Pill>
        </RowBetween>
        <ProgressBar percent={ev.cotisationMontant > 0 ? (paid / ev.cotisationMontant) * 100 : 100} />
        <Muted>
          <Text className={MUTED_NUM}>{fmt(paid)}</Text> / <Text className={MUTED_NUM}>{fmt(ev.cotisationMontant)}</Text>
        </Muted>
      </Card>

      {canPay && remaining > 0 ? (
        <Button title="Enregistrer un paiement" block onPress={() => openSheet(<EventPaymentSheet eventId={eventId} chorishId={chorishId} />)} />
      ) : null}
      {receipt ? <Button title="Voir mon reçu" variant="outline" block onPress={() => openSheet(<ReceiptSheet receipt={receipt} />)} /> : null}

      {can("cotisations") ? (
        <>
          <SectionHeader title="Tous les choristes" className="mt-[18px]" />
          {chorists.map((c, i) => {
            const p = ev.contributions[c.id] || 0
            return (
              <ListRow
                key={c.id}
                left={<Avatar id={c.id} name={c.name} size={30} />}
                title={c.name}
                right={<Pill variant={p >= ev.cotisationMontant ? "green" : "default"}>{fmt(p)}</Pill>}
                last={i === chorists.length - 1}
              />
            )
          })}
        </>
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} className="mt-3.5" />
    </View>
  )
}

/* --------------------------- Paiement événementiel --------------------------- */

export function EventPaymentSheet({ eventId, chorishId }: { eventId: number; chorishId: number }) {
  const { events, chorists, confirmEventPayment } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const { busy, submit } = usePaymentSubmit()
  const { details, champs } = useDetailsPaiement()
  const ev = parId(events, eventId)
  const chorist = chorists.find((c) => c.id === chorishId)
  const remaining = ev ? Math.max(0, ev.cotisationMontant - (ev.contributions[chorishId] || 0)) : 0
  const [amount, setAmount] = useState(String(remaining))

  function confirm() {
    const value = parseInt(amount) || 0
    if (value <= 0) {
      toast("Saisissez un montant valide")
      return
    }
    submit(() => confirmEventPayment(eventId, chorishId, value, details()))
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>
        {ev?.titre} · {chorist?.name}
      </Muted>
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" mono />
      {champs}
      <SheetActions onConfirm={confirm} onCancel={closeSheet} busy={busy} />
    </View>
  )
}

/* --------------------------- Reçu numérique (.receipt) --------------------------- */

export function ReceiptSheet({
  receipt,
}: {
  receipt: Pick<Recu, "id" | "chorishId" | "label" | "montant" | "date" | "enregistrePar" | "mode" | "localId" | "syncStatus">
}) {
  const { chorists, choraleNom, parametres, can, cancelPayment } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const [annulation, setAnnulation] = useState(false)
  const [motif, setMotif] = useState("")
  const [busy, setBusy] = useState(false)
  // Paiement refusé avant d'atteindre le serveur : il se retire simplement (pas de motif).
  const nonEnvoye = receipt.syncStatus === "failed" && receipt.id === "En attente"
  const peutAnnuler = !!receipt.localId && (nonEnvoye || can("paiementsAnnuler"))

  async function confirmerAnnulation() {
    if (busy || !receipt.localId) return
    if (!nonEnvoye && !motif.trim()) {
      toast("Indiquez le motif de l'annulation")
      return
    }
    setBusy(true)
    try {
      await cancelPayment(receipt.localId, nonEnvoye ? "Paiement non envoyé" : motif)
      closeSheet()
      toast(nonEnvoye ? "Paiement retiré" : "Paiement annulé — le reçu n'est plus valable")
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }
  const chorist = chorists.find((c) => c.id === receipt.chorishId)
  // Libellé du mode (code inconnu, ex. mode supprimé depuis : le code lui-même).
  const mode = receipt.mode ? (parametres.modesReglement.find((m) => m.code === receipt.mode)?.label ?? receipt.mode) : null

  return (
    <View>
      <SheetTitle>Reçu numérique</SheetTitle>
      {receipt.syncStatus && receipt.syncStatus !== "synced" ? (
        <View className="mt-1 flex-row items-center gap-2">
          <RecordSyncBadge status={receipt.syncStatus} />
          <Muted className="shrink">
            {receipt.syncStatus === "pending"
              ? "Enregistré sur le téléphone : le numéro de reçu sera attribué à l'envoi."
              : "Le serveur a refusé ce paiement."}
          </Muted>
        </View>
      ) : null}

      <View className="mt-3 rounded-card border border-line bg-paper p-[22px]">
        <View className="rounded-field border border-dashed border-line-strong p-[18px]">
          {/* Réserve à droite pour ne pas passer sous le tampon sur petit écran. */}
          <View className="pr-14">
            <Text className="font-mono-medium text-[12px] text-ink-light">{receipt.id === "En attente" ? "N° en attente" : "N° " + receipt.id}</Text>
            <Text className="mb-3.5 mt-1.5 font-sans-bold text-[18.5px] tracking-[-0.2px] text-navy">{choraleNom}</Text>
          </View>

          <KeyValue label="Choriste" value={chorist?.name ?? "—"} first />
          <KeyValue label="Motif" value={receipt.label} />
          <KeyValue label="Montant" value={fmt(receipt.montant)} mono valueClassName="text-success" />
          {mode ? <KeyValue label="Mode de règlement" value={mode} /> : null}
          <KeyValue label="Payé le" value={receipt.date} mono />
          <KeyValue label="Enregistré par" value={receipt.enregistrePar} />

          <View className="mt-[18px] items-center">
            <QrPlaceholder />
          </View>
        </View>

        {/* Tampon « ACQUITTÉ » (.seal-stamp) */}
        <View
          accessibilityLabel={`Acquitté le ${receipt.date}`}
          className="absolute right-[18px] top-3.5 h-16 w-16 items-center justify-center rounded-full border-2 border-success opacity-[.85]"
          // Inclinaison en style : les classes rotate-* passent par des variables CSS (cf. PressableScale).
          style={{ transform: [{ rotate: "-14deg" }] }}
        >
          <Text className="text-center font-sans-semibold text-[11px] leading-[12px] text-success">ACQUITTÉ</Text>
          <Text className="text-center font-sans-medium text-[8.5px] leading-[12px] tabular-nums text-success" numberOfLines={1}>
            {receipt.date}
          </Text>
        </View>
      </View>

      {peutAnnuler ? (
        annulation ? (
          <Card className="mt-4">
            {nonEnvoye ? (
              <Muted>Retirer ce paiement qui n'a pas pu être envoyé ?</Muted>
            ) : (
              <Field label="Motif de l'annulation" placeholder="Ex : saisi par erreur" value={motif} onChangeText={setMotif} first />
            )}
            <Button
              title={busy ? "Annulation…" : nonEnvoye ? "Retirer le paiement" : "Confirmer l'annulation"}
              variant="danger"
              block
              className="mt-3"
              disabled={busy}
              onPress={confirmerAnnulation}
            />
            <Button title="Garder le paiement" variant="ghost" block className="mt-2" onPress={() => setAnnulation(false)} />
          </Card>
        ) : (
          <Button
            title={nonEnvoye ? "Retirer ce paiement" : "Annuler ce paiement"}
            variant="danger"
            block
            className="mt-4"
            onPress={() => setAnnulation(true)}
          />
        )
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} className="mt-2" />
    </View>
  )
}
