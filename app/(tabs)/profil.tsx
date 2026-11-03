// Écran Profil — conforme à renderProfil() du prototype.
import { router } from "expo-router"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { ReceiptSheet } from "../../components/sheets/CotisationSheets"
import { Avatar, Button, Card, CardTitle, Chevron, EmptyState, ListRow, Muted, Pill, RowBetween, SectionHeader } from "../../components/ui"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { fmt } from "../../lib/format"

export default function ProfilScreen() {
  const { currentUser, chorists, roleLabels, roleHistory, receiptsFor, loginAs, logout, isDemo, can } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()

  if (!currentUser) return null

  const hist = roleHistory[currentUser.id] ?? []
  const myReceipts = receiptsFor(currentUser.id)
  const others = chorists.filter((c) => c.id !== currentUser.id)

  return (
    <Screen title="Profil">
      {/* Carte identité */}
      <Card className="flex-row items-center gap-3.5">
        <Avatar id={currentUser.id} name={currentUser.name} size={52} />
        <View className="min-w-0 flex-1">
          <CardTitle>{currentUser.name}</CardTitle>
          <Muted>
            Membre n° <Text className="font-mono-medium tabular-nums">{currentUser.numero}</Text>
          </Muted>
        </View>
      </Card>

      <SectionHeader title="Rôles actuels" />
      <Card>
        {currentUser.roles.map((r) => (
          <RowBetween key={r} className="py-1.5">
            <Pill variant="gold">{roleLabels[r]}</Pill>
            {currentUser.mandat && r !== "choriste" ? (
              <Muted className="font-mono-medium tabular-nums">
                {currentUser.mandat.debut} → {currentUser.mandat.fin}
              </Muted>
            ) : null}
          </RowBetween>
        ))}
        <Muted className="mt-2">Une même personne peut cumuler plusieurs rôles à la fois sur un compte unique.</Muted>
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
        <EmptyState icon="🧾" title="Aucun reçu" subtitle="Vos reçus apparaîtront ici après un paiement." />
      ) : (
        <Card className="py-1">
          {myReceipts.map((r, i) => (
            <ListRow
              key={r.id}
              last={i === myReceipts.length - 1}
              title={r.label}
              subtitle={`${r.date} · ${r.type}`}
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

      {/* Changement de compte : réservé au mode démonstration (jamais avec une vraie session). */}
      {isDemo ? (
        <>
          <SectionHeader title="Aperçu du rôle (démo)" />
          <Card className="pb-1">
            <Muted className="mb-1">Se connecter avec un autre profil pour prévisualiser ses droits d'accès :</Muted>
            {others.map((c, i) => (
              <ListRow
                key={c.id}
                last={i === others.length - 1}
                left={<Avatar id={c.id} name={c.name} size={30} />}
                title={c.name}
                subtitle={c.roles.map((r) => roleLabels[r]).join(" · ")}
                right={<Chevron />}
                onPress={() => {
                  loginAs(c.id)
                  router.replace("/(tabs)")
                  toast("Connecté — " + c.name)
                }}
              />
            ))}
          </Card>
        </>
      ) : null}

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
