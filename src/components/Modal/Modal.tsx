import { useEffect, useCallback } from 'react'
import './Modal.css'

export interface ModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

export function Modal({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel }: ModalProps) {
  const handleClose = useCallback(() => {
    if (onCancel) onCancel()
    else onConfirm()
  }, [onCancel, onConfirm])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={handleClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          {onCancel && (
            <button className="modal-btn" onClick={onCancel}>{cancelLabel}</button>
          )}
          <button className="modal-btn modal-btn-confirm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
