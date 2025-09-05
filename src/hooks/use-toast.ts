import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// Affiche 1 toast à la fois (comportement existant)
const TOAST_LIMIT = 1

// Délai de retrait du DOM après fermeture (pour l'animation de sortie)
const TOAST_REMOVE_DELAY = 400

// Durée d'affichage par défaut avant auto-fermeture
export const DEFAULT_TOAST_DURATION = 2200

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  /** Durée d'affichage avant auto-dismiss ; si non défini => DEFAULT_TOAST_DURATION */
  duration?: number
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>() // timeouts de retrait (après dismiss)
const autoDismissTimers = new Map<string, ReturnType<typeof setTimeout>>() // timeouts d’auto-dismiss

const clearAutoDismiss = (toastId: string) => {
  const t = autoDismissTimers.get(toastId)
  if (t) {
    clearTimeout(t)
    autoDismissTimers.delete(toastId)
  }
}

const scheduleAutoDismiss = (toastId: string, duration?: number) => {
  // 0 ou valeur non finie => on ne programme pas l’auto-dismiss
  const d = Number.isFinite(duration) ? (duration as number) : DEFAULT_TOAST_DURATION
  if (!(d > 0)) return

  clearAutoDismiss(toastId)
  const timeout = setTimeout(() => {
    dispatch({ type: "DISMISS_TOAST", toastId })
  }, d)
  autoDismissTimers.set(toastId, timeout)
}

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Side effects tolérés comme dans la version d’origine
      if (toastId) {
        // on annule l’auto-dismiss en cours, puis on programme le retrait
        clearAutoDismiss(toastId)
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          clearAutoDismiss(toast.id)
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }

    case "REMOVE_TOAST": {
      // nettoyage défensif des timers d’auto-dismiss
      if (action.toastId) clearAutoDismiss(action.toastId)

      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
    }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (next: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...next, id },
    })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Création
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // Auto-fermeture programmée (durée spécifique > défaut si non fournie)
  scheduleAutoDismiss(id, props.duration)

  return {
    id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
