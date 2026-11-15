'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const q=require('../gis-data-quality.js');
test('zero, unknown, missing and not applicable remain distinct',()=>{
 assert.equal(q.classifyValue(0).state,'zero');assert.equal(q.classifyValue(null).state,'unknown');
 assert.equal(q.classifyValue(undefined).state,'missing');assert.equal(q.classifyValue(5,{notApplicable:true}).state,'not_applicable');
});
test('metadata validation detects bad source and resolution',()=>{const x=q.validateMetadata({source:'',spatialResolution:-2});assert.equal(x.valid,false);assert.ok(x.errors.length>=2);});
test('record validation checks type, range and required',()=>{const x=q.validateRecord({height:'12'},{height:{type:'number',min:0,required:true},name:{type:'string',required:true}});assert.equal(x.valid,false);assert.equal(x.errors.length,2);});
test('summary and limitations expose incompleteness without converting null to zero',()=>{const s=q.summarizeQuality({metadata:{source:'survey',retrievedAt:'2026-01-01T00:00:00Z',version:'v1',spatialResolution:10,coverage:'region A'},records:[{n:0,label:null},{n:3,label:'x'}],schema:{n:{type:'number'},label:{type:'string',nullable:true}}});assert.equal(s.completenessPercent,75);assert.equal(s.invalidRecords,0);assert.match(q.buildLimitationsReport(s),/nie jest interpretowany jako zero/);});
test('audit log stores and returns validation events',()=>{const a=q.createAuditLog();a.add('validation',{ok:true});assert.equal(a.list().length,1);assert.equal(a.list()[0].details.ok,true);});
