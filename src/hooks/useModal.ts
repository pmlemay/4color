import { useState, useCallback, useRef } from 'react'
import { ModalProps } from '../components/Modal/Modal'

interface ModalState {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  hasCancel: boolean
}

export function useModal() {
  const [state, setState] = useState<ModalState>({
    open: false, message: '', hasCancel: false,
  })
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback((result: boolean) => {
    setState(s => ({ ...s, open: false }))
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const showAlert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise(resolve => {
      resolveRef.current?.( false)
      resolveRef.current = () => resolve()
      setState({ open: true, message, title, hasCancel: false })
    })
  }, [])

  const showConfirm = useCallback((message: string, title?: string, confirmLabel?: string, cancelLabel?: string): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setState({ open: true, message, title, confirmLabel, cancelLabel, hasCancel: true })
    })
  }, [])

  const modalProps: ModalProps = {
    open: state.open,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    onConfirm: () => close(true),
    onCancel: state.hasCancel ? () => close(false) : undefined,
  }

  return { modalProps, showAlert, showConfirm }
}
