import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g04-audit-log-coverage.js';

// G4 — Audit-log-coverage guard. A mutating server-action handler (a function
// whose body carries the 'use server' directive AND performs a Prisma mutation)
// must, in the same body, also call audit(...) OR carry an `audit-exempt:`
// comment. CLAUDE.md §2: "Audit-log every state-changing action."
it('G4 audit-log-coverage: mutating server actions must audit() or be exempt', () => {
  makeRuleTester().run('@estate/audit-log-coverage', rule, {
    valid: [
      // mutation + audit() in the same body
      {
        code: "async function updateProperty(id, data){ 'use server'; await prisma.property.update({ where:{id}, data }); await audit({ actor, action:'property.updated', entity:'property', entity_id:id, diff }); }",
      },
      // a read-only server action (findUnique is not a mutation) needs no audit()
      {
        code: "async function readProperty(id){ 'use server'; return prisma.property.findUnique({ where:{id} }); }",
      },
      // findMany / count are reads — no audit required
      {
        code: "async function listProperties(){ 'use server'; return prisma.property.findMany(); }",
      },
      // exemption via line comment inside the function range
      {
        code: "async function purge(id){ 'use server'; // audit-exempt: GDPR erasure logged separately\n await prisma.property.delete({ where:{id} }); }",
      },
      // exemption via block comment
      {
        code: "async function archive(id){ 'use server'; /* audit-exempt: retention job */ await prisma.tenancy.deleteMany({ where:{ propertyId:id } }); }",
      },
      // mutation but NOT a server action — out of scope, no audit needed
      {
        code: 'async function seedProperty(data){ await prisma.property.create({ data }); }',
      },
      // server action with no Prisma mutation at all
      {
        code: "async function ping(){ 'use server'; return 'pong'; }",
      },
      // a non-prisma .update() call must not be treated as a Prisma mutation
      {
        code: "async function refresh(state){ 'use server'; await store.session.update(state); }",
      },
      // createMany / updateMany / upsert each paired with audit()
      {
        code: "async function bulkCreate(rows){ 'use server'; await prisma.enquiry.createMany({ data: rows }); await audit({ action:'enquiry.bulk_created' }); }",
      },
    ],
    invalid: [
      // mutation in a server action with no audit() and no exemption
      {
        code: "async function updateProperty(id, data){ 'use server'; await prisma.property.update({ where:{id}, data }); }",
        errors: [{ messageId: 'missingAudit' }],
      },
      // create without audit
      {
        code: "async function createTenancy(data){ 'use server'; await prisma.tenancy.create({ data }); }",
        errors: [{ messageId: 'missingAudit' }],
      },
      // deleteMany without audit
      {
        code: "async function wipe(propertyId){ 'use server'; await prisma.enquiry.deleteMany({ where:{ propertyId } }); }",
        errors: [{ messageId: 'missingAudit' }],
      },
      // upsert without audit
      {
        code: "async function saveBranch(data){ 'use server'; await prisma.branch.upsert({ where:{ id: data.id }, create: data, update: data }); }",
        errors: [{ messageId: 'missingAudit' }],
      },
      // arrow-function server action: mutation, no audit
      {
        code: "const removeProperty = async (id) => { 'use server'; await prisma.property.delete({ where:{id} }); };",
        errors: [{ messageId: 'missingAudit' }],
      },
    ],
  });
});
