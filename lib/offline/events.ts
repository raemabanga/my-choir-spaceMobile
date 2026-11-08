// Petits signaux internes du mode hors ligne. Ils évitent les imports circulaires :
// les repositories ne connaissent pas le syncManager, ils signalent seulement.

type Handler<T> = (value: T) => void

function createSignal<T>() {
  const handlers = new Set<Handler<T>>()
  return {
    emit(value: T) {
      for (const handler of handlers) {
        try {
          handler(value)
        } catch (e) {
          console.warn("[offline] abonné en erreur", e)
        }
      }
    },
    subscribe(handler: Handler<T>) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}

/** La file d'attente a changé ; `true` = une opération vient d'être ajoutée (à envoyer dès que possible). */
export const queueChanged = createSignal<{ enqueued: boolean }>()

/** Les données locales d'une entité ont changé (écriture locale ou téléchargement). Valeur : nom de l'entité, ou "*" pour toutes. */
export const dataChanged = createSignal<string>()
