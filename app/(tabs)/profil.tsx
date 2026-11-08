// Écran Profil — conforme à renderProfil() du prototype.
import { router } from "expo-router"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { ReceiptSheet } from "../../components/sheets/CotisationSheets"
import { Receipt } from "lucide-react-native"
import { Avatar, Button, Card, CardTitle, Chevron, EmptyState, ListRow, Muted, Pill, SectionHeader } from "../../components/ui"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { fmt } from "../../lib/format"

export default function ProfilScreen() {
  const { currentUser, roleHistory, receiptsFor, logout, can } = useApp()
  const { openSheet } = useSheet()

  if (!currentUser) return null

  const hist = roleHistory[currentUser.id] ?? []
  const myReceipts = receiptsFor(currentUser.id)

  return (
    <Screen title="Profil">
      {/* Carte identité */}
      <Card className="flex-row items-center gap-3.5">
        <Avatar id={currentUser.id} name={currentUser.name} size={52} />
        <View className="min-w-0 flex-1">
          <CardTitle>{currentUser.name}</CardTitle>
          <Muted>
            Membre n° <Text className="font-sans-medium tabular-nums">{currentUser.numero}</Text>
          </Muted>
        </View>
      </Card>

      {/* Gestion de la chorale : mêmes droits que le web (admin, bureau, secrétaire). */}
      {can("comptes") ? (
        <>
          <SectionHeader title="Gestion de la chorale" />
          <Card className="py-1">
            <ListRow
              last
              title="Comptes & Rôles"
              subtitle={can("comptesFull") ? "Créer des comptes, attribuer et révoquer les rôles" : "Créer et désactiver les comptes choriste et commissions"}
              right={<Chevron />}
              onPress={() => router.push("/comptes")}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Historique des rôles" />
      <Card className="py-1">
        {hist.map((h, i) => (
          <ListRow
            key={i}
            last={i === hist.length - 1}
            title={h.role}
            subtitle={"Depuis le " + h.debut + (h.fin ? " jusqu'au " + h.fin : "")}
            right={!h.fin ? <Pill variant="green">Actif</Pill> : <Pill>Terminé</Pill>}
          />
        ))}
      </Card>

      <SectionHeader title="Mes reçus" />
      {myReceipts.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucun reçu" subtitle="Vos reçus apparaîtront ici après un paiement." />
      ) : (
        <Card className="py-1">
          {myReceipts.map((r, i) => (
            <ListRow
              key={r.localId ?? r.id}
              last={i === myReceipts.length - 1}
              title={r.label}
              subtitle={`${r.date} · ${r.type}` + (r.syncStatus === "pending" ? " · en attente d'envoi" : r.syncStatus === "failed" ? " · non envoyé" : "")}
              right={
                <Pill variant="gold" mono>
                  {fmt(r.montant)}
                </Pill>
              }
              onPress={() => openSheet(<ReceiptSheet receipt={r} />)}
            />
          ))}
        </Card>
      )}

      <Button
        title="Se déconnecter"
        variant="outline"
        block
        className="mt-[18px]"
        onPress={() => {
          logout()
          router.replace("/login")
        }}
      />
    </Screen>
  )
}
