import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewPassword } from '../lib/fitness/password';
import { profileSchema } from '../lib/fitness/model';
import { initialData } from '../lib/fitness/seed';
test('old profile parses without optional preferences; new fields validate bounds',()=>{
 const old={...initialData('old-account').profile,goals:['Aumentar força'],onboarded:true};
 assert(profileSchema.safeParse(old).success);
 assert(profileSchema.safeParse({...old,level:'intermediario',preferredDuration:45,preferredDays:[1,3],availableEquipment:['Halteres'],limitations:'Evito impacto'}).success);
 assert(!profileSchema.safeParse({...old,preferredDuration:0}).success);
 assert(!profileSchema.safeParse({...old,availableEquipment:['x'.repeat(61)]}).success);
});
test('password rules require minimum length and exact confirmation',()=>{
 assert.match(validateNewPassword('1234567','1234567')??'',/8/);
 assert.match(validateNewPassword('Astrongpassword','different')??'',/coincidem/);
 assert.equal(validateNewPassword('Astrongpassword','Astrongpassword'),null);
});
