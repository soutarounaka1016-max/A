(() => {
  'use strict';
  const STORAGE_KEY = 'word-deck:words:v1';
  const DEFAULT_CATEGORIES = ['英単語','古文単語','化学','その他'];
  const STATUS_LABELS = {new:'未学習',learning:'学習中',mastered:'覚えた'};
  const $ = (id) => document.getElementById(id);
  const state = { words: loadWords(), studyWords: [], studyIndex: 0, revealed: false, deleteId: null };

  function loadWords(){
    try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed.filter(validWord) : []; }
    catch { return []; }
  }
  function validWord(w){ return w && typeof w.id==='string' && typeof w.word==='string' && typeof w.meaning==='string'; }
  function saveWords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.words)); }
  function makeId(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function escapeText(value){ return String(value ?? ''); }
  function formatDate(value){ const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ja-JP'); }
  function allCategories(){ return [...new Set([...DEFAULT_CATEGORIES,...state.words.map(w=>w.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ja')); }
  function showToast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.classList.remove('show'),1800); }
  function showView(id){ document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id)); document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view===id)); if(id==='listView') renderList(); if(id==='studyView') buildStudyDeck(true); window.scrollTo({top:0,behavior:'smooth'}); }
  function renderStats(){
    $('totalCount').textContent=state.words.length;
    $('newCount').textContent=state.words.filter(w=>w.status==='new').length;
    $('learningCount').textContent=state.words.filter(w=>w.status==='learning').length;
    $('masteredCount').textContent=state.words.filter(w=>w.status==='mastered').length;
  }
  function populateCategories(){
    const categories=allCategories();
    for(const id of ['categoryFilter','studyCategoryFilter']){
      const select=$(id), current=select.value;
      select.innerHTML='<option value="all">すべて</option>';
      categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;select.append(o);});
      if([...select.options].some(o=>o.value===current)) select.value=current;
    }
    $('categoryOptions').innerHTML='';
    categories.forEach(c=>{const o=document.createElement('option');o.value=c;$('categoryOptions').append(o);});
  }
  function renderAll(){ renderStats(); populateCategories(); renderList(); buildStudyDeck(false); }
  function filteredWords(){
    const q=$('searchInput').value.trim().toLocaleLowerCase('ja');
    const category=$('categoryFilter').value, status=$('statusFilter').value;
    return state.words.filter(w=>(category==='all'||w.category===category)&&(status==='all'||w.status===status)&&(!q||[w.word,w.meaning,w.note,w.category].some(v=>String(v||'').toLocaleLowerCase('ja').includes(q))));
  }
  function renderList(){
    const list=$('wordList'); list.innerHTML=''; const words=filteredWords(); $('emptyList').classList.toggle('hidden',words.length>0);
    words.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).forEach(w=>{
      const card=document.createElement('article'); card.className='word-card';
      const info=document.createElement('div');
      const meta=document.createElement('div'); meta.className='word-meta';
      const cat=document.createElement('span'); cat.className='badge'; cat.textContent=w.category||'未分類';
      const status=document.createElement('span'); status.className=`badge status-${w.status}`; status.textContent=STATUS_LABELS[w.status]||'未学習';
      const date=document.createElement('span'); date.className='badge'; date.textContent=`更新 ${formatDate(w.updatedAt)}`;
      meta.append(cat,status,date);
      const title=document.createElement('h3'); title.textContent=escapeText(w.word);
      const meaning=document.createElement('p'); meaning.textContent=escapeText(w.meaning);
      info.append(meta,title,meaning);
      if(w.note){ const note=document.createElement('p'); note.textContent=escapeText(w.note); info.append(note); }
      const actions=document.createElement('div'); actions.className='word-actions';
      const edit=document.createElement('button'); edit.type='button';edit.textContent='編集';edit.addEventListener('click',()=>openDialog(w));
      const del=document.createElement('button');del.type='button';del.textContent='削除';del.className='delete-button';del.addEventListener('click',()=>openDelete(w));
      actions.append(edit,del); card.append(info,actions); list.append(card);
    });
  }
  function openDialog(word=null){
    $('dialogTitle').textContent=word?'単語を編集':'単語を追加'; $('wordId').value=word?.id||''; $('wordInput').value=word?.word||''; $('meaningInput').value=word?.meaning||''; $('noteInput').value=word?.note||''; $('categoryInput').value=word?.category||'英単語'; $('formStatus').value=word?.status||'new'; $('formError').classList.add('hidden'); $('wordDialog').showModal(); setTimeout(()=>$('wordInput').focus(),20);
  }
  function closeDialog(){ $('wordDialog').close(); }
  function submitWord(event){
    event.preventDefault(); const word=$('wordInput').value.trim(), meaning=$('meaningInput').value.trim();
    if(!word||!meaning){$('formError').textContent='単語と意味を入力してください。';$('formError').classList.remove('hidden');return;}
    const id=$('wordId').value, now=new Date().toISOString();
    if(id){ const target=state.words.find(w=>w.id===id); if(target) Object.assign(target,{word,meaning,note:$('noteInput').value.trim(),category:$('categoryInput').value.trim()||'未分類',status:$('formStatus').value,updatedAt:now}); }
    else state.words.push({id:makeId(),word,meaning,note:$('noteInput').value.trim(),category:$('categoryInput').value.trim()||'未分類',status:$('formStatus').value,createdAt:now,updatedAt:now,lastReviewedAt:null,reviewCount:0,missCount:0});
    saveWords(); closeDialog(); renderAll(); showToast(id?'単語を更新しました':'単語を保存しました');
  }
  function openDelete(word){ state.deleteId=word.id; $('deleteMessage').textContent=`「${word.word}」を削除します。この操作は元に戻せません。`; $('deleteDialog').showModal(); }
  function confirmDelete(){ if(!state.deleteId)return; state.words=state.words.filter(w=>w.id!==state.deleteId); state.deleteId=null; saveWords(); $('deleteDialog').close(); renderAll(); showToast('単語を削除しました'); }
  function studyCandidates(){ const status=$('studyStatusFilter').value, category=$('studyCategoryFilter').value; return state.words.filter(w=>(category==='all'||w.category===category)&&(status==='all'||w.status===status||(status==='not-mastered'&&w.status!=='mastered'))); }
  function shuffle(array){ for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];} return array; }
  function buildStudyDeck(reset=true){
    let words=studyCandidates().slice(); if($('shuffleToggle').checked) words=shuffle(words);
    state.studyWords=words; if(reset||state.studyIndex>=words.length) state.studyIndex=0; state.revealed=false; renderCard();
  }
  function renderCard(){
    const has=state.studyWords.length>0; $('studyEmpty').classList.toggle('hidden',has); $('studyArea').classList.toggle('hidden',!has); $('studyProgress').textContent=has?`${state.studyIndex+1} / ${state.studyWords.length}`:'0 / 0'; if(!has)return;
    const w=state.studyWords[state.studyIndex]; $('cardCategory').textContent=w.category||'未分類'; $('cardPrompt').textContent=w.word; $('cardAnswer').textContent=w.meaning; $('cardNote').textContent=w.note||'';
    $('cardAnswer').classList.toggle('hidden',!state.revealed); $('cardNote').classList.toggle('hidden',!state.revealed||!w.note); $('revealHint').textContent=state.revealed?'タップして単語だけに戻す':'タップして意味を見る';
  }
  function moveCard(delta){ if(!state.studyWords.length)return; state.studyIndex=(state.studyIndex+delta+state.studyWords.length)%state.studyWords.length; state.revealed=false; renderCard(); }
  function markStatus(status){
    if(!state.studyWords.length)return; const shown=state.studyWords[state.studyIndex]; const target=state.words.find(w=>w.id===shown.id); if(!target)return; const now=new Date().toISOString(); target.status=status; target.lastReviewedAt=now; target.reviewCount=(target.reviewCount||0)+1; if(status!=='mastered') target.missCount=(target.missCount||0)+1; target.updatedAt=now; saveWords(); renderStats(); renderList(); showToast(status==='mastered'?'「覚えた」にしました':'「学習中」にしました'); buildStudyDeck(false);
  }
  document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  ['addHeaderButton','addHomeButton','addListButton'].forEach(id=>$(id).addEventListener('click',()=>openDialog()));
  $('listHomeButton').addEventListener('click',()=>showView('listView')); $('startStudyButton').addEventListener('click',()=>showView('studyView'));
  $('closeDialog').addEventListener('click',closeDialog); $('cancelDialog').addEventListener('click',closeDialog); $('wordForm').addEventListener('submit',submitWord);
  $('cancelDelete').addEventListener('click',()=>{$('deleteDialog').close();state.deleteId=null;}); $('confirmDelete').addEventListener('click',confirmDelete);
  ['searchInput','categoryFilter','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',renderList));
  ['studyStatusFilter','studyCategoryFilter','shuffleToggle'].forEach(id=>$(id).addEventListener('change',()=>buildStudyDeck(true)));
  $('flashcard').addEventListener('click',()=>{state.revealed=!state.revealed;renderCard();}); $('prevCard').addEventListener('click',()=>moveCard(-1)); $('nextCard').addEventListener('click',()=>moveCard(1)); $('markLearning').addEventListener('click',()=>markStatus('learning')); $('markMastered').addEventListener('click',()=>markStatus('mastered'));
  renderAll();
  window.WordDeckTest={STORAGE_KEY,getWords:()=>structuredClone(state.words)};
})();
