import type { ComponentType } from 'react'
import { template as membershipApplication } from './membership-application'
import { template as courseRequest } from './course-request'
import { template as courseAssignment } from './course-assignment'
import { template as contactMessage } from './contact-message'
import { template as newRegistration } from './new-registration'
import { template as cancellationInternal } from './cancellation-internal'
import { template as cancellationConfirmation } from './cancellation-confirmation'
import { template as courseBooking, waitlistTemplate as courseWaitlist } from './course-booking-confirmation'
import { template as paymentCheckReminder } from './payment-check-reminder'
import { template as immediatePaymentAlert } from './immediate-payment-alert'



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
  'course-assignment': courseAssignment,
  'contact-message': contactMessage,
  'new-registration': newRegistration,
  'cancellation-internal': cancellationInternal,
  'cancellation-confirmation': cancellationConfirmation,
  'course-booking-confirmation': courseBooking,
  'course-waitlist-confirmation': courseWaitlist,
  'payment-check-reminder': paymentCheckReminder,
  'immediate-payment-alert': immediatePaymentAlert,
}
