// Shared brand styling for Dwayne Noe Construction app emails.
// Email body MUST be white (#ffffff) regardless of the dark app theme.
export const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif", margin: 0, padding: 0 },
  container: { padding: '32px 28px', maxWidth: '560px' },
  brandBar: { borderTop: '4px solid #e89339', paddingTop: '20px', marginBottom: '12px' },
  brandLabel: {
    fontFamily: "'Oswald', 'Arial Narrow', Arial, sans-serif",
    fontSize: '12px', letterSpacing: '0.18em', color: '#e89339',
    textTransform: 'uppercase' as const, margin: '0 0 6px', fontWeight: 700 as const,
  },
  h1: {
    fontFamily: "'Oswald', 'Arial Narrow', Arial, sans-serif",
    fontSize: '26px', fontWeight: 700 as const, color: '#0a1430',
    textTransform: 'uppercase' as const, margin: '0 0 22px', lineHeight: '1.15',
  },
  text: { fontSize: '15px', color: '#3d4860', lineHeight: '1.6', margin: '0 0 18px' },
  meta: {
    fontSize: '14px', color: '#0a1430', lineHeight: '1.6', margin: '0 0 8px',
  },
  metaLabel: {
    fontFamily: "'Oswald', 'Arial Narrow', Arial, sans-serif",
    fontSize: '11px', letterSpacing: '0.14em', color: '#8a93a6',
    textTransform: 'uppercase' as const, fontWeight: 700 as const,
    display: 'inline-block' as const, minWidth: '90px',
  },
  card: {
    backgroundColor: '#f4f6fb', borderLeft: '3px solid #1e40d6',
    borderRadius: '6px', padding: '16px 20px', margin: '0 0 24px',
  },
  button: {
    backgroundColor: '#1e40d6', color: '#ffffff', fontSize: '14px',
    fontFamily: "'Oswald', 'Arial Narrow', Arial, sans-serif",
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    fontWeight: 700 as const, borderRadius: '10px',
    padding: '14px 26px', textDecoration: 'none', display: 'inline-block' as const,
  },
  divider: { borderTop: '1px solid #e6e8ef', margin: '32px 0 18px' },
  footer: { fontSize: '12px', color: '#8a93a6', lineHeight: '1.5', margin: 0 },
  signature: {
    fontFamily: "'Oswald', 'Arial Narrow', Arial, sans-serif",
    fontSize: '13px', color: '#0a1430', letterSpacing: '0.06em',
    textTransform: 'uppercase' as const, margin: '6px 0 0', fontWeight: 700 as const,
  },
}
