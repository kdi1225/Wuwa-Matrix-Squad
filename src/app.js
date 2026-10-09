import {CHARACTERS,CHARACTER_MAP,ELEMENTS} from './data.js';
import {STORAGE_KEY,defaultState,newParty,limitFor,usageOf,validateParties,placeCharacter,normalizeState} from './model.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',grip:'<path d="M8 5h0m8 0h0M8 12h0m8 0h0M8 19h0m8 0h0" stroke-width="3"/>'
};
const icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key]||paths.person}</svg>`;
const elementIcon=element=>`<img class="element-icon" src="./public/images/elements/${encodeURIComponent(element)}.png" alt="${escape(element)}" draggable="false">`;
let state=defaultState(),selection=null,dragSelection=null,dragParty=null,toastTimer,dialogMode=null,draft=new Set();
let storageError=false;
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)state=normalizeState(JSON.parse(saved));}catch{storageError=true;}
const dialog=$('settings-dialog');
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageError=false;}catch{storageError=true;notify('브라우저에 저장할 수 없어요. 사이트 저장 공간 설정을 확인해주세요.');}renderSaveStatus();}
function renderSaveStatus(){$('save-status').classList.toggle('error',storageError);$('save-status').innerHTML=`<span></span>${storageError?'브라우저 저장 확인 필요':'이 브라우저에 자동 저장'}`;}
function portrait(c,lazy=true){return c.image?`<img src="${escape(c.image)}" alt="" ${lazy?'loading="lazy"':''} draggable="false">`:`<div class="silhouette">${icon('person')}</div><span class="upcoming-tag">출시 예정</span>`;}
function renderRoster(){
  const grid=$('roster-grid'),top=grid.scrollTop;
  const list=CHARACTERS.filter(c=>(state.element==='전체'||state.element===c.element)&&(!state.onlyOwned||state.owned.includes(c.id)));
  $('roster-count').textContent=`${list.length} / ${CHARACTERS.length}`;
  $('element-filters').innerHTML=ELEMENTS.map(e=>`<button type="button" class="filter" data-filter="${e}" aria-pressed="${state.element===e}">${e}</button>`).join('');
  $('owned-count').textContent=state.owned.length;
  $('only-owned').checked=state.onlyOwned;
  grid.innerHTML=list.length?list.map(c=>{
    const count=usageOf(state,c.id),limit=limitFor(state,c.id),full=count>=limit;
    return `<button type="button" class="character-card ${selection?.id===c.id&&!selection.source?'selected':''}" data-character="${escape(c.id)}" data-element="${c.element}" draggable="${!full}" aria-disabled="${full}" aria-pressed="${selection?.id===c.id&&!selection.source}" aria-label="${escape(c.name)}, ${c.element}, ${count}/${limit}회 편성" title="${escape(c.name)} · ${c.element}${c.supporter?' · 서포터':''}"><div class="portrait">${portrait(c)}<span class="element-badge">${elementIcon(c.element)}</span>${limit===2?`<span class="limit-badge ${c.supporter?'':'cycle'}">${c.supporter?'2회':'주기 2회'}</span>`:''}</div><div class="card-info"><span class="card-name">${escape(c.name)}</span><span class="card-bottom"><span>${c.supporter?'서포터':c.element}</span><span class="usage ${count?'used':''}"><b>${count}</b> / ${limit}</span></span></div>${full?'<span class="completed-label">편성 완료</span>':''}</button>`;
  }).join(''):`<div class="empty-roster"><span class="empty-icon">◇</span>${state.onlyOwned?'조건에 맞는 보유 공명자가 없어요.':'해당 속성의 공명자가 없어요.'}${state.onlyOwned?'<br><button class="button" type="button" data-open-owned>보유 공명자 선택</button>':''}</div>`;
  grid.scrollTop=top;
}
function renderParties(){
  $('party-count').textContent=String(state.parties.length).padStart(2,'0');
  const assigned=state.parties.reduce((n,p)=>n+p.slots.filter(Boolean).length,0);
  $('assignment-count').textContent=`${assigned}명 편성`;
  $('party-list').innerHTML=state.parties.map((p,i)=>`<article class="party" data-party="${p.id}" aria-label="파티 ${i+1}"><div class="party-header"><div class="party-label"><button class="party-grip" type="button" draggable="true" data-party-drag="${p.id}" aria-label="파티 ${i+1} 순서 드래그">${icon('grip')}</button><span class="party-number">${String(i+1).padStart(2,'0')}</span><h3 class="party-name">파티 ${i+1}</h3></div><div class="party-controls"><button class="icon-button" type="button" data-reorder="${p.id}" data-direction="-1" aria-label="파티 ${i+1} 위로" ${i===0?'disabled':''}>${icon('up')}</button><button class="icon-button" type="button" data-reorder="${p.id}" data-direction="1" aria-label="파티 ${i+1} 아래로" ${i===state.parties.length-1?'disabled':''}>${icon('down')}</button><button class="party-delete" type="button" data-delete-party="${p.id}" aria-label="파티 ${i+1} 삭제">삭제</button></div></div><div class="slots">${p.slots.map((id,index)=>{
    const c=CHARACTER_MAP.get(id),selected=selection?.source?.partyId===p.id&&selection.source.index===index;
    return `<div class="slot"><button type="button" class="slot-target ${c?'filled':'empty'} ${selected?'selected':''}" data-slot-party="${p.id}" data-slot-index="${index}" ${c?`data-element="${c.element}" draggable="true"`:''} aria-label="파티 ${i+1} 슬롯 ${index+1}${c?' '+escape(c.name):' 비어 있음'}">${c?`${portrait(c,false)}<span class="slot-label">${elementIcon(c.element)}${escape(c.name)}</span>`:'<span class="slot-symbol">＋</span><span class="slot-caption">공명자 추가</span>'}</button>${c?`<button type="button" class="slot-remove" data-remove-party="${p.id}" data-remove-index="${index}" aria-label="파티 ${i+1} ${escape(c.name)} 편성 해제">×</button>`:''}</div>`;
  }).join('')}</div></article>`).join('');
}
function renderGuide(){$('selection-guide').classList.toggle('active',!!selection);$('selection-guide').textContent=selection?`${CHARACTER_MAP.get(selection.id).name} 선택됨 · 배치할 슬롯을 눌러주세요. (Esc로 해제)`:'캐릭터를 드래그하거나, 선택한 뒤 빈 슬롯을 눌러주세요.';}
function render(){renderRoster();renderParties();renderGuide();renderSaveStatus();$('cycle-summary').textContent=state.cycle.length?`${state.cycle.join(', ')} · 최대 2회`:'지정한 공명자를 최대 2회 편성할 수 있어요.';}
function commit(next){state=next;selection=null;persist();render();}
function place(partyId,index,pick=selection){const result=placeCharacter(state,pick,partyId,index);if(result.error){notify(result.error);return;}const name=CHARACTER_MAP.get(pick.id).name;commit(result.state);notify(`${name} 편성 완료`);}
function reorder(id,targetIndex){const from=state.parties.findIndex(p=>p.id===id);if(from<0||targetIndex<0||targetIndex>=state.parties.length)return;const parties=[...state.parties];const [party]=parties.splice(from,1);parties.splice(targetIndex,0,party);commit({...state,parties});}
function dialogCharacters(){return dialogMode==='owned'?CHARACTERS:CHARACTERS.filter(c=>!c.supporter);}
function updateDialogCount(){$('dialog-count').textContent=`${draft.size}명 선택 / ${dialogCharacters().length}명`;}
function renderDialog(){
  $('settings-grid').innerHTML=dialogCharacters().map(c=>`<button type="button" class="owned-card" data-draft="${escape(c.id)}" data-element="${c.element}" aria-pressed="${draft.has(c.id)}" aria-label="${escape(c.name)} ${draft.has(c.id)?'선택됨':'선택 안 됨'}" title="${escape(c.name)}"><div class="portrait">${portrait(c)}<span class="element-badge">${elementIcon(c.element)}</span></div><span class="owned-name">${escape(c.name)}</span><span class="check-mark" aria-hidden="true">✓</span></button>`).join('');updateDialogCount();
}
function openSettings(mode){
  dialogMode=mode;draft=new Set(mode==='owned'?state.owned:state.cycle);
  $('dialog-eyebrow').textContent=mode==='owned'?'MY RESONATORS':'CYCLE BONUS';
  $('dialog-title').textContent=mode==='owned'?'보유 공명자 설정':'주기별 추가 편성 대상';
  $('dialog-description').textContent=mode==='owned'?'보유 중인 공명자를 선택하세요. 저장한 목록을 도감 필터에 적용할 수 있어요.':'이번 주기에 2회 편성이 허용되는 공명자를 선택하세요.';
  $('dialog-save').textContent=mode==='owned'?'보유 현황 저장':'주기 설정 저장';
  $('dialog-filter-label').hidden=mode!=='owned';$('cycle-note').hidden=mode==='owned';$('dialog-only-owned').checked=state.onlyOwned;$('dialog-error').hidden=true;
  renderDialog();dialog.showModal();$('settings-grid').scrollTop=0;
}
$('element-filters').addEventListener('click',event=>{const b=event.target.closest('[data-filter]');if(b){state.element=b.dataset.filter;persist();renderRoster();$('element-filters').querySelector(`[data-filter="${state.element}"]`).focus();}});
$('only-owned').addEventListener('change',event=>{state.onlyOwned=event.target.checked;persist();renderRoster();});
$('owned-button').addEventListener('click',()=>openSettings('owned'));
$('cycle-button').addEventListener('click',()=>openSettings('cycle'));
$('roster-grid').addEventListener('click',event=>{
  if(event.target.closest('[data-open-owned]')){openSettings('owned');return;}
  const card=event.target.closest('[data-character]');if(!card)return;
  if(card.getAttribute('aria-disabled')==='true'){notify('편성 가능 횟수를 모두 사용했어요. 파티에서 해제한 뒤 다시 배치해주세요.');return;}
  selection=selection?.id===card.dataset.character&&!selection.source?null:{id:card.dataset.character};render();
  const sameCard=[...$('roster-grid').querySelectorAll('[data-character]')].find(el=>el.dataset.character===card.dataset.character);sameCard?.focus({preventScroll:true});
});
$('party-list').addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-party]');
  if(remove){const p=state.parties.find(p=>p.id===remove.dataset.removeParty);p.slots[Number(remove.dataset.removeIndex)]=null;commit(state);notify('편성을 해제했어요.');return;}
  const del=event.target.closest('[data-delete-party]');if(del){state.parties=state.parties.filter(p=>p.id!==del.dataset.deleteParty);if(!state.parties.length)state.parties=[newParty()];commit(state);return;}
  const order=event.target.closest('[data-reorder]');if(order){reorder(order.dataset.reorder,state.parties.findIndex(p=>p.id===order.dataset.reorder)+Number(order.dataset.direction));return;}
  const slot=event.target.closest('[data-slot-party]');if(!slot)return;
  const partyId=slot.dataset.slotParty,index=Number(slot.dataset.slotIndex),id=state.parties.find(p=>p.id===partyId).slots[index];
  if(selection){if(selection.source?.partyId===partyId&&selection.source.index===index){selection=null;render();}else place(partyId,index);}
  else if(id){selection={id,source:{partyId,index}};render();}else notify('왼쪽 도감에서 배치할 공명자를 선택해주세요.');
});
$('add-party').addEventListener('click',()=>{state.parties.push(newParty());commit(state);$('party-list').lastElementChild.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open&&selection){selection=null;render();}});
document.addEventListener('dragstart',event=>{
  const partyHandle=event.target.closest('[data-party-drag]');if(partyHandle){dragParty=partyHandle.dataset.partyDrag;event.dataTransfer.setData('text/plain',dragParty);event.dataTransfer.effectAllowed='move';return;}
  const card=event.target.closest('[data-character]'),slot=event.target.closest('[data-slot-party]');
  if(card&&card.getAttribute('aria-disabled')!=='true')dragSelection={id:card.dataset.character};
  else if(slot){const partyId=slot.dataset.slotParty,index=Number(slot.dataset.slotIndex);const id=state.parties.find(p=>p.id===partyId)?.slots[index];if(id)dragSelection={id,source:{partyId,index}};}
  if(dragSelection){event.dataTransfer.setData('text/plain',dragSelection.id);event.dataTransfer.effectAllowed=dragSelection.source?'move':'copy';}
});
document.addEventListener('dragover',event=>{const slot=event.target.closest('[data-slot-party]'),party=event.target.closest('.party');if(dragSelection&&slot){event.preventDefault();event.dataTransfer.dropEffect=dragSelection.source?'move':'copy';slot.classList.add('drag-over');}else if(dragParty&&party){event.preventDefault();party.classList.add('drop-party');}});
document.addEventListener('dragleave',event=>{const target=event.target.closest('.drag-over,.drop-party');if(target&&!target.contains(event.relatedTarget)){target.classList.remove('drag-over','drop-party');}});
const clearDrag=()=>{dragSelection=null;dragParty=null;document.querySelectorAll('.drag-over,.drop-party').forEach(el=>el.classList.remove('drag-over','drop-party'));};
document.addEventListener('drop',event=>{const slot=event.target.closest('[data-slot-party]'),party=event.target.closest('.party');if(dragSelection&&slot){event.preventDefault();place(slot.dataset.slotParty,Number(slot.dataset.slotIndex),dragSelection);}else if(dragParty&&party){event.preventDefault();reorder(dragParty,state.parties.findIndex(p=>p.id===party.dataset.party));}clearDrag();});
document.addEventListener('dragend',clearDrag);
$('settings-grid').addEventListener('click',event=>{const card=event.target.closest('[data-draft]');if(!card)return;const id=card.dataset.draft;if(draft.has(id))draft.delete(id);else draft.add(id);card.setAttribute('aria-pressed',String(draft.has(id)));card.setAttribute('aria-label',`${id} ${draft.has(id)?'선택됨':'선택 안 됨'}`);updateDialogCount();$('dialog-error').hidden=true;});
$('select-all').addEventListener('click',()=>{draft=new Set(dialogCharacters().map(c=>c.id));renderDialog();});
$('deselect-all').addEventListener('click',()=>{draft.clear();renderDialog();});
for(const id of ['dialog-close','dialog-cancel'])$(id).addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
$('settings-form').addEventListener('submit',event=>{
  event.preventDefault();
  const next=dialogMode==='owned'?{...state,owned:[...draft],onlyOwned:$('dialog-only-owned').checked}:{...state,cycle:[...draft]};
  const error=validateParties(next);if(error){$('dialog-error').textContent=error+' 해당 공명자를 파티에서 해제한 후 설정을 변경해주세요.';$('dialog-error').hidden=false;return;}
  commit(next);dialog.close();if(!storageError)notify(dialogMode==='owned'?'보유 현황을 저장했어요.':'주기별 편성 대상을 저장했어요.');
});
render();if(storageError)notify('저장된 정보를 읽지 못했어요. 브라우저 저장 설정을 확인해주세요.');
