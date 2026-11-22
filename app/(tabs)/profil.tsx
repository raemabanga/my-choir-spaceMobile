// Écran Profil — conforme à renderProfil() du prototype.
import { router } from "expo-router"
import { useState } from "react"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { ReceiptSheet } from "../../components/sheets/CotisationSheets"
import { Check, ClipboardCheck, Download, ListChecks, Receipt } from "lucide-react-native"
import { ResumeAssiduiteBloc, STATUT_PRESENCE } from "../../components/Assiduite"
import { Avatar, Button, Card, CardTitle, Chevron, Chip, ChipsRow, cx, EmptyState, ListRow, Muted, Pagination, Pill, SearchBar, SectionHeader } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useOfflineCollection } from "../../hooks/offline"
import { usePagination } from "../../hooks/usePagination"
import { fetchMonCompte, LIBELLE_TYPE_SEANCE, type Compte } from "../../lib/api"
import { dettesMembre } from "../../lib/dettes"
import { ROLE_LABEL } from "../../lib/roles"
import { telechargerFichePdf } from "../../lib/fichePdf"
import { lignesFiche } from "../../components/sheets/CompteSheets"
import { correspondRecherche, fmt, formatDateShort } from "../../lib/format"
import { mesPresencesRepository } from "../../lib/offline/entities"
import type { Recu, RecuType } from "../../types"
import { useToast } from "../../context/ToastContext"
import { recuPdfDepuis, telechargerRecusPdf } from "../../lib/recuPdf"

