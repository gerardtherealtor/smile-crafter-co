/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_brand.ts'

interface Props {
  userName?: string
  userEmail?: string
  functionArea?: string
  description?: string
  screenshotUrl?: string
  submittedAt?: string
}

const SupportTicketEmail = ({ userName, userEmail, functionArea, description, screenshotUrl, submittedAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Support ticket from {userName || userEmail || 'a crew member'}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>New Support Ticket</Heading>
        <Text style={styles.text}>A crew member reported an issue using the portal.</Text>
        <Section style={styles.card}>
          <Text style={styles.meta}><span style={styles.metaLabel}>From</span> {userName || '—'} ({userEmail || '—'})</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Area</span> {functionArea || 'Not specified'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>When</span> {submittedAt || 'Just now'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>What's happening</span></Text>
          <Text style={{ ...styles.text, whiteSpace: 'pre-wrap' }}>{description || '—'}</Text>
        </Section>
        {screenshotUrl ? (
          <Section style={styles.card}>
            <Text style={styles.meta}><span style={styles.metaLabel}>Screenshot</span></Text>
            <Img src={screenshotUrl} alt="Screenshot" style={{ maxWidth: '100%', borderRadius: 6 }} />
            <Text style={styles.text}><Link href={screenshotUrl}>Open full size</Link></Text>
          </Section>
        ) : null}
        <Section style={styles.divider} />
        <Text style={styles.footer}>You're getting this because you're an admin on Dwayne Noe Construction.</Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportTicketEmail,
  subject: (d: Record<string, any>) => `Support ticket: ${d.userName || d.userEmail || 'crew member'}${d.functionArea ? ` — ${d.functionArea}` : ''}`,
  displayName: 'Admin — support ticket',
  previewData: {
    userName: 'Jordan Lee',
    userEmail: 'jordan@example.com',
    functionArea: 'Clock In / Clock Out',
    description: 'When I tap Clock In nothing happens and the button greys out.',
    submittedAt: 'May 24, 2026 4:12 PM',
  },
} satisfies TemplateEntry

export default SupportTicketEmail
