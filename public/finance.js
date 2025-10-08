(function () {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const fmtEUR = (n) => (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const STORAGE_KEY = "finpilot_ie_v1";

  const state = { contas: [], gastos: [], salarios: [], transferencias: [], categorias: [], fixas: [], dividas: [] };

  function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function today(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        state.contas = [ { id: uid(), titular: "Giseli", banco: "AIB", tipo: "Corrente" }, { id: uid(), titular: "FR", banco: "Revolut", tipo: "Poupança" } ];
        state.categorias = [ { id: uid(), nome: "Aluguel", tipo: "despesa" } ];
        state.salarios = [ { id: uid(), data: today(), titular: "Giseli", banco: "AIB", horas: 40, valor: 500 } ];
        state.fixas = [ { id: uid(), nome: "Internet", titular: "FR", valor: 40, data: today(), semana: "1", dia: "Qui", status: "aberta" } ];
        state.gastos = [ { id: uid(), data: today(), titular: "FR", banco: "AIB", descricao: "Supermercado", valor: 35.9, status: "aberta" } ];
        persist(); return;
      }
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
      if(!Array.isArray(state.contas)) state.contas = [];
      // Migrate old entries to include status
      state.gastos.forEach(g=>{ if(!g.status) g.status='aberta'; });
      state.fixas.forEach(f=>{ if(!f.status) f.status='aberta'; });
    }catch(e){ console.error('Erro ao carregar storage', e); }
  }

  function pessoasFromContas(){ const set=new Set(state.contas.map(c=> (c.titular||'').trim()).filter(Boolean)); return Array.from(set); }
  function contasOptions(){ return state.contas.map(c=>({ value:c.id, label:`${c.titular} - ${c.tipo} (${c.banco})` })); }
  function contaById(id){ return state.contas.find(c=> c.id===id); }

  function initNav(){
    const nav = qs('#nav');
    const sections = {
      dashboard: qs('#tab-dashboard'), salarios: qs('#tab-salarios'), fixas: qs('#tab-fixas'), dividas: qs('#tab-dividas'), gastos: qs('#tab-gastos'), transferencias: qs('#tab-transferencias'), categorias: qs('#tab-categorias'), contas: qs('#tab-contas') };

    function activate(tab){
      qsa('.nav a').forEach(a=> a.classList.toggle('active', a.dataset.tab===tab));
      Object.entries(sections).forEach(([k,el])=> el && el.classList.toggle('hidden', k!==tab));
      if(tab==='contas'){ wireContas(); renderContas(); }
      if(tab==='gastos') renderGastos();
      if(tab==='salarios') renderSalarios();
      if(tab==='transferencias') renderTransfers();
      if(tab==='categorias') renderCategorias();
      if(tab==='fixas') renderFixas();
      if(tab==='dividas') renderDividas();
    }

    nav.addEventListener('click', (e)=>{ const a=e.target.closest('a[data-tab]'); if(!a) return; e.preventDefault(); activate(a.dataset.tab); history.replaceState(null,'',`#${a.dataset.tab}`); });

    const hash = location.hash.replace('#','');
    const allowed=['dashboard','salarios','fixas','dividas','gastos','transferencias','categorias','contas'];
    const initial = allowed.includes(hash)?hash:'dashboard';
    activate(initial);
  }

  const modal = {
    open(opts){ this.opts = opts; qs('#modalTitle').textContent = opts.title || 'Editar'; const form=qs('#modalForm'); form.innerHTML=''; form.onsubmit = (ev)=>{ ev.preventDefault(); const data=Object.fromEntries(new FormData(form).entries()); if(opts.onSubmit) opts.onSubmit(data); modal.close(); }; form.append(...opts.fields.map(renderField)); qs('#backdrop').style.display='flex'; },
    close(){ qs('#backdrop').style.display='none'; this.opts=null; }
  };

  function renderField(f){ const wrap=document.createElement('div'); wrap.className=f.full?"":"row"; const col=document.createElement('div'); col.className='col'; const id=f.id||`f_${uid()}`; const label=document.createElement('label'); label.htmlFor=id; label.textContent=f.label||''; let input; if(f.type==='textarea'){ input=document.createElement('textarea'); if(f.rows) input.rows=f.rows; } else if(f.type==='select'){ input=document.createElement('select'); (f.options||[]).forEach(opt=>{ const o=document.createElement('option'); if(typeof opt==='string'){ o.value=opt; o.textContent=opt; } else { o.value=opt.value; o.textContent=opt.label; } if(f.value!=null && String(f.value)===String(o.value)) o.selected=true; input.appendChild(o); }); } else { input=document.createElement('input'); input.type=f.type||'text'; if(f.step) input.step=f.step; } input.id=id; input.name=f.name||id; if(f.placeholder) input.placeholder=f.placeholder; if(f.value!=null) input.value=f.value; if(f.required) input.required=true; col.append(label,input); wrap.append(col); return wrap; }

  function wireModalButtons(){ qs('#modalClose').addEventListener('click', ()=> modal.close()); qs('#modalCancel').addEventListener('click', ()=> modal.close()); qs('#backdrop').addEventListener('click', (e)=>{ if(e.target.id==='backdrop') modal.close(); }); }

  function renderContas(){ const tbody=qs('#tblContas tbody'); if(!tbody) return; tbody.innerHTML=''; state.contas.forEach(c=>{ const tr=document.createElement('tr'); tr.innerHTML = `
      <td>${c.titular}</td>
      <td>${c.banco}</td>
      <td>${c.tipo}</td>
      <td class="actions">
        <button class="btn ghost" data-act="edit-conta" data-id="${c.id}">Editar</button>
        <button class="btn danger" data-act="del-conta" data-id="${c.id}">Excluir</button>
      </td>`; tbody.appendChild(tr); }); }

  let contasWired=false;
  function wireContas(){ if(contasWired) return; const newBtn=qs('#btnNewConta'); const table=qs('#tblContas'); if(!newBtn||!table) return; newBtn.addEventListener('click', ()=>{ modal.open({ title:'Nova conta', fields:[ { label:'Titular (pessoa)', name:'titular', type:'text', required:true, placeholder:'Ex.: Giseli' }, { label:'Banco', name:'banco', type:'text', required:true, placeholder:'Ex.: AIB' }, { label:'Tipo', name:'tipo', type:'select', options:['Corrente','Poupança','Cartão','Outro'], value:'Corrente' } ], onSubmit:(data)=>{ state.contas.unshift({ id:uid(), titular:data.titular, banco:data.banco, tipo:data.tipo }); persist(); renderContas(); } }); }); table.addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-conta'){ if(!confirm('Tem certeza que deseja excluir esta conta?')) return; state.contas = state.contas.filter(c=> c.id!==id); persist(); renderContas(); } else if(act==='edit-conta'){ const c=state.contas.find(x=> x.id===id); if(!c) return; modal.open({ title:'Editar conta', fields:[ { label:'Titular (pessoa)', name:'titular', type:'text', required:true, value:c.titular }, { label:'Banco', name:'banco', type:'text', required:true, value:c.banco }, { label:'Tipo', name:'tipo', type:'select', options:['Corrente','Poupança','Cartão','Outro'], value:c.tipo } ], onSubmit:(data)=>{ Object.assign(c, { titular:data.titular, banco:data.banco, tipo:data.tipo }); persist(); renderContas(); } }); } }); contasWired=true; }

  // GASTOS (with status)
  function renderGastos(){ const tbody=qs('#tblGastos tbody'); if(!tbody) return; tbody.innerHTML=''; state.gastos.forEach(g=>{ const tr=document.createElement('tr'); tr.innerHTML=`
        <td>${g.data||''}</td><td>${g.titular||''}</td><td>${g.banco||''}</td><td>${g.descricao||''}</td><td>${fmtEUR(g.valor)}</td><td><span class="pill">${g.status||'aberta'}</span></td>
        <td class="actions"><button class="btn ghost" data-act="edit-gasto" data-id="${g.id}">Editar</button><button class="btn danger" data-act="del-gasto" data-id="${g.id}">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireGastos(){ qs('#btnNewGasto').addEventListener('click', ()=>{ const people=pessoasFromContas(); const contas=contasOptions(); modal.open({ title:'Novo gasto', fields:[ { label:'Data', name:'data', type:'date', required:true, value:today() }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Banco (conta)', name:'banco_id', type:'select', options: contas }, { label:'Descrição', name:'descricao', type:'textarea', rows:3 }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ const conta = contaById(data.banco_id); state.gastos.unshift({ id:uid(), data:data.data, titular:data.titular, banco: conta? `${conta.banco}`:'', descricao:data.descricao||'', valor:Number(data.valor||0), conta_id:data.banco_id||null, status:data.status||'aberta' }); persist(); renderGastos(); } }); }); qs('#tblGastos').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-gasto'){ if(!confirm('Tem certeza que deseja excluir este gasto?')) return; state.gastos = state.gastos.filter(g=> g.id!==id); persist(); renderGastos(); } else if(act==='edit-gasto'){ const g=state.gastos.find(x=> x.id===id); if(!g) return; const people=pessoasFromContas(); const contas=contasOptions(); modal.open({ title:'Editar gasto', fields:[ { label:'Data', name:'data', type:'date', required:true, value:g.data }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:g.titular }, { label:'Banco (conta)', name:'banco_id', type:'select', options: contas, value:g.conta_id||'' }, { label:'Descrição', name:'descricao', type:'textarea', rows:3, value:g.descricao }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:g.valor }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:g.status||'aberta' } ], onSubmit:(data)=>{ const conta=contaById(data.banco_id); Object.assign(g, { data:data.data, titular:data.titular, banco: conta? `${conta.banco}`:'', descricao:data.descricao||'', valor:Number(data.valor||0), conta_id:data.banco_id||null, status:data.status||'aberta' }); persist(); renderGastos(); } }); } }); }

  // SALÁRIOS
  function renderSalarios(){ const tbody=qs('#tblSalarios tbody'); if(!tbody) return; tbody.innerHTML=''; state.salarios.forEach(s=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.data}</td><td>${s.titular}</td><td>${s.banco}</td><td>${s.horas??''}</td><td>${fmtEUR(s.valor)}</td><td class="actions"><button class="btn danger" data-act="del-salario" data-id="${s.id}">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireSalarios(){ qs('#btnNewSalario').addEventListener('click', ()=>{ const people=pessoasFromContas(); const bancos=Array.from(new Set(state.contas.map(c=> c.banco))).map(b=> String(b)); modal.open({ title:'Novo salário', fields:[ { label:'Data', name:'data', type:'date', required:true, value:today() }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Banco', name:'banco', type:'select', options: bancos.length?bancos:['AIB','Revolut'] }, { label:'Horas', name:'horas', type:'number', step:'1' }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true } ], onSubmit:(data)=>{ state.salarios.unshift({ id:uid(), data:data.data, titular:data.titular, banco:data.banco, horas: data.horas?Number(data.horas):undefined, valor:Number(data.valor||0) }); persist(); renderSalarios(); } }); }); qs('#tblSalarios').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; if(btn.dataset.act==='del-salario'){ if(!confirm('Tem certeza que deseja excluir este salário?')) return; const id=btn.dataset.id; state.salarios = state.salarios.filter(s=> s.id!==id); persist(); renderSalarios(); } }); }

  // TRANSFERÊNCIAS
  function renderTransfers(){ const tbody=qs('#tblTransfers tbody'); if(!tbody) return; tbody.innerHTML=''; state.transferencias.forEach(t=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${t.data}</td><td><span class=\"pill\">${t.tipo}</span></td><td>${t.de_label}</td><td>${t.para_label}</td><td>${fmtEUR(t.valor)}</td><td>${t.descricao||''}</td><td class=\"actions\"><button class=\"btn danger\" data-act=\"del-transfer\" data-id=\"${t.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireTransfers(){ qs('#btnNewTransfer').addEventListener('click', ()=>{ const contas=contasOptions(); modal.open({ title:'Nova transferência', fields:[ { label:'Data', name:'data', type:'date', required:true, value:today() }, { label:'Tipo', name:'tipo', type:'select', options:['Transferência','Despesa'], value:'Transferência' }, { label:'De (conta)', name:'de_id', type:'select', options: contas }, { label:'Para (conta)', name:'para_id', type:'select', options: contas }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Descrição', name:'descricao', type:'textarea', rows:3 } ], onSubmit:(data)=>{ const cDe=contaById(data.de_id); const cPara=contaById(data.para_id); state.transferencias.unshift({ id:uid(), data:data.data, tipo:data.tipo, de_id:data.de_id||null, para_id:data.para_id||null, de_label: cDe? `${cDe.titular} - ${cDe.tipo} (${cDe.banco})`:'-', para_label: cPara? `${cPara.titular} - ${cPara.tipo} (${cPara.banco})`:'-', valor:Number(data.valor||0), descricao:data.descricao||'' }); persist(); renderTransfers(); } }); }); qs('#tblTransfers').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; if(btn.dataset.act==='del-transfer'){ if(!confirm('Tem certeza que deseja excluir esta transferência?')) return; const id=btn.dataset.id; state.transferencias = state.transferencias.filter(t=> t.id!==id); persist(); renderTransfers(); } }); }

  // CATEGORIAS
  function renderCategorias(){ const tbody=qs('#tblCategorias tbody'); if(!tbody) return; tbody.innerHTML=''; state.categorias.forEach(c=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${c.nome}</td><td><span class=\"pill\">${c.tipo}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-categoria\" data-id=\"${c.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-categoria\" data-id=\"${c.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireCategorias(){ qs('#btnNewCategoria').addEventListener('click', ()=>{ modal.open({ title:'Nova categoria', fields:[ { label:'Nome', name:'nome', type:'text', required:true }, { label:'Tipo', name:'tipo', type:'select', options:['despesa','receita'], value:'despesa' } ], onSubmit:(data)=>{ state.categorias.unshift({ id:uid(), nome:data.nome, tipo:data.tipo }); persist(); renderCategorias(); } }); }); qs('#tblCategorias').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-categoria'){ if(!confirm('Tem certeza que deseja excluir esta categoria?')) return; state.categorias = state.categorias.filter(c=> c.id!==id); persist(); renderCategorias(); } else if(act==='edit-categoria'){ const c=state.categorias.find(x=> x.id===id); if(!c) return; modal.open({ title:'Editar categoria', fields:[ { label:'Nome', name:'nome', type:'text', required:true, value:c.nome }, { label:'Tipo', name:'tipo', type:'select', options:['despesa','receita'], value:c.tipo } ], onSubmit:(data)=>{ c.nome=data.nome; c.tipo=data.tipo; persist(); renderCategorias(); } }); } }); }

  // FIXAS (with status)
  const SEMANAS=['1','2','3','4','5']; const DIAS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  function renderFixas(){ const tbody=qs('#tblFixas tbody'); if(!tbody) return; tbody.innerHTML=''; state.fixas.forEach(f=>{ const regra=(f.semana&&f.dia)? `${f.semana}ª • ${f.dia}`:''; const tr=document.createElement('tr'); tr.innerHTML=`<td>${f.nome}</td><td>${f.titular}</td><td>${fmtEUR(f.valor)}</td><td>${f.data||''}</td><td>${regra}</td><td><span class="pill">${f.status||'aberta'}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-fixa\" data-id=\"${f.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-fixa\" data-id=\"${f.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireFixas(){ qs('#btnNewFixa').addEventListener('click', ()=>{ const people=pessoasFromContas(); modal.open({ title:'Nova despesa fixa', fields:[ { label:'Nome', name:'nome', type:'text', required:true }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Data (opcional)', name:'data', type:'date' }, { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:'1' }, { label:'Dia da semana', name:'dia', type:'select', options: DIAS, value:'Qua' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ state.fixas.unshift({ id:uid(), nome:data.nome, titular:data.titular, valor:Number(data.valor||0), data:data.data||'', semana:data.semana||'', dia:data.dia||'', status:data.status||'aberta' }); persist(); renderFixas(); } }); }); qs('#tblFixas').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-fixa'){ if(!confirm('Tem certeza que deseja excluir esta despesa fixa?')) return; state.fixas = state.fixas.filter(f=> f.id!==id); persist(); renderFixas(); } else if(act==='edit-fixa'){ const f=state.fixas.find(x=> x.id===id); if(!f) return; const people=pessoasFromContas(); modal.open({ title:'Editar despesa fixa', fields:[ { label:'Nome', name:'nome', type:'text', required:true, value:f.nome }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:f.titular }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:f.valor }, { label:'Data (opcional)', name:'data', type:'date', value:f.data }, { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:f.semana||'1' }, { label:'Dia da semana', name:'dia', type:'select', options: DIAS, value:f.dia||'Qua' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:f.status||'aberta' } ], onSubmit:(data)=>{ Object.assign(f,{ nome:data.nome, titular:data.titular, valor:Number(data.valor||0), data:data.data||'', semana:data.semana||'', dia:data.dia||'', status:data.status||'aberta' }); persist(); renderFixas(); } }); } }); }

  // DÍVIDAS
  function renderDividas(){ const tbody=qs('#tblDividas tbody'); if(!tbody) return; tbody.innerHTML=''; state.dividas.forEach(d=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.nome||''}</td><td>${d.titular||''}</td><td>${fmtEUR(d.valor)}</td><td>${d.vencimento||''}</td><td><span class=\"pill\">${d.status||''}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-divida\" data-id=\"${d.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-divida\" data-id=\"${d.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireDividas(){ qs('#btnNewDivida').addEventListener('click', ()=>{ const people=pessoasFromContas(); modal.open({ title:'Nova dívida', fields:[ { label:'Nome da dívida', name:'nome', type:'text', required:true }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Vencimento', name:'vencimento', type:'date' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ state.dividas.unshift({ id:uid(), nome:data.nome, titular:data.titular||'', valor:Number(data.valor||0), vencimento:data.vencimento||'', status:data.status||'aberta' }); persist(); renderDividas(); } }); }); qs('#tblDividas').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-divida'){ if(!confirm('Tem certeza que deseja excluir esta dívida?')) return; state.dividas = state.dividas.filter(d=> d.id!==id); persist(); renderDividas(); } else if(act==='edit-divida'){ const d=state.dividas.find(x=> x.id===id); if(!d) return; const people=pessoasFromContas(); modal.open({ title:'Editar dívida', fields:[ { label:'Nome da dívida', name:'nome', type:'text', required:true, value:d.nome }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:d.titular }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:d.valor }, { label:'Vencimento', name:'vencimento', type:'date', value:d.vencimento }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:d.status||'aberta' } ], onSubmit:(data)=>{ Object.assign(d,{ nome:data.nome, titular:data.titular||'', valor:Number(data.valor||0), vencimento:data.vencimento||'', status:data.status||'aberta' }); persist(); renderDividas(); } }); } }); }

  function wireSair(){ qs('#btnSair').addEventListener('click', ()=>{ if(!confirm('Sair e limpar sessão local?')) return; location.href='login.html'; }); }

  function init(){ load(); initNav(); wireModalButtons(); wireSair(); wireGastos(); wireSalarios(); wireTransfers(); wireCategorias(); wireFixas(); wireDividas(); }
  document.addEventListener('DOMContentLoaded', init);
})();