export default function ProfilScreen() {
  const { currentUser, roleHistory, receiptsFor, logout, can, parametres, choraleNom, statutaireParAnnee, nonDuParAnnee, mensualite, events } = useApp()
  const { toast } = useToast()
  const { openSheet } = useSheet()
  // Assiduité du membre connecté (12 derniers mois), calculée par le serveur.
  const assiduite = useOfflineCollection(mesPresencesRepository).items[0]?.data ?? null

  // « Mes reçus » : recherche (libellé, numéro), filtres type et mode de règlement, liste paginée.
  const [recherche, setRecherche] = useState("")
  const [typeRecu, setTypeRecu] = useState<RecuType | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const myReceipts = currentUser ? receiptsFor(currentUser.id) : []
  const libelleMode = (code: string) => parametres.modesReglement.find((m) => m.code === code)?.label ?? code
  const modesPresents = [...new Set(myReceipts.map((r) => r.mode).filter((m): m is string => !!m))]
  const recusVisibles = myReceipts.filter(
    (r) => (!typeRecu || r.type === typeRecu) && (!mode || r.mode === mode) && correspondRecherche(recherche, r.label, r.id, r.date)
  )
  const paginationRecus = usePagination(recusVisibles, 20, [recherche, typeRecu, mode])

  // Téléchargement groupé : plusieurs reçus dans un seul PDF (trois par page A4).
  const [selectionActive, setSelectionActive] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [generation, setGeneration] = useState(false)
  const cleRecu = (r: Recu) => r.localId ?? r.id
  // Paiement refusé par le serveur : pas de reçu.
  const telechargeables = recusVisibles.filter((r) => r.syncStatus !== "failed")
  const selectionnes = telechargeables.filter((r) => selection.has(cleRecu(r)))
  const basculerSelection = (r: Recu) =>
    setSelection((s) => {
      const suivante = new Set(s)
      if (suivante.has(cleRecu(r))) suivante.delete(cleRecu(r))
      else suivante.add(cleRecu(r))
      return suivante
    })
  const telecharger = async (liste: Recu[]) => {
    if (generation || liste.length === 0 || !currentUser) return
    setGeneration(true)
    try {
      await telechargerRecusPdf(
        liste.map((r) => recuPdfDepuis(r, { choraleNom, choriste: currentUser.name, libelleMode })),
        currentUser.name
      )
      setSelectionActive(false)
      setSelection(new Set())
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "La génération des reçus a échoué. Réessayez.")
    } finally {
      setGeneration(false)
    }
  }

  /** Ma fiche en PDF : identité, fiche d'inscription et dettes (fiche lue sur le serveur). */
  const [fichePdf, setFichePdf] = useState(false)
  const telechargerMaFiche = async () => {
    if (fichePdf || !currentUser) return
    setFichePdf(true)
    try {
      let compte: Compte
      try {
        compte = await fetchMonCompte()
      } catch {
        throw new Error("Connectez-vous à internet pour télécharger votre fiche.")
      }
      await telechargerFichePdf({
        choraleNom,
        nom: compte.nom,
        identite: [
          ["Nom", compte.nomDeFamille || "—"],
          ["Prénom", compte.prenom || "—"],
          ["Téléphone", compte.telephone || "—"],
          ["Email", compte.email || "—"],
          ["Rôles", compte.roles.map((r) => ROLE_LABEL[r]).join(", ")],
        ],
        fiche: lignesFiche(compte.fiche ?? {}),
        dettes: dettesMembre(currentUser.id, { statutaireParAnnee, nonDuParAnnee, mensualite, events }).dettes,
      })
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Le PDF n'a pas pu être créé.")
    } finally {
      setFichePdf(false)
    }
  }

  if (!currentUser) return null

  const hist = roleHistory[currentUser.id] ?? []

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
      <Button
        title={fichePdf ? "Préparation du PDF…" : "Télécharger ma fiche (PDF)"}
        icon={Download}
        variant="outline"
        block
        className="mb-1"
        disabled={fichePdf}
        onPress={telechargerMaFiche}
      />

      {/* Gestion de la chorale : mêmes droits que le web (comptes : admin, bureau, secrétaire ;
          présences : bureau, secrétariat, commissions recette et présence). */}
      {can("comptesVoir") || can("presences") ? (
        <>
          <SectionHeader title="Gestion de la chorale" />
          <Card className="py-1">
            {can("comptesVoir") ? (
              <ListRow
                last={!can("presences")}
                title={can("comptes") ? "Comptes & Rôles" : "Choristes"}
                subtitle={
                  can("comptesFull")
                    ? "Créer des comptes, attribuer et révoquer les rôles"
                    : can("comptes")
                      ? "Créer et désactiver les comptes choriste et commissions"
                      : "Consulter la liste des choristes et leur fiche"
                }
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
            <ResumeAssiduiteBloc resume={assiduite} categorie={assiduite.categorie} suffixe=" (12 derniers mois)" />
            {assiduite.dernieres.slice(0, 3).map((s, i) => (
              <ListRow
                key={s.seanceId}
                last={i === Math.min(assiduite.dernieres.length, 3) - 1}
                title={s.libelle}
                subtitle={`${LIBELLE_TYPE_SEANCE[s.type] ?? "Séance"} · ${formatDateShort(s.date)}`}
                right={<Pill variant={STATUT_PRESENCE[s.statut].variant}>{STATUT_PRESENCE[s.statut].label}</Pill>}
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
        <>
          <SearchBar value={recherche} onChangeText={setRecherche} placeholder="Rechercher un reçu (libellé, numéro, date)" autoCorrect={false} />
          <ChipsRow className={modesPresents.length > 1 ? "mb-2" : undefined}>
            <Chip label="Tous" active={typeRecu === null} onPress={() => setTypeRecu(null)} />
            <Chip label="Statutaire" active={typeRecu === "Statutaire"} onPress={() => setTypeRecu("Statutaire")} />
            <Chip label="Événementielle" active={typeRecu === "Événementielle"} onPress={() => setTypeRecu("Événementielle")} />
          </ChipsRow>
          {modesPresents.length > 1 ? (
            <ChipsRow>
              <Chip label="Tous les modes" active={mode === null} onPress={() => setMode(null)} />
              {modesPresents.map((m) => (
                <Chip key={m} label={libelleMode(m)} active={mode === m} onPress={() => setMode(mode === m ? null : m)} />
              ))}
            </ChipsRow>
          ) : null}
          {telechargeables.length > 0 ? (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {selectionActive ? (
                <>
                  <Button
                    small
                    icon={Download}
                    title={generation ? "Génération…" : `Télécharger la sélection (${selectionnes.length})`}
                    disabled={generation || selectionnes.length === 0}
                    onPress={() => telecharger(selectionnes)}
                  />
                  <Button
                    small
                    variant="ghost"
                    title="Annuler"
                    onPress={() => {
                      setSelectionActive(false)
                      setSelection(new Set())
                    }}
                  />
                </>
              ) : (
                <>
                  <Button
                    small
                    variant="outline"
                    icon={Download}
                    title={generation ? "Génération…" : `Tout télécharger (${telechargeables.length})`}
                    disabled={generation}
                    onPress={() => telecharger(telechargeables)}
                  />
                  {telechargeables.length > 1 ? (
                    <Button small variant="ghost" icon={ListChecks} title="Sélectionner" onPress={() => setSelectionActive(true)} />
                  ) : null}
                </>
              )}
            </View>
          ) : null}
          {selectionActive ? <Muted className="-mt-1 mb-2">Touchez les reçus à mettre dans le PDF (trois par page).</Muted> : null}
          {recusVisibles.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucun résultat" subtitle="Modifiez la recherche ou les filtres." />
          ) : (
            <Card className="py-1">
              {paginationRecus.pageItems.map((r, i) => {
                const coche = selection.has(cleRecu(r))
                const selectionnable = r.syncStatus !== "failed"
                return (
                  <ListRow
                    key={cleRecu(r)}
                    last={i === paginationRecus.pageItems.length - 1}
                    left={
                      selectionActive ? (
                        <View
                          className={cx(
                            "size-[22px] items-center justify-center rounded-md border",
                            coche ? "border-navy bg-navy" : "border-line-strong bg-paper",
                            !selectionnable && "opacity-40"
                          )}
                        >
                          {coche ? <Check size={14} color={colors.paper} strokeWidth={3} /> : null}
                        </View>
                      ) : undefined
                    }
                    title={r.label}
                    subtitle={`${r.date} · ${r.type}` + (r.syncStatus === "pending" ? " · en attente d'envoi" : r.syncStatus === "failed" ? " · non envoyé" : "")}
                    right={
                      <Pill variant="gold" mono>
                        {fmt(r.montant)}
                      </Pill>
                    }
                    accessibilityLabel={selectionActive ? `${r.label}, ${coche ? "sélectionné" : "non sélectionné"}` : undefined}
                    onPress={
                      selectionActive
                        ? selectionnable
                          ? () => basculerSelection(r)
                          : undefined
                        : () => openSheet(<ReceiptSheet receipt={r} />)
                    }
                  />
                )
              })}
            </Card>
          )}
          <Pagination {...paginationRecus} />
        </>
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
