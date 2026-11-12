import * as React from 'react'

const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment')

export function isFragment(object: unknown): boolean {
  if (typeof object === 'object' && object !== null) {
    const el = object as { $$typeof?: symbol; type?: unknown }
    return el.type === REACT_FRAGMENT_TYPE || el.type === React.Fragment
  }
  return false
}

export const Element = Symbol.for('react.element')
export const Fragment = REACT_FRAGMENT_TYPE
export const ForwardRef = Symbol.for('react.forward_ref')
export const Memo = Symbol.for('react.memo')
export const Lazy = Symbol.for('react.lazy')
export const Suspense = Symbol.for('react.suspense')
export const StrictMode = Symbol.for('react.strict_mode')

export function isElement(object: unknown): boolean {
  return React.isValidElement(object)
}

export function isMemo(object: unknown): boolean {
  return typeof object === 'object' && object !== null && (object as { $$typeof?: symbol }).$$typeof === Memo
}

export function isValidElementType(type: unknown): boolean {
  return typeof type === 'string' || typeof type === 'function' || isElement(type)
}

export default {
  isFragment,
  isElement,
  isMemo,
  isValidElementType,
  Fragment,
}

