/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandBar}>
          <Text style={styles.brandLabel}>Dwayne Noe Construction</Text>
        </Section>
        <Heading style={styles.h1}>Verification Code</Heading>
        <Text style={styles.text}>Use the code below to confirm your identity:</Text>
        <Text style={styles.code}>{token}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          This code expires shortly. Didn't request it? You can safely ignore this email.
        </Text>
        <Text style={styles.signature}>— Dwayne Noe Construction</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
