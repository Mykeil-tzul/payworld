import test from "node:test";
import assert from "node:assert/strict";
import {create,apply,reconcile} from "../site/engine.mjs";
const begin=scenario=>apply(create(575,scenario),"authorize","payment-1");
const settle=s=>["capture","clear","settle"].reduce((state,c)=>apply(state,c),s);

test("authorization routes through Visa and creates no merchant ledger entry",()=>{
 const s=begin("approve");
 assert.equal(s.status,"authorized");
 assert.equal(s.auths,1);
 assert.ok(s.events.some(e=>e.from==="visa"&&e.to==="issuer"));
 assert.deepEqual(s.ledger,[]);
 assert.equal(reconcile(settle(s)).net,575);
});
test("decline cannot capture or settle",()=>{
 const s=begin("decline");
 assert.equal(s.status,"declined");
 assert.throws(()=>apply(s,"capture"));
 assert.deepEqual(s.ledger,[]);
});
test("timeout is unresolved until the original approval is looked up",()=>{
 let s=begin("timeout");
 assert.equal(s.status,"unknown");
 assert.throws(()=>apply(s,"capture"));
 s=apply(s,"authorize","payment-1");
 assert.equal(s.status,"unknown");
 s=apply(s,"resolve");
 assert.equal(s.status,"authorized");
 assert.equal(s.auths,1);
});
test("idempotency suppresses duplicate authorizations and rejects key reuse",()=>{
 const s=begin("duplicate");
 assert.equal(s.auths,1);
 assert.equal(s.events.at(-1).title,"Duplicate request suppressed");
 assert.throws(()=>apply(s,"capture","payment-1"),/different command/);
 assert.throws(()=>create(5.75,"approve"),/Invalid/);
});
test("full refund and delayed duplicate webhook do not alter settled ledger twice",()=>{
 const s=settle(begin("refund"));
 assert.deepEqual(reconcile(s),{net:575,expected:575,matched:true});
 const delivered=apply(s,"webhook","settlement-event-1");
 assert.deepEqual(delivered.ledger,s.ledger);
 const pending=apply(delivered,"refund");
 const done=apply(pending,"refund_settle");
 assert.equal(done.status,"refunded");
 assert.equal(done.ledger.length,4);
 assert.deepEqual(reconcile(done),{net:0,expected:0,matched:true});
 assert.deepEqual(apply(done,"refund").ledger,done.ledger);
});
