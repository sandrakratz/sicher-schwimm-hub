import type { ComponentType } from 'react'
import { template as membershipApplication } from './membership-application'
import { template as courseRequest } from './course-request'
import { template as courseAssignment } from './course-assignment'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'membership-application': membershipApplication,
  'course-request': courseRequest,
}
