// FinPilot IE - LocalStorage only (EUR padrão) - MODO CLARO
// Ajustes: Titular como texto, Tipo de Conta no lugar de Nome da Conta
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
  function todayISO() { return new Date().toISOString().slice(0,10); }

  // Estado
  const defaultState = {
    pessoas: [], // [{id, nome}]
    contas: [],  // [{id, titularNome, banco, tipoConta, saldoInicial, saldoAtual, pessoaId}]
    categorias: [], // [{id, nome, tipo}]
    transacoes: [], // [{id, dataISO, contaId, valor, categoriaId, descricao, deContaId, paraContaId}]
    recorrentes: [],
    orcamentos: [],
    dividas: []
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch {
      return { ...defaultState };
    }
  }
  function saveState(st) { localStorage.setItem(LS_KEY, JSON.stringify(st)); }

  let state = loadState();

  // Semeadura amigável
  if (state.pessoas.length === 0) {
    const p1 = { id: uid(), nome: 'Eu' };
    const p2 = { id: uid(), nome: 'Cônjuge' };
    state.pessoas.push(p1, p2);
    state.contas.push(
      { id: uid(), titularNome: 'Eu', banco: 'Meu Banco', tipoConta: 'Corrente', saldoInicial: 1000, saldoAtual: 1000, pessoaId: p1.id },
      { id: uid(), titularNome: 'Cônjuge', banco: 'Banco Cônjuge', tipoConta: 'Poupança', saldoInicial: 800, saldoAtual: 800, pessoaId: p2.id }
    );
    state.categorias.push(
      { id: uid(), nome: 'Salário', tipo: 'receita' },
      { id: uid(), nome: 'Aluguel', tipo: 'despesa' },
      { id: uid(), nome: 'Mercado', tipo: 'despesa' },
      { id: uid(), nome: 'Serviços', tipo: 'despesa' }
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

  // Render Pessoas (apenas utilidades internas)
  function ensurePessoaByName(nome) {
    const n = (nome || '').trim();
    if (!n) return null;
    let p = state.pessoas.find(x => x.nome.toLowerCase() === n.toLowerCase());
    if (!p) {
      p = { id: uid(), nome: n };
      state.pessoas.push(p);
    }
    return p;
  }

  // Contas
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
        opt.textContent = `${c.titularNome} - ${c.tipoConta} (${c.banco || '-'})`;
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
        <td><span class="badge ${cat.tipo}">${cat.tipo}</span></td>
        <td>
          <button class="btn" data-act="edit" data-id="${cat.id}">Editar</button>
          <button class="btn danger" data-act="del" data-id="${cat.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

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
    const ordered = [...state.transacoes].sort((a,b)=> (a.dataISO||'').localeCompare(b.dataISO||'')).reverse();
    ordered.forEach(t => {
      const conta = state.contas.find(c => c.id === t.contaId);
      const cat = state.categorias.find(c => c.id === t.categoriaId);
      const isTransfer = !!(t.deContaId && t.paraContaId);
      const tipoBadge = isTransfer ? '<span class="badge transfer">Transferência</span>' :
                        (cat ? `<span class="badge ${cat.tipo}">${cat.tipo}</span>` : '');
      const contaNome = isTransfer ? '-' : (conta ? `${conta.titularNome} - ${conta.tipoConta}` : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(t.dataISO||'').slice(0,10)}</td>
        <td>${tipoBadge}</td>
        <td>${contaNome}</td>
        <td style="text-align:right">${fmtMoney(t.valor)}</td>
        <td>${t.descricao || ''}</td>
        <td>
          <button class="btn danger" data-act="del" data-id="${t.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
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

  // Bind Contas
  function bindContas() {
    renderContasTable();
    renderContasSelects();

    const form = $('#form-conta');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const titularNome = ($('#ct-titular') || {}).value || '';
        const tipoConta = ($('#ct-tipo') || {}).value || '';
        const banco = ($('#ct-banco') || {}).value || '';
        const saldoInicial = Number((($('#ct-saldo-inicial') || {}).value || '0').replace(',', '.'));

        if (!titularNome.trim() || !tipoConta.trim()) {
          alert('Informe Titular e Tipo de Conta.');
          return;
        }

        const pessoa = ensurePessoaByName(titularNome);
        const pessoaId = pessoa ? pessoa.id : null;

        if (idEdit) {
          const c = state.contas.find(x => x.id === idEdit);
          if (c) {
            c.titularNome = titularNome.trim();
            c.tipoConta = tipoConta.trim();
            c.banco = banco;
            c.pessoaId = pessoaId;
            c.saldoInicial = isNaN(saldoInicial) ? 0 : saldoInicial;
          }
          form.removeAttribute('data-edit-id');
        } else {
          state.contas.push({
            id: uid(),
            titularNome: titularNome.trim(),
            tipoConta: tipoConta.trim(),
            banco,
            pessoaId,
            saldoInicial: isNaN(saldoInicial) ? 0 : saldoInicial,
            saldoAtual: isNaN(saldoInicial) ? 0 : saldoInicial
          });
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
          if (!confirm('Excluir conta? Isso também removerá transferências relacionadas.')) return;
          state.contas = state.contas.filter(c => c.id !== id);
          state.transacoes = state.transacoes.filter(t => t.contaId !== id && t.deContaId !== id && t.paraContaId !== id);
          recalcSaldos();
          saveState(state);
          renderContasTable();
          renderContasSelects();
          renderTransacoes();
        } else if (act === 'edit') {
          const c = state.contas.find(x => x.id === id);
          if (!c) return;
          ($('#ct-titular') || {}).value = c.titularNome || '';
          ($('#ct-tipo') || {}).value = c.tipoConta || '';
          ($('#ct-banco') || {}).value = c.banco || '';
          ($('#ct-saldo-inicial') || {}).value = String(c.saldoInicial || 0);
          const form = $('#form-conta');
          if (form) form.setAttribute('data-edit-id', c.id);
        }
      });
    }
  }

  // Bind Categorias
  function bindCategorias() {
    renderCategorias();
    const form = $('#form-categoria');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const idEdit = form.getAttribute('data-edit-id');
        const nome = ($('#cat-nome') || {}).value || '';
        const tipo = ($('#cat-tipo') || {}).value || 'despesa';
        if (!nome.trim()) {
          alert('Informe o nome da categoria.');
          return;
        }
        if (idEdit) {
          const c = state.categorias.find(x => x.id === idEdit);
          if (c) {
            c.nome = nome.trim();
            c.tipo = tipo;
          }
          form.removeAttribute('data-edit-id');
        } else {
          state.categorias.push({ id: uid(), nome: nome.trim(), tipo });
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
          state.transacoes.forEach(t => { if (t.categoriaId === id) t.categoriaId = null; });
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

  // Bind Transações
  function bindTransacoes() {
    renderContasSelects();
    renderCategorias();
    renderTransacoes();

    const form = $('#form-transacao');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const dataISO = ($('#tx-data') || {}).value || todayISO();
        const contaId = ($('#tx-conta') || {}).value || '';
        const categoriaId = ($('#tx-categoria') || {}).value || '';
        const valor = Number((($('#tx-valor') || {}).value || '0').replace(',', '.'));
        const descricao = ($('#tx-descricao') || {}).value || '';
        const deContaId = ($('#tx-de-conta') || {}).value || '';
        const paraContaId = ($('#tx-para-conta') || {}).value || '';
        const isTransfer = deContaId && paraContaId;

        if (isTransfer) {
          if (deContaId === paraContaId) { alert('Selecione contas diferentes.'); return; }
          if (isNaN(valor) || valor <= 0) { alert('Valor inválido.'); return; }
          state.transacoes.push({
            id: uid(), dataISO, contaId: null, valor, categoriaId: null,
            descricao: descricao || 'Transferência', deContaId, paraContaId
          });
        } else {
          if (!contaId || !categoriaId) { alert('Selecione conta e categoria.'); return; }
          if (isNaN(valor) || valor <= 0) { alert('Valor inválido.'); return; }
          state.transacoes.push({
            id: uid(), dataISO, contaId, valor, categoriaId,
            descricao, deContaId: null, paraContaId: null
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

    const btnSair = $('#btn-sair');
    if (btnSair) btnSair.addEventListener('click', () => { window.location.href = 'login.html'; });
  }

  function init() {
    bindNav();
    bindContas();
    bindCategorias();
    bindTransacoes();
    const firstPane = document.querySelector('.tab-pane');
    if (firstPane) showTab(firstPane.id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
