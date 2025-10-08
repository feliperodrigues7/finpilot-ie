(function(){'use strict';
function $(i){return document.getElementById(i)}
function on(e,v,f){if(e)e.addEventListener(v,f)}
function toast(m){console.log('[Toast]',m)}
function fmt(n){return new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n||0))}
function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
var DB_KEYS={people:'fp_people',accounts:'fp_accounts',categories:'fp_categories',transactions:'fp_transactions',recurring:'fp_recurring'};
var storage={get:function(k,d){if(d===void 0)d=[];try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set:function(k,v){localStorage.setItem(k,JSON.stringify(v))}};
var data={
 getPeople:function(){return storage.get(DB_KEYS.people)},
 savePerson:function(name){name=(name||'').trim();if(!name)return null;var p=this.getPeople();if(p.indexOf(name)===-1){p.push(name);storage.set(DB_KEYS.people,p)}return name},
 getAccounts:function(){return storage.get(DB_KEYS.accounts)},
 saveAccount:function(acc){var l=this.getAccounts();if(!acc.id){acc.id=uid();l.push(acc)}else{var i=l.findIndex(function(a){return a.id===acc.id});if(i>-1)l[i]=acc;else l.push(acc)}storage.set(DB_KEYS.accounts,l);return acc}
};
// UI mínimo
function renderPeople(){var ul=$('people-list');if(!ul)return;ul.innerHTML='';data.getPeople().forEach(function(p){var li=document.createElement('li');li.textContent=p;ul.appendChild(li)})}
function wire(){on($('add-account-button'),'click',function(){alert('ok btn')})}
function init(){try{wire();renderPeople();console.log('FinPilot IE up')}catch(e){console.error('init fail',e)}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
})();
