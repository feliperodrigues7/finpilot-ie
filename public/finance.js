(function () {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const fmtEUR = (n) => (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const toISO = (ddmmaa) => {
    // aceita AAAA-MM-DD, retorna igual; aceita DD/MM/AAAA -> AAAA-MM-DD
    if (!ddmmaa) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(ddmmaa)) return ddmmaa;
    const m = ddmmaa.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return ddmmaa;
    return `${m[3]}-${m[2]}-${m[1]}`;
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
  const STORAGE_KEY = "finpilot_ie_v2";

  const state = { contas: [], gastos: [], salarios: [], transferencias: [], categorias: [], fixas: [], dividas: [] };

  function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function todayISO(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderDashboard(); }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        state.contas = [ { id: uid(), titular: "Giseli", banco: "AIB", tipo: "Corrente" }, { id: uid(), titular: "FR", banco: "Revolut", tipo: "Poupança" } ];
        state.categorias = [ { id: uid(), nome: "Aluguel", tipo: "despesa" } ];
        state.salarios = [ { id: uid(), data: todayISO(), titular: "Giseli", banco: "AIB", horas: 40, valor: 500 }, { id: uid(), data: todayISO(), titular: "FR", banco: "Revolut", horas: 40, valor: 450 } ];
        state.fixas = [ { id: uid(), nome: "Internet", titular: "FR", valor: 40, data: todayISO(), semana: "1", dia: "Qui", status: "paga" } ];
        state.gastos = [ { id: uid(), data: todayISO(), titular: "FR", banco: "AIB", descricao: "Supermercado", valor: 35.9, status: "paga" } ];
        state.dividas = [ { id: uid(), nome: "Pastel", titular: "FR", valor: 20, vencimento: todayISO(), status: "aberta" } ];
        state.transferencias = [ { id: uid(), data: todayISO(), tipo: 'Transferência', de_id: null, para_id: null, de_label: 'FR - Corrente (AIB)', para_label: 'Giseli - Poupança (Revolut)', valor: 100, descricao: 'Ajuste' } ];
        persist(); return;
      }
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
      // normalização básica
      state.gastos.forEach(g=>{ if(!g.status) g.status='aberta'; if(g.data) g.data = toISO(g.data); });
      state.fixas.forEach(f=>{ if(!f.status) f.status='aberta'; if(f.data) f.data = toISO(f.data); });
      state.salarios.forEach(s=>{ if(s.data) s.data = toISO(s.data); });
      state.dividas.forEach(d=>{ if(d.vencimento) d.vencimento = toISO(d.vencimento); });
      state.transferencias.forEach(t=>{ if(t.data) t.data = toISO(t.data); });
    }catch(e){ console.error('Erro ao carregar storage', e); }
  }

  function pessoasFromContas(){ const set=new Set(state.contas.map(c=> (c.titular||'').trim()).filter(Boolean)); return Array.from(set); }
  function contasOptions(){ return state.contas.map(c=>({ value:c.id, label:`${c.titular} - ${c.tipo} (${c.banco})` })); }
  function contaById(id){ return state.contas.find(c=> c.id===id); }

  // DASHBOARD
  function monthFilter(iso){ if(!iso) return true; const d=new Date(iso+'T12:00:00'); const now=new Date(); return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); }

  function computeBalances(){
    // chave = `${titular}||${banco}`
    const map = new Map();
    const add = (titular,banco,delta)=>{ const key=`${titular}||${banco}`; const cur=map.get(key)||0; map.set(key, cur + Number(delta||0)); };

    // Receitas: salários (crédito)
    state.salarios.forEach(s=> add(s.titular, s.banco, +s.valor));

    // Gastos pagos: débito
    state.gastos.filter(g=> (g.status||'')==='paga').forEach(g=> add(g.titular, g.banco, -g.valor));

    // Despesas fixas pagas: débito (atribui ao primeiro banco do titular)
    state.fixas.filter(f=> (f.status||'')==='paga').forEach(f=>{
      const conta = state.contas.find(c=> c.titular===f.titular) || { banco: '—' };
      add(f.titular, conta.banco, -f.valor);
    });

    // Dívidas pagas: débito (atribui ao primeiro banco do titular)
    state.dividas.filter(d=> (d.status||'')==='paga').forEach(d=>{
      const conta = state.contas.find(c=> c.titular===d.titular) || { banco: '—' };
      add(d.titular, conta.banco, -d.valor);
    });

    // Transferências: movimentam saldo conforme tipo
    state.transferencias.forEach(t=>{
      const tipo = (t.tipo||'').toLowerCase();
      const val = Number(t.valor||0);
      if(tipo==='transferência' || tipo==='transferencia'){
        const cDe = contaById(t.de_id);
        const cPara = contaById(t.para_id);
        if(cDe) add(cDe.titular, cDe.banco, -val);
        if(cPara) add(cPara.titular, cPara.banco, +val);
      } else if(tipo==='despesa'){
        const cDe = contaById(t.de_id);
        if(cDe) add(cDe.titular, cDe.banco, -val);
      } else if(tipo==='receita'){
        const cPara = contaById(t.para_id);
        if(cPara) add(cPara.titular, cPara.banco, +val);
      }
    });

    return Array.from(map.entries()).map(([key,val])=>{ const [titular,banco]=key.split('||'); return {titular,banco,saldo:val}; }).sort((a,b)=> a.titular.localeCompare(b.titular)||a.banco.localeCompare(b.banco));
  }

  function kpisMes(){
    let receitas=0, despesas=0;
    // salários
    state.salarios.filter(s=> monthFilter(s.data)).forEach(s=> receitas += Number(s.valor||0));
    // gastos pagos
    state.gastos.filter(g=> monthFilter(g.data) && (g.status||'')==='paga').forEach(g=> despesas += Number(g.valor||0));
    // fixas pagas
    state.fixas.filter(f=> monthFilter(f.data) && (f.status||'')==='paga').forEach(f=> despesas += Number(f.valor||0));
    // dívidas pagas
    state.dividas.filter(d=> monthFilter(d.vencimento) && (d.status||'')==='paga').forEach(d=> despesas += Number(d.valor||0));
    // transferências
    state.transferencias.filter(t=> monthFilter(t.data)).forEach(t=>{
      const tipo=(t.tipo||'').toLowerCase();
      const v=Number(t.valor||0);
      if(tipo==='despesa') despesas+=v;
      if(tipo==='receita') receitas+=v;
      // Transferência (entre contas) não altera KPIs globais de receita/ despesa
    });
    return { receitas, despesas, resultado: receitas - despesas };
  }

  function renderDashboard(){
    const rows = computeBalances();
    const tbody = qs('#tblDash tbody');
    if(tbody){ tbody.innerHTML=''; rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${r.titular}</td><td>${r.banco}</td><td><strong>${fmtEUR(r.saldo)}</strong></td>`; tbody.appendChild(tr); }); }
    const cards = qs('#dashCards');
    if(cards){ cards.innerHTML=''; rows.forEach(r=>{ const positive = (r.saldo||0) >= 0; const div=document.createElement('div'); div.className='card'; div.innerHTML = `<div class="title">${r.titular} • ${r.banco}</div><div class="value" style="color:${positive?'var(--ok)':'var(--danger)'}">${fmtEUR(r.saldo)}</div><div class="delta muted">${positive?'Saldo positivo':'Saldo negativo'}</div>`; cards.appendChild(div); }); const total = rows.reduce((s,x)=> s + x.saldo, 0); const resumo = qs('#resumoSaldo'); if(resumo) resumo.textContent = ` • Total geral: ${fmtEUR(total)}`; }
    const k = kpisMes();
    const r1 = qs('#kpiReceitas'); if(r1) r1.textContent = fmtEUR(k.receitas);
    const r2 = qs('#kpiDespesas'); if(r2) r2.textContent = fmtEUR(k.despesas);
    const r3 = qs('#kpiResultado'); if(r3) r3.textContent = fmtEUR(k.resultado);
  }

  function initNav(){
    const nav = qs('#nav');
    const sections = { dashboard: qs('#tab-dashboard'), salarios: qs('#tab-salarios'), fixas: qs('#tab-fixas'), dividas: qs('#tab-dividas'), gastos: qs('#tab-gastos'), transferencias: qs('#tab-transferencias'), categorias: qs('#tab-categorias'), contas: qs('#tab-contas') };

    function activate(tab){
      qsa('.nav a').forEach(a=> a.classList.toggle('active', a.dataset.tab===tab));
      Object.entries(sections).forEach(([k,el])=> el && el.classList.toggle('hidden', k!==tab));
      if(tab==='dashboard') renderDashboard();
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

  const modal = { open(opts){ this.opts = opts; qs('#modalTitle').textContent = opts.title || 'Editar'; const form=qs('#modalForm'); form.innerHTML=''; form.onsubmit = (ev)=>{ ev.preventDefault(); const data=Object.fromEntries(new FormData(form).entries()); if(opts.onSubmit) opts.onSubmit(data); modal.close(); }; form.append(...opts.fields.map(renderField)); qs('#backdrop').style.display='flex'; }, close(){ qs('#backdrop').style.display='none'; this.opts=null; } };

  function renderField(f){ const wrap=document.createElement('div'); const id=f.id||`f_${uid()}`; const label=document.createElement('label'); label.htmlFor=id; label.textContent=f.label||''; let input; if(f.type==='textarea'){ input=document.createElement('textarea'); if(f.rows) input.rows=f.rows; } else if(f.type==='select'){ input=document.createElement('select'); (f.options||[]).forEach(opt=>{ const o=document.createElement('option'); if(typeof opt==='string'){ o.value=opt; o.textContent=opt; } else { o.value=opt.value; o.textContent=opt.label; } if(f.value!=null && String(f.value)===String(o.value)) o.selected=true; input.appendChild(o); }); } else { input=document.createElement('input'); input.type=f.type||'text'; if(f.step) input.step=f.step; if(f.type==='date' && f.value){ input.value = toISO(f.value); } }
    input.id=id; input.name=f.name||id; if(f.placeholder) input.placeholder=f.placeholder; if(f.value!=null && input.type!=='date') input.value=f.value; if(f.required) input.required=true; const col=document.createElement('div'); col.append(label,input); wrap.append(col); return wrap; }

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

  function renderGastos(){ const tbody=qs('#tblGastos tbody'); if(!tbody) return; tbody.innerHTML=''; state.gastos.forEach(g=>{ const tr=document.createElement('tr'); tr.innerHTML=`
        <td>${fmtDate(g.data||'')}</td><td>${g.titular||''}</td><td>${g.banco||''}</td><td>${g.descricao||''}</td><td>${fmtEUR(g.valor)}</td><td><span class="pill">${g.status||'aberta'}</span></td>
        <td class="actions"><button class="btn ghost" data-act="edit-gasto" data-id="${g.id}">Editar</button><button class="btn danger" data-act="del-gasto" data-id="${g.id}">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireGastos(){ qs('#btnNewGasto').addEventListener('click', ()=>{ const people=pessoasFromContas(); const contas=contasOptions(); modal.open({ title:'Novo gasto', fields:[ { label:'Data', name:'data', type:'date', required:true, value:todayISO() }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Banco (conta)', name:'banco_id', type:'select', options: contas }, { label:'Descrição', name:'descricao', type:'textarea', rows:3 }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ const conta = contaById(data.banco_id); state.gastos.unshift({ id:uid(), data:toISO(data.data), titular:data.titular, banco: conta? `${conta.banco}`:'', descricao:data.descricao||'', valor:Number(data.valor||0), conta_id:data.banco_id||null, status:data.status||'aberta' }); persist(); renderGastos(); } }); }); qs('#tblGastos').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-gasto'){ if(!confirm('Tem certeza que deseja excluir este gasto?')) return; state.gastos = state.gastos.filter(g=> g.id!==id); persist(); renderGastos(); } else if(act==='edit-gasto'){ const g=state.gastos.find(x=> x.id===id); if(!g) return; const people=pessoasFromContas(); const contas=contasOptions(); modal.open({ title:'Editar gasto', fields:[ { label:'Data', name:'data', type:'date', required:true, value:g.data }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:g.titular }, { label:'Banco (conta)', name:'banco_id', type:'select', options: contas, value:g.conta_id||'' }, { label:'Descrição', name:'descricao', type:'textarea', rows:3, value:g.descricao }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:g.valor }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:g.status||'aberta' } ], onSubmit:(data)=>{ const conta=contaById(data.banco_id); Object.assign(g, { data:toISO(data.data), titular:data.titular, banco: conta? `${conta.banco}`:'', descricao:data.descricao||'', valor:Number(data.valor||0), conta_id:data.banco_id||null, status:data.status||'aberta' }); persist(); renderGastos(); } }); } }); }

  function renderSalarios(){ const tbody=qs('#tblSalarios tbody'); if(!tbody) return; tbody.innerHTML=''; state.salarios.forEach(s=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${fmtDate(s.data)}</td><td>${s.titular}</td><td>${s.banco}</td><td>${s.horas??''}</td><td>${fmtEUR(s.valor)}</td><td class="actions"><button class="btn danger" data-act="del-salario" data-id="${s.id}">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireSalarios(){ qs('#btnNewSalario').addEventListener('click', ()=>{ const people=pessoasFromContas(); const bancos=Array.from(new Set(state.contas.map(c=> c.banco))).map(b=> String(b)); modal.open({ title:'Novo salário', fields:[ { label:'Data', name:'data', type:'date', required:true, value:todayISO() }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Banco', name:'banco', type:'select', options: bancos.length?bancos:['AIB','Revolut'] }, { label:'Horas', name:'horas', type:'number', step:'1' }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true } ], onSubmit:(data)=>{ state.salarios.unshift({ id:uid(), data:toISO(data.data), titular:data.titular, banco:data.banco, horas: data.horas?Number(data.horas):undefined, valor:Number(data.valor||0) }); persist(); renderSalarios(); } }); }); qs('#tblSalarios').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; if(btn.dataset.act==='del-salario'){ if(!confirm('Tem certeza que deseja excluir este salário?')) return; const id=btn.dataset.id; state.salarios = state.salarios.filter(s=> s.id!==id); persist(); renderSalarios(); } }); }

  function renderTransfers(){ const tbody=qs('#tblTransfers tbody'); if(!tbody) return; tbody.innerHTML=''; state.transferencias.forEach(t=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${fmtDate(t.data)}</td><td><span class=\"pill\">${t.tipo}</span></td><td>${t.de_label||''}</td><td>${t.para_label||''}</td><td>${fmtEUR(t.valor)}</td><td>${t.descricao||''}</td><td class=\"actions\"><button class=\"btn danger\" data-act=\"del-transfer\" data-id=\"${t.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireTransfers(){ qs('#btnNewTransfer').addEventListener('click', ()=>{ const contas=contasOptions(); modal.open({ title:'Nova transferência', fields:[ { label:'Data', name:'data', type:'date', required:true, value:todayISO() }, { label:'Tipo', name:'tipo', type:'select', options:['Transferência','Despesa','Receita'], value:'Transferência' }, { label:'De (conta)', name:'de_id', type:'select', options: contas }, { label:'Para (conta)', name:'para_id', type:'select', options: contas }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Descrição', name:'descricao', type:'textarea', rows:3 } ], onSubmit:(data)=>{ const cDe=contaById(data.de_id); const cPara=contaById(data.para_id); state.transferencias.unshift({ id:uid(), data:toISO(data.data), tipo:data.tipo, de_id:data.de_id||null, para_id:data.para_id||null, de_label: cDe? `${cDe.titular} - ${cDe.tipo} (${cDe.banco})`:'-', para_label: cPara? `${cPara.titular} - ${cPara.tipo} (${cPara.banco})`:'-', valor:Number(data.valor||0), descricao:data.descricao||'' }); persist(); renderTransfers(); } }); }); qs('#tblTransfers').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; if(btn.dataset.act==='del-transfer'){ if(!confirm('Tem certeza que deseja excluir esta transferência?')) return; const id=btn.dataset.id; state.transferencias = state.transferencias.filter(t=> t.id!==id); persist(); renderTransfers(); } }); }

  function renderCategorias(){ const tbody=qs('#tblCategorias tbody'); if(!tbody) return; tbody.innerHTML=''; state.categorias.forEach(c=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${c.nome}</td><td><span class=\"pill\">${c.tipo}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-categoria\" data-id=\"${c.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-categoria\" data-id=\"${c.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireCategorias(){ qs('#btnNewCategoria').addEventListener('click', ()=>{ modal.open({ title:'Nova categoria', fields:[ { label:'Nome', name:'nome', type:'text', required:true }, { label:'Tipo', name:'tipo', type:'select', options:['despesa','receita'], value:'despesa' } ], onSubmit:(data)=>{ state.categorias.unshift({ id:uid(), nome:data.nome, tipo:data.tipo }); persist(); renderCategorias(); } }); }); qs('#tblCategorias').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-categoria'){ if(!confirm('Tem certeza que deseja excluir esta categoria?')) return; state.categorias = state.categorias.filter(c=> c.id!==id); persist(); renderCategorias(); } else if(act==='edit-categoria'){ const c=state.categorias.find(x=> x.id===id); if(!c) return; modal.open({ title:'Editar categoria', fields:[ { label:'Nome', name:'nome', type:'text', required:true, value:c.nome }, { label:'Tipo', name:'tipo', type:'select', options:['despesa','receita'], value:c.tipo } ], onSubmit:(data)=>{ c.nome=data.nome; c.tipo=data.tipo; persist(); renderCategorias(); } }); } }); }

  const SEMANAS=['1','2','3','4','5']; const DIAS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  function renderFixas(){ const tbody=qs('#tblFixas tbody'); if(!tbody) return; tbody.innerHTML=''; state.fixas.forEach(f=>{ const regra=(f.semana&&f.dia)? `${f.semana}ª • ${f.dia}`:''; const tr=document.createElement('tr'); tr.innerHTML=`<td>${f.nome}</td><td>${f.titular}</td><td>${fmtEUR(f.valor)}</td><td>${fmtDate(f.data||'')}</td><td>${regra}</td><td><span class="pill">${f.status||'aberta'}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-fixa\" data-id=\"${f.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-fixa\" data-id=\"${f.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireFixas(){ qs('#btnNewFixa').addEventListener('click', ()=>{ const people=pessoasFromContas(); modal.open({ title:'Nova despesa fixa', fields:[ { label:'Nome', name:'nome', type:'text', required:true }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Data (opcional)', name:'data', type:'date' }, { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:'1' }, { label:'Dia da semana', name:'dia', type:'select', options: DIAS, value:'Qua' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ state.fixas.unshift({ id:uid(), nome:data.nome, titular:data.titular, valor:Number(data.valor||0), data: data.data? toISO(data.data):'', semana:data.semana||'', dia:data.dia||'', status:data.status||'aberta' }); persist(); renderFixas(); } }); }); qs('#tblFixas').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-fixa'){ if(!confirm('Tem certeza que deseja excluir esta despesa fixa?')) return; state.fixas = state.fixas.filter(f=> f.id!==id); persist(); renderFixas(); } else if(act==='edit-fixa'){ const f=state.fixas.find(x=> x.id===id); if(!f) return; const people=pessoasFromContas(); modal.open({ title:'Editar despesa fixa', fields:[ { label:'Nome', name:'nome', type:'text', required:true, value:f.nome }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:f.titular }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:f.valor }, { label:'Data (opcional)', name:'data', type:'date', value:f.data }, { label:'Semana', name:'semana', type:'select', options: SEMANAS.map(s=>({value:s,label:`${s}ª`})), value:f.semana||'1' }, { label:'Dia da semana', name:'dia', type:'select', options: DIAS, value:f.dia||'Qua' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:f.status||'aberta' } ], onSubmit:(data)=>{ Object.assign(f,{ nome:data.nome, titular:data.titular, valor:Number(data.valor||0), data:data.data? toISO(data.data):'', semana:data.semana||'', dia:data.dia||'', status:data.status||'aberta' }); persist(); renderFixas(); } }); } }); }

  function renderDividas(){ const tbody=qs('#tblDividas tbody'); if(!tbody) return; tbody.innerHTML=''; state.dividas.forEach(d=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.nome||''}</td><td>${d.titular||''}</td><td>${fmtEUR(d.valor)}</td><td>${fmtDate(d.vencimento||'')}</td><td><span class=\"pill\">${d.status||''}</span></td><td class=\"actions\"><button class=\"btn ghost\" data-act=\"edit-divida\" data-id=\"${d.id}\">Editar</button><button class=\"btn danger\" data-act=\"del-divida\" data-id=\"${d.id}\">Excluir</button></td>`; tbody.appendChild(tr); }); }
  function wireDividas(){ qs('#btnNewDivida').addEventListener('click', ()=>{ const people=pessoasFromContas(); modal.open({ title:'Nova dívida', fields:[ { label:'Nome da dívida', name:'nome', type:'text', required:true }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'] }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true }, { label:'Vencimento', name:'vencimento', type:'date' }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:'aberta' } ], onSubmit:(data)=>{ state.dividas.unshift({ id:uid(), nome:data.nome, titular:data.titular||'', valor:Number(data.valor||0), vencimento:data.vencimento? toISO(data.vencimento):'', status:data.status||'aberta' }); persist(); renderDividas(); } }); }); qs('#tblDividas').addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-act]'); if(!btn) return; const id=btn.dataset.id; const act=btn.dataset.act; if(act==='del-divida'){ if(!confirm('Tem certeza que deseja excluir esta dívida?')) return; state.dividas = state.dividas.filter(d=> d.id!==id); persist(); renderDividas(); } else if(act==='edit-divida'){ const d=state.dividas.find(x=> x.id===id); if(!d) return; const people=pessoasFromContas(); modal.open({ title:'Editar dívida', fields:[ { label:'Nome da dívida', name:'nome', type:'text', required:true, value:d.nome }, { label:'Titular', name:'titular', type:'select', options: people.length?people:['Giseli','FR'], value:d.titular }, { label:'Valor (EUR)', name:'valor', type:'number', step:'0.01', required:true, value:d.valor }, { label:'Vencimento', name:'vencimento', type:'date', value:d.vencimento }, { label:'Status', name:'status', type:'select', options:['aberta','paga','negociada'], value:d.status||'aberta' } ], onSubmit:(data)=>{ Object.assign(d,{ nome:data.nome, titular:data.titular||'', valor:Number(data.valor||0), vencimento:data.vencimento? toISO(data.vencimento):'', status:data.status||'aberta' }); persist(); renderDividas(); } }); } }); }

  function wireSair(){ qs('#btnSair').addEventListener('click', ()=>{ if(!confirm('Sair e limpar sessão local?')) return; location.href='login.html'; }); }

  function init(){ load(); initNav(); wireModalButtons(); wireSair(); wireGastos(); wireSalarios(); wireTransfers(); wireCategorias(); wireFixas(); wireDividas(); renderDashboard(); }
  document.addEventListener('DOMContentLoaded', init);
})();
