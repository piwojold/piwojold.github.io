/**
 * Neutral GIS Data Quality utilities (standalone; no OCOKA/tactical integration).
 * CommonJS for Node tests; browser consumers may bundle/import this module.
 */
'use strict';

const STATES = Object.freeze({ VALUE:'value', ZERO:'zero', UNKNOWN:'unknown', NOT_APPLICABLE:'not_applicable', MISSING:'missing' });

function classifyValue(value, options={}) {
  if (value === undefined) return {state:STATES.MISSING, value:null};
  if (value === null) return {state:STATES.UNKNOWN, value:null};
  if (options.notApplicable === true) return {state:STATES.NOT_APPLICABLE, value:null};
  if (typeof value === 'number' && Number.isFinite(value) && value === 0) return {state:STATES.ZERO, value:0};
  return {state:STATES.VALUE, value};
}

function validateMetadata(meta={}) {
  const errors=[], warnings=[];
  if (!meta.source || typeof meta.source !== 'string') errors.push('source: wymagane źródło danych');
  if (meta.retrievedAt && Number.isNaN(Date.parse(meta.retrievedAt))) errors.push('retrievedAt: niepoprawna data ISO');
  if (meta.version != null && typeof meta.version !== 'string') errors.push('version: oczekiwany tekst');
  if (meta.spatialResolution != null && !(Number.isFinite(meta.spatialResolution) && meta.spatialResolution > 0)) errors.push('spatialResolution: wartość musi być dodatnia');
  if (meta.coverage != null && (typeof meta.coverage !== 'string' || !meta.coverage.trim())) errors.push('coverage: oczekiwany opis tekstowy');
  if (!meta.retrievedAt) warnings.push('Brak daty pozyskania danych');
  if (!meta.version) warnings.push('Brak wersji/identyfikatora zbioru');
  if (!meta.spatialResolution) warnings.push('Brak informacji o rozdzielczości przestrzennej');
  if (!meta.coverage) warnings.push('Brak opisu pokrycia przestrzennego');
  return {valid:errors.length===0, errors, warnings};
}

/** Validate a plain object against a small declarative schema.
 * field rules: {type:'number|string|boolean|array|object', required, min, max, nullable, enum}
 */
function validateRecord(record, schema) {
  const errors=[], warnings=[];
  if (!record || typeof record!=='object' || Array.isArray(record)) return {valid:false,errors:['record: oczekiwany obiekt'],warnings};
  for (const [key,rule] of Object.entries(schema||{})) {
    const v=record[key];
    if (v===undefined) { if(rule.required) errors.push(key+': brak wymaganego pola'); continue; }
    if (v===null) { if(!rule.nullable) errors.push(key+': null niedozwolone (oznacz jako unknown lub nullable)'); else warnings.push(key+': wartość nieznana'); continue; }
    const types={number:Number.isFinite(v),string:typeof v==='string',boolean:typeof v==='boolean',array:Array.isArray(v),object:typeof v==='object'&&!Array.isArray(v)};
    if(rule.type && !types[rule.type]) {errors.push(key+': niepoprawny typ (oczekiwano '+rule.type+')');continue;}
    if(rule.enum && !rule.enum.includes(v)) errors.push(key+': wartość spoza dozwolonego zbioru');
    if(typeof v==='number') {if(rule.min!=null&&v<rule.min)errors.push(key+': poniżej minimum '+rule.min);if(rule.max!=null&&v>rule.max)errors.push(key+': powyżej maksimum '+rule.max);}
  }
  return {valid:errors.length===0,errors,warnings};
}

function summarizeQuality({metadata={}, records=[], schema={}}={}) {
  const meta=validateMetadata(metadata);
  const checks=records.map((r,i)=>({index:i,...validateRecord(r,schema)}));
  const invalid=checks.filter(x=>!x.valid).length;
  const warnings=checks.reduce((n,x)=>n+x.warnings.length,0)+meta.warnings.length;
  const fields=Object.keys(schema), total=records.length*fields.length;
  let known=0;
  for(const r of records) for(const f of fields) if(r[f]!==undefined&&r[f]!==null) known++;
  const completeness=total?Math.round(known/total*100):null;
  return {metadata:meta,records:checks,recordCount:records.length,invalidRecords:invalid,warningCount:warnings,completenessPercent:completeness,status:!meta.valid||invalid?'needs_review':warnings?'partial':'good'};
}

function buildLimitationsReport(summary) {
  const lines=['# Raport jakości danych GIS','',`Status: **${summary.status}**`,
    `Rekordy: ${summary.recordCount}; niepoprawne: ${summary.invalidRecords}; ostrzeżenia: ${summary.warningCount}`,
    `Kompletność pól: ${summary.completenessPercent==null?'N/D':summary.completenessPercent+'%'}`,'',
    '## Metadane źródła',''];
  const m=summary.metadata;
  lines.push(...(m.errors.length?m.errors.map(x=>'- BŁĄD: '+x):['- Walidacja metadanych bez błędów']));
  lines.push(...m.warnings.map(x=>'- OSTRZEŻENIE: '+x),'','## Ograniczenia','',
    '- Raport opisuje wyłącznie jakość, kompletność i walidację przekazanych danych GIS.',
    '- Nie potwierdza prawdziwości danych w terenie ani dokładności pomiarowej.',
    '- Brak wartości nie jest interpretowany jako zero ani jako potwierdzony brak zjawiska.');
  return lines.join('\n');
}

function createAuditLog(){ const events=[]; return {add(type,details={}){events.push({type,at:new Date().toISOString(),details});},list(){return events.map(e=>({...e,details:{...e.details}}));},clear(){events.length=0;}}; }

module.exports={STATES,classifyValue,validateMetadata,validateRecord,summarizeQuality,buildLimitationsReport,createAuditLog};
