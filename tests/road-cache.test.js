import test from 'node:test';
import assert from 'node:assert/strict';
import {roadCoverage,ROAD_CACHE_AGE_MS} from '../app/road-cache.js';

test('inventaire des 87 codes : paquet, cache récent, lacune et révision nécessaire',()=>{
 const now=Date.parse('2026-11-15T12:00:00Z');
 const rows=roadCoverage(['33366','33001','33002','33003'],[
  {code:'33001',features:[{},{}],matched:3,asOf:new Date(now-1000).toISOString()},
  {code:'33002',features:[{}],matched:1,asOf:new Date(now-ROAD_CACHE_AGE_MS-1000).toISOString()}
 ],now);
 assert.equal(rows[0].state,'paquet');
 assert.deepEqual([rows[1].state,rows[1].count,rows[1].rejected],['indexé',2,1]);
 assert.equal(rows[2].state,'à actualiser');
 assert.equal(rows[3].state,'non chargé');
});

test('un paquet territorial prime sur un cache plus ancien et signale les objets écartés',()=>{
 const now=Date.parse('2026-11-15T12:00:00Z');
 const rows=roadCoverage(['33001','33002'],[
  {code:'33001',count:92,matched:92,asOf:'2026-11-01T00:00:00Z'},
  {code:'33002',count:11,matched:11,asOf:'2026-11-15T11:00:00Z'}
 ],now,[
  {code:'33001',count:99,matched:101,asOf:'2026-11-14T00:00:00Z'},
  {code:'33002',count:10,matched:10,asOf:'2026-11-10T00:00:00Z'}
 ]);
 assert.deepEqual([rows[0].state,rows[0].count,rows[0].rejected],['paquet',99,2]);
 assert.deepEqual([rows[1].state,rows[1].count],['indexé',11]);
});
