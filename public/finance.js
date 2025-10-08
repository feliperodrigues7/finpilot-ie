// FinPilot IE - LocalStorage (EUR)
// Padronização de modais para todas as abas + tema claro
(function () {
  'use strict';

  const CURRENCY = 'EUR';
  const LS_KEY = 'finpilot_ie_v1';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function fmtMoney(v) { return Number(v || 0).toLocaleString('pt-PT', { style: 'currency', currency: CURRENCY }); }
  function uid() { return 'id_' + Math.random().toString(36).slice(2, 10); }
  function todayISO() { return new Date().toISOString().slice(0,10); }
  function sortAsc(a, b) { return a.localeCompare(b, 'pt', { sensitivity: 'base' }); }

  const defaultState = {
    pessoas: [],
    contas: [],
    categorias: [],
    transacoes: [],
    salarios: [],
    recorrentes: [],
    dividas: [],
    gastos: []
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

  // Seed inicial
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
  }
  if (!state.categorias.find(c => c.nome.toLowerCase() === 'salário' && c.tipo === 'receita')) {
    state.categorias.push({ id: uid(), nome: 'Salário', tipo: 'receita' });
    saveState(state);
  }

  // Helpers gerais
  function getUniqueTitularesSorted() {
    const set = new Set(state.contas.map(c => (c.titularNome || '').trim()).filter(Boolean));
    return Array.from(set).sort(sortAsc);
  }
  function renderTitularOptions(selectEl) {
    if (!selectEl) return;
    const values = getUniqueTitularesSorted();
    selectEl.innerHTML = '';
    const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione';
    selectEl.appendChild(blank);
    values.forEach(nome => {
      const opt = document.createElement('option'); opt.value = nome; opt.textContent = nome; selectEl.appendChild(opt);
    });
  }
  function renderBancoOptionsForTitular(selectEl, titular) {
    if (!selectEl) return;
    const bancos = Array.from(new Set(
      state.contas
        .filter(c => (c.titularNome||'').trim().toLowerCase() === (titular||'').trim().toLowerCase())
        .map(c => (c.banco||'').trim())
        .filter(Boolean)
    )).sort(sortAsc);
    selectEl.innerHTML = '';
    const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione';
    selectEl.appendChild(blank);
    bancos.forEach(b => {
      const opt = document.createElement('option'); opt.value = b; opt.textContent = b; selectEl.appendChild(opt);
    });
  }
  function renderCategoriaOptions(selectEl, tipoFilter) {
    if (!selectEl) return;
    const cats = state.categorias
      .filter(c => !tipoFilter || c.tipo === tipoFilter)
      .slice()
      .sort((a,b)=> sortAsc(a.nome||'', b.nome||''));
    selectEl.innerHTML = '';
    const blank = document.createElement('option'); blank.value=''; blank.textContent='Selecione';
    selectEl.appendChild(blank);
    cats.forEach(c => {
      const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nome; selectEl.appendChild(opt);
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

  // Modal helpers
  function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('show'); }
  function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }
  function bindModalEvents() {
    $all('.close-button, .btn-modal.secondary').forEach(btn => {
      btn.addEventListener('click', function() {
        const modalId = this.getAttribute('data-modal');
        if (modalId) closeModal(modalId);
      });
    });
    $all('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal(modal.id);
      });
    });
  }

  // Dashboard
  function renderDashboard() {
    const cards = $('#dashboard-cards');
    const totalEl = $('#dashboard-total');
    const fixasWrap = $('#dashboard-fixas');
    const dividasWrap = $('#dashboard-dividas');
    if (!cards || !totalEl) return;

    recalcSaldos();
    cards.innerHTML = '';
    const contasOrdered = state.contas.slice().sort((a,b)=> sortAsc(a.titularNome||'', b.titularNome||'') || sortAsc(a.banco||'', b.banco||''));
    contasOrdered.forEach(c => {
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

    // Fixas por Titular
    if (fixasWrap) {
      fixasWrap.innerHTML = '';
      const mapa = {};
      state.recorrentes.forEach(r => {
        const t = (r.titularNome || '').trim() || '(Sem titular)';
        mapa[t] = (mapa[t] || 0) + Number(r.valor || 0);
      });
      Object.keys(mapa).sort(sortAsc).forEach(tit => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h3>Fixas • <span class="accent">${tit}</span></h3>
          <div class="value">${fmtMoney(mapa[tit])}</div>
          <div class="sub">Total de despesas fixas</div>
        `;
        fixasWrap.appendChild(div);
      });
    }

    // Dívidas por título/titular
    if (dividasWrap) {
      dividasWrap.innerHTML = '';
      const combos = {};
      state.dividas.forEach(d => {
        const tit = (d.titularNome || '').trim() || '(Sem titular)';
        const nome = (d.nome || '').trim() || '(Sem nome)';
        const key = `${tit}||${nome}`;
        combos[key] = (combos[key] || 0) + Number(d.valor || 0);
      });
      Object.keys(combos)
        .sort((ka,kb)=>{
          const [ta,na]=ka.split('||'); const [tb,nb]=kb.split('||');
          return sortAsc(ta,tb) || sortAsc(na,nb);
        })
        .forEach(key => {
          const [tit, nome] = key.split('||');
          const val = combos[key];
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `
            <h3>${nome} • <span class="accent">${tit}</span></h3>
            <div class="value">${fmtMoney(val)}</div>
            <div class="sub">Total desse título (por titular)</div>
          `;
          dividasWrap.appendChild(div);
        });
    }
  }

  // CONTAS
  function renderContasTable() {
    const tbody = $('#tbl-contas-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = state.contas.slice().sort((a,b)=> sortAsc(a.titularNome||'', b.titularNome||'') || sortAsc(a.banco||'', b.banco||''));
    ordered.forEach(c => {
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
    renderTitularOptions($('#transfer-de-titular'));
    renderTitularOptions($('#transfer-para-titular'));
  }
  function bindContas() {
    renderContasTable();
    renderContasSelectsForTransfers();

    // Abrir modal Nova conta
    const btnOpenAccount = $('#btn-open-account-modal');
    if (btnOpenAccount) {
      btnOpenAccount.addEventListener('click', () => {
        const form = $('#account-form');
        if (form) form.reset();
        $('#account-id').value = '';
        $('#account-owner-name').value = '';
        $('#account-modal-title').textContent = 'Nova Conta';
        openModal('account-modal');
      });
    }

    // Submit modal conta
    const modalForm = $('#account-form');
    if (modalForm) {
      modalForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const idEdit = $('#account-id').value;
        const pessoaNome = ($('#account-owner-name').value || '').trim();
        const tipoConta = ($('#account-name').value || '').trim();
        const banco = ($('#account-bank').value || '').trim();
        const saldoInicial = Number($('#account-balance').value || 0);

        if (!pessoaNome) { alert('Informe o nome da pessoa (titular).'); return; }
        if (!tipoConta) { alert('Informe o tipo de conta.'); return; }

        let pessoa = state.pessoas.find(p => (p.nome || '').trim().toLowerCase() === pessoaNome.toLowerCase());
        if (!pessoa) { pessoa = { id: uid(), nome: pessoaNome }; state.pessoas.push(pessoa); }

        if (idEdit) {
          const c = state.contas.find(x => x.id === idEdit);
          if (c) {
            c.titularNome = pessoa.nome;
            c.tipoConta = tipoConta;
            c.banco = banco;
            c.pessoaId = pessoa.id;
            c.saldoInicial = saldoInicial;
          }
        } else {
          state.contas.push({
            id: uid(), titularNome: pessoa.nome, tipoConta, banco,
            pessoaId: pessoa.id, saldoInicial, saldoAtual: saldoInicial
          });
        }

        recalcSaldos();
        saveState(state);
        renderContasTable();
        renderContasSelectsForTransfers();
        renderDashboard();

        renderTitularOptions($('#gasto-titular'));
        renderTitularOptions($('#salario-titular'));
        renderTitularOptions($('#recorrente-titular'));
        renderTitularOptions($('#divida-titular'));
        closeModal('account-modal');
        modalForm.reset();
        $('#account-id').value = '';
      });
    }

    // Ações da tabela
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
          renderGastos(); renderTransacoes(); // atualizar tabelas relativas
        } else if (act === 'edit') {
          const c = state.contas.find(x => x.id === id);
          if (!c) return;
          $('#account-id').value = c.id;
          $('#account-owner-name').value = c.titularNome || '';
          $('#account-name').value = c.tipoConta || '';
          $('#account-bank').value = c.banco || '';
          $('#account-balance').value = c.saldoInicial || 0;
          $('#account-modal-title').textContent = 'Editar Conta';
          openModal('account-modal');
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
        <td>
          <button class="btn" data-act="edit" data-id="${g.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${g.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindGastos() {
    // abrir modal novo
    const btn = $('#btn-open-gasto-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#gasto-form').reset();
      $('#gasto-id').value = '';
      $('#gasto-modal-title').textContent = 'Novo Gasto';
      renderTitularOptions($('#gasto-titular'));
      renderBancoOptionsForTitular($('#gasto-banco'), '');
      openModal('gasto-modal');
    });
    // dependência titular->banco
    const selTit = $('#gasto-titular');
    if (selTit) selTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#gasto-banco'), selTit.value || ''));

    renderGastos();

    // submit
    const form = $('#gasto-form');
    if (form) {
      form.addEventListener('submit', function(e){
        e.preventDefault();
        const idEdit = $('#gasto-id').value;
        const valor = Number(($('#gasto-valor').value || '0').replace(',','.'));
        const dataISO = $('#gasto-data').value || todayISO();
        const titularNome = $('#gasto-titular').value || '';
        const banco = $('#gasto-banco').value || '';
        const descricao = $('#gasto-desc').value || '';

        if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }
        if (!titularNome.trim()) { alert('Selecione o titular.'); return; }
        if (!banco.trim()) { alert('Selecione o banco.'); return; }

        const conta = findContaByTitularAndBanco(titularNome, banco);
        if (!conta) { alert('Conta não encontrada para este titular e banco.'); return; }

        // Categoria "Gasto"
        let catGasto = state.categorias.find(c => c.nome.toLowerCase() === 'gasto' && c.tipo === 'despesa');
        if (!catGasto) { catGasto = { id: uid(), nome: 'Gasto', tipo: 'despesa' }; state.categorias.push(catGasto); }

        if (idEdit) {
          const g = state.gastos.find(x=>x.id===idEdit);
          if (g) { g.dataISO=dataISO; g.titularNome=titularNome; g.banco=banco; g.descricao=descricao; g.valor=valor; g.contaIdVinculada=conta.id; }
          // Atualizar transação correspondente: remover e recriar simples
          state.transacoes = state.transacoes.filter(t => !(t.contaId===g.contaIdVinculada && (t.descricao||'').toLowerCase()===(g.descricao||'gasto').toLowerCase() && (t.dataISO||'').slice(0,10)===(g.dataISO||'').slice(0,10) && Number(t.valor)===Number(g.valor)));
        } else {
          const gid = uid();
          state.gastos.push({ id: gid, dataISO, titularNome, banco, descricao, valor, contaIdVinculada: conta.id });
        }

        // Criar transação de despesa
        state.transacoes.push({
          id: uid(), dataISO, contaId: conta.id, valor,
          categoriaId: catGasto.id, descricao: descricao || 'Gasto',
          deContaId: null, paraContaId: null
        });

        recalcSaldos();
        saveState(state);
        renderGastos();
        renderTransacoes();
        renderContasTable();
        renderDashboard();
        closeModal('gasto-modal');
      });
    }

    // ações tabela
    const tbody = $('#tbl-gastos-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
          const gasto = state.gastos.find(g => g.id === id);
          state.gastos = state.gastos.filter(g => g.id !== id);
          if (gasto) {
            // remover uma transação equivalente (heurística)
            const idx = state.transacoes.findIndex(t =>
              t.contaId === gasto.contaIdVinculada &&
              Number(t.valor) === Number(gasto.valor) &&
              (t.dataISO || '').slice(0,10) === (gasto.dataISO || '').slice(0,10) &&
              (t.descricao || '').toLowerCase() === (gasto.descricao || 'gasto').toLowerCase()
            );
            if (idx >= 0) state.transacoes.splice(idx,1);
          }
          recalcSaldos(); saveState(state);
          renderGastos(); renderTransacoes(); renderContasTable(); renderDashboard();
        } else if (act === 'edit') {
          const g = state.gastos.find(x => x.id === id); if (!g) return;
          $('#gasto-id').value = g.id;
          $('#gasto-data').value = g.dataISO || '';
          renderTitularOptions($('#gasto-titular')); $('#gasto-titular').value = g.titularNome || '';
          renderBancoOptionsForTitular($('#gasto-banco'), g.titularNome || ''); $('#gasto-banco').value = g.banco || '';
          $('#gasto-desc').value = g.descricao || '';
          $('#gasto-valor').value = g.valor || 0;
          $('#gasto-modal-title').textContent = 'Editar Gasto';
          openModal('gasto-modal');
        }
      });
    }
  }

  // TRANSFERÊNCIAS
  function renderTransacoes() {
    const tbody = $('#tbl-transacoes-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.transacoes].sort((a,b)=> (a.dataISO||'').localeCompare(b.dataISO||'')).reverse();
    ordered.forEach(t => {
      const isTransfer = !!(t.deContaId && t.paraContaId);
      let deNome = '-', paraNome = '-';
      if (isTransfer) {
        const de = state.contas.find(c => c.id === t.deContaId);
        const para = state.contas.find(c => c.id === t.paraContaId);
        deNome = de ? `${de.titularNome} - ${de.tipoConta} (${de.banco||'-'})` : '-';
        paraNome = para ? `${para.titularNome} - ${para.tipoConta} (${para.banco||'-'})` : '-';
      }
      const tipoBadge = isTransfer ? '<span class="badge transfer">Transferência</span>' :
                        (t.categoriaId ? '<span class="badge despesa">Despesa</span>' : '<span class="badge receita">Receita</span>');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(t.dataISO||'').slice(0,10)}</td>
        <td>${tipoBadge}</td>
        <td>${deNome}</td>
        <td>${paraNome}</td>
        <td style="text-align:right">${fmtMoney(t.valor)}</td>
        <td>${t.descricao || ''}</td>
        <td>
          <button class="btn" data-act="edit" data-id="${t.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${t.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindTransacoes() {
    // abrir modal
    const btn = $('#btn-open-transfer-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#transfer-form').reset();
      $('#transfer-id').value = '';
      $('#transfer-modal-title').textContent = 'Nova Transferência';
      renderTitularOptions($('#transfer-de-titular'));
      renderTitularOptions($('#transfer-para-titular'));
      renderBancoOptionsForTitular($('#transfer-de-banco'), '');
      renderBancoOptionsForTitular($('#transfer-para-banco'), '');
      openModal('transfer-modal');
    });

    // dependências
    const deTit = $('#transfer-de-titular');
    const paraTit = $('#transfer-para-titular');
    if (deTit) deTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#transfer-de-banco'), deTit.value || ''));
    if (paraTit) paraTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#transfer-para-banco'), paraTit.value || ''));

    renderTransacoes();

    const form = $('#transfer-form');
    if (form) {
      form.addEventListener('submit', function(e){
        e.preventDefault();
        const idEdit = $('#transfer-id').value;
        const dataISO = $('#transfer-data').value || todayISO();
        const valor = Number(($('#transfer-valor').value || '0').replace(',', '.'));
        const descricao = $('#transfer-desc').value || '';
        const deTitular = $('#transfer-de-titular').value || '';
        const deBanco = $('#transfer-de-banco').value || '';
        const paraTitular = $('#transfer-para-titular').value || '';
        const paraBanco = $('#transfer-para-banco').value || '';

        if (!deTitular || !deBanco) { alert('Selecione titular e banco de origem.'); return; }
        if (!paraTitular || !paraBanco) { alert('Selecione titular e banco de destino.'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Valor inválido.'); return; }

        const deConta = findContaByTitularAndBanco(deTitular, deBanco);
        const paraConta = findContaByTitularAndBanco(paraTitular, paraBanco);

        if (!deConta) { alert('Conta de origem não encontrada.'); return; }
        if (!paraConta) { alert('Conta de destino não encontrada.'); return; }
        if (deConta.id === paraConta.id) { alert('Selecione contas diferentes.'); return; }

        if (idEdit) {
          const t = state.transacoes.find(x=>x.id===idEdit);
          if (t) { t.dataISO=dataISO; t.valor=valor; t.descricao=descricao||'Transferência'; t.deContaId=deConta.id; t.paraContaId=paraConta.id; t.contaId=null; t.categoriaId=null; }
        } else {
          state.transacoes.push({
            id: uid(), dataISO, contaId: null, valor, categoriaId: null,
            descricao: descricao || 'Transferência', deContaId: deConta.id, paraContaId: paraConta.id
          });
        }

        recalcSaldos(); saveState(state);
        renderTransacoes(); renderContasTable(); renderDashboard();
        closeModal('transfer-modal');
      });
    }

    // ações tabela
    const tbody = $('#tbl-transacoes-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
          state.transacoes = state.transacoes.filter(t => t.id !== id);
          recalcSaldos(); saveState(state);
          renderTransacoes(); renderContasTable(); renderDashboard();
        } else if (act === 'edit') {
          const t = state.transacoes.find(x => x.id === id); if (!t) return;
          $('#transfer-id').value = t.id;
          $('#transfer-data').value = t.dataISO || '';
          renderTitularOptions($('#transfer-de-titular'));
          renderTitularOptions($('#transfer-para-titular'));
          // Preencher selects com base nas contas
          const de = state.contas.find(c => c.id === t.deContaId);
          const para = state.contas.find(c => c.id === t.paraContaId);
          $('#transfer-de-titular').value = de ? de.titularNome : '';
          renderBancoOptionsForTitular($('#transfer-de-banco'), de ? de.titularNome : ''); $('#transfer-de-banco').value = de ? (de.banco||'') : '';
          $('#transfer-para-titular').value = para ? para.titularNome : '';
          renderBancoOptionsForTitular($('#transfer-para-banco'), para ? para.titularNome : ''); $('#transfer-para-banco').value = para ? (para.banco||'') : '';
          $('#transfer-valor').value = t.valor || 0;
          $('#transfer-desc').value = t.descricao || '';
          $('#transfer-modal-title').textContent = 'Editar Transferência';
          openModal('transfer-modal');
        }
      });
    }
  }

  // SALÁRIOS
  function ensureCategoriaSalario() {
    let cat = state.categorias.find(c => c.nome.toLowerCase() === 'salário' && c.tipo === 'receita');
    if (!cat) { cat = { id: uid(), nome: 'Salário', tipo: 'receita' }; state.categorias.push(cat); }
    return cat;
  }
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
        <td>
          <button class="btn" data-act="edit" data-id="${s.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${s.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindSalarios() {
    // abrir modal
    const btn = $('#btn-open-salario-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#salario-form').reset();
      $('#salario-id').value = '';
      $('#salario-modal-title').textContent = 'Novo Salário';
      renderTitularOptions($('#salario-titular'));
      renderBancoOptionsForTitular($('#salario-banco'), '');
      openModal('salario-modal');
    });

    // dependência
    const selTit = $('#salario-titular');
    if (selTit) selTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#salario-banco'), selTit.value || ''));

    renderSalarios();

    // submit
    const form = $('#salario-form'); if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = $('#salario-id').value;
        const nome = $('#salario-titular').value || '';
        const banco = $('#salario-banco').value || '';
        const valor = Number(($('#salario-valor').value || '0').replace(',', '.'));
        const horas = Number(($('#salario-horas').value || '0').replace(',', '.'));
        const dataISO = $('#salario-data').value || todayISO();

        if (!nome.trim()) { alert('Selecione o titular.'); return; }
        if (!banco.trim()) { alert('Selecione o banco.'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Informe um valor de salário válido.'); return; }

        const conta = findContaByTitularAndBanco(nome, banco);
        if (!conta) { alert('Conta não encontrada para este titular e banco.'); return; }

        const catSalario = ensureCategoriaSalario();

        if (idEdit) {
          const s = state.salarios.find(x=>x.id===idEdit);
          if (s) { s.dataISO=dataISO; s.nome=nome.trim(); s.banco=banco.trim(); s.horas=isNaN(horas)?null:horas; s.valor=isNaN(valor)?0:valor; s.contaIdVinculada=conta.id; }
          // não reconstruo transações antigas por simplicidade
        } else {
          state.salarios.push({
            id: uid(), dataISO, nome: nome.trim(), banco: banco.trim(),
            horas: isNaN(horas) ? null : horas, valor: isNaN(valor) ? 0 : valor, contaIdVinculada: conta.id
          });
        }

        state.transacoes.push({
          id: uid(), dataISO, contaId: conta.id, valor,
          categoriaId: catSalario.id, descricao: `Salário ${nome.trim()}`,
          deContaId: null, paraContaId: null
        });

        recalcSaldos();
        saveState(state);
        renderSalarios(); renderTransacoes(); renderContasTable(); renderDashboard();
        closeModal('salario-modal');
      });
    }

    // ações
    const tbody = $('#tbl-salarios-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
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
          recalcSaldos(); saveState(state);
          renderSalarios(); renderTransacoes(); renderContasTable(); renderDashboard();
        } else if (act === 'edit') {
          const s = state.salarios.find(x => x.id === id); if (!s) return;
          $('#salario-id').value = s.id;
          $('#salario-data').value = s.dataISO || '';
          renderTitularOptions($('#salario-titular')); $('#salario-titular').value = s.nome || '';
          renderBancoOptionsForTitular($('#salario-banco'), s.nome || ''); $('#salario-banco').value = s.banco || '';
          $('#salario-horas').value = (typeof s.horas === 'number' ? s.horas : '');
          $('#salario-valor').value = s.valor || 0;
          $('#salario-modal-title').textContent = 'Editar Salário';
          openModal('salario-modal');
        }
      });
    }
  }

  // CATEGORIAS
  function renderCategorias() {
    const tbody = $('#tbl-categorias-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = state.categorias.slice().sort((a,b)=> sortAsc(a.nome||'', b.nome||'') || sortAsc(a.tipo||'', b.tipo||''));
    ordered.forEach(cat => {
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
  }
  function bindCategorias() {
    // abrir modal
    const btn = $('#btn-open-categoria-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#categoria-form').reset();
      $('#categoria-id').value = '';
      $('#categoria-modal-title').textContent = 'Nova Categoria';
      openModal('categoria-modal');
    });

    renderCategorias();

    // submit
    const form = $('#categoria-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = $('#categoria-id').value;
        const nome = ($('#categoria-nome') || {}).value || '';
        const tipo = ($('#categoria-tipo') || {}).value || 'despesa';
        if (!nome.trim()) { alert('Informe o nome.'); return; }
        if (idEdit) {
          const c = state.categorias.find(x => x.id === idEdit);
          if (c) { c.nome = nome.trim(); c.tipo = tipo; }
        } else {
          state.categorias.push({ id: uid(), nome: nome.trim(), tipo });
        }
        saveState(state);
        renderCategorias();
        closeModal('categoria-modal');
      });
    }

    // ações
    const tbody = $('#tbl-categorias-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir categoria?')) return;
          state.categorias = state.categorias.filter(c => c.id !== id);
          saveState(state);
          renderCategorias();
        } else if (act === 'edit') {
          const c = state.categorias.find(x => x.id === id);
          if (!c) return;
          $('#categoria-id').value = c.id;
          $('#categoria-nome').value = c.nome;
          $('#categoria-tipo').value = c.tipo;
          $('#categoria-modal-title').textContent = 'Editar Categoria';
          openModal('categoria-modal');
        }
      });
    }
  }

  // DESPESAS FIXAS
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
    const ordered = [...state.recorrentes].sort((a,b)=> sortAsc(a.titularNome||'', b.titularNome||'') || sortAsc(a.nome||'', b.nome||''));
    ordered.forEach(r => {
      const venc = r.dataISO ? (r.dataISO || '').slice(0,10) : '';
      const semanaDia = humanizeSemanaDia(r.semanaDoMes, r.diaDaSemana);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.nome || '(sem nome)'}</td>
        <td>${r.titularNome || '-'}</td>
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
    // abrir modal
    const btn = $('#btn-open-recorrente-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#recorrente-form').reset();
      $('#recorrente-id').value = '';
      $('#recorrente-modal-title').textContent = 'Nova Despesa Fixa';
      renderCategoriaOptions($('#recorrente-categoria'), 'despesa');
      renderTitularOptions($('#recorrente-titular'));
      openModal('recorrente-modal');
    });

    renderRecorrentes();

    // submit
    const form = $('#recorrente-form'); if (form) {
      form.addEventListener('submit', function(e){
        e.preventDefault();
        const idEdit = $('#recorrente-id').value;
        const categoriaId = $('#recorrente-categoria').value || '';
        const valor = Number(($('#recorrente-valor').value || '0').replace(',', '.'));
        const dataISO = $('#recorrente-data').value || '';
        const semana = $('#recorrente-semana').value || '';
        const dia = $('#recorrente-dia').value || '';
        const titularNome = $('#recorrente-titular').value || '';

        if (!categoriaId) { alert('Selecione o Nome (Tipo de Despesa).'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }
        if (!titularNome.trim()) { alert('Selecione o titular responsável.'); return; }

        const cat = state.categorias.find(c => c.id === categoriaId);
        const nome = cat ? cat.nome : '';
        const semanaNum = semana ? Number(semana) : null;
        const diaNum = (dia || dia === '0') ? Number(dia) : null;

        if (idEdit) {
          const r = state.recorrentes.find(x => x.id === idEdit);
          if (r) {
            r.categoriaId=categoriaId; r.nome=nome; r.valor=valor; r.dataISO=dataISO;
            r.semanaDoMes=semanaNum||null; r.diaDaSemana=(dia !== '' ? diaNum : null);
            r.titularNome = titularNome.trim();
          }
        } else {
          state.recorrentes.push({
            id: uid(), categoriaId, nome, valor, dataISO,
            semanaDoMes: semanaNum||null, diaDaSemana: (dia !== '' ? diaNum : null),
            titularNome: titularNome.trim()
          });
        }
        saveState(state); renderRecorrentes(); renderDashboard(); closeModal('recorrente-modal');
      });
    }

    // ações
    const tbody = $('#tbl-recorrentes-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]'); if (!btn) return;
        const id = btn.getAttribute('data-id'); const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir esta Despesa Fixa?')) return;
          state.recorrentes = state.recorrentes.filter(r => r.id !== id);
          saveState(state); renderRecorrentes(); renderDashboard();
        } else if (act === 'edit') {
          const r = state.recorrentes.find(x => x.id === id); if (!r) return;
          $('#recorrente-id').value = r.id;
          renderCategoriaOptions($('#recorrente-categoria'), 'despesa'); $('#recorrente-categoria').value = r.categoriaId || '';
          $('#recorrente-valor').value = r.valor || 0;
          $('#recorrente-data').value = r.dataISO || '';
          $('#recorrente-semana').value = r.semanaDoMes || '';
          $('#recorrente-dia').value = (r.diaDaSemana === 0 ? '0' : (r.diaDaSemana || ''));
          renderTitularOptions($('#recorrente-titular')); $('#recorrente-titular').value = r.titularNome || '';
          $('#recorrente-modal-title').textContent = 'Editar Despesa Fixa';
          openModal('recorrente-modal');
        }
      });
    }
  }

  // DÍVIDAS
  function humanizeSemana(semana) { return semana ? `${semana}ª` : ''; }
  function renderDividas() {
    const tbody = $('#tbl-dividas-body'); if (!tbody) return;
    tbody.innerHTML = '';
    const ordered = [...state.dividas].sort((a,b)=> sortAsc(a.titularNome||'', b.titularNome||'') || sortAsc(a.nome||'', b.nome||''));
    ordered.forEach(d => {
      const venc = d.vencimentoISO ? (d.vencimentoISO || '').slice(0,10) : '-';
      const fim = d.fimISO ? (d.fimISO || '').slice(0,10) : '-';
      const semana = humanizeSemana(d.semanaDoMes);
      const titular = d.titularNome || '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.nome || '(sem nome)'}</td>
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
  }
  function bindDividas() {
    // abrir modal
    const btn = $('#btn-open-divida-modal');
    if (btn) btn.addEventListener('click', () => {
      $('#divida-form').reset();
      $('#divida-id').value = '';
      $('#divida-modal-title').textContent = 'Nova Dívida';
      renderCategoriaOptions($('#divida-categoria'), 'despesa');
      renderTitularOptions($('#divida-titular'));
      openModal('divida-modal');
    });

    renderDividas();

    // submit
    const form = $('#divida-form'); if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const idEdit = $('#divida-id').value;
      const categoriaId = $('#divida-categoria').value || '';
      const valor = Number(($('#divida-valor') || {}).value || '0');
      const vencimentoISO = $('#divida-vencimento').value || '';
      const fimISO = $('#divida-fim').value || '';
      const semana = $('#divida-semana').value || '';
      const titularNome = $('#divida-titular').value || '';

      if (!categoriaId) { alert('Selecione o Nome da dívida (Tipo de Despesa).'); return; }
      if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }
      if (!titularNome.trim()) { alert('Selecione o titular da dívida.'); return; }

      const cat = state.categorias.find(c => c.id === categoriaId);
      const nome = cat ? cat.nome : '';
      const semanaNum = semana ? Number(semana) : null;

      if (idEdit) {
        const d = state.dividas.find(x => x.id === idEdit);
        if (d) { d.categoriaId=categoriaId; d.nome=nome; d.valor=valor; d.vencimentoISO=vencimentoISO; d.fimISO=fimISO; d.semanaDoMes=semanaNum||null; d.titularNome=titularNome.trim(); }
      } else {
        state.dividas.push({ id: uid(), categoriaId, nome, valor, vencimentoISO, fimISO, semanaDoMes: semanaNum||null, titularNome: titularNome.trim() });
      }

      saveState(state);
      renderDividas();
      renderDashboard();
      closeModal('divida-modal');
    });

    // ações
    const tbody = $('#tbl-dividas-body');
    if (tbody) {
      tbody.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-act]'); if (!btn) return;
        const id = btn.getAttribute('data-id'); const act = btn.getAttribute('data-act');
        if (act === 'del') {
          if (!confirm('Excluir esta Dívida?')) return;
          state.dividas = state.dividas.filter(d => d.id !== id);
          saveState(state); renderDividas(); renderDashboard();
        } else if (act === 'edit') {
          const d = state.dividas.find(x => x.id === id); if (!d) return;
          $('#divida-id').value = d.id;
          renderCategoriaOptions($('#divida-categoria'), 'despesa'); $('#divida-categoria').value = d.categoriaId || '';
          $('#divida-valor').value = d.valor || 0;
          $('#divida-vencimento').value = d.vencimentoISO || '';
          $('#divida-fim').value = d.fimISO || '';
          $('#divida-semana').value = d.semanaDoMes || '';
          renderTitularOptions($('#divida-titular')); $('#divida-titular').value = d.titularNome || '';
          $('#divida-modal-title').textContent = 'Editar Dívida';
          openModal('divida-modal');
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
    if (tabId === 'tab-dashboard') renderDashboard();
  }
  function bindNav() {
    $all('[data-tab]').forEach(btn => { btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab'))); });
    const btnSair = $('#btn-sair'); if (btnSair) btnSair.addEventListener('click', () => { window.location.href = 'login.html'; });
  }

  // INIT
  function init() {
    bindModalEvents();
    bindNav();
    bindContas();
    bindGastos();
    bindTransacoes();
    bindSalarios();
    bindCategorias();
    bindRecorrentes();
    bindDividas();

    const firstPane = document.querySelector('.tab-pane');
    if (firstPane) showTab(firstPane.id);
    renderDashboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
