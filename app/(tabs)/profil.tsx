// Écran Profil — conforme à renderProfil() du prototype.
import { router } from "expo-router"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { ReceiptSheet } from "../../components/sheets/CotisationSheets"
import { ClipboardCheck, Receipt } from "lucide-react-native"
import { Avatar, Button, Card, CardTitle, Chevron, EmptyState, ListRow, Muted, Numeric, Pill, ProgressBar, RowBetween, SectionHeader, type PillVariant } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useOfflineCollection } from "../../hooks/offline"
import { LIBELLE_TYPE_SEANCE, type CategorieAssiduite, type StatutPresence } from "../../lib/api"
import { fmt, formatDateShort } from "../../lib/format"
import { mesPresencesRepository } from "../../lib/offline/entities"

/** Pastille de la catégorie d'assiduité (seuils de l'API : 75 % et 40 %). */
const CATEGORIE: Record<CategorieAssiduite, { label: string; variant: PillVariant }> = {
  ASSIDU: { label: "Assidu", variant: "green" },
  IRREGULIER: { label: "Irrégulier", variant: "pending" },
  DECROCHEUR: { label: "Décrocheur", variant: "burg" },
}

const STATUT: Record<StatutPresence, { label: string; variant: PillVariant }> = {
  PRESENT: { label: "Présent", variant: "green" },
  EXCUSE: { label: "Excusé", variant: "pending" },
  ABSENT: { label: "Absent", variant: "burg" },
}

export default function ProfilScreen() {
  const { currentUser, roleHistory, receiptsFor, logout, can } = useApp()
  const { openSheet } = useSheet()
  // Assiduité du membre connecté (12 derniers mois), calculée par le serveur.
  const assiduite = useOfflineCollection(mesPresencesRepository).items[0]?.data ?? null

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

      {/* Gestion de la chorale : mêmes droits que le web (comptes : admin, bureau, secrétaire ;
          présences : bureau, secrétariat, commissions recette et présence). */}
      {can("comptes") || can("presences") ? (
        <>
          <SectionHeader title="Gestion de la chorale" />
          <Card className="py-1">
            {can("comptes") ? (
              <ListRow
                last={!can("presences")}
                title="Comptes & Rôles"
                subtitle={can("comptesFull") ? "Créer des comptes, attribuer et révoquer les rôles" : "Créer et désactiver les comptes choriste et commissions"}
                right={<Chevron />}
                onPress={() => router.push("/comptes")}
              />
            ) : null}
            {can("presences") ? (
              <ListRow
                last
                left={<ClipboardCheck size={20} color={colors.navy} strokeWidth={1.75} />}
                title="Présences"
                subtitle="Faire l'appel, historique des séances"
                right={<Chevron />}
                onPress={() => router.push("/presences")}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Mon assiduité" />
      <Card>
        {assiduite && assiduite.attendues > 0 ? (
          <>
            <RowBetween>
              <Numeric className="font-sans-semibold text-[28px] tracking-[-0.5px]">{assiduite.taux != null ? `${assiduite.taux} %` : "—"}</Numeric>
              {assiduite.categorie ? <Pill variant={CATEGORIE[assiduite.categorie].variant}>{CATEGORIE[assiduite.categorie].label}</Pill> : null}
            </RowBetween>
            <ProgressBar percent={assiduite.taux ?? 0} />
            <Muted className="mt-1">
              {`${assiduite.presents} présences · ${assiduite.excuses} excusées · ${assiduite.absents} absences sur ${assiduite.attendues} séances (12 derniers mois)`}
            </Muted>
            {assiduite.dernieres.slice(0, 3).map((s, i) => (
              <ListRow
                key={s.seanceId}
                last={i === Math.min(assiduite.dernieres.length, 3) - 1}
                title={s.libelle}
                subtitle={`${LIBELLE_TYPE_SEANCE[s.type] ?? "Séance"} · ${formatDateShort(s.date)}`}
                right={<Pill variant={STATUT[s.statut].variant}>{STATUT[s.statut].label}</Pill>}
              />
            ))}
          </>
        ) : (
          <Muted>Aucune séance enregistrée pour le moment.</Muted>
        )}
      </Card>

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
