# Mode hors ligne

Principe : **les écrans ne parlent jamais à l'API**. Ils lisent et écrivent uniquement dans la base SQLite du téléphone. Le `syncManager` échange en arrière-plan entre SQLite et le serveur.

```
Écran ──► Hook (useOffline…) ──► Repository ──► SQLite (téléphone)
                                                     ▲
                                                     │ en arrière-plan
                                          syncManager ◄──► API serveur
```

Pour l'écran, que le réseau soit là ou non ne change rien.

## Fichiers

| Fichier | Rôle |
|---|---|
| `database.ts` | Ouvre `offline.db`, applique les migrations (`PRAGMA user_version`), table `sync_meta` |
| `network-monitor.ts` | NetInfo → booléen `isOnline` + abonnés prévenus à chaque changement |
| `sync-queue.service.ts` | File `sync_queue` (CREATE / UPDATE / DELETE), stockée dans SQLite : survit à la fermeture de l'app |
| `offline-repository.ts` | Repository générique : lecture, écriture `pending`, mise en file, règles de conservation |
| `registry.ts` | `defineOfflineEntity()` : déclare une entité (repository + appels API) |
| `entities.ts` | **Les déclarations d'entités de l'app** (importé par `app/_layout.tsx`), voir plus bas |
| `sync-manager.ts` | Envoi de la file, téléchargement, synchronisation initiale / forcée |
| `sync-status.store.ts` | Store Zustand affiché à l'utilisateur |
| `OfflineProvider.tsx` | Cache TanStack Query, invalidé à chaque changement local |
| `session-cache.ts` | Dernière session connue, pour rouvrir l'app sans réseau |
| `bootstrap.ts` | `initializeOffline()` : base → réseau → syncManager |

Hooks : `hooks/offline/` · Composants : `components/sync/` · Écran : `app/initial-sync.tsx`.

## Stockage

Toutes les entités partagent la table `local_records` (données en JSON) :

