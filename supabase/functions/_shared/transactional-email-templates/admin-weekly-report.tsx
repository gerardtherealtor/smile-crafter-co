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
  totalRegular?: number | string
  totalOvertime?: number | string
  totalHours?: number | string
  crewCount?: number
  pdfUrl?: string
}

const WeeklyReportEmail = ({
  weekStart, weekEnd, totalRegular, totalOvertime, totalHours, crewCount, pdfUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Weekly report: {weekStart} – {weekEnd}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>Weekly Report</Heading>
        <Text style={styles.text}>
          Crew hours for the week of <strong>{weekStart || '—'} – {weekEnd || '—'}</strong>.
        </Text>
        <Section style={styles.card}>
          <Text style={styles.meta}><span style={styles.metaLabel}>Crew</span> {crewCount ?? '—'} active</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Regular</span> {totalRegular ?? '—'} hrs</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Overtime</span> <strong>{totalOvertime ?? '—'} hrs</strong></Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Total</span> <strong>{totalHours ?? '—'} hrs</strong></Text>
        </Section>
        {pdfUrl ? (
          <>
            <Button style={styles.button} href={pdfUrl}>Download PDF</Button>
            <Text style={{ ...styles.footer, marginTop: '12px' }}>
              Link expires in 7 days. Sign in to the admin dashboard for the full archive.
            </Text>
          </>
        ) : (
          <Text style={styles.text}>
            Sign in to the admin dashboard to view and download the full PDF.
          </Text>
        )}
        <Section style={styles.divider} />
        <Text style={styles.footer}>You're getting this because you're an admin on Dwayne Noe Construction.</Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyReportEmail,
  subject: (d: Record<string, any>) => `Weekly report: ${d.weekStart || ''} – ${d.weekEnd || ''}`,
  displayName: 'Admin — weekly report',
  previewData: {
    weekStart: 'Apr 27, 2026', weekEnd: 'May 3, 2026',
    totalRegular: 156, totalOvertime: 12, totalHours: 168, crewCount: 5,
    pdfUrl: 'https://example.com/report.pdf',
  },
} satisfies TemplateEntry

export default WeeklyReportEmail
