// FinPilot IE - LocalStorage (EUR)
// Pessoa (Titular) como texto livre no modal de contas
// "Nome da Conta" renomeado para "Tipo de Conta"
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
    contas: [],       // {id, titularNome, banco, tipoConta, saldoInicial, saldoAtual, pessoaId}
    categorias: [],   // {id, nome, tipo}
    transacoes: [],   // {id, dataISO, contaId, valor, categoriaId, descricao, deContaId, paraContaId}
    salarios: [],     // {id, dataISO, nome, banco, horas, valor, contaIdVinculada}
    recorrentes: [],  // {id, categoriaId, nome, valor, dataISO?, semanaDoMes?, diaDaSemana?, titularNome?}
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

  // Semeadura inicial
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
  // Garantir categoria Salário
  if (!state.categorias.find(c => c.nome.toLowerCase() === 'salário' && c.tipo === 'receita')) {
    state.categorias.push({ id: uid(), nome: 'Salário', tipo: 'receita' });
    saveState(state);
  }

  // Helpers
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
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  }
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  }
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

    // Dívidas por Título e Titular
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

  // Contas
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
    const selDeTit = $('#tx-de-titular');
    const selParaTit = $('#tx-para-titular');
    renderTitularOptions(selDeTit);
    renderTitularOptions(selParaTit);
  }
  function bindContas() {
    renderContasTable();
    renderContasSelectsForTransfers();

    // "+ Nova conta" abre modal limpo
    const btnOpenAccount = $('#btn-open-account-modal');
    if (btnOpenAccount) {
      btnOpenAccount.addEventListener('click', () => {
        const form = $('#account-form');
        if (form) form.reset();
        $('#account-id').value = '';
        $('#account-owner-name').value = '';
        const title = $('#account-modal-title');
        if (title) title.textContent = 'Nova Conta';
        openModal('account-modal');
      });
    }

    // Suporte legado (se existir um form antigo)
    const legacyForm = $('#form-conta');
    if (legacyForm) {
      legacyForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = legacyForm.getAttribute('data-edit-id');
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
          legacyForm.removeAttribute('data-edit-id');
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

        renderTitularOptions($('#gs-titular'));
        renderTitularOptions($('#sl-nome'));
        renderTitularOptions($('#rc-titular'));
        renderTitularOptions($('#dv-titular'));
        renderBancoOptionsForTitular($('#gs-banco'), ($('#gs-titular')||{}).value || '');
        renderBancoOptionsForTitular($('#sl-banco'), ($('#sl-nome')||{}).value || '');

        legacyForm.reset();
      });
    }

    // Modal form (campo de pessoa é texto livre)
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

        // Encontrar/criar pessoa
        let pessoa = state.pessoas.find(p => (p.nome || '').trim().toLowerCase() === pessoaNome.toLowerCase());
        if (!pessoa) {
          pessoa = { id: uid(), nome: pessoaNome };
          state.pessoas.push(pessoa);
        }

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
            id: uid(),
            titularNome: pessoa.nome,
            tipoConta,
            banco,
            pessoaId: pessoa.id,
            saldoInicial,
            saldoAtual: saldoInicial
          });
        }

        recalcSaldos();
        saveState(state);
        renderContasTable();
        renderContasSelectsForTransfers();
        renderDashboard();

        // Atualiza selects noutras abas
        renderTitularOptions($('#gs-titular'));
        renderTitularOptions($('#sl-nome'));
        renderTitularOptions($('#rc-titular'));
        renderTitularOptions($('#dv-titular'));

        closeModal('account-modal');
        modalForm.reset();
        $('#account-id').value = '';
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
          renderTitularOptions($('#rc-titular'));
          renderTitularOptions($('#dv-titular'));
          renderGastos();
          renderTransacoes();
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

  // Categorias
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

    renderCategoriaOptions($('#rc-categoria'), 'despesa');
    renderCategoriaOptions($('#dv-categoria'), 'despesa');
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
          if (!confirm('Excluir categoria?')) return;
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

  // Gastos
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

      let catGasto = state.categorias.find(c => c.nome.toLowerCase() === 'gasto' && c.tipo === 'despesa');
      if (!catGasto) { catGasto = { id: uid(), nome: 'Gasto', tipo: 'despesa' }; state.categorias.push(catGasto); }

      state.gastos.push({
        id: uid(), dataISO, titularNome, banco, descricao, valor, contaIdVinculada: conta.id
      });

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

  // Transferências
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
        <td><button class="btn danger" data-act="del" data-id="${t.id}">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  function bindTransacoes() {
    renderContasSelectsForTransfers();
    renderTransacoes();

    const txDeTit = $('#tx-de-titular');
    const txParaTit = $('#tx-para-titular');
    if (txDeTit) txDeTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#tx-de-banco'), txDeTit.value || ''));
    if (txParaTit) txParaTit.addEventListener('change', ()=> renderBancoOptionsForTitular($('#tx-para-banco'), txParaTit.value || ''));

    const form = $('#form-transacao');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const dataISO = ($('#tx-data') || {}).value || todayISO();
        const valor = Number((($('#tx-valor') || {}).value || '0').replace(',', '.'));
        const descricao = ($('#tx-desc') || {}).value || '';
        const deTitular = ($('#tx-de-titular') || {}).value || '';
        const deBanco = ($('#tx-de-banco') || {}).value || '';
        const paraTitular = ($('#tx-para-titular') || {}).value || '';
        const paraBanco = ($('#tx-para-banco') || {}).value || '';

        if (!deTitular || !deBanco) { alert('Selecione titular e banco de origem.'); return; }
        if (!paraTitular || !paraBanco) { alert('Selecione titular e banco de destino.'); return; }
        if (isNaN(valor) || valor <= 0) { alert('Valor inválido.'); return; }

        const deContaId = findContaByTitularAndBanco(deTitular, deBanco);
        const paraContaId = findContaByTitularAndBanco(paraTitular, paraBanco);

        if (!deContaId) { alert('Conta de origem não encontrada.'); return; }
        if (!paraContaId) { alert('Conta de destino não encontrada.'); return; }
        if (deContaId.id === paraContaId.id) { alert('Selecione contas diferentes.'); return; }

        state.transacoes.push({
          id: uid(), dataISO, contaId: null, valor, categoriaId: null,
          descricao: descricao || 'Transferência', deContaId: deContaId.id, paraContaId: paraContaId.id
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

  // Salários
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

  // Despesas fixas
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

    renderCategoriaOptions($('#rc-categoria'), 'despesa');
    renderTitularOptions($('#rc-titular'));
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
      const titularNome = ($('#rc-titular') || {}).value || '';

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
        form.removeAttribute('data-edit-id');
      } else {
        state.recorrentes.push({
          id: uid(), categoriaId, nome, valor, dataISO,
          semanaDoMes: semanaNum||null, diaDaSemana: (dia !== '' ? diaNum : null),
          titularNome: titularNome.trim()
        });
      }
      saveState(state); renderRecorrentes(); renderDashboard(); form.reset();
    });

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
          ($('#rc-categoria')||{}).value = r.categoriaId || '';
          ($('#rc-valor')||{}).value = String(r.valor || 0);
          ($('#rc-data')||{}).value = r.dataISO || '';
          ($('#rc-semana')||{}).value = r.semanaDoMes || '';
          ($('#rc-dia-semana')||{}).value = (r.diaDaSemana === 0 ? '0' : (r.diaDaSemana || ''));
          ($('#rc-titular')||{}).value = r.titularNome || '';
          form.setAttribute('data-edit-id', r.id);
        }
      });
    }
  }

  // Dívidas
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

    renderCategoriaOptions($('#dv-categoria'), 'despesa');
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
      renderDashboard();
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
          saveState(state); renderDividas(); renderDashboard();
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

  // Navegação
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

  // Init
  function init() {
    bindModalEvents();
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
