import { CHARACTERS, CHARACTER_MAP, ELEMENTS } from './data.js';
export const STORAGE_KEY = 'wuwa-matrix-squad:v1';
export const newParty = () => ({id:crypto.randomUUID(),slots:[null,null,null]});
export const defaultState = () => ({version:1,parties:[newParty(),newParty(),newParty()],owned:[],onlyOwned:false,element:'전체',cycle:[]});
export const limitFor = (state,id) => CHARACTER_MAP.get(id)?.supporter || state.cycle.includes(id) ? 2 : 1;
export const usageOf = (state,id) => state.parties.reduce((n,p)=>n+p.slots.filter(value=>value===id).length,0);
export function validateParties(state) {
  for (const party of state.parties) {
    const filled=party.slots.filter(Boolean);
    if (new Set(filled).size!==filled.length) return '같은 파티에 동일한 공명자를 두 번 편성할 수 없어요.';
  }
  for (const c of CHARACTERS) if(usageOf(state,c.id)>limitFor(state,c.id)) return `${c.name}의 편성 가능 횟수(${limitFor(state,c.id)}회)를 초과했어요.`;
  return null;
}
export function placeCharacter(state,selection,partyId,index) {
  if(!selection||!CHARACTER_MAP.has(selection.id)||!Number.isInteger(index)||index<0||index>2) return {error:'배치할 공명자를 먼저 선택해주세요.'};
  const next={...state,parties:state.parties.map(p=>({...p,slots:[...p.slots]}))};
  const target=next.parties.find(p=>p.id===partyId);
  if(!target)return {error:'파티를 찾을 수 없어요.'};
  if(selection.source){
    const source=next.parties.find(p=>p.id===selection.source.partyId);
    if(!source||source.slots[selection.source.index]!==selection.id)return {error:'공명자를 다시 선택해주세요.'};
    const previous=target.slots[index];
    source.slots[selection.source.index]=previous;
  }
  target.slots[index]=selection.id;
  const error=validateParties(next);
  return error?{error}:{state:next};
}
export function normalizeState(raw) {
  if(!raw||raw.version!==1||!Array.isArray(raw.parties)||raw.parties.length>200)throw new Error('Invalid saved state');
  const ids=values=>Array.isArray(values)?[...new Set(values.filter(id=>CHARACTER_MAP.has(id)))]:[];
  const state={version:1,owned:ids(raw.owned),cycle:ids(raw.cycle).filter(id=>!CHARACTER_MAP.get(id).supporter),onlyOwned:raw.onlyOwned===true,element:ELEMENTS.includes(raw.element)?raw.element:'전체',parties:[]};
  const partyIds=new Set();
  for(const party of raw.parties){
    if(!Array.isArray(party.slots)||party.slots.length!==3)throw new Error('Invalid party');
    const id=typeof party.id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(party.id)&&!partyIds.has(party.id)?party.id:crypto.randomUUID();
    partyIds.add(id);
    state.parties.push({id,slots:party.slots.map(value=>CHARACTER_MAP.has(value)?value:null)});
  }
  if(!state.parties.length)state.parties.push(newParty());
  if(validateParties(state))throw new Error('Invalid saved lineup');
  return state;
}
