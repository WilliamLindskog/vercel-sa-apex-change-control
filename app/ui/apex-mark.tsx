// Three facets form an open A. Solid fills keep its cuts legible at navigation sizes.
export function ApexMark({ size = 28 }: { size?: number }) {
  return <svg className="apex-mark" width={size} height={size} viewBox="0 0 36 32" aria-hidden="true" fill="currentColor">
    <path d="M0 30 16.2 2h3.6l3.6 6.3L10.9 30Z"/>
    <path d="m24.7 10.5 11.2 19.5H25.2L19.4 20Z"/>
    <path d="m16.9 24.4 3.2 5.6h-6.5Z"/>
  </svg>;
}
