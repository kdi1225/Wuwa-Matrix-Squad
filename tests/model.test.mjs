import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS} from '../src/data.js';
import {defaultState,placeCharacter,limitFor,normalizeState,validateParties,usageOf} from '../src/model.js';

test('roster includes 61 entries, 7 supporters, and Lily placeholder',()=>{
  assert.equal(CHARACTERS.length,61);
  assert.equal(new Set(CHARACTERS.map(c=>c.id)).size,61);
  assert.equal(CHARACTERS.filter(c=>c.supporter).length,7);
  assert.equal(CHARACTERS.find(c=>c.id==='릴리').image,null);
});
test('normal characters cannot be copied to a second party',()=>{
  let state=defaultState();
  state=placeCharacter(state,{id:'금희'},state.parties[0].id,0).state;
  assert.match(placeCharacter(state,{id:'금희'},state.parties[1].id,0).error,/초과/);
  assert.equal(usageOf(state,'금희'),1);
});
test('supporters allow two separate parties, but not a third or same-party duplicate',()=>{
  let state=defaultState();
  state=placeCharacter(state,{id:'벨리나'},state.parties[0].id,0).state;
  assert.match(placeCharacter(state,{id:'벨리나'},state.parties[0].id,1).error,/동일한/);
  state=placeCharacter(state,{id:'벨리나'},state.parties[1].id,0).state;
  assert.match(placeCharacter(state,{id:'벨리나'},state.parties[2].id,0).error,/초과/);
});
test('cycle bonus sets a limit of two without stacking on supporters',()=>{
  const state=defaultState();state.cycle=['금희','벨리나'];
  assert.equal(limitFor(state,'금희'),2);
  assert.equal(limitFor(state,'벨리나'),2);
  state.parties[0].slots[0]='금희';state.parties[1].slots[0]='금희';
  assert.equal(validateParties(state),null);
  state.cycle=[];assert.match(validateParties(state),/금희/);
});
test('moving exhausted characters does not consume another use',()=>{
  const state=defaultState();state.parties[0].slots[0]='금희';
  const result=placeCharacter(state,{id:'금희',source:{partyId:state.parties[0].id,index:0}},state.parties[1].id,2);
  assert.equal(result.state.parties[0].slots[0],null);
  assert.equal(result.state.parties[1].slots[2],'금희');
  assert.equal(usageOf(result.state,'금희'),1);
  assert.equal(state.parties[0].slots[0],'금희');
});
test('swapping slots preserves both characters and refuses invalid swaps atomically',()=>{
  const state=defaultState();state.parties[0].slots=['금희','벨리나',null];state.parties[1].slots=['산화','벨리나',null];
  const swap=placeCharacter(state,{id:'금희',source:{partyId:state.parties[0].id,index:0}},state.parties[1].id,0);
  assert.deepEqual(swap.state.parties[0].slots,['산화','벨리나',null]);
  assert.deepEqual(swap.state.parties[1].slots,['금희','벨리나',null]);
  const rejected=placeCharacter(state,{id:'금희',source:{partyId:state.parties[0].id,index:0}},state.parties[1].id,1);
  assert.match(rejected.error,/동일한/);
  assert.deepEqual(state.parties[0].slots,['금희','벨리나',null]);
});
test('same-party reorder and replacement release the old slot/character',()=>{
  let state=defaultState();state.parties[0].slots=['금희','산화',null];
  state=placeCharacter(state,{id:'금희',source:{partyId:state.parties[0].id,index:0}},state.parties[0].id,1).state;
  assert.deepEqual(state.parties[0].slots,['산화','금희',null]);
  state=placeCharacter(state,{id:'기염'},state.parties[0].id,1).state;
  assert.equal(usageOf(state,'금희'),0);
});
test('saved ownership, filter, cycle and parties survive serialization',()=>{
  const state=defaultState();state.owned=['금희','설지'];state.onlyOwned=true;state.element='응결';state.cycle=['금희'];state.parties[0].slots[0]='금희';
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
});
test('malformed state and illegal lineups are rejected',()=>{
  assert.throws(()=>normalizeState(null));
  const state=defaultState();state.parties[0].slots=['금희','금희',null];
  assert.throws(()=>normalizeState(state));
});