| Colonne | Sens |
|---|---|
| `local_id` | UUID créé sur le téléphone, stable : clé des listes |
| `server_id` | Identifiant serveur, `NULL` tant que l'élément n'a pas été envoyé |
| `sync_status` | `synced`, `pending` (modification non envoyée) ou `failed` (envoi abandonné) |
| `deleted_at` | Suppression « douce » d'un élément déjà sur le serveur |
| `last_pushed_at` | Dernier envoi réussi (protection de 30 s contre une réponse périmée) |
| `server_updated_at` | Version serveur connue (si l'API la fournit) |

Une entité qui a besoin de vraies colonnes SQL peut ajouter ses tables avec `registerMigration({ version: 100, up })` (versions ≥ 100) avant le démarrage.

## Cycle de vie

1. **Démarrage** (`app/_layout.tsx`) : `initializeOffline({ canSync: hasStoredToken })`. Sans jeton (déconnecté), rien n'est envoyé.
2. **Connexion** : `AppContext` appelle `syncManager.setOwner(membershipId)`. Un autre membre sur le même téléphone efface les données locales **et la file** du précédent.
3. **Premier téléchargement** : `app/initial-sync.tsx` → `performInitialSync()` télécharge chaque entité déclarée (ordre `order`), puis marque la synchronisation initiale comme faite.
4. **Lecture** : `useOfflineCollection(repo)` lit SQLite (`staleTime: Infinity`), recherche en mémoire.
5. **Écriture** : `useOfflineMutations(repo)` → `repo.create/update/remove` → SQLite `pending` + file + envoi lancé sans attendre.
6. **Retour du réseau** / retour au premier plan / nouvelle opération : `pushToServer()` traite la file dans l'ordre d'arrivée.
7. **Tirer pour rafraîchir** (`Screen`) : `syncManager.forceSync()` envoie puis retélécharge tout.

### Envoi d'une opération

| Résultat | Suite |
|---|---|
| Succès | `server_id` renseigné, élément `synced` (s'il ne reste rien à envoyer), opération effacée |
| Pas de réseau / 401 | Arrêt du traitement, opération remise en attente **sans compter d'essai** |
| 4xx (400, 403, 409…) | Échec définitif (`failed`) : réessayer ne changerait rien |
| 404 sur un DELETE | Considéré comme un succès |
| 5xx, 408, 429, autre | Nouvel essai (5 s, 15 s…), `failed` après 3 essais |

Une opération qui ne passe pas bloque les opérations suivantes **du même élément** (l'ordre est garanti), pas celles des autres. `syncManager.retryFailed()` (bouton « Réessayer » de la bannière) relance les échecs.

### Cas particuliers (repository)

- **Modifié sans avoir jamais été envoyé** : on réécrit le contenu du CREATE en attente (pas d'UPDATE). Un CREATE en échec est relancé avec le nouveau contenu, **à sa place d'origine** dans la file. Si le CREATE est en cours d'envoi, un UPDATE suit ; il lira l'identifiant serveur au moment de partir.
- **Modifié et déjà sur le serveur** : un UPDATE. Chaque UPDATE porte le contenu complet : un UPDATE en attente est remplacé, ceux en échec sont effacés (un « Réessayer » ne peut jamais renvoyer une version périmée).
- **Supprimé sans avoir jamais été envoyé** : suppression locale et annulation de ses opérations ; le serveur n'en entend jamais parler.
- **Supprimé et déjà sur le serveur** : `deleted_at` + DELETE ; les UPDATE en attente ou en échec sont annulés.
- **CREATE abandonné (`failed`) alors qu'un UPDATE ou un DELETE attend** : l'UPDATE est reporté dans le CREATE (relancé par « Réessayer ») ; le DELETE efface l'élément localement. Rien ne reste bloqué dans la file.

### Changement d'utilisateur

- `syncManager.suspend()` coupe tout envoi **avant** que le jeton change : appelé par `logout`, `closeSession` (jeton refusé) et au début de `signIn`. Les opérations restent en file.
- `setOwner()` (à l'ouverture d'une session) : même utilisateur → l'envoi reprend ; autre utilisateur → effacement des données et de la file du précédent (attente de l'envoi en cours bornée à 5 s), puis reprise.
- `signIn` attend `setOwner` avant de rediriger : la file de l'utilisateur précédent ne part jamais avec le jeton du nouveau, et le premier téléchargement du nouveau n'est jamais effacé.

### Données venant du serveur (`syncFromServer`)

La version locale est conservée si elle est :
- encore `pending` (ou `failed`), ou a encore une opération en file ;
- envoyée il y a moins de 30 s ;
- supprimée localement ;
- plus récente que la réponse du serveur (quand l'API fournit `updatedAt`).

Avec `fullReplace` (téléchargements complets), les éléments `synced` absents de la réponse sont effacés (supprimés depuis le web, par exemple).

## Entités de l'app (`entities.ts`)

| Entité | Lecture | Écriture hors ligne | Remarque |
|---|---|---|---|
| `parametres`, `historiqueRoles`, `statutaire` | oui | — | Singletons (un seul enregistrement) |
| `membres`, `comptes` | oui | — | La gestion des comptes reste en ligne ; chaque compte renvoyé par l'API est rangé localement |
| `evenements` | oui | créer, modifier, supprimer | Suppression refusée localement s'il y a des paiements, des dépenses ou une feuille de présence (comme le 409 du serveur ; `aFeuillePresence` vient de `EvenementEntity.presence`) |
| `paiements` | oui | encaisser, annuler (motif joint à la suppression) | Un paiement pour un événement créé hors ligne attend l'envoi de l'événement (`DependencyPendingError`) |
| `depenses` | oui | ajouter ; valider une fois envoyée | |
| `chants` | oui | ajouter, supprimer | |
| `presenceMembres` (ordre 9) | oui (`GET /espace/presences/membres`) | — | Choristes actifs à appeler ; 403 ignoré pour les rôles sans accès aux présences |
| `seances` (ordre 10) | oui (`GET /espace/presences/seances?du=…&avecPresences=true`, 12 derniers mois) | faire l'appel (créer, modifier), supprimer | Chaque envoi transmet toute la feuille par `PUT /espace/presences/feuille` (clé naturelle : répétition du jour, culte (jour, numéro 1 à 5) ou événement), avec `base` = `serveurMajLe` ; une feuille d'un événement créé hors ligne attend l'envoi de l'événement |
| `mesPresences` (ordre 11) | oui (`GET /espace/presences/moi`) | — | Singleton : assiduité du membre connecté (« Mon assiduité » du Profil) |

`AppContext` lit ces données via `context/choraleData.ts` :
- **Cartes de cotisation** : dernière version du serveur, complétée par les paiements du téléphone (un paiement saisi hors ligne coche son mois, une annulation en attente le décoche).
- **Contributions aux événements** : calculées à partir des paiements locaux.
- **Identifiants provisoires** : un élément pas encore envoyé reçoit un identifiant négatif (stable pendant la session) ; il prend l'identifiant du serveur après l'envoi.

`OFFLINE_DATA_VERSION` : à augmenter quand on ajoute une entité ou qu'on change la forme des données. Les téléphones déjà synchronisés refont alors la synchronisation initiale.

## Ajouter une entité qui marche hors ligne

**1. Déclarer l'entité** dans `entities.ts` :

```ts
import * as api from "../api"
import { defineOfflineEntity } from "./registry"

export const noteRepository = defineOfflineEntity<Note>("notes", {
  label: "Notes",      // affiché pendant la synchronisation initiale
  order: 10,           // ordre de téléchargement
  pull: async () => (await api.fetchNotes()).map((n) => ({ serverId: n.id, data: n, updatedAt: n.updatedAt })),
  create: async (data) => {
    const n = await api.createNote(data)
    return { serverId: n.id, data: n }
  },
  update: async (serverId, data) => {
    await api.updateNote(Number(serverId), data)
  },
  remove: (serverId) => api.deleteNote(Number(serverId)),
})
```

Les erreurs doivent porter un `status` HTTP (0 = serveur injoignable), comme l'`ApiError` de `lib/api.ts`. Sinon, passer `classifyError` à `initializeOffline`.

**2. Lire** dans l'écran, jamais `api.*` :

```tsx
const { items } = useOfflineCollection(noteRepository, { search, searchFields: (n) => [n.titre, n.auteur] })
```

**3. Écrire** :

```tsx
const { create, update, remove } = useOfflineMutations(noteRepository)
create({ titre: "…" })                          // immédiat, réseau ou pas
update({ localId, changes: { titre: "…" } })
remove(localId)
```

**4. Afficher l'état** : `<RecordSyncBadge status={record.syncStatus} />` dans les listes ; `OfflineBanner`, `SyncStatusBadge` et `PendingCounter` pour l'état global.

Une entité non déclarée au démarrage laisse ses opérations en file (rien n'est perdu) : importez toujours sa déclaration depuis `entities.ts`.

## Web

expo-sqlite fonctionne sur le web avec le moteur WebAssembly (`metro.config.js`) et les en-têtes COOP/COEP (`app.json`, plugin `expo-router`). Si la base ne peut pas s'ouvrir, l'app démarre quand même, sans mode hors ligne (`useSyncStatusStore().ready === false`).
