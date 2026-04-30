/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newSignup } from './admin-new-signup.tsx'
import { template as hoursSubmitted } from './admin-hours-submitted.tsx'
import { template as weeklyReport } from './admin-weekly-report.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-new-signup': newSignup,
  'admin-hours-submitted': hoursSubmitted,
  'admin-weekly-report': weeklyReport,
}
