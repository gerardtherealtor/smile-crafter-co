/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName, oldEmail, newEmail, confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>{siteName}</Text>
        </Section>
        <Heading style={styles.h1}>Confirm Email Change</Heading>
        <Text style={styles.text}>
          You requested to change your {siteName} email from{' '}
          <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link> to{' '}
          <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Confirm Change</Button>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          If you didn't request this, secure your account immediately.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
