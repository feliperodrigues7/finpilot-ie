// FinPilot IE - LocalStorage (EUR)
// Dashboard, Contas, Gastos, Transações (apenas transferências), Salários, Categorias, Despesa Fixa, Dívidas
(function () {
  'use strict';

  const CURRENCY = 'EUR';
  const LS_KEY = 'finpilot_ie_v1';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function fmtMoney(v) { return Number(v || 0).toLocaleString('pt-PT', { style: 'currency', currency: CURRENCY }); }
  function uid() { return 'id_' + Math.random().toString(36).slice(2, 10); }
  function todayISO() { return new Date().toISOString().slice(0,10); }

  const defaultState = {
    pessoas: [],
    contas: [],       // {id, titularNome, banco, tipoConta, saldoInicial, saldoAtual, pessoaId}
    categorias: [],   // {id, nome, tipo}
    transacoes: [],   // {id, dataISO, contaId, valor, categoriaId, descricao, deContaId, paraContaId}
    salarios: [],     // {id, dataISO, nome, banco, horas, valor, contaIdVinculada}
    recorrentes: [],  // {id, categoriaId, nome, valor, dataISO?, semanaDoMes?, diaDaSemana?}
    dividas: [],      // {id, categoriaId, nome, valor, vencimentoISO?, fimISO?, semanaDoMes?, titularNome?}
    gastos: []        // {id, dataISO, titularNome, banco, descricao, valor, contaIdVinculada}
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch { return { ...defaultState }; }
  }
  function saveState(st) { localStorage.setItem(LS_KEY, JSON.stringify(st)); }

  let state = loadState();

  // Semeadura
  if (state.pessoas.length === 0) {
    const p1 = { id: uid(), nome: 'Eu' };
    const p2 = { id: uid(), nome: 'Cônjuge' };
    state.pessoas.push(p1, p2);
    state.contas.push(
      { id: uid(), titularNome: 'Eu', banco: 'Meu Banco', tipoConta: 'Corrente', saldoInicial: 1000, saldoAtual: 1000, pessoaId: p1.id },
      { id: uid(), titularNome: 'Cônjuge', banco: 'Banco Cônjuge', tipoConta: 'Poupança', saldoInicial: 800, saldoAtual: 800, pessoaId: p2.id }
    );
    const catSal = { id: uid(), nome: 'Salário', tipo: 'receita' };
    const catMer = { id: uid(), nome: 'Mercado', tipo: 'despesa' };
    const catAlu = { id: uid(), nome: 'Aluguel', tipo: 'despesa' };
    state.categorias.push(catSal, catMer, catAlu);
    saveState(state);
  } else {
    if (!state.categorias.find(c => c.nome.toLowerCase() === 'salário' && c.tipo === 'receita')) {
      state.categorias.push({ id: uid(), nome: 'Salário', tipo: 'receita' });
      saveState(state);
    }
  }

  // Utils específicos
  function getUniqueTitulares() {
    return Array.from(new Set(state.contas.map(c => (c.titularNome || '').trim()).filter(Boolean)));
  }
  function renderTitularOptions(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione';
    selectEl.appendChild(blank);
    getUniqueTitulares().forEach(nome => {
      const opt = document.createElement('option'); opt.value = nome; opt.textContent = nome; selectEl.appendChild(opt);
    });
  }
  function renderBancoOptionsForTitular(selectEl, titular) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione';
    selectEl.appendChild(blank);
    const bancos = Array.from(new Set(
      state.contas.filter(c => (c.titularNome||'').trim().toLowerCase() === (titular||'').trim().toLowerCase())
                   .map(c => (c.banco||'').trim()).filter(Boolean)
    ));
    bancos.forEach(b => {
      const opt = document.createElement('option'); opt.value = b; opt.textContent = b; selectEl.appendChild(opt);
    });
  }
  function findContaByTitularAndBanco(nome, banco) {
    const n = (nome||'').trim().toLowerCase();
    const b = (banco||'').trim().toLowerCase();
    return state.contas.find(c => (c.titularNome||'').trim().toLowerCase()===n && (c.banco||'').trim().toLowerCase()===b) || null;
  }
  function recalcSaldos() {
    state.contas.forEach(c => c.saldoAtual = Number(c.saldoInicial || 0));
    state.transacoes.forEach(t => {
      if (t.deContaId && t.paraContaId) {
        const de = state.contas.find(c => c.id === t.deContaId);
        const para = state.contas.find(c => c.id === t.paraContaId);
        const val = Number(t.valor || 0);
        if (de) de.saldoAtual -= val;
        if (para) para.saldoAtual += val;
      } else {
        const conta = state.contas.find(c => c.id === t.contaId);
        const cat = state.categorias.find(c => c.id === t.categoriaId);
        const val = Number(t.valor || 0);
        if (conta) {
          if (cat && cat.tipo === 'despesa') conta.saldoAtual -= val;
          else conta.saldoAtual += val;
        }
      }
    });
  }

  // DASHBOARD
  function renderDashboard() {
    const cards = $('#dashboard-cards');
    const totalEl = $('#dashboard-total');
    if (!cards || !totalEl) return;
    recalcSaldos();
    cards.innerHTML = '';
    state.contas.forEach(c => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h3>${c.titularNome} • <span class="accent">${c.banco || '-'}</span></h3>
        <div class="value">${fmtMoney(c.saldoAtual)}</div>
        <div class="sub">${c.tipoConta || ''}</div>
      `;
      cards.appendChild(div);
    });
    const total = state.contas.reduce((acc,c)=>acc+Number(c.saldoAtual||0),0);
    totalEl.textContent = fmtMoney(total);
  }

  // CONTAS
  function renderContasTable() {
    const tbody = $('#tbl-contas-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.contas.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.titularNome || ''}</td>
        <td>${c.banco || ''}</td>
        <td>${c.tipoConta || ''}</td>
        <td style="text-align:right">${fmtMoney(c.saldoInicial)}</td>
        <td style="text-align:right">${fmtMoney(c.saldoAtual)}</td>
        <td>
          <button class="btn" data-act="edit" data-id="${c.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${c.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    renderDashboard();
  }
  function renderContasSelectsForTransfers() {
    const selDe = $('#tx-de-conta');
    const selPara = $('#tx-para-conta');
    [selDe, selPara].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = ''; blank.textContent = 'Selecione';
      sel.appendChild(blank);
      state.contas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.titularNome} - ${c.tipoConta} (${c.banco || '-'})`;
        sel.appendChild(opt);
      });
    });
  }
  function bindContas() {
    renderContasTable();
    renderContasSelectsForTransfers();

    const form = $('#form-conta');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const titularNome = ($('#ct-titular') || {}).value || '';
        const tipoConta = ($('#ct-tipo') || {}).value || '';
        const banco = ($('#ct-banco') || {}).value || '';
        const saldoInicial = Number((($('#ct-saldo-inicial') || {}).value || '0').replace(',', '.'));

        if (!titularNome.trim() || !tipoConta.trim()) { alert('Informe Titular e Tipo de Conta.'); return; }

        let pessoa = state.pessoas.find(p => p.nome.toLowerCase() === titularNome.trim().toLowerCase());
        if (!pessoa) { pessoa = { id: uid(), nome: titularNome.trim() }; state.pessoas.push(pessoa); }

        if (idEdit) {
          const c = state.contas.find(x => x.id === idEdit);
          if (c) {
            c.titularNome = titularNome.trim();
            c.tipoConta = tipoConta.trim();
            c.banco = banco;
            c.pessoaId = pessoa.id;
            c.saldoInicial = isNaN(saldoInicial) ? 0 : saldoInicial;
          }
          form.removeAttribute('data-edit-id');
        } else {
          state.contas.push({
            id: uid(),
            titularNome: titularNome.trim(),
            tipoConta: tipoConta.trim(),
            banco,
            pessoaId: pessoa.id,
            saldoInicial: isNaN(saldoInicial) ? 0 : saldoInicial,
            saldoAtual: isNaN(saldoInicial) ? 0 : saldoInicial
          });
        }

        recalcSaldos();
        saveState(state);
        renderContasTable();
        renderContasSelectsForTransfers();
        renderDashboard();

        // Atualiza selects da aba Gastos e Salários
        renderTitularOptions($('#gs-titular'));
        renderTitularOptions($('#sl-nome'));
        renderBancoOptionsForTitular($('#gs-banco'), ($('#gs-titular')||{}).value || '');
        renderBancoOptionsForTitular($('#sl-banco'), ($('#sl-nome')||{}).value || '');

        form.reset();
      });
    }

    const tbody = $('#tbl-contas-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir conta? Isso também removerá transferências relacionadas.')) return;
          state.contas = state.contas.filter(c => c.id !== id);
          state.transacoes = state.transacoes.filter(t => t.contaId !== id && t.deContaId !== id && t.paraContaId !== id);
          recalcSaldos();
          saveState(state);
          renderContasTable();
          renderContasSelectsForTransfers();
          renderDashboard();

          renderTitularOptions($('#gs-titular'));
          renderBancoOptionsForTitular($('#gs-banco'), ($('#gs-titular')||{}).value || '');
          renderTitularOptions($('#sl-nome'));
          renderBancoOptionsForTitular($('#sl-banco'), ($('#sl-nome')||{}).value || '');
          renderGastos();
          renderTransacoes();
        } else if (act === 'edit') {
          const c = state.contas.find(x => x.id === id);
          if (!c) return;
          ($('#ct-titular') || {}).value = c.titularNome || '';
          ($('#ct-tipo') || {}).value = c.tipoConta || '';
          ($('#ct-banco') || {}).value = c.banco || '';
          ($('#ct-saldo-inicial') || {}).value = String(c.saldoInicial || 0);
          form && form.setAttribute('data-edit-id', c.id);
        }
      });
    }
  }

  // CATEGORIAS
  function renderCategorias() {
    const tbody = $('#tbl-categorias-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.categorias.forEach(cat => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${cat.nome}</td>
        <td><span class="badge ${cat.tipo}">${cat.tipo}</span></td>
        <td>
          <button class="btn" data-act="edit" data-id="${cat.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${cat.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // selects dependentes (ex.: transações categoria se necessário)
  }
  function bindCategorias() {
    renderCategorias();
    const form = $('#form-categoria');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const nome = ($('#cat-nome') || {}).value || '';
        const tipo = ($('#cat-tipo') || {}).value || 'despesa';
        if (!nome.trim()) { alert('Informe o nome.'); return; }
        if (idEdit) {
          const c = state.categorias.find(x => x.id === idEdit);
          if (c) { c.nome = nome.trim(); c.tipo = tipo; }
          form.removeAttribute('data-edit-id');
        } else {
          state.categorias.push({ id: uid(), nome: nome.trim(), tipo });
        }
        saveState(state);
        renderCategorias();
      });
    }
    const tbody = $('#tbl-categorias-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir tipo?')) return;
          state.categorias = state.categorias.filter(c => c.id !== id);
          saveState(state);
          renderCategorias();
        } else if (act === 'edit') {
          const c = state.categorias.find(x => x.id === id);
          if (!c) return;
          ($('#cat-nome') || {}).value = c.nome;
          ($('#cat-tipo') || {}).value = c.tipo;
          form && form.setAttribute('data-edit-id', c.id);
        }
      });
    }
  }

  // GASTOS
  function renderGastos() {
    const tbody = $('#tbl-gastos-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.gastos].sort((a,b)=> (a.dataISO||'').localeCompare(b.dataISO||'')).reverse();
    ordered.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(g.dataISO||'').slice(0,10)}</td>
        <td>${g.titularNome}</td>
        <td>${g.banco}</td>
        <td>${g.descricao || ''}</td>
        <td style="text-align:right">${fmtMoney(g.valor)}</td>
        <td><button class="btn danger" data-act="del" data-id="${g.id}">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindGastos() {
    renderTitularOptions($('#gs-titular'));
    renderBancoOptionsForTitular($('#gs-banco'), '');
    const gsTit = $('#gs-titular');
    if (gsTit) gsTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#gs-banco'), gsTit.value || ''));
    renderGastos();

    const form = $('#form-gasto');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const valor = Number((($('#gs-valor')||{}).value || '0').replace(',','.'));
      const dataISO = ($('#gs-data')||{}).value || todayISO();
      const titularNome = ($('#gs-titular')||{}).value || '';
      const banco = ($('#gs-banco')||{}).value || '';
      const descricao = ($('#gs-desc')||{}).value || '';

      if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }
      if (!titularNome.trim()) { alert('Selecione o titular.'); return; }
      if (!banco.trim()) { alert('Selecione o banco.'); return; }

      const conta = findContaByTitularAndBanco(titularNome, banco);
      if (!conta) { alert('Conta não encontrada para este titular e banco.'); return; }

      // Gasto é uma despesa: cria uma transação de despesa sem precisar de categoria específica
      // Para manter coerência, criamos (se não existir) a categoria "Gasto" como despesa
      let catGasto = state.categorias.find(c => c.nome.toLowerCase() === 'gasto' && c.tipo === 'despesa');
      if (!catGasto) { catGasto = { id: uid(), nome: 'Gasto', tipo: 'despesa' }; state.categorias.push(catGasto); }

      // Registrar gasto
      state.gastos.push({
        id: uid(), dataISO, titularNome, banco, descricao, valor, contaIdVinculada: conta.id
      });

      // Registrar transação vinculada para refletir no saldo
      state.transacoes.push({
        id: uid(), dataISO, contaId: conta.id, valor,
        categoriaId: catGasto.id, descricao: descricao || 'Gasto',
        deContaId: null, paraContaId: null
      });

      recalcSaldos();
      saveState(state);
      renderGastos();
      renderContasTable();
      renderDashboard();

      // limpar campos
      ($('#gs-valor')||{}).value = '';
      ($('#gs-data')||{}).value = '';
      ($('#gs-desc')||{}).value = '';
    });

    const tbody = $('#tbl-gastos-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act="del"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const gasto = state.gastos.find(g => g.id === id);
        state.gastos = state.gastos.filter(g => g.id !== id);

        // remover transação correspondente (heurística por valor, data, conta e descricao)
        if (gasto) {
          const idx = state.transacoes.findIndex(t =>
            t.contaId === gasto.contaIdVinculada &&
            Number(t.valor) === Number(gasto.valor) &&
            (t.dataISO || '').slice(0,10) === (gasto.dataISO || '').slice(0,10) &&
            (t.descricao || '').toLowerCase() === (gasto.descricao || 'gasto').toLowerCase()
          );
          if (idx >= 0) state.transacoes.splice(idx,1);
        }

        recalcSaldos();
        saveState(state);
        renderGastos();
        renderContasTable();
        renderDashboard();
      });
    }
  }

  // TRANSFERÊNCIAS (Transações)
  function renderTransacoes() {
    const tbody = $('#tbl-transacoes-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.transacoes].sort((a,b)=> (a.dataISO||'').localeCompare(b.dataISO||'')).reverse();
    ordered.forEach(t => {
      const conta = state.contas.find(c => c.id === t.contaId);
      const isTransfer = !!(t.deContaId && t.paraContaId);
      const tipoBadge = isTransfer ? '<span class="badge transfer">Transferência</span>' :
                        (t.categoriaId ? '<span class="badge despesa">Despesa</span>' : '');
      const contaNome = isTransfer ? '-' : (conta ? `${conta.titularNome} - ${conta.tipoConta}` : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(t.dataISO||'').slice(0,10)}</td>
        <td>${tipoBadge}</td>
        <td>${contaNome}</td>
        <td style="text-align:right">${fmtMoney(t.valor)}</td>
        <td>${t.descricao || ''}</td>
        <td><button class="btn danger" data-act="del" data-id="${t.id}">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindTransacoes() {
    renderContasSelectsForTransfers();
    renderTransacoes();

    const form = $('#form-transacao');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const dataISO = ($('#tx-data') || {}).value || todayISO();
        const valor = Number((($('#tx-valor') || {}).value || '0').replace(',', '.'));
        const descricao = ($('#tx-descricao') || {}).value || '';
        const deContaId = ($('#tx-de-conta') || {}).value || '';
        const paraContaId = ($('#tx-para-conta') || {}).value || '';

        const isTransfer = deContaId && paraContaId;
        if (!isTransfer) { alert('Selecione as contas De e Para.'); return; }
        if (deContaId === paraContaId) { alert('Selecione contas diferentes.'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Valor inválido.'); return; }

        state.transacoes.push({
          id: uid(), dataISO, contaId: null, valor, categoriaId: null,
          descricao: descricao || 'Transferência', deContaId, paraContaId
        });

        recalcSaldos();
        saveState(state);
        renderTransacoes();
        renderContasTable();
        renderDashboard();
        form.reset();
      });
    }

    const tbody = $('#tbl-transacoes-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act="del"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        state.transacoes = state.transacoes.filter(t => t.id !== id);
        recalcSaldos();
        saveState(state);
        renderTransacoes();
        renderContasTable();
        renderDashboard();
      });
    }
  }

  // SALÁRIOS
  function ensureCategoriaSalario() {
    let cat = state.categorias.find(c => c.nome.toLowerCase() === 'salário' && c.tipo === 'receita');
    if (!cat) { cat = { id: uid(), nome: 'Salário', tipo: 'receita' }; state.categorias.push(cat); }
    return cat;
  }
  function renderSalarioNomeOptions() { renderTitularOptions($('#sl-nome')); }
  function renderSalarioBancoOptionsForTitular(titular) { renderBancoOptionsForTitular($('#sl-banco'), titular); }
  function renderSalarios() {
    const tbody = $('#tbl-salarios-body'); if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.salarios].sort((a,b)=> (a.dataISO||'').localeCompare(b.dataISO||'')).reverse();
    ordered.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(s.dataISO||'').slice(0,10)}</td>
        <td>${s.nome}</td>
        <td>${s.banco || ''}</td>
        <td>${typeof s.horas === 'number' ? s.horas : (s.horas || '')}</td>
        <td style="text-align:right">${fmtMoney(s.valor)}</td>
        <td><button class="btn danger" data-act="del" data-id="${s.id}">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindSalarios() {
    renderSalarioNomeOptions(); renderSalarioBancoOptionsForTitular('');
    const slNome = $('#sl-nome'); if (slNome) slNome.addEventListener('change', () => renderSalarioBancoOptionsForTitular(slNome.value || ''));
    renderSalarios();

    const form = $('#form-salario'); if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const nome = ($('#sl-nome') || {}).value || '';
      const banco = ($('#sl-banco') || {}).value || '';
      const valor = Number((($('#sl-valor') || {}).value || '0').replace(',', '.'));
      const horas = Number((($('#sl-horas') || {}).value || '0').replace(',', '.'));
      const dataISO = ($('#sl-data') || {}).value || todayISO();

      if (!nome.trim()) { alert('Selecione o titular.'); return; }
      if (!banco.trim()) { alert('Selecione o banco.'); return; }
      if (isNaN(valor) || valor <= 0) { alert('Informe um valor de salário válido.'); return; }

      const conta = findContaByTitularAndBanco(nome, banco);
      if (!conta) { alert('Conta não encontrada para este titular e banco.'); return; }

      const catSalario = ensureCategoriaSalario();

      state.salarios.push({
        id: uid(), dataISO, nome: nome.trim(), banco: banco.trim(),
        horas: isNaN(horas) ? null : horas, valor: isNaN(valor) ? 0 : valor, contaIdVinculada: conta.id
      });

      state.transacoes.push({
        id: uid(), dataISO, contaId: conta.id, valor,
        categoriaId: catSalario.id, descricao: `Salário ${nome.trim()}`,
        deContaId: null, paraContaId: null
      });

      recalcSaldos();
      saveState(state);
      renderSalarios();
      renderTransacoes();
      renderContasTable();
      renderDashboard();

      ($('#sl-valor') || {}).value = '';
      ($('#sl-horas') || {}).value = '';
      ($('#sl-data') || {}).value = '';
    });

    const tbody = $('#tbl-salarios-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act="del"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const sal = state.salarios.find(s => s.id === id);
        state.salarios = state.salarios.filter(s => s.id !== id);
        if (sal) {
          const idx = state.transacoes.findIndex(t =>
            t.contaId === sal.contaIdVinculada &&
            Number(t.valor) === Number(sal.valor) &&
            (t.dataISO || '').slice(0,10) === (sal.dataISO || '').slice(0,10) &&
            (t.descricao || '').toLowerCase().includes('salário')
          );
          if (idx >= 0) state.transacoes.splice(idx, 1);
        }
        recalcSaldos();
        saveState(state);
        renderSalarios();
        renderTransacoes();
        renderContasTable();
        renderDashboard();
      });
    }
  }

  // DESPESA FIXA
  function humanizeSemanaDia(semana, dia) {
    const semanaTxt = semana ? `${semana}ª` : '';
    const dias = { '1':'Seg', '2':'Ter', '3':'Qua', '4':'Qui', '5':'Sex', '6':'Sáb', '0':'Dom' };
    const diaTxt = (dia !== undefined && dia !== null && String(dia) !== '') ? dias[String(dia)] : '';
    if (semanaTxt && diaTxt) return `${semanaTxt} • ${diaTxt}`;
    if (semanaTxt) return semanaTxt;
    if (diaTxt) return diaTxt;
    return '';
  }
  function renderRecorrentes() {
    const tbody = $('#tbl-recorrentes-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.recorrentes].sort((a,b)=> (a.nome||'').localeCompare(b.nome||''));
    ordered.forEach(r => {
      const cat = state.categorias.find(c => c.id === r.categoriaId);
      const nome = r.nome || (cat ? cat.nome : '(sem nome)');
      const venc = r.dataISO ? (r.dataISO || '').slice(0,10) : '';
      const semanaDia = humanizeSemanaDia(r.semanaDoMes, r.diaDaSemana);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nome}</td>
        <td style="text-align:right">${fmtMoney(r.valor)}</td>
        <td>${venc || '-'}</td>
        <td>${semanaDia || '-'}</td>
        <td>
          <button class="btn" data-act="edit" data-id="${r.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${r.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindRecorrentes() {
    renderRecorrentes();
    const form = $('#form-recorrente'); if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const idEdit = form.getAttribute('data-edit-id');
      const categoriaId = ($('#rc-categoria') || {}).value || '';
      const valor = Number((($('#rc-valor') || {}).value || '0').replace(',', '.'));
      const dataISO = ($('#rc-data') || {}).value || '';
      const semana = ($('#rc-semana') || {}).value || '';
      const dia = ($('#rc-dia-semana') || {}).value || '';

      if (!categoriaId) { alert('Selecione o Nome (Tipo de Despesa).'); return; }
      if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }

      const cat = state.categorias.find(c => c.id === categoriaId);
      const nome = cat ? cat.nome : '';
      const semanaNum = semana ? Number(semana) : null;
      const diaNum = (dia || dia === '0') ? Number(dia) : null;

      if (idEdit) {
        const r = state.recorrentes.find(x => x.id === idEdit);
        if (r) { r.categoriaId=categoriaId; r.nome=nome; r.valor=valor; r.dataISO=dataISO; r.semanaDoMes=semanaNum||null; r.diaDaSemana=(dia !== '' ? diaNum : null); }
        form.removeAttribute('data-edit-id');
      } else {
        state.recorrentes.push({ id: uid(), categoriaId, nome, valor, dataISO, semanaDoMes: semanaNum||null, diaDaSemana: (dia !== '' ? diaNum : null) });
      }
      saveState(state); renderRecorrentes(); form.reset();
    });

    const tbody = $('#tbl-recorrentes-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]'); if (!btn) return;
        const id = btn.getAttribute('data-id'); const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir esta Despesa Fixa?')) return;
          state.recorrentes = state.recorrentes.filter(r => r.id !== id);
          saveState(state); renderRecorrentes();
        } else if (act === 'edit') {
          const r = state.recorrentes.find(x => x.id === id); if (!r) return;
          ($('#rc-categoria')||{}).value = r.categoriaId || '';
          ($('#rc-valor')||{}).value = String(r.valor || 0);
          ($('#rc-data')||{}).value = r.dataISO || '';
          ($('#rc-semana')||{}).value = r.semanaDoMes || '';
          ($('#rc-dia-semana')||{}).value = (r.diaDaSemana === 0 ? '0' : (r.diaDaSemana || ''));
          form.setAttribute('data-edit-id', r.id);
        }
      });
    }
  }

  // DÍVIDAS
  function humanizeSemana(semana) { return semana ? `${semana}ª` : ''; }
  function renderDividas() {
    const tbody = $('#tbl-dividas-body'); if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.dividas].sort((a,b)=> (a.nome||'').localeCompare(b.nome||''));
    ordered.forEach(d => {
      const cat = state.categorias.find(c => c.id === d.categoriaId);
      const nome = d.nome || (cat ? cat.nome : '(sem nome)');
      const venc = d.vencimentoISO ? (d.vencimentoISO || '').slice(0,10) : '-';
      const fim = d.fimISO ? (d.fimISO || '').slice(0,10) : '-';
      const semana = humanizeSemana(d.semanaDoMes);
      const titular = d.titularNome || '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nome}</td>
        <td>${titular}</td>
        <td style="text-align:right">${fmtMoney(d.valor)}</td>
        <td>${venc}</td>
        <td>${fim}</td>
        <td>${semana || '-'}</td>
        <td>
          <button class="btn" data-act="edit" data-id="${d.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${d.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // selects dependentes
    if ($('#dv-categoria') && $('#dv-categoria').children.length <= 1) {
      // carregar categorias despesa
      const selDv = $('#dv-categoria'); selDv.innerHTML = '';
      const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione'; selDv.appendChild(blank);
      state.categorias.filter(c=>c.tipo==='despesa').forEach(cat=>{
        const opt=document.createElement('option'); opt.value=cat.id; opt.textContent=cat.nome; selDv.appendChild(opt);
      });
    }
    renderTitularOptions($('#dv-titular'));
  }
  function bindDividas() {
    renderDividas();
    const form = $('#form-divida'); if (!form) return;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      const idEdit = form.getAttribute('data-edit-id');
      const categoriaId = ($('#dv-categoria') || {}).value || '';
      const valor = Number((($('#dv-valor') || {}).value || '0').replace(',', '.'));
      const vencimentoISO = ($('#dv-vencimento') || {}).value || '';
      const fimISO = ($('#dv-fim') || {}).value || '';
      const semana = ($('#dv-semana') || {}).value || '';
      const titularNome = ($('#dv-titular') || {}).value || '';

      if (!categoriaId) { alert('Selecione o Nome da dívida (Tipo de Despesa).'); return; }
      if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }
      if (!titularNome.trim()) { alert('Selecione o titular da dívida.'); return; }

      const cat = state.categorias.find(c => c.id === categoriaId);
      const nome = cat ? cat.nome : '';
      const semanaNum = semana ? Number(semana) : null;

      if (idEdit) {
        const d = state.dividas.find(x => x.id === idEdit);
        if (d) { d.categoriaId=categoriaId; d.nome=nome; d.valor=valor; d.vencimentoISO=vencimentoISO; d.fimISO=fimISO; d.semanaDoMes=semanaNum||null; d.titularNome=titularNome.trim(); }
        form.removeAttribute('data-edit-id');
      } else {
        state.dividas.push({ id: uid(), categoriaId, nome, valor, vencimentoISO, fimISO, semanaDoMes: semanaNum||null, titularNome: titularNome.trim() });
      }

      saveState(state);
      renderDividas();
      form.reset();
    });

    const tbody = $('#tbl-dividas-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]'); if (!btn) return;
        const id = btn.getAttribute('data-id'); const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir esta Dívida?')) return;
          state.dividas = state.dividas.filter(d => d.id !== id);
          saveState(state); renderDividas();
        } else if (act === 'edit') {
          const d = state.dividas.find(x => x.id === id); if (!d) return;
          ($('#dv-categoria')||{}).value = d.categoriaId || '';
          ($('#dv-valor')||{}).value = String(d.valor || 0);
          ($('#dv-vencimento')||{}).value = d.vencimentoISO || '';
          ($('#dv-fim')||{}).value = d.fimISO || '';
          ($('#dv-semana')||{}).value = d.semanaDoMes || '';
          ($('#dv-titular')||{}).value = d.titularNome || '';
          form.setAttribute('data-edit-id', d.id);
        }
      });
    }
  }

  // NAV
  function showTab(tabId) {
    $all('.tab-pane').forEach(el => el.style.display = 'none');
    const el = document.getElementById(tabId);
    if (el) el.style.display = 'block';
    $all('[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active'); else btn.classList.remove('active');
    });
    // Atualizar dashboard sempre que abrir
    if (tabId === 'tab-dashboard') renderDashboard();
  }
  function bindNav() {
    $all('[data-tab]').forEach(btn => { btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab'))); });
    const btnSair = $('#btn-sair'); if (btnSair) btnSair.addEventListener('click', () => { window.location.href = 'login.html'; });
  }

  function init() {
    bindNav();
    bindContas();
    bindCategorias();
    bindGastos();
    bindTransacoes();
    bindSalarios();
    bindRecorrentes();
    bindDividas();
    const firstPane = document.querySelector('.tab-pane');
    if (firstPane) showTab(firstPane.id);
    renderDashboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
