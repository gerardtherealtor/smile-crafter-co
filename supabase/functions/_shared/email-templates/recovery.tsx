/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>{siteName}</Text>
        </Section>
        <Heading style={styles.h1}>Reset Your Password</Heading>
        <Text style={styles.text}>
          We got a request to reset your password for the {siteName} crew portal.
          Click below to set a new one.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Reset Password</Button>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          Didn't request this? You can safely ignore this email — your password won't change.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
