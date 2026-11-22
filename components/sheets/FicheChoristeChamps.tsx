// Champs de la fiche d'inscription du choriste, dans l'ordre de la fiche papier.
// Partagés par la création et la modification d'un compte (CompteSheets.tsx).
// Équivalent mobile de components/portail/fiche-choriste-champs.tsx sur le web.

import DateTimePicker from "@react-native-community/datetimepicker"
import { useState } from "react"
import { Platform, Pressable, Switch, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { DateField } from "../DateField"
import {
  depuisDate,
  GENRES,
  SITUATIONS_MATRIMONIALES,
  SITUATIONS_SOCIALES,
  STATUTS_EGLISE,
  TYPES_MARIAGE,
  VOIX,
  versDate,
  type ErreursFiche,
  type FicheSaisie,
} from "../../lib/fiche"
import { Chip, Field, FieldLabel, fieldBoxClasses, FormRow2, SectionHeader } from "../ui"

/** Message d'erreur sous un champ. */
function Erreur({ children }: { children?: string }) {
  if (!children) return null
  return <Text className="mt-1 font-sans text-[11.5px] text-danger">{children}</Text>
}

/**
 * Date facultative : vide, le champ affiche « Choisir une date ». Une fois choisie, c'est un
 * DateField classique avec un lien « Effacer ».
 */
function DateFacultative({
  label,
  value,
  onChange,
  defaut,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  /** Date proposée à l'ouverture du calendrier. */
  defaut: Date
}) {
  const [show, setShow] = useState(false)
  const aujourdhui = new Date()

  if (value) {
    return (
      <View>
        <DateField label={label} value={versDate(value)} maximumDate={aujourdhui} onChange={(d) => onChange(depuisDate(d))} />
        <Pressable onPress={() => onChange(undefined)} accessibilityRole="button" accessibilityLabel={`Effacer : ${label}`} hitSlop={8}>
          <Text className="mt-1 font-sans-medium text-[12px] text-ink-soft underline">Effacer</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        // iOS : le calendrier compact ne s'ouvre pas par programme, on propose donc la date par défaut.
        onPress={() => (Platform.OS === "ios" ? onChange(depuisDate(defaut)) : setShow(true))}
        accessibilityRole="button"
        accessibilityLabel={`${label} : non renseignée, choisir une date`}
        className={`${fieldBoxClasses(false)} min-h-touch justify-center px-[13px]`}
      >
        <Text className="font-sans text-[13.5px] text-ink-light">Choisir une date</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={defaut}
          mode="date"
          display="default"
          maximumDate={aujourdhui}
          onChange={(_, date) => {
            setShow(false)
            if (date) onChange(depuisDate(date))
          }}
        />
      ) : null}
    </View>
  )
}

/** Choix unique : un second appui sur le choix actif le retire. */
function ChoixUnique<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <View className="mt-2 flex-row flex-wrap gap-[7px]">
      {options.map(([v, l]) => (
        <Chip key={v} label={l} active={value === v} onPress={() => onChange(value === v ? undefined : v)} />
      ))}
    </View>
  )
}

