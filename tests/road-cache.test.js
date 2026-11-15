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
