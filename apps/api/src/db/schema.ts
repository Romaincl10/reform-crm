import { pgTable, text, integer, real, boolean, timestamp } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

const id = () => text('id').primaryKey().$defaultFn(() => nanoid());
const createdAt = () => timestamp('created_at', { mode: 'date' }).notNull().$defaultFn(() => new Date());
const updatedAt = () => timestamp('updated_at', { mode: 'date' }).notNull().$defaultFn(() => new Date());

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: createdAt(),
});

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  status: text('status', { enum: ['prospect', 'client', 'inactive'] }).notNull().default('prospect'),
  siren: text('siren'),
  spk: boolean('spk').notNull().default(false),
  spkPulse: boolean('spk_pulse').notNull().default(false),
  industry: text('industry'),
  size: text('size'),
  website: text('website'),
  address: text('address'),
  city: text('city'),
  zipcode: text('zipcode'),
  country: text('country').default('France'),
  notes: text('notes'),
  ownerId: text('owner_id').references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contacts = pgTable('contacts', {
  id: id(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role'),
  email: text('email'),
  phone: text('phone'),
  isPrimary: boolean('is_primary').notNull().default(false),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deals = pgTable('deals', {
  id: id(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  stage: text('stage', {
    enum: ['to_qualify', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'],
  }).notNull().default('to_qualify'),
  offerType: text('offer_type'),
  amount: real('amount'),
  probability: integer('probability').default(0),
  expectedCloseAt: timestamp('expected_close_at', { mode: 'date' }),
  serviceStartAt: timestamp('service_start_at', { mode: 'date' }),
  serviceEndAt: timestamp('service_end_at', { mode: 'date' }),
  invoiceDate1: timestamp('invoice_date_1', { mode: 'date' }),
  invoiceAmount1: real('invoice_amount_1'),
  invoiceDate2: timestamp('invoice_date_2', { mode: 'date' }),
  invoiceAmount2: real('invoice_amount_2'),
  invoiceDate3: timestamp('invoice_date_3', { mode: 'date' }),
  invoiceAmount3: real('invoice_amount_3'),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  lostReason: text('lost_reason'),
  ownerId: text('owner_id').references(() => users.id),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const activities = pgTable('activities', {
  id: id(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  dealId: text('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['call', 'email', 'meeting', 'note', 'task'] }).notNull(),
  subject: text('subject').notNull(),
  body: text('body'),
  occurredAt: timestamp('occurred_at', { mode: 'date' }).notNull().$defaultFn(() => new Date()),
  done: boolean('done').notNull().default(true),
  authorId: text('author_id').references(() => users.id),
  createdAt: createdAt(),
});

export const engagements = pgTable('engagements', {
  id: id(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  dealId: text('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  totalAmount: real('total_amount').notNull().default(0),
  paidAmount: real('paid_amount').notNull().default(0),
  offerType: text('offer_type'),
  spk: boolean('spk').notNull().default(false),
  spkPulse: boolean('spk_pulse').notNull().default(false),
  status: text('status', { enum: ['active', 'completed', 'cancelled'] }).notNull().default('active'),
  invoiceStatus: text('invoice_status', { enum: ['to_invoice', 'invoiced', 'partially_paid', 'paid'] }).notNull().default('to_invoice'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  invoicedAt: timestamp('invoiced_at', { mode: 'date' }),
  invoicedAmount: real('invoiced_amount'),
  invoiceRef: text('invoice_ref'),
  invoiceDate1: timestamp('invoice_date_1', { mode: 'date' }),
  invoiceAmount1: real('invoice_amount_1'),
  invoiceDate2: timestamp('invoice_date_2', { mode: 'date' }),
  invoiceAmount2: real('invoice_amount_2'),
  invoiceDate3: timestamp('invoice_date_3', { mode: 'date' }),
  invoiceAmount3: real('invoice_amount_3'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const milestones = pgTable('milestones', {
  id: id(),
  engagementId: text('engagement_id').notNull().references(() => engagements.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  amount: real('amount').notNull(),
  dueDate: timestamp('due_date', { mode: 'date' }),
  invoicedAt: timestamp('invoiced_at', { mode: 'date' }),
  invoiceRef: text('invoice_ref'),
  status: text('status', { enum: ['to_invoice', 'invoiced', 'paid', 'overdue'] }).notNull().default('to_invoice'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const payments = pgTable('payments', {
  id: id(),
  milestoneId: text('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  receivedAt: timestamp('received_at', { mode: 'date' }).notNull().$defaultFn(() => new Date()),
  method: text('method'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Payment = typeof payments.$inferSelect;
