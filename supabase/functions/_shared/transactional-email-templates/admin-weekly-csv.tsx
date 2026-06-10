/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_brand.ts'

interface Props {
  weekStart?: string
  weekEnd?: string
  rowCount?: number
  crewCount?: number
  totalHours?: number | string
  csvUrl?: string
}

const WeeklyCsvEmail = ({
  weekStart, weekEnd, rowCount, crewCount, totalHours, csvUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Weekly CSV: {weekStart} – {weekEnd}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>Weekly Hours CSV</Heading>
        <Text style={styles.text}>
          Here is the crew hours CSV for the week of{' '}
          <strong>{weekStart || '—'} – {weekEnd || '—'}</strong>.
        </Text>
        <Section style={styles.card}>
          <Text style={styles.meta}><span style={styles.metaLabel}>Crew</span> {crewCount ?? '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Entries</span> {rowCount ?? '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Total</span> <strong>{totalHours ?? '—'} hrs</strong></Text>
        </Section>
        {csvUrl ? (
          <>
            <Button style={styles.button} href={csvUrl}>Download CSV</Button>
            <Text style={{ ...styles.footer, marginTop: '12px' }}>
              Secure link valid for 7 days.
            </Text>
          </>
        ) : (
          <Text style={styles.text}>The CSV download link is unavailable.</Text>
        )}
        <Section style={styles.divider} />
        <Text style={styles.footer}>You requested this email from the admin dashboard.</Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyCsvEmail,
  subject: (d: Record<string, any>) =>
    `Weekly CSV: ${d.weekStart || ''} – ${d.weekEnd || ''}`,
  displayName: 'Admin — weekly CSV',
  previewData: {
    weekStart: 'Apr 27, 2026', weekEnd: 'May 3, 2026',
    rowCount: 42, crewCount: 5, totalHours: 168,
    csvUrl: 'https://example.com/week.csv',
  },
} satisfies TemplateEntry

export default WeeklyCsvEmail
