import test from 'node:test';
import assert from 'node:assert/strict';
import { effectivePaymentStatus, paymentInputSchema } from '../lib/fitness/payments';
test('payment data validates amount, month and status without card data',()=>{
 const draft={studentId:'a88d54c6-e7be-4d17-9876-3f0d12c5b783',referenceMonth:'2026-09-01',dueDate:'2026-09-10',amount:200,status:'pending',notes:''};
 assert(paymentInputSchema.safeParse(draft).success);
 assert(!paymentInputSchema.safeParse({...draft,amount:-1}).success);
 assert(!paymentInputSchema.safeParse({...draft,referenceMonth:'2026-09-11'}).success);
 assert(!paymentInputSchema.safeParse({...draft,status:'processed'}).success);
});
test('pending becomes overdue by date; paid/waived remain final',()=>{
 assert.equal(effectivePaymentStatus({status:'pending',dueDate:'2026-09-10'},'2026-09-24'),'overdue');
 assert.equal(effectivePaymentStatus({status:'pending',dueDate:'2026-09-24'},'2026-09-24'),'pending');
 assert.equal(effectivePaymentStatus({status:'paid',dueDate:'2026-09-10'},'2026-09-24'),'paid');
 assert.equal(effectivePaymentStatus({status:'waived',dueDate:'2026-09-10'},'2026-09-24'),'waived');
});
