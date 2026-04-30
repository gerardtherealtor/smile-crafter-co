/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_brand.ts'

interface Props {
  employeeName?: string
  workDate?: string
  jobName?: string
  clockIn?: string
  clockOut?: string
  breakMinutes?: number
  hours?: number | string
  notes?: string
}

const HoursSubmittedEmail = ({
  employeeName, workDate, jobName, clockIn, clockOut, breakMinutes, hours, notes,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{employeeName || 'A crew member'} logged {hours ?? '—'} hrs</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>Hours Submitted</Heading>
        <Text style={styles.text}>
          <strong>{employeeName || 'A crew member'}</strong> submitted a time entry.
        </Text>
        <Section style={styles.card}>
          <Text style={styles.meta}><span style={styles.metaLabel}>Date</span> {workDate || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Job</span> {jobName || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>In / Out</span> {clockIn || '—'} → {clockOut || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Break</span> {breakMinutes ?? 0} min</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Total</span> <strong>{hours ?? '—'} hrs</strong></Text>
          {notes ? (
            <Text style={styles.meta}><span style={styles.metaLabel}>Notes</span> {notes}</Text>
          ) : null}
        </Section>
        <Section style={styles.divider} />
        <Text style={styles.footer}>You're getting this because you're an admin on Dwayne Noe Construction.</Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HoursSubmittedEmail,
  subject: (d: Record<string, any>) =>
    `${d.employeeName || 'Crew'} logged ${d.hours ?? '—'} hrs${d.workDate ? ` (${d.workDate})` : ''}`,
  displayName: 'Admin — hours submitted',
  previewData: {
    employeeName: 'Marcus Hill', workDate: 'Apr 30, 2026', jobName: 'Bell Meadow Lot 7',
    clockIn: '07:00', clockOut: '15:30', breakMinutes: 30, hours: 8, notes: 'Framed back wall',
  },
} satisfies TemplateEntry

export default HoursSubmittedEmail
