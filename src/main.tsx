import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Patch DOM methods to prevent Google Translate from crashing React.
// Google Translate wraps text nodes in <font> tags, which causes React's
// reconciliation to fail with "NotFoundError: removeChild" when it tries
// to update translated text nodes that have been reparented.
if (typeof Node !== 'undefined') {
  const origRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return origRemoveChild.call(child.parentNode, child) as T
      }
      return child
    }
    return origRemoveChild.call(this, child) as T
  }

  const origInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
    if (refNode && refNode.parentNode !== this) {
      return origInsertBefore.call(this, newNode, null) as T
    }
    return origInsertBefore.call(this, newNode, refNode) as T
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
