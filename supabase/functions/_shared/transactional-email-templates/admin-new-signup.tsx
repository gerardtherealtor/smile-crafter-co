/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_brand.ts'

interface Props {
  fullName?: string
  email?: string
  phone?: string
  signupAt?: string
}

const NewSignupEmail = ({ fullName, email, phone, signupAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New crew signup: {fullName || email || 'Someone'}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>New Crew Signup</Heading>
        <Text style={styles.text}>A new crew member just registered for the portal.</Text>
        <Section style={styles.card}>
          <Text style={styles.meta}><span style={styles.metaLabel}>Name</span> {fullName || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Email</span> {email || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>Phone</span> {phone || '—'}</Text>
          <Text style={styles.meta}><span style={styles.metaLabel}>When</span> {signupAt || 'Just now'}</Text>
        </Section>
        <Text style={styles.text}>
          Sign in to the admin dashboard to assign their role or review.
        </Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>You're getting this because you're an admin on Dwayne Noe Construction.</Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewSignupEmail,
  subject: (d: Record<string, any>) => `New crew signup: ${d.fullName || d.email || 'New user'}`,
  displayName: 'Admin — new crew signup',
  previewData: { fullName: 'Jordan Lee', email: 'jordan@example.com', phone: '(615) 555-0142', signupAt: 'Apr 30, 2026 4:12 PM' },
} satisfies TemplateEntry

export default NewSignupEmail
