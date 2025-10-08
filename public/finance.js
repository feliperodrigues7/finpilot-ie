// FinPilot IE - Frontend (somente frontend, sem backend obrigatório)
const { createClient } = window.supabase || {};
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON = window.SUPABASE_ANON || '';
let supa = null;
try { if (createClient && SUPABASE_URL && SUPABASE_ANON) { supa = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true } }); } } catch(_) {}

function $(id){ return document.getElementById(id); }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn); }
function showToast(msg){ const t=$('toast'); if(!t){alert(msg);return;} t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

function wireTabs(){
  const btns=document.querySelectorAll('.tab-button'); const contents=document.querySelectorAll('.tab-content');
  btns.forEach(b=>on(b,'click',()=>{ btns.forEach(x=>x.classList.remove('active')); contents.forEach(c=>c.classList.remove('active')); b.classList.add('active'); const el=$(b.dataset.tab); if(el) el.classList.add('active'); }));
}

function wireModals(){
  document.querySelectorAll('.modal').forEach(m=>{
    const close=m.querySelector('.close-button'); if(close){ on(close,'click',()=>m.style.display='none'); }
    on(m,'click',(e)=>{ if(e.target===m) m.style.display='none'; });
  });
}

function wireButtons(){
  on($('add-account-button'),'click',()=>{$('account-form')?.reset(); $('account-modal').style.display='block';});
  on($('add-transaction-button'),'click',()=>{$('transaction-form')?.reset(); $('transaction-modal').style.display='block';});
  on($('add-category-button'),'click',()=>{$('category-form')?.reset(); $('category-modal').style.display='block';});
  on($('add-recurring-button'),'click',()=>{$('recurring-form')?.reset(); $('recurring-modal').style.display='block';});
  on($('add-budget-button'),'click',()=>{$('budget-form')?.reset(); $('budget-modal').style.display='block';});
  on($('add-debt-button'),'click',()=>{$('debt-form')?.reset(); $('debt-modal').style.display='block';});
}

async function init(){
  wireTabs(); wireModals(); wireButtons();
  // Preencher selects de pessoas com placeholder até haver backend
  const ownerSelects=['owner-filter','account-owner-name','transaction-owner-name','category-owner-name','recurring-owner-name','budget-owner-name','debt-owner-name'];
  ownerSelects.forEach(id=>{ const el=$(id); if(!el) return; if(id==='owner-filter'){ el.innerHTML='<option value="">Todas as Pessoas</option><option value="Você">Você</option><option value="Cônjuge">Cônjuge</option>'; } else { el.innerHTML='<option>Você</option><option>Cônjuge</option>'; }});
  // Datas padrão
  const s=$('transaction-start-date'); const e=$('transaction-end-date'); const today=new Date(); const start=new Date(today.getFullYear(), today.getMonth(),1).toISOString().slice(0,10); if(s) s.value=start; if(e) e.value=today.toISOString().slice(0,10);
  const bmonth=$('budget-month'); if(bmonth) bmonth.value=today.toISOString().slice(0,7);
  const rmonth=$('report-month'); if(rmonth) rmonth.value=today.toISOString().slice(0,7);

  // Logout (sem backend)
  on($('logout-button'),'click',()=>{ showToast('Sessão encerrada'); try{ location.href='./login.html'; }catch(_){ } });

  // Se houver Supabase configurado, tentar obter user e prosseguir (não obrigatório)
  if(supa){ try { const { data:{ user } } = await supa.auth.getUser(); if(!user){ /* opcional redirecionar */ } } catch(_) {}
  }
}

document.addEventListener('DOMContentLoaded', init);
