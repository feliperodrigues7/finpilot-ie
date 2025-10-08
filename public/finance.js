// FinPilot IE - LocalStorage only (EUR padrão)
// Tabs: contas, transacoes, categorias, recorrentes, orcamento, dividas, relatorios, configuracoes
// Tudo ASCII-safe. Nenhuma dependência externa.

(function () {
  'use strict';

  // Util
  const CURRENCY = 'EUR';
  const LS_KEY = 'finpilot_ie_v1';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function fmtMoney(v) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-PT', { style: 'currency', currency: CURRENCY });
  }
  function uid() { return 'id_' + Math.random().toString(36).slice(2, 10); }

  // Estado inicial
  const defaultState = {
    pessoas: [], // [{id, nome}]
    contas: [],  // [{id, nome, banco, saldoInicial, saldoAtual, pessoaId}]
    categorias: [], // [{id, nome, tipo: 'despesa'|'receita'}]
    transacoes: [], // [{id, dataISO, contaId, valor, categoriaId, descricao, deContaId, paraContaId}]
    recorrentes: [], // flexível (não utilizado aqui)
    orcamentos: [],  // flexível (não utilizado aqui)
    dividas: []      // flexível (não utilizado aqui)
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch (e) {
      console.warn('Erro ao carregar estado:', e);
      return { ...defaultState };
    }
  }

  function saveState(st) {
    localStorage.setItem(LS_KEY, JSON.stringify(st));
  }

  let state = loadState();

  // Semeadura inicial (se quiser algo visível)
  if (state.pessoas.length === 0) {
    const p1 = { id: uid(), nome: 'Eu' };
    const p2 = { id: uid(), nome: 'Cônjuge' };
    state.pessoas.push(p1, p2);
    const c1 = { id: uid(), nome: 'Conta Principal', banco: 'Meu Banco', saldoInicial: 1000, saldoAtual: 1000, pessoaId: p1.id };
    const c2 = { id: uid(), nome: 'Conta Cônjuge', banco: 'Banco Cônjuge', saldoInicial: 800, saldoAtual: 800, pessoaId: p2.id };
    state.contas.push(c1, c2);
    state.categorias.push(
      { id: uid(), nome: 'Salário', tipo: 'receita' },
      { id: uid(), nome: 'Renda', tipo: 'despesa' },
      { id: uid(), nome: 'Compras Mercado', tipo: 'despesa' },
      { id: uid(), nome: 'Serviços (Luz/Água/Internet)', tipo: 'despesa' }
    );
    saveState(state);
  }

  // Tabs
  function showTab(tabId) {
    $all('.tab-pane').forEach(el => el.style.display = 'none');
    const el = document.getElementById(tabId);
    if (el) el.style.display = 'block';
    $all('[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  // Render helpers
  function renderPessoasOptions(selectEl, includeBlank) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    if (includeBlank) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Selecione';
      selectEl.appendChild(opt);
    }
    state.pessoas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome;
      selectEl.appendChild(opt);
    });
  }

  function renderContasTable() {
    const tbody = $('#tbl-contas-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.contas.forEach(c => {
      const p = state.pessoas.find(x => x.id === c.pessoaId);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.nome}</td>
        <td>${c.banco || ''}</td>
        <td>${p ? p.nome : ''}</td>
        <td style="text-align:right">${fmtMoney(c.saldoInicial)}</td>
        <td style="text-align:right">${fmtMoney(c.saldoAtual)}</td>
        <td>
          <button data-act="edit" data-id="${c.id}">Editar</button>
          <button data-act="del" data-id="${c.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderContasSelects() {
    const selConta = $('#tx-conta');
    const selDe = $('#tx-de-conta');
    const selPara = $('#tx-para-conta');
    [selConta, selDe, selPara].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Selecione';
      sel.appendChild(blank);
      state.contas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome} (${c.banco || '-'})`;
        sel.appendChild(opt);
      });
    });
  }

  function renderCategorias() {
    const tbody = $('#tbl-categorias-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.categorias.forEach(cat => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${cat.nome}</td>
        <td>${cat.tipo}</td>
        <td>
          <button data-act="edit" data-id="${cat.id}">Editar</button>
          <button data-act="del" data-id="${cat.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // selects de transações
    const selCat = $('#tx-categoria');
    if (selCat) {
      selCat.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Selecione';
      selCat.appendChild(blank);
      state.categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.nome} (${cat.tipo})`;
        selCat.appendChild(opt);
      });
    }
  }

  function renderTransacoes() {
    const tbody = $('#tbl-transacoes-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const ordered = [...state.transacoes].sort((a, b) => (a.dataISO || '').localeCompare(b.dataISO || '')).reverse();

    ordered.forEach(t => {
      const conta = state.contas.find(c => c.id === t.contaId);
      const cat = state.categorias.find(c => c.id === t.categoriaId);
      const isTransfer = !!(t.deContaId && t.paraContaId);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(t.dataISO || '').slice(0,10)}</td>
        <td>${isTransfer ? 'Transferência' : (cat ? cat.nome : '')}</td>
        <td>${conta ? conta.nome : (isTransfer ? '-' : '')}</td>
        <td style="text-align:right">${fmtMoney(t.valor)}</td>
        <td>${t.descricao || ''}</td>
        <td>
          <button data-act="del" data-id="${t.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function recalcSaldos() {
    // recomputa saldoAtual a partir de saldoInicial + transações
    state.contas.forEach(c => c.saldoAtual = Number(c.saldoInicial || 0));
    state.transacoes.forEach(t => {
      if (t.deContaId && t.paraContaId) {
        // transferência
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

  // Handlers: Contas
  function bindContas() {
    // povoar selects
    renderPessoasOptions($('#ct-pessoa'), true);
    renderContasTable();
    renderContasSelects();

    const form = $('#form-conta');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const nome = ($('#ct-nome') || {}).value || '';
        const banco = ($('#ct-banco') || {}).value || '';
        const pessoaId = ($('#ct-pessoa') || {}).value || '';
        const saldoInicial = Number((($('#ct-saldo-inicial') || {}).value || '0').replace(',', '.'));
        if (!nome || !pessoaId) {
          alert('Informe nome e pessoa.');
          return;
        }
        if (idEdit) {
          const c = state.contas.find(x => x.id === idEdit);
          if (c) {
            c.nome = nome;
            c.banco = banco;
            c.pessoaId = pessoaId;
            // ajustar saldoInicial altera recomputação
            c.saldoInicial = isNaN(saldoInicial) ? 0 : saldoInicial;
          }
          form.removeAttribute('data-edit-id');
        } else {
          const c = {
            id: uid(),
            nome,
            banco,
            pessoaId,
            saldoInicial: isNaN(saldoInicial) ? 0 : saldoInicial,
            saldoAtual: isNaN(saldoInicial) ? 0 : saldoInicial
          };
          state.contas.push(c);
        }
        recalcSaldos();
        saveState(state);
        renderContasTable();
        renderContasSelects();
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
          if (!confirm('Excluir conta? Isso não remove transações vinculadas; saldos serão recalculados.')) return;
          state.contas = state.contas.filter(c => c.id !== id);
          // remover transações ligadas à conta ou transferências que envolvam
          state.transacoes = state.transacoes.filter(t =>
            t.contaId !== id && t.deContaId !== id && t.paraContaId !== id
          );
          recalcSaldos();
          saveState(state);
          renderContasTable();
          renderContasSelects();
          renderTransacoes();
        } else if (act === 'edit') {
          const c = state.contas.find(x => x.id === id);
          if (!c) return;
          ($('#ct-nome') || {}).value = c.nome;
          ($('#ct-banco') || {}).value = c.banco || '';
          ($('#ct-pessoa') || {}).value = c.pessoaId || '';
          ($('#ct-saldo-inicial') || {}).value = String(c.saldoInicial);
          const form = $('#form-conta');
          if (form) form.setAttribute('data-edit-id', c.id);
        }
      });
    }
  }

  // Handlers: Categorias
  function bindCategorias() {
    renderCategorias();
    const form = $('#form-categoria');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const nome = ($('#cat-nome') || {}).value || '';
        const tipo = ($('#cat-tipo') || {}).value || 'despesa';
        if (!nome) {
          alert('Informe o nome da categoria.');
          return;
        }
        if (idEdit) {
          const c = state.categorias.find(x => x.id === idEdit);
          if (c) {
            c.nome = nome;
            c.tipo = tipo;
          }
          form.removeAttribute('data-edit-id');
        } else {
          state.categorias.push({ id: uid(), nome, tipo });
        }
        saveState(state);
        renderCategorias();
        form.reset();
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
          if (!confirm('Excluir categoria? Transações com esta categoria permanecerão sem categoria.')) return;
          state.categorias = state.categorias.filter(c => c.id !== id);
          state.transacoes.forEach(t => {
            if (t.categoriaId === id) t.categoriaId = null;
          });
          saveState(state);
          renderCategorias();
          renderTransacoes();
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

  // Handlers: Transações (inclui transferências)
  function bindTransacoes() {
    renderContasSelects();
    renderCategorias();
    renderTransacoes();

    const form = $('#form-transacao');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const dataISO = ($('#tx-data') || {}).value || new Date().toISOString().slice(0,10);
        const contaId = ($('#tx-conta') || {}).value || '';
        const categoriaId = ($('#tx-categoria') || {}).value || '';
        const valor = Number((($('#tx-valor') || {}).value || '0').replace(',', '.'));
        const descricao = ($('#tx-descricao') || {}).value || '';

        const deContaId = ($('#tx-de-conta') || {}).value || '';
        const paraContaId = ($('#tx-para-conta') || {}).value || '';

        const isTransfer = deContaId && paraContaId;

        if (isTransfer) {
          if (deContaId === paraContaId) {
            alert('Selecione contas diferentes para transferência.');
            return;
          }
          if (isNaN(valor) || valor <= 0) {
            alert('Informe um valor válido para a transferência.');
            return;
          }
          state.transacoes.push({
            id: uid(),
            dataISO,
            contaId: null,
            valor,
            categoriaId: null,
            descricao: descricao || 'Transferência',
            deContaId,
            paraContaId
          });
        } else {
          if (!contaId || !categoriaId) {
            alert('Selecione conta e categoria.');
            return;
          }
          if (isNaN(valor) || valor <= 0) {
            alert('Informe um valor válido.');
            return;
          }
          state.transacoes.push({
            id: uid(),
            dataISO,
            contaId,
            valor,
            categoriaId,
            descricao,
            deContaId: null,
            paraContaId: null
          });
        }

        recalcSaldos();
        saveState(state);
        renderTransacoes();
        renderContasTable();
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
      });
    }
  }

  // Navegação
  function bindNav() {
    $all('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        showTab(tabId);
      });
    });

    // Botão sair (apenas volta à tela de login.html se existir)
    const btnSair = $('#btn-sair');
    if (btnSair) {
      btnSair.addEventListener('click', () => {
        // para demo local, apenas redireciona
        window.location.href = 'login.html';
      });
    }
  }

  function init() {
    bindNav();
    bindContas();
    bindCategorias();
    bindTransacoes();

    // Abre a primeira aba existente
    const firstPane = document.querySelector('.tab-pane');
    if (firstPane) showTab(firstPane.id);
  }

  // Esperar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
