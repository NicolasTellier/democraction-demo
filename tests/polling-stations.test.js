import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePollingCatalog,bureauFeature} from '../app/polling-stations.js';

const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const data = read('../data/bureaux-referentiel-23.json');
const communes = read('../data/territoire-33-11-2026.json').communes;

test('23 bureaux fournis : nombres, identifiants et absence de contour vérifiés',()=>{
  const stations=validatePollingCatalog(data,communes);
  const values=[
    ['33067',[875,893]],['33143',[1007,1047]],['33341',[860,827]],
    ['33138',[970,930,977,1028,945,917,995]],['33393',[926,1154,1096,1196]],
    ['33321',[789,845]],['33473',[1289,1208]],['33114',[755,722]]
  ];
  assert.equal(stations.length,23);
  for(const [code,expected] of values)
    assert.deepEqual(stations.filter(row=>row.codeInsee===code).map(row=>row.reportedValue),expected);
  assert.ok(stations.every(row=>row.geometry===null&&row.valueMeaning.includes('à vérifier')));
  assert.equal(bureauFeature([],stations[0].id),undefined);
});

test('catalogue incohérent refusé avant affichage',()=>{
  const wrong=structuredClone(data);
  wrong.stations[1].id=wrong.stations[0].id;
  assert.throws(()=>validatePollingCatalog(wrong,communes),/Bureau invalide/);
  wrong.stations[1].id='33067-2';
  wrong.stations[1].geometry={type:'Polygon',coordinates:[]};
  assert.throws(()=>validatePollingCatalog(wrong,communes),/Bureau invalide/);
});
