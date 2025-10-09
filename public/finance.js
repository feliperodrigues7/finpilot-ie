(function () {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const fmtEUR = (n) => (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

  const toISO = (v) => {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match?.(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
  };
  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso+'T12:00:00') : new Date(iso);
    if (isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const STORAGE_KEY = "finpilot_ie_v3";
  const state = { contas: [], gastos: [], salarios: [], transferencias: [], categorias: [], fixas: [], dividas: [] };
  function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function todayISO(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderDashboard(); }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ Object.assign(state, JSON.parse(raw)); }
    } catch(e){ console.error(e); }
  }

  function pessoasFromContas(){
    const set=new Set(state.contas.map(c=> (c.titular||'').trim()).filter(Boolean));
    return Array.from(set);
  }
  function contasOptions(){ return state.contas.map(c=>({ value:c.id, label:`${c.titular} - ${c.tipo} (${c.banco})` })); }
  function contaById(id){ return state.contas.find(c=> c.id===id); }
  function getEmailByTitular(t){ const c = state.contas.find(x => (x.titular||'') === (t||'')); return (c && c.email) ? String(c.email).trim() : ''; }

  // === Supabase Adapter (com logs e exposição em window) ===
  const SB = (() => {
    try{
      if (!window.SUPABASE_URL) { console.warn('[SB] SUPABASE_URL ausente'); return null; }
      if (!window.SUPABASE_ANON_KEY) { console.warn('[SB] SUPABASE_ANON_KEY ausente'); return null; }
      if (!window.supabase) { console.warn('[SB] SDK supabase ausente'); return null; }

      const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('[SB] Client criado');

      // contas
      async function listContas(){ const {data, error} = await client.from('contas').select('*').order('created_at', {ascending:false}); if(error) throw error; return data||[]; }
      async function insertConta(rec){ const {data, error} = await client.from('contas').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function updateConta(id, patch){ const {data, error} = await client.from('contas').update(patch).eq('id', id).select('*').single(); if(error) throw error; return data; }
      async function deleteConta(id){ const {error} = await client.from('contas').delete().eq('id', id); if(error) throw error; return true; }

      // gastos
      async function listGastos(){ const {data, error} = await client.from('gastos').select('*').order('data', {ascending:false}).order('created_at', {ascending:false}); if(error) throw error; return data||[]; }
      async function insertGasto(rec){ const {data, error} = await client.from('gastos').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function updateGasto(id, patch){ const {data, error} = await client.from('gastos').update(patch).eq('id', id).select('*').single(); if(error) throw error; return data; }
      async function deleteGasto(id){ const {error} = await client.from('gastos').delete().eq('id', id); if(error) throw error; return true; }

      // salarios
      async function listSalarios(){ const {data, error} = await client.from('salarios').select('*').order('data', {ascending:false}).order('created_at', {ascending:false}); if(error) throw error; return data||[]; }
      async function insertSalario(rec){ const {data, error} = await client.from('salarios').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function updateSalario(id, patch){ const {data, error} = await client.from('salarios').update(patch).eq('id', id).select('*').single(); if(error) throw error; return data; }
      async function deleteSalario(id){ const {error} = await client.from('salarios').delete().eq('id', id); if(error) throw error; return true; }

      // fixas
      async function listFixas(){ const {data, error} = await client.from('fixas').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
      async function insertFixa(rec){ const {data, error} = await client.from('fixas').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function updateFixa(id, patch){ const {data, error} = await client.from('fixas').update(patch).eq('id', id).select('*').single(); if(error) throw error; return data; }
      async function deleteFixa(id){ const {error} = await client.from('fixas').delete().eq('id', id); if(error) throw error; return true; }

      // dividas
      async function listDividas(){ const {data, error} = await client.from('dividas').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
      async function insertDivida(rec){ const {data, error} = await client.from('dividas').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function updateDivida(id, patch){ const {data, error} = await client.from('dividas').update(patch).eq('id', id).select('*').single(); if(error) throw error; return data; }
      async function deleteDivida(id){ const {error} = await client.from('dividas').delete().eq('id', id); if(error) throw error; return true; }

      // categorias
      async function listCategorias(){ const {data, error} = await client.from('categorias').select('*').order('nome',{ascending:true}); if(error) throw error; return data||[]; }
      async function insertCategoria(rec){ const {data, error} = await client.from('categorias').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function deleteCategoria(id){ const {error} = await client.from('categorias').delete().eq('id', id); if(error) throw error; return true; }

      // transferencias
      async function listTransfers(){ const {data, error} = await client.from('transferencias').select('*').order('data',{ascending:false}).order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
      async function insertTransfer(rec){ const {data, error} = await client.from('transferencias').insert(rec).select('*').single(); if(error) throw error; return data; }
      async function deleteTransfer(id){ const {error} = await client.from('transferencias').delete().eq('id', id); if(error) throw error; return true; }

      const api = {
        client,
        contas: { list:listContas, insert:insertConta, update:updateConta, remove:deleteConta },
        gastos: { list:listGastos, insert:insertGasto, update:updateGasto, remove:deleteGasto },
        salarios: { list:listSalarios, insert:insertSalario, update:updateSalario, remove:deleteSalario },
        fixas: { list:listFixas, insert:insertFixa, update:updateFixa, remove:deleteFixa },
        dividas: { list:listDividas, insert:insertDivida, update:updateDivida, remove:deleteDivida },
        categorias: { list:listCategorias, insert:insertCategoria, remove:deleteCategoria },
        transferencias: { list:listTransfers, insert:insertTransfer, remove:deleteTransfer }
      };
      window.SB = api; // facilita debug
      return api;
    }catch(e){
      console.error('[SB] Falha init:', e);
      return null;
    }
  })();

  // === Dashboard ===
  function computeBalances(){
    const map=new Map();
    const add=(titular,banco,delta)=>{ const key=`${titular}||${banco}`; map.set(key, (map.get(key)||0) + Number(delta||0)); };
    state.salarios.forEach(s=> add(s.titular, s.banco, +s.valor));
    state.gastos.filter(g=> (g.status||'')==='paga').forEach(g=>{
      const conta = contaById(g.conta_id);
      const banco = g.banco || (conta? conta.banco : '—');
      add(g.titular, banco, -g.valor);
    });
    state.fixas.filter(f=> (f.status||'')==='paga').forEach(f=>{ const conta=state.contas.find(c=> c.titular===f.titular) || { banco:'—' }; add(f.titular, conta.banco, -f.valor); });
    state.dividas.filter(d=> (d.status||'')==='paga').forEach(d=>{ const conta=state.contas.find(c=> c.titular===d.titular) || { banco:'—' }; add(d.titular, conta.banco, -d.valor); });
    state.transferencias.forEach(t=>{
      const tipo=(t.tipo||'').toLowerCase(); const v=Number(t.valor||0);
      if(tipo==='transferência' || tipo==='transferencia'){ const cDe=contaById(t.de_id); const cPara=contaById(t.para_id); if(cDe) add(cDe.titular,cDe.banco,-v); if(cPara) add(cPara.titular,cPara.banco,+v); }
      else if(tipo==='despesa'){ const cDe=contaById(t.de_id); if(cDe) add(cDe.titular,cDe.banco,-v); }
      else if(tipo==='receita'){ const cPara=contaById(t.para_id); if(cPara) add(cPara.titular,cPara.banco,+v); }
    });
    return Array.from(map.entries()).map(([key,val])=>{ const [titular,banco]=key.split('||'); return {titular,banco,saldo:val}; }).sort((a,b)=> a.titular.localeCompare(b.titular)||a.banco.localeCompare(b.banco));
  }

  function renderDashboard(){
    const rows=computeBalances();
    const tbody=qs('#tblDash tbody'); if(tbody){ tbody.innerHTML=''; rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.titular}</td><td>${r.banco}</td><td><strong>${fmtEUR(r.saldo)}</strong></td>`; tbody.appendChild(tr); }); }
    const cards=qs('#dashCards'); if(cards){ cards.innerHTML=''; rows.forEach(r=>{ const positive=(r.saldo||0)>=0; const div=document.createElement('div'); div.className='card'; div.innerHTML=`<div class="title">${r.titular} • ${r.banco}</div><div class="value" style="color:${positive?'var(--ok)':'var(--danger)'}">${fmtEUR(r.saldo)}</div><div class="delta muted">${positive?'Saldo positivo':'Saldo negativo'}</div>`; cards.appendChild(div); }); }
  }

  function initNav(){
    const nav = qs('#nav');
    const sections = { dashboard: qs('#tab-dashboard'), salarios: qs('#tab-salarios'), fixas: qs('#tab-fixas'), dividas: qs('#tab-dividas'), gastos: qs('#tab-gastos'), transferencias: qs('#tab-transferencias'), categorias: qs('#tab-categorias'), contas: qs('#tab-contas') };
    function activate(tab){
      qsa('.nav a').forEach(a=> a.classList.toggle('active', a.dataset.tab===tab));
      Object.entries(sections).forEach(([k,el])=> el && el.classList.toggle('hidden', k!==tab));
      if(tab==='dashboard') renderDashboard();
      if(tab==='contas'){ wireContas(); renderContas(); }
      if(tab==='gastos'){ wireGastos(); renderGastos(); }
      if(tab==='salarios'){ wireSalarios(); renderSalarios(); }
      if(tab==='transferencias'){ wireTransfers(); renderTransfers(); }
      if(tab==='categorias'){ wireCategorias(); renderCategorias(); }
      if(tab==='fixas'){ wireFixas(); renderFixas(); }
      if(tab==='dividas'){ wireDividas(); renderDividas(); }
    }
    nav.addEventListener('click', (e)=>{
      const a=e.target.closest('a[data-tab]'); if(!a) return;
      e.preventDefault(); activate(a.dataset.tab); history.replaceState(null,'',`#${a.dataset.tab}`);
    });
    const hash=location.hash.replace('#',''); const allowed=['dashboard','salarios','fixas','dividas','gastos','transferencias','categorias','contas']; const initial = allowed.includes(hash)?hash:'dashboard'; activate(initial);
  }

  // === Modal ===
  const modal = {
    open(opts){
      this.opts = opts;
      qs('#modalTitle').textContent = opts.title || 'Editar';
      const form=qs('#modalForm');
      form.innerHTML='';
      form.onsubmit = (ev)=>{
        ev.preventDefault();
        const data=Object.fromEntries(new FormData(form).entries());
        if(opts.onSubmit) opts.onSubmit(data);
        modal.close();
      };
      form.append(...opts.fields.map(renderField));
      const bd=qs('#backdrop'); bd.style.display='flex'; bd.style.alignItems='center'; bd.style.justifyContent='center';
    },
    close(){ qs('#backdrop').style.display='none'; this.opts=null; }
  };

  function renderField(f){
    const wrap=document.createElement('div'); const id=f.id||`f_${uid()}`;
    const label=document.createElement('label'); label.htmlFor=id; label.textContent=f.label||'';
    let input;
    if(f.type==='textarea'){ input=document.createElement('textarea'); if(f.rows) input.rows=f.rows; }
    else if(f.type==='select'){ input=document.createElement('select'); (f.options||[]).forEach(opt=>{ const o=document.createElement('option'); if(typeof opt==='string'){ o.value=opt; o.textContent=opt; } else { o.value=opt.value; o.textContent=opt.label; } if(f.value!=null && String(f.value)===String(o.value)) o.selected=true; input.appendChild(o); }); }
    else { input=document.createElement('input'); input.type=f.type||'text'; if(f.step) input.step=f.step; if(f.type==='date' && f.value){ input.value = toISO(f.value); } }
    input.id=id; input.name=f.name||id; if(f.placeholder) input.placeholder=f.placeholder; if(f.value!=null && input.type!=='date') input.value=f.value; if(f.required) input.required=true;
    const col=document.createElement('div'); col.append(label,input); wrap.append(col); return wrap;
  }
  function wireModalButtons(){ qs('#modalClose').addEventListener('click', ()=> modal.close()); qs('#modalCancel').addEventListener('click', ()=> modal.close()); qs('#backdrop').addEventListener('click', (e)=>{ if(e.target.id==='backdrop') modal.close(); }); }

  // === Contas ===
  function renderContas(){
    const tbody=qs('#tblContas tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.contas.forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${c.titular}</td><td>${c.banco}</td><td>${c.tipo}</td>
        <td class="actions"><button class="btn ghost" data-act="edit-conta" data-id="${c.id}">Editar</button>
        <button class="btn danger" data-act="del-conta" data-id="${c.id}">Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }

  let contasWired=false;
  function wireContas(){
    if(contasWired) return;
    const newBtn=qs('#btnNewConta'); const table=qs('#tblContas'); if(!newBtn||!table) return;

    newBtn.addEventListener('click', ()=>{
      modal.open({
        title:'Nova conta',
        fields:[
          { label:'Titular (pessoa)', name:'titular', type:'text', required:true, placeholder:'Ex.: Giseli' },
          { label:'E-mail', name:'email', type:'email', required:false, placeholder:'exemplo@dominio.com' },
          { label:'Banco', name:'banco', type:'text', required:true, placeholder:'Ex.: AIB' },
          { label:'Tipo', name:'tipo', type:'select', options:['Corrente','Poupança','Cartão','Outro'], value:'Corrente' }
        ],
        onSubmit: async (data)=>{
          const rec = { titular:data.titular, email:(data.email||'').trim(), banco:data.banco, tipo:data.tipo };
          console.log('[UI] Salvando Conta', { via: SB ? 'supabase' : 'local', rec });
          if (SB) {
            try { const saved = await SB.contas.insert(rec); state.contas.unshift(saved); }
            catch(e){ console.error('[SB] Erro insert conta', e); alert('Erro ao salvar no Supabase: ' + (e.message || e)); return; }
          } else {
            state.contas.unshift({ id:uid(), ...rec }); persist();
          }
          renderContas(); renderDashboard();
        }
      });
    });

    table.addEventListener('click', async (e)=>{
      const btn=e.target.closest('button[data-act]'); if(!btn) return;
      const id=btn.dataset.id; const act=btn.dataset.act;
      if(act==='del-conta'){
        if(!confirm('Tem certeza que deseja excluir esta conta?')) return;
        if (SB) { try { await SB.contas.remove(id); } catch(e){ console.error('[SB] Erro delete conta', e); alert('Erro ao excluir no Supabase: ' + (e.message || e)); return; } }
        state.contas = state.contas.filter(c=> c.id!==id); if(!SB) persist(); renderContas(); renderDashboard();
      } else if(act==='edit-conta'){
        const c=state.contas.find(x=> x.id===id); if(!c) return;
        modal.open({
          title:'Editar conta',
          fields:[
            { label:'Titular (pessoa)', name:'titular', type:'text', required:true, value:c.titular },
            { label:'E-mail', name:'email', type:'email', required:false, value:c.email||'' },
            { label:'Banco', name:'banco', type:'text', required:true, value:c.banco },
            { label:'Tipo', name:'tipo', type:'select', options:['Corrente','Poupança','Cartão','Outro'], value:c.tipo }
          ],
          onSubmit: async (data)=>{
            const patch = { titular:data.titular, email:(data.email||'').trim(), banco:data.banco, tipo:data.tipo };
            console.log('[UI] Atualizando Conta', { via: SB ? 'supabase' : 'local', patch });
            if (SB) {
              try { const updated = await SB.contas.update(c.id, patch); Object.assign(c, updated); }
              catch(e){ console.error('[SB] Erro update conta', e); alert('Erro ao atualizar no Supabase: ' + (e.message || e)); return; }
            } else {
              Object.assign(c, patch); persist();
            }
            renderContas(); renderDashboard();
          }
        });
      }
    });
    contasWired=true;
  }

  // === Gastos ===
  function renderGastos(){
    const tbody=qs('#tblGastos tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.gastos.forEach(g=>{
      const conta = contaById(g.conta_id);
      const banco = g.banco || (conta? conta.banco : '');
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${fmtDate(g.data||'')}</td><td>${g.titular||''}</td><td>${banco}</td><td>${g.descricao||''}</td><td>${fmtEUR(g.valor)}</td>
        <td><span class="pill">${g.status||'aberta'}</span></td>
        <td class="actions">
          <button class="btn ghost" data-act="edit-gasto" data-id="${g.id}">Editar</button>
          <button class="btn danger" data-act="del-gasto" data-id="${g.id}">Excluir</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  let gastosWired=false;
  function wireGastos(){
    if(gastosWired) return;
    const btn=qs('#btnNewGasto'); if(btn){
      btn.addEventListener('click', ()=>{
        const people=pessoasFromContas(); const contas=contasOptions();
        modal.open({
          title:'Novo gasto',
          fields:[
            { label:'Data', name:'data', type:'date', required:true, value:todayISO() },
            { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] },
            { label:'Conta', name:'conta_id', type:'select', options: contas },
            { label:'Descrição', name:'descricao', type:'textarea', rows:3 },
            { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true },
            { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' }
          ],
          onSubmit: async (data)=>{
            const rec = {
              data: toISO(data.data),
              titular: data.titular,
              conta_id: data.conta_id || null,
              descricao: data.descricao || '',
              valor: Number(data.valor||0),
              status: data.status || 'aberta'
            };
            console.log('[UI] Salvando Gasto', { via: SB ? 'supabase' : 'local', rec });
            if (SB){
              try{
                const saved = await SB.gastos.insert(rec);
                state.gastos.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert gasto', e); alert('Erro ao salvar gasto no Supabase: ' + (e.message||e)); return; }
            } else {
              state.gastos.unshift({ id:uid(), ...rec });
              persist();
            }
            renderGastos(); renderDashboard();
          }
        });
      });
    }
    const table=qs('#tblGastos'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        const id=btn.dataset.id; const act=btn.dataset.act;
        if(act==='del-gasto'){
          if(!confirm('Excluir este gasto?')) return;
          if(SB){ try{ await SB.gastos.remove(id); }catch(e){ console.error('[SB] Erro delete gasto', e); alert('Erro ao excluir no Supabase: ' + (e.message||e)); return; } }
          state.gastos = state.gastos.filter(g=> g.id!==id);
          if(!SB) persist();
          renderGastos(); renderDashboard();
        } else if(act==='edit-gasto'){
          const g=state.gastos.find(x=> x.id===id); if(!g) return;
          const people=pessoasFromContas(); const contas=contasOptions();
          modal.open({
            title:'Editar gasto',
            fields:[
              { label:'Data', name:'data', type:'date', required:true, value:g.data },
              { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:g.titular },
              { label:'Conta', name:'conta_id', type:'select', options: contas, value:g.conta_id||'' },
              { label:'Descrição', name:'descricao', type:'textarea', rows:3, value:g.descricao||'' },
              { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:g.valor },
              { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:g.status||'aberta' }
            ],
            onSubmit: async (data)=>{
              const patch = {
                data: toISO(data.data),
                titular: data.titular,
                conta_id: data.conta_id || null,
                descricao: data.descricao || '',
                valor: Number(data.valor||0),
                status: data.status || 'aberta'
              };
              console.log('[UI] Atualizando Gasto', { via: SB ? 'supabase' : 'local', patch });
              if(SB){
                try{
                  const updated = await SB.gastos.update(g.id, patch);
                  Object.assign(g, updated);
                }catch(e){ console.error('[SB] Erro update gasto', e); alert('Erro ao atualizar no Supabase: ' + (e.message||e)); return; }
              } else {
                Object.assign(g, patch); persist();
              }
              renderGastos(); renderDashboard();
            }
          });
        }
      });
    }
    gastosWired=true;
  }

  // === Salários ===
  function renderSalarios(){
    const tbody=qs('#tblSalarios tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.salarios.forEach(s=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${fmtDate(s.data)}</td><td>${s.titular}</td><td>${s.banco}</td><td>${s.horas??''}</td><td>${fmtEUR(s.valor)}</td>
        <td class="actions">
          <button class="btn danger" data-act="del-salario" data-id="${s.id}">Excluir</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  let salariosWired=false;
  function wireSalarios(){
    if(salariosWired) return;
    const btn=qs('#btnNewSalario'); if(btn){
      btn.addEventListener('click', ()=>{
        const people=pessoasFromContas(); const bancos=Array.from(new Set(state.contas.map(c=> c.banco))).map(b=> String(b));
        modal.open({
          title:'Novo salário',
          fields:[
            { label:'Data', name:'data', type:'date', required:true, value:todayISO() },
            { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] },
            { label:'Banco', name:'banco', type:'select', options: bancos.length?bancos:['AIB','Revolut'] },
            { label:'Horas', name:'horas', type:'number', step:'1' },
            { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }
          ],
          onSubmit: async (data)=>{
            const rec = {
              data: toISO(data.data),
              titular: data.titular,
              banco: data.banco,
              horas: data.horas ? Number(data.horas) : null,
              valor: Number(data.valor||0)
            };
            console.log('[UI] Salvando Salário', { via: SB ? 'supabase' : 'local', rec });
            if (SB){
              try{
                const saved = await SB.salarios.insert(rec);
                state.salarios.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert salario', e); alert('Erro ao salvar salário no Supabase: ' + (e.message||e)); return; }
            } else {
              state.salarios.unshift({ id:uid(), ...rec });
              persist();
            }
            renderSalarios(); renderDashboard();
          }
        });
      });
    }
    const table=qs('#tblSalarios'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        if(btn.dataset.act==='del-salario'){
          if(!confirm('Tem certeza que deseja excluir este salário?')) return;
          const id=btn.dataset.id;
          if(SB){ try{ await SB.salarios.remove(id); }catch(e){ console.error('[SB] Erro delete salario', e); alert('Erro ao excluir no Supabase: ' + (e.message||e)); return; } }
          state.salarios = state.salarios.filter(s=> s.id!==id);
          if(!SB) persist();
          renderSalarios(); renderDashboard();
        }
      });
    }
    salariosWired=true;
  }

  // === Categorias ===
  function renderCategorias(){
    const tbody=qs('#tblCategorias tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.categorias.forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${c.nome}</td><td>${c.tipo}</td>
        <td class="actions"><button class="btn danger" data-act="del-categoria" data-id="${c.id}">Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }
  let categoriasWired=false;
  function wireCategorias(){
    if(categoriasWired) return;
    const btn=qs('#btnNewCategoria'); if(btn){
      btn.addEventListener('click', async ()=>{
        modal.open({
          title:'Nova categoria',
          fields:[
            { label:'Nome', name:'nome', type:'text', required:true },
            { label:'Tipo', name:'tipo', type:'select', options:['entrada','saida'], value:'saida' }
          ],
          onSubmit: async (data)=>{
            const rec = { nome:data.nome, tipo:data.tipo };
            if (SB){
              try{
                const saved = await SB.categorias.insert(rec);
                state.categorias.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert categoria', e); alert('Erro ao salvar categoria no Supabase: ' + (e.message||e)); return; }
            } else {
              state.categorias.unshift({ id:uid(), ...rec });
              persist();
            }
            renderCategorias();
          }
        });
      });
    }
    const table=qs('#tblCategorias'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        if(btn.dataset.act==='del-categoria'){
          if(!confirm('Excluir esta categoria?')) return;
          const id=btn.dataset.id;
          if (SB){
            try{ await SB.categorias.remove(id); }
            catch(e){ console.error('[SB] Erro delete categoria', e); alert('Erro ao excluir categoria no Supabase: ' + (e.message||e)); return; }
          }
          state.categorias = state.categorias.filter(c=> c.id!==id);
          if(!SB) persist();
          renderCategorias();
        }
      });
    }
    categoriasWired=true;
  }

  // === Transferências ===
  function renderTransfers(){
    const tbody=qs('#tblTransfers tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.transferencias.forEach(t=>{
      const cDe = contaById(t.de_id);
      const cPara = contaById(t.para_id);
      const deLabel = cDe ? `${cDe.titular} - ${cDe.tipo} (${cDe.banco})` : '-';
      const paraLabel = cPara ? `${cPara.titular} - ${cPara.tipo} (${cPara.banco})` : '-';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${fmtDate(t.data)}</td><td><span class="pill">${t.tipo}</span></td><td>${deLabel}</td><td>${paraLabel}</td><td>${fmtEUR(t.valor)}</td><td>${t.descricao||''}</td>
        <td class="actions"><button class="btn danger" data-act="del-transfer" data-id="${t.id}">Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }
  let transfersWired=false;
  function wireTransfers(){
    if(transfersWired) return;
    const btn=qs('#btnNewTransfer'); if(btn){
      btn.addEventListener('click', ()=>{
        const contas=contasOptions();
        modal.open({
          title:'Nova transferência',
          fields:[
            { label:'Data', name:'data', type:'date', required:true, value:todayISO() },
            { label:'Tipo', name:'tipo', type:'select', options:['Transferência','Despesa','Receita'], value:'Transferência' },
            { label:'De (conta)', name:'de_id', type:'select', options: contas },
            { label:'Para (conta)', name:'para_id', type:'select', options: contas },
            { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true },
            { label:'Descrição', name:'descricao', type:'textarea', rows:3 }
          ],
          onSubmit: async (data)=>{
            const rec = {
              data: toISO(data.data),
              tipo: data.tipo,
              de_id: data.de_id || null,
              para_id: data.para_id || null,
              valor: Number(data.valor || 0),
              descricao: data.descricao || ''
            };
            if (SB){
              try{
                const saved = await SB.transferencias.insert(rec);
                state.transferencias.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert transferência', e); alert('Erro ao salvar transferência no Supabase: ' + (e.message||e)); return; }
            } else {
              state.transferencias.unshift({ id:uid(), ...rec });
              persist();
            }
            renderTransfers(); renderDashboard();
          }
        });
      });
    }
    const table=qs('#tblTransfers'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        if(btn.dataset.act==='del-transfer'){
          if(!confirm('Tem certeza que deseja excluir esta transferência?')) return;
          const id=btn.dataset.id;
          if (SB){
            try{ await SB.transferencias.remove(id); }
            catch(e){ console.error('[SB] Erro delete transferência', e); alert('Erro ao excluir transferência no Supabase: ' + (e.message||e)); return; }
          }
          state.transferencias = state.transferencias.filter(t=> t.id!==id);
          if(!SB) persist();
          renderTransfers(); renderDashboard();
        }
      });
    }
    transfersWired=true;
  }

  // === Fixas ===
  const SEMANAS=['1','2','3','4','5'];
  function renderFixas(){
    const tbody=qs('#tblFixas tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.fixas.forEach(f=>{
      const regra=(f.semana)? `${f.semana}ª`:'';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${f.nome}</td><td>${f.titular}</td><td>${fmtEUR(f.valor)}</td><td>${fmtDate(f.data||'')}</td><td>${regra}</td>
        <td><span class="pill">${f.status||'aberta'}</span></td>
        <td class="actions"><button class="btn ghost" data-act="edit-fixa" data-id="${f.id}">Editar</button>
        <button class="btn danger" data-act="del-fixa" data-id="${f.id}">Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }
  let fixasWired=false;
  function wireFixas(){
    if(fixasWired) return;
    const btn=qs('#btnNewFixa'); if(btn){
      const people=pessoasFromContas();
      btn.addEventListener('click', ()=>{
        modal.open({
          title:'Nova despesa fixa',
          fields:[
            { label:'Nome', name:'nome', type:'text', required:true },
            { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] },
            { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true },
            { label:'Data (opcional)', name:'data', type:'date' },
            { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:'1' },
            { label:'Observações', name:'obs', type:'textarea', rows:3 },
            { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' }
          ],
          onSubmit: async (data)=>{
            const rec = {
              nome:data.nome,
              titular:data.titular,
              valor:Number(data.valor||0),
              data: data.data? toISO(data.data):'',
              semana:data.semana||'',
              status:data.status||'aberta',
              obs:data.obs||''
            };
            if (SB){
              try{
                const saved = await SB.fixas.insert(rec);
                state.fixas.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert fixa', e); alert('Erro ao salvar fixa no Supabase: ' + (e.message||e)); return; }
            } else {
              state.fixas.unshift({ id:uid(), ...rec });
              persist();
            }
            renderFixas(); renderDashboard();
          }
        });
      });
    }
    const table=qs('#tblFixas'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        const id=btn.dataset.id; const act=btn.dataset.act;
        if(act==='del-fixa'){
          if(!confirm('Tem certeza que deseja excluir esta despesa fixa?')) return;
          if (SB){
            try{ await SB.fixas.remove(id); }
            catch(e){ console.error('[SB] Erro delete fixa', e); alert('Erro ao excluir fixa no Supabase: ' + (e.message||e)); return; }
          }
          state.fixas = state.fixas.filter(f=> f.id!==id);
          if(!SB) persist();
          renderFixas(); renderDashboard();
        } else if(act==='edit-fixa'){
          const f=state.fixas.find(x=> x.id===id); if(!f) return;
          const people=pessoasFromContas();
          modal.open({
            title:'Editar despesa fixa',
            fields:[
              { label:'Nome', name:'nome', type:'text', required:true, value:f.nome },
              { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:f.titular },
              { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:f.valor },
              { label:'Data (opcional)', name:'data', type:'date', value:f.data },
              { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:f.semana||'1' },
              { label:'Observações', name:'obs', type:'textarea', rows:3, value:f.obs||'' },
              { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:f.status||'aberta' }
            ],
            onSubmit: async (data)=>{
              const patch = {
                nome:data.nome,
                titular:data.titular,
                valor:Number(data.valor||0),
                data:data.data? toISO(data.data):'',
                semana:data.semana||'',
                status:data.status||'aberta',
                obs:data.obs||''
              };
              if (SB){
                try{
                  const updated = await SB.fixas.update(f.id, patch);
                  Object.assign(f, updated);
                }catch(e){ console.error('[SB] Erro update fixa', e); alert('Erro ao atualizar fixa no Supabase: ' + (e.message||e)); return; }
              } else {
                Object.assign(f, patch); persist();
              }
              renderFixas(); renderDashboard();
            }
          });
        }
      });
    }
    fixasWired=true;
  }

  // === Dívidas ===
  function renderDividas(){
    const tbody=qs('#tblDividas tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.dividas.forEach(d=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${d.nome||''}</td><td>${d.titular||''}</td><td>${fmtEUR(d.valor)}</td><td>${fmtDate(d.vencimento||'')}</td>
        <td><span class="pill">${d.status||''}</span></td>
        <td class="actions"><button class="btn ghost" data-act="edit-divida" data-id="${d.id}">Editar</button>
        <button class="btn danger" data-act="del-divida" data-id="${d.id}">Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }
  let dividasWired=false;
  function wireDividas(){
    if(dividasWired) return;
    const btn=qs('#btnNewDivida'); if(btn){
      const people=pessoasFromContas();
      btn.addEventListener('click', ()=>{
        modal.open({
          title:'Nova dívida',
          fields:[
            { label:'Nome da dívida', name:'nome', type:'text', required:true },
            { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] },
            { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true },
            { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:'1' },
            { label:'Vencimento (opcional)', name:'vencimento', type:'date' },
            { label:'Observações', name:'obs', type:'textarea', rows:3 },
            { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' }
          ],
          onSubmit: async (data)=>{
            const rec = {
              nome:data.nome,
              titular:data.titular||'',
              valor:Number(data.valor||0),
              semana:data.semana||'',
              vencimento:data.vencimento? toISO(data.vencimento):'',
              status:data.status||'aberta',
              obs:data.obs||''
            };
            if (SB){
              try{
                const saved = await SB.dividas.insert(rec);
                state.dividas.unshift(saved);
              }catch(e){ console.error('[SB] Erro insert divida', e); alert('Erro ao salvar dívida no Supabase: ' + (e.message||e)); return; }
            } else {
              state.dividas.unshift({ id:uid(), ...rec });
              persist();
            }
            renderDividas(); renderDashboard();
          }
        });
      });
    }
    const table=qs('#tblDividas'); if(table){
      table.addEventListener('click', async (e)=>{
        const btn=e.target.closest('button[data-act]'); if(!btn) return;
        const id=btn.dataset.id; const act=btn.dataset.act;
        if(act==='del-divida'){
          if(!confirm('Tem certeza que deseja excluir esta dívida?')) return;
          if (SB){
            try{ await SB.dividas.remove(id); }
            catch(e){ console.error('[SB] Erro delete divida', e); alert('Erro ao excluir dívida no Supabase: ' + (e.message||e)); return; }
          }
          state.dividas = state.dividas.filter(d=> d.id!==id);
          if(!SB) persist();
          renderDividas(); renderDashboard();
        } else if(act==='edit-divida'){
          const d=state.dividas.find(x=> x.id===id); if(!d) return;
          const people=pessoasFromContas();
          modal.open({
            title:'Editar dívida',
            fields:[
              { label:'Nome da dívida', name:'nome', type:'text', required:true, value:d.nome },
              { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:d.titular },
              { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:d.valor },
              { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:d.semana||'1' },
              { label:'Vencimento (opcional)', name:'vencimento', type:'date', value:d.vencimento },
              { label:'Observações', name:'obs', type:'textarea', rows:3, value:d.obs||'' },
              { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:d.status||'aberta' }
            ],
            onSubmit: async (data)=>{
              const patch = {
                nome:data.nome,
                titular:data.titular||'',
                valor:Number(data.valor||0),
                semana:data.semana||'',
                vencimento:data.vencimento? toISO(data.vencimento):'',
                status:data.status||'aberta',
                obs:data.obs||''
              };
              if (SB){
                try{
                  const updated = await SB.dividas.update(d.id, patch);
                  Object.assign(d, updated);
                }catch(e){ console.error('[SB] Erro update divida', e); alert('Erro ao atualizar dívida no Supabase: ' + (e.message||e)); return; }
              } else {
                Object.assign(d, patch); persist();
              }
              renderDividas(); renderDashboard();
            }
          });
        }
      });
    }
    dividasWired=true;
  }

  function wireSair(){ const btn=qs('#btnSair'); if(btn){ btn.addEventListener('click', ()=>{ if(!confirm('Sair e limpar sessão local?')) return; location.href='login.html'; }); } }

  // === Init ===
  async function init(){
    load();

    if(SB){
      try{ state.contas = await SB.contas.list(); }catch(e){ console.warn('Falha contas SB, usando local', e.message||e); }
      try{ state.gastos = await SB.gastos.list(); }catch(e){ console.warn('Falha gastos SB, usando local', e.message||e); }
      try{ state.salarios = await SB.salarios.list(); }catch(e){ console.warn('Falha salarios SB, usando local', e.message||e); }

      try{ state.fixas = await SB.fixas.list(); }catch(e){ console.warn('Falha fixas SB, usando local', e.message||e); }
      try{ state.dividas = await SB.dividas.list(); }catch(e){ console.warn('Falha dividas SB, usando local', e.message||e); }
      try{ state.categorias = await SB.categorias.list(); }catch(e){ console.warn('Falha categorias SB, usando local', e.message||e); }
      try{ state.transferencias = await SB.transferencias.list(); }catch(e){ console.warn('Falha transferencias SB, usando local', e.message||e); }
    } else {
      console.warn('[SB] Inativo — operando em LocalStorage');
    }

    initNav();
    wireModalButtons();
    wireSair();
    renderDashboard();
  }
  document.addEventListener('DOMContentLoaded', ()=> { init(); });
})();
