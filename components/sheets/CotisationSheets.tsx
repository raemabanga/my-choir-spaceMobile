import { useState } from "react"
import { Text, View } from "react-native"
import { DateField } from "../DateField"
import { Avatar, Button, Field, Muted, Pill, ProgressBar, RowBetween, Select } from "../ui"

import { MENSUALITE, MONTHS } from "../../data/mockData"
import { fmt } from "../../lib/format"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"

function SheetTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 19, color: colors.aubergine, marginBottom: 4 }}>{children}</Text>
}

/* --------------------------- Paiement statutaire (mois précis) --------------------------- */

export function PaymentSheet({ chorishId, monthIndex }: { chorishId: number; monthIndex: number }) {
  const { chorists, confirmPaymentStatutaire } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const chorist = chorists.find((c) => c.id === chorishId)!
  const [amount, setAmount] = useState(String(MENSUALITE))
  const [date, setDate] = useState(new Date())
  const [mode, setMode] = useState("Espèces")

  function confirm() {
    confirmPaymentStatutaire(chorishId, monthIndex, parseInt(amount) || MENSUALITE)
    closeSheet()
    toast("Paiement enregistré — reçu généré")
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>Cotisation statutaire · {MONTHS[monthIndex]}</Muted>
      <Field label="Choriste" value={chorist.name} editable={false} />
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <DateField label="Date du paiement" value={date} onChange={setDate} />
      <Select
        label="Mode"
        value={mode}
        onChange={setMode}
        options={["Espèces", "Chèque", "Virement"].map((m) => ({ label: m, value: m }))}
      />
      <Button title="Valider et générer le reçu" onPress={confirm} block style={{ marginTop: 20 }} />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block />
    </View>
  )
}

/* --------------------------- Paiement rapide (choix choriste + mois) --------------------------- */

export function QuickPaymentSheet() {
  const { chorists, confirmPaymentStatutaire } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  const [chorishId, setChorishId] = useState(chorists[0].id)
  const [monthIndex, setMonthIndex] = useState(0)
  const [amount, setAmount] = useState(String(MENSUALITE))

  function confirm() {
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
        onChange={setChorishId}
        options={chorists.map((c) => ({ label: c.name, value: c.id }))}
      />
      <Select
        label="Mois à régler"
        value={monthIndex}
        onChange={setMonthIndex}
        options={MONTHS.map((m, i) => ({ label: m, value: i }))}
      />
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Button title="Valider et générer le reçu" onPress={confirm} block style={{ marginTop: 20 }} />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block />
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
  const canPay = can("registerPayment")

  return (
    <View>
      <SheetTitle>{ev.titre}</SheetTitle>
      <Muted>Cotisation événementielle — {fmt(ev.cotisationMontant)} par personne</Muted>
      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(46,27,51,0.08)", borderRadius: 18, padding: 16, marginTop: 12, marginBottom: 12 }}>
        <RowBetween>
          <Muted>{chorist.name}</Muted>
          <Pill variant={remaining === 0 ? "green" : "default"}>
            {remaining === 0 ? "Réglé" : fmt(remaining) + " restant"}
          </Pill>
        </RowBetween>
        <ProgressBar percent={(paid / ev.cotisationMontant) * 100} />
        <Muted>{fmt(paid)} / {fmt(ev.cotisationMontant)}</Muted>
      </View>

      {canPay && remaining > 0 ? (
        <Button
          title="Enregistrer un paiement"
          block
          onPress={() => openSheet(<EventPaymentSheet eventId={eventId} chorishId={chorishId} />)}
        />
      ) : null}
      {remaining === 0 ? (
        <Button
          title="Voir mon reçu"
          variant="outline"
          block
          onPress={() => {
            const r = recus.find((r: any) => r.chorishId === chorishId && r.label === ev.titre) || recus[0]
            if (r) openSheet(<ReceiptSheet receipt={r} />)
          }}
        />
      ) : null}

      {can("viewAllCotisations") ? (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 15, color: colors.aubergine }}>
              Tous les choristes
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(46,27,51,0.25)" }} />
          </View>
          {chorists.map((c: any) => {
            const p = ev.contributions[c.id] || 0
            return (
              <RowBetween key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(46,27,51,0.07)" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={c.name} color={c.color} size={30} />
                  <Text style={{ fontSize: 13.5, color: colors.ink }}>{c.name}</Text>
                </View>
                <Pill variant={p >= ev.cotisationMontant ? "green" : "default"}>{fmt(p)}</Pill>
              </RowBetween>
            )
          })}
        </View>
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} style={{ marginTop: 14 }} />
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
    confirmEventPayment(eventId, chorishId, parseInt(amount) || 0)
    closeSheet()
    toast("Paiement enregistré — reçu généré")
  }

  return (
    <View>
      <SheetTitle>Enregistrer un paiement</SheetTitle>
      <Muted>{ev.titre} · {chorist.name}</Muted>
      <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <DateField label="Date" value={date} onChange={setDate} />
      <Button title="Valider et générer le reçu" onPress={confirm} block style={{ marginTop: 20 }} />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block />
    </View>
  )
}

/* --------------------------- Reçu numérique --------------------------- */

export function ReceiptSheet({ receipt }: { receipt: { id: string; chorishId: number; label: string; montant: number; date: string; enregistrePar: string } }) {
  const { chorists } = useApp()
  const { closeSheet } = useSheet()
  const chorist = chorists.find((c) => c.id === receipt.chorishId)!

  return (
    <View>
      <SheetTitle>Reçu numérique</SheetTitle>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 16,
          padding: 4,
          marginTop: 12,
        }}
      >
        <View style={{ borderWidth: 1.5, borderColor: "rgba(46,27,51,0.25)", borderStyle: "dashed", borderRadius: 10, padding: 18 }}>
          <RowBetween>
            <Text style={{ fontFamily: "SpaceMono_400Regular", fontSize: 10, color: colors.muted }}>N° {receipt.id}</Text>
            <View style={{ borderWidth: 2.5, borderColor: colors.green, borderRadius: 32, width: 60, height: 60, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-14deg" }] }}>
              <Text style={{ fontFamily: "Fraunces_500Medium_Italic", fontSize: 9, color: colors.green, textAlign: "center" }}>ACQUITTÉ{"\n"}{receipt.date}</Text>
            </View>
          </RowBetween>
          <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 16, color: colors.aubergine, marginTop: 10, marginBottom: 14 }}>
            Chorale Sainte-Cécile
          </Text>
          <RowBetween style={{ marginTop: 4 }}>
            <Muted>Choriste</Muted>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{chorist.name}</Text>
          </RowBetween>
          <RowBetween style={{ marginTop: 8 }}>
            <Muted>Motif</Muted>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{receipt.label}</Text>
          </RowBetween>
          <RowBetween style={{ marginTop: 8 }}>
            <Muted>Montant</Muted>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.green }}>{fmt(receipt.montant)}</Text>
          </RowBetween>
          <RowBetween style={{ marginTop: 8 }}>
            <Muted>Enregistré par</Muted>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{receipt.enregistrePar}</Text>
          </RowBetween>
        </View>
      </View>
      <Button title="Fermer" variant="ghost" block onPress={closeSheet} style={{ marginTop: 16 }} />
    </View>
  )
}
