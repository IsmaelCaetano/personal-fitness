import { z } from 'zod';
export const paymentInputSchema=z.object({studentId:z.string().uuid(),referenceMonth:z.string().regex(/^\d{4}-\d{2}-01$/),dueDate:z.string().date(),amount:z.number().finite().min(0).max(1000000),status:z.enum(['pending','paid','overdue','waived']),paidAt:z.string().datetime().nullable().optional(),notes:z.string().max(1000)});
export function effectivePaymentStatus(payment:{status:'pending'|'paid'|'overdue'|'waived';dueDate:string},today:string):'pending'|'paid'|'overdue'|'waived'{return payment.status==='pending' && payment.dueDate<today?'overdue':payment.status;}
