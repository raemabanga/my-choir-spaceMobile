import { router } from "expo-router"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { ReceiptSheet } from "../../components/sheets/CotisationSheets"
import { Avatar, Card, EmptyState, ListRow, Muted, Pill, RowBetween, SectionHeader } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Button } from "../../components/ui"

export default function ProfilScreen() {
  const { currentUser, chorists, roleLabels, roleHistory, receiptsFor, loginAs, logout } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()

  if (!currentUser) return null

  const hist = roleHistory[currentUser.id] ?? []
  const myReceipts = receiptsFor(currentUser.id)
  const others = chorists.filter((c) => c.id !== currentUser.id)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <AppHeader title="Profil" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={currentUser.name} color={currentUser.color} size={52} />
          <View>
            <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 16, color: colors.ink }}>{currentUser.name}</Text>
            <Muted>Membre n° {currentUser.numero}</Muted>
          </View>
        </Card>

        <SectionHeader title="Rôles actuels" />
        <Card>
          {currentUser.roles.map((r) => (
            <RowBetween key={r} style={{ paddingVertical: 6 }}>
              <Pill variant="gold">{roleLabels[r]}</Pill>
              {currentUser.mandat && r !== "choriste" ? (
                <Muted>
                  {currentUser.mandat.debut} — {currentUser.mandat.fin}
                </Muted>
              ) : null}
            </RowBetween>
          ))}
          <Muted style={{ marginTop: 8 }}>
            Une même personne peut cumuler plusieurs rôles à la fois sur un compte unique.
          </Muted>
        </Card>

        <SectionHeader title="Historique des rôles" />
        <Card>
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
          <Card>
            {myReceipts.map((r, i) => (
              <ListRow
                key={r.id}
                last={i === myReceipts.length - 1}
                title={r.label}
                subtitle={r.date + " · " + r.type}
                right={<Pill variant="gold">{r.montant.toLocaleString("fr-FR")} FCFA</Pill>}
                onPress={() => openSheet(<ReceiptSheet receipt={r} />)}
              />
            ))}
          </Card>
        )}

        <SectionHeader title="Aperçu du rôle (démo)" />
        <Card>
          <Muted style={{ marginBottom: 6 }}>
            Se connecter avec un autre profil pour prévisualiser ses droits d'accès :
          </Muted>
          {others.map((c, i) => (
            <ListRow
              key={c.id}
              last={i === others.length - 1}
              left={<Avatar name={c.name} color={c.color} size={30} />}
              title={c.name}
              subtitle={c.roles.map((r) => roleLabels[r]).join(" · ")}
              right={<Text style={{ color: colors.muted, fontSize: 16 }}>›</Text>}
              onPress={() => {
                loginAs(c.id)
                toast("Connecté — " + c.name)
              }}
            />
          ))}
        </Card>

        <Button
          title="Se déconnecter"
          variant="outline"
          block
          style={{ marginTop: 18 }}
          onPress={() => {
            logout()
            router.replace("/login")
          }}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
