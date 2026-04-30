/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to access the {siteName} crew portal</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>{siteName}</Text>
        </Section>
        <Heading style={styles.h1}>Confirm Your Email</Heading>
        <Text style={styles.text}>
          Welcome to the <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link> crew portal.
          Please confirm <strong>{recipient}</strong> to start clocking in and tracking your hours.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Confirm Email</Button>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
