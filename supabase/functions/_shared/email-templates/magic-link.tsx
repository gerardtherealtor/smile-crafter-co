/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>{siteName}</Text>
        </Section>
        <Heading style={styles.h1}>Your Sign-In Link</Heading>
        <Text style={styles.text}>
          Click below to sign in to the {siteName} crew portal. This link expires shortly.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Sign In</Button>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          Didn't request this? You can safely ignore this email.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
