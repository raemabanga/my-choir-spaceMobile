import { useState } from "react"
import { Text, View } from "react-native"
import { DateField } from "../DateField"
import { Avatar, Button, Card, Field, KeyValue, ListRow, Muted, Pill, ProgressBar, QrPlaceholder, RowBetween, SectionHeader, Select, SheetTitle } from "../ui"

import { ANNEE, MENSUALITE, MONTHS } from "../../data/mockData"
import { fmt } from "../../lib/format"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Recu } from "../../types"

const MODES = ["Espèces", "Mobile Money", "Virement", "Chèque"]

/**
 * Saisie du montant en Geist Mono à chiffres tabulaires. `Field` n'expose pas de className pour son
 * TextInput interne (un className y écraserait toutes ses classes) : police passée via sa prop `style`.
 */

/** Montant secondaire en Geist Mono (12,5px, muted) ; pas via <Numeric> pour éviter un conflit avec ses text-[13px]/text-ink. */
const MUTED_NUM = "font-mono-medium text-[12.5px] tabular-nums text-ink-light"

/** Boutons d'action en bas de sheet : principal à 20px du dernier champ, « Annuler » 8px dessous. */
function SheetActions({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <Button title="Valider et générer le reçu" onPress={onConfirm} block className="mt-5" />
      <Button title="Annuler" variant="ghost" onPress={onCancel} block className="mt-2" />
    </>
  )
}

/* --------------------------- Paiement statutaire (mois précis) --------------------------- */

export function PaymentSheet({ chorishId, monthIndex }: { chorishId: number; monthIndex: number }) {
  const { chorists, confirmPaymentStatutaire } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const chorist = chorists.find((c) => c.id === chorishId)!
  const [amount, setAmount] = useState(String(MENSUALITE))
  const [date, setDate] = useState(new Date())
  const [mode, setMode] = useState(MODES[0])

  function confirm() {
    confirmPaymentStatutaire(chorishId, monthIndex, parseInt(amount) || MENSUALITE)
    closeSheet()
    toast("Paiement enregistré — reçu généré")
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>
        Cotisation statutaire · {MONTHS[monthIndex]} <Text className="font-mono-medium tabular-nums">{ANNEE}</Text>
      </Muted>
      <Field label="Choriste" value={chorist.name} editable={false} />
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" mono />
      <DateField label="Date du paiement" value={date} onChange={setDate} />
      <Select label="Mode" value={mode} onChange={setMode} options={MODES.map((m) => ({ label: m, value: m }))} />
      <SheetActions onConfirm={confirm} onCancel={closeSheet} />
    </View>
  )
}

/* --------------------------- Paiement rapide (choix choriste + mois) --------------------------- */

export function QuickPaymentSheet() {
  const { chorists, statutaire, confirmPaymentStatutaire } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const [chorishId, setChorishId] = useState(chorists[0].id)
  const firstUnpaid = (id: number) => Math.max(0, statutaire[id].findIndex((p) => !p))
  const [monthIndex, setMonthIndex] = useState(firstUnpaid(chorists[0].id))
  const [amount, setAmount] = useState(String(MENSUALITE))

  const monthOptions = MONTHS.map((m, i) => ({ label: `${m} ${ANNEE}` + (statutaire[chorishId][i] ? " (déjà réglé)" : ""), value: i }))

  function confirm() {
    if (statutaire[chorishId][monthIndex]) {
      toast("Ce mois est déjà réglé")
      return
    }
    confirmPaymentStatutaire(chorishId, monthIndex, parseInt(amount) || MENSUALITE)
    closeSheet()
    toast("Paiement enregistré — reçu généré")
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
      <SheetActions onConfirm={confirm} onCancel={closeSheet} />
    </View>
  )
}

/* --------------------------- Détail cotisation événementielle --------------------------- */

export function EventCotisationSheet({ eventId, chorishId }: { eventId: number; chorishId: number }) {
  const { events, chorists, can, recus } = useApp()
  const { openSheet, closeSheet } = useSheet()
  const ev = events.find((e) => e.id === eventId)
  const chorist = chorists.find((c) => c.id === chorishId)
  if (!ev || !chorist) return null

  const paid = ev.contributions[chorishId] || 0
  const remaining = Math.max(0, ev.cotisationMontant - paid)
  const canPay = can("paiements")
  const receipt = recus.find((r) => r.chorishId === chorishId && r.label === ev.titre)

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
        <ProgressBar percent={(paid / ev.cotisationMontant) * 100} />
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
  const ev = events.find((e) => e.id === eventId)!
  const chorist = chorists.find((c) => c.id === chorishId)!
  const remaining = ev.cotisationMontant - (ev.contributions[chorishId] || 0)
  const [amount, setAmount] = useState(String(remaining))
  const [date, setDate] = useState(new Date())

  function confirm() {
    const value = parseInt(amount) || 0
    if (value <= 0) {
      toast("Saisissez un montant valide")
      return
    }
    confirmEventPayment(eventId, chorishId, value)
    closeSheet()
    toast("Paiement enregistré — reçu généré")
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>
        {ev.titre} · {chorist.name}
      </Muted>
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" mono />
      <DateField label="Date" value={date} onChange={setDate} />
      <SheetActions onConfirm={confirm} onCancel={closeSheet} />
    </View>
  )
}

/* --------------------------- Reçu numérique (.receipt) --------------------------- */

export function ReceiptSheet({ receipt }: { receipt: Pick<Recu, "id" | "chorishId" | "label" | "montant" | "date" | "enregistrePar"> }) {
  const { chorists } = useApp()
  const { closeSheet } = useSheet()
  const chorist = chorists.find((c) => c.id === receipt.chorishId)

  return (
    <View>
      <SheetTitle>Reçu numérique</SheetTitle>

      <View className="mt-3 rounded-card border border-line bg-paper p-[22px]">
        <View className="rounded-field border border-dashed border-line-strong p-[18px]">
          {/* Réserve à droite pour ne pas passer sous le tampon sur petit écran. */}
          <View className="pr-14">
            <Text className="font-mono text-[10px] tabular-nums text-ink-light">N° {receipt.id}</Text>
            <Text className="mb-3.5 mt-1.5 font-sans-bold text-[18.5px] tracking-[-0.2px] text-navy">Chorale Sainte-Cécile</Text>
          </View>

          <KeyValue label="Choriste" value={chorist?.name ?? "—"} first />
          <KeyValue label="Motif" value={receipt.label} />
          <KeyValue label="Montant" value={fmt(receipt.montant)} mono valueClassName="text-success" />
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
          <Text className="text-center font-mono-medium text-[8.5px] leading-[12px] tabular-nums text-success" numberOfLines={1}>
            {receipt.date}
          </Text>
        </View>
      </View>

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} className="mt-4" />
    </View>
  )
}