export function FicheChoristeChamps({
  saisie,
  onChange,
  erreurs,
  onEffacerErreur,
}: {
  saisie: FicheSaisie
  onChange: (maj: Partial<FicheSaisie>) => void
  erreurs: ErreursFiche
  onEffacerErreur: (cle: keyof ErreursFiche) => void
}) {
  const texte = (cle: "lieuNaissance" | "adresse" | "quartier" | "zone" | "lieuBapteme" | "profession" | "secteurActivite" | "precedentesChorales") => ({
    value: saisie[cle] ?? "",
    onChangeText: (v: string) => onChange({ [cle]: v }),
  })

  return (
    <View>
      <SectionHeader title="Genre et pupitre" />
      <FieldLabel>Genre</FieldLabel>
      <ChoixUnique options={GENRES} value={saisie.genre} onChange={(v) => onChange({ genre: v })} />
      <FieldLabel>Voix</FieldLabel>
      <ChoixUnique options={VOIX} value={saisie.voix} onChange={(v) => onChange({ voix: v })} />
      <View className="mt-3.5 flex-row items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3.5 py-3">
        <View className="flex-1">
          <Text className="font-sans-medium text-[13.5px] text-ink">Instrumentiste</Text>
          <Text className="font-sans text-[12px] text-ink-light">Joue d'un instrument pour la chorale</Text>
        </View>
        <Switch
          value={saisie.instrumentiste ?? false}
          onValueChange={(v) => onChange({ instrumentiste: v })}
          accessibilityLabel="Instrumentiste"
          // Composant natif : couleurs passées en props.
          trackColor={{ false: colors.lineStrong, true: colors.navy }}
          thumbColor={colors.paper}
        />
      </View>

      <SectionHeader title="Naissance et domicile" />
      <DateFacultative
        label="Date de naissance (facultatif)"
        value={saisie.dateNaissance}
        defaut={new Date(2000, 0, 1)}
        onChange={(v) => (onChange({ dateNaissance: v }), onEffacerErreur("dateNaissance"), onEffacerErreur("dateBapteme"))}
      />
      <Erreur>{erreurs.dateNaissance}</Erreur>
      <Field label="Lieu de naissance (facultatif)" placeholder="Ex. Abidjan" autoCapitalize="words" {...texte("lieuNaissance")} />
      <Field label="Adresse (facultatif)" placeholder="Rue, lot, îlot…" {...texte("adresse")} />
      <FormRow2>
        <Field label="Quartier (facultatif)" autoCapitalize="words" {...texte("quartier")} />
        <Field label="Zone (facultatif)" {...texte("zone")} />
      </FormRow2>

      <SectionHeader title="Situation matrimoniale" />
      <ChoixUnique
        options={SITUATIONS_MATRIMONIALES}
        value={saisie.situationMatrimoniale}
        onChange={(v) => onChange({ situationMatrimoniale: v })}
      />
      {saisie.situationMatrimoniale === "MARIE" ? (
        <>
          <FieldLabel>Type de mariage (plusieurs choix possibles)</FieldLabel>
          <View className="flex-row flex-wrap gap-[7px]">
            {TYPES_MARIAGE.map(([v, l]) => {
              const actif = saisie.typesMariage.includes(v)
              return (
                <Chip
                  key={v}
                  label={l}
                  active={actif}
                  onPress={() =>
                    onChange({ typesMariage: actif ? saisie.typesMariage.filter((x) => x !== v) : [...saisie.typesMariage, v] })
                  }
                />
              )
            })}
          </View>
        </>
      ) : null}
      <Field
        label="Nombre d'enfants (facultatif)"
        mono
        keyboardType="number-pad"
        value={saisie.nombreEnfants}
        onChangeText={(v) => (onChange({ nombreEnfants: v }), onEffacerErreur("nombreEnfants"))}
      />
      <Erreur>{erreurs.nombreEnfants}</Erreur>

      <SectionHeader title="Statut à l'Église" />
      <ChoixUnique options={STATUTS_EGLISE} value={saisie.statutEglise} onChange={(v) => onChange({ statutEglise: v })} />
      <DateFacultative
        label="Date de baptême (facultatif)"
        value={saisie.dateBapteme}
        defaut={new Date()}
        onChange={(v) => (onChange({ dateBapteme: v }), onEffacerErreur("dateBapteme"))}
      />
      <Erreur>{erreurs.dateBapteme}</Erreur>
      <Field label="Lieu de baptême (facultatif)" placeholder="Paroisse, ville" {...texte("lieuBapteme")} />
      <FieldLabel>Transféré(e) d'une autre paroisse ?</FieldLabel>
      <ChoixUnique
        options={[
          ["oui", "Oui"],
          ["non", "Non"],
        ]}
        value={saisie.transfere === undefined ? undefined : saisie.transfere ? "oui" : "non"}
        onChange={(v) => onChange({ transfere: v === undefined ? undefined : v === "oui" })}
      />

      <SectionHeader title="Situation sociale" />
      <ChoixUnique options={SITUATIONS_SOCIALES} value={saisie.situationSociale} onChange={(v) => onChange({ situationSociale: v })} />
      <Field label="Profession (facultatif)" {...texte("profession")} />
      <Field label="Secteur d'activité (facultatif)" {...texte("secteurActivite")} />
      <Field
        label="Précédente(s) chorale(s) (facultatif)"
        multiline
        placeholder="Nom de la chorale, paroisse, années…"
        {...texte("precedentesChorales")}
      />
    </View>
  )
}
