import test from 'node:test';
import assert from 'node:assert/strict';
import {classification,classIndex} from '../app/geo-utils.js';
test('légende d’écart : classes fixes divergentes, zéro et absence distincts',()=>{
 const legend=classification([-20,0,30,null],{method:'diverging-points',unit:'points'});
 assert.deepEqual(legend.colors,['#b35806','#f7f7f7','#2166ac']);
 assert.equal(legend.method,'diverging-points');assert.equal(legend.unit,'points');
 for(const value of [-100,-0.001])assert.equal(classIndex(value,legend),0);
 assert.equal(classIndex(0,legend),1);
 for(const value of [0.001,100])assert.equal(classIndex(value,legend),2);
 for(const value of [null,undefined,NaN,Infinity,-101,101,'',false])assert.equal(classIndex(value,legend),-1);
 assert.deepEqual(classification([null],{method:'diverging-points'}).labels,legend.labels);
});
test('légende d’écart : indépendante du périmètre et sans modifier les méthodes existantes',()=>{
 const first=classification([-1,1],{method:'diverging-points'}),second=classification([-90,90],{method:'diverging-points'});
 assert.deepEqual(first,second);
 const percent=classification([0,25,100],{method:'fixed-percent'});
 assert.equal(classIndex(0,percent),0);assert.equal(classIndex(100,percent),3);
});
