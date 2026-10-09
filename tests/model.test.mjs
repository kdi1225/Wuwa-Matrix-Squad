import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS} from '../src/data.js';
import {defaultState,placeCharacter,limitFor,normalizeState,validateParties,usageOf} from '../src/model.js';

test('roster includes 61 entries, 7 supporters, and upcoming Lily',()=>{
  assert.equal(CHARACTERS.length,61);
  assert.equal(new Set(CHARACTERS.map(c=>c.id)).size,61);
  assert.equal(CHARACTERS.filter(c=>c.supporter).length,7);
  assert.equal(CHARACTERS.find(c=>c.id==='릴리').upcoming,true);
});
test('normal characters cannot be copied to a second party',()=>{
  let state=defaultState();
  state=placeCharacter(state,{id:'금희'},state.parties[0].id,0).state;
  assert.match(placeCharacter(state,{id:'금희'},state.parties[1].id,0).error,/초과/);
  assert.equal(usageOf(state,'금희'),1);
});

test('all Rover elements share one use and reject cross-element duplicates',()=>{
  const rovers=CHARACTERS.filter(c=>c.usageGroup==='방랑자');
  assert.equal(rovers.length,4);
  for(const first of rovers){
    let state=defaultState();
    state=placeCharacter(state,{id:first.id},state.parties[0].id,0).state;
    for(const other of rovers){
      assert.equal(usageOf(state,other.id),1);
      assert.match(placeCharacter(state,{id:other.id},state.parties[1].id,0).error,/초과/);
      assert.match(placeCharacter(state,{id:other.id},state.parties[0].id,1).error,/동일한/);
    }
  }
});

test('Rover can change element in place, move, swap and be released without extra uses',()=>{
  let state=defaultState();state.parties[0].slots=['방랑자·회절','금희',null];
  state=placeCharacter(state,{id:'방랑자·기류'},state.parties[0].id,0).state;
  assert.equal(state.parties[0].slots[0],'방랑자·기류');
  state=placeCharacter(state,{id:'방랑자·기류',source:{partyId:state.parties[0].id,index:0}},state.parties[0].id,1).state;
  assert.deepEqual(state.parties[0].slots,['금희','방랑자·기류',null]);
  state=placeCharacter(state,{id:'방랑자·기류',source:{partyId:state.parties[0].id,index:1}},state.parties[1].id,0).state;
  assert.equal(usageOf(state,'방랑자·인멸'),1);
  state.parties[1].slots[0]=null;
  state=placeCharacter(state,{id:'방랑자·전도'},state.parties[2].id,0).state;
  assert.equal(usageOf(state,'방랑자·회절'),1);
});

test('a Rover cycle bonus gives two shared uses rather than two per element',()=>{
  let state=defaultState();state.cycle=['방랑자·회절','방랑자·전도'];
  for(const c of CHARACTERS.filter(c=>c.usageGroup==='방랑자'))assert.equal(limitFor(state,c.id),2);
  state=placeCharacter(state,{id:'방랑자·기류'},state.parties[0].id,0).state;
  assert.match(placeCharacter(state,{id:'방랑자·인멸'},state.parties[0].id,1).error,/동일한/);
  state=placeCharacter(state,{id:'방랑자·인멸'},state.parties[1].id,0).state;
  assert.equal(usageOf(state,'방랑자·회절'),2);
  assert.match(placeCharacter(state,{id:'방랑자·전도'},state.parties[2].id,0).error,/초과/);
  state.cycle=[];assert.match(validateParties(state),/방랑자/);
});

test('old saves retain the first Rover and all other parties and settings',()=>{
  const old=defaultState();old.owned=['방랑자·회절','금희'];old.onlyOwned=true;old.element='회절';
  old.parties[0].slots=['방랑자·회절','금희','방랑자·인멸'];
  old.parties[1].slots=['방랑자·기류','설지',null];
  old.parties[2].slots=['방랑자·전도',null,null];
  const next=normalizeState(old);
  assert.deepEqual(next.parties.map(p=>p.slots),[['방랑자·회절','금희',null],[null,'설지',null],[null,null,null]]);
  assert.deepEqual(next.parties.map(p=>p.id),old.parties.map(p=>p.id));
  assert.deepEqual(next.owned,old.owned);assert.equal(next.onlyOwned,true);assert.equal(next.element,'회절');
  assert.equal(old.parties[1].slots[0],'방랑자·기류');
  assert.deepEqual(normalizeState(next),next);
});

test('old cycle saves keep two Rovers in distinct parties and release only excess placements',()=>{
  const old=defaultState();old.cycle=['방랑자·기류'];
  old.parties[0].slots=['방랑자·회절','방랑자·인멸',null];
  old.parties[1].slots=['방랑자·기류',null,null];
  old.parties[2].slots=['방랑자·전도',null,null];
  const next=normalizeState(old);
  assert.deepEqual(next.parties.map(p=>p.slots),[['방랑자·회절',null,null],['방랑자·기류',null,null],[null,null,null]]);
  assert.equal(validateParties(next),null);
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
