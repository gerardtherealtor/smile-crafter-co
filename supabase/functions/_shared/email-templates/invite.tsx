/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join the {siteName} crew portal</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>{siteName}</Text>
        </Section>
        <Heading style={styles.h1}>You're On The Crew</Heading>
        <Text style={styles.text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>.
          Accept your invite to set up your account and start logging hours.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Accept Invitation</Button>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          Not expecting this? You can safely ignore this email.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
