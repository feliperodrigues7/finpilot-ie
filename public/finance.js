/* FinPilot IE - Frontend LocalStorage
   - Delegação de eventos para todos os botões
   - Modais reutilizáveis
   - Confirmações de exclusão quando solicitado
   - Layout e IDs compatíveis com finance.html acima
*/

(function () {
  // Utilidades
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const fmtEUR = (n) =>
    (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

  const state = {
    gastos: [],
    salarios: [],
    transferencias: [],
    categorias: [],
    fixas: [],
    dividas: [],
    contas: [
      { id: "a1", nome: "Giseli - Corrente", banco: "AIB", titular: "Giseli" },
      { id: "a2", nome: "FR - Poupança", banco: "Revolut", titular: "FR" }
    ],
  };

  const STORAGE_KEY = "finpilot_ie_v1";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // seed leve para telas
        state.categorias = [
          { id: uid(), nome: "Aluguel", tipo: "despesa" },
          { id: uid(), nome: "Convelio", tipo: "despesa" },
          { id: uid(), nome: "Elaine", tipo: "despesa" },
          { id: uid(), nome: "Emprestimo", tipo: "despesa" },
          { id: uid(), nome: "Faculdade", tipo: "despesa" },
          { id: uid(), nome: "GoMo", tipo: "despesa" },
          { id: uid(), nome: "Icloud", tipo: "despesa" },
        ];
        state.salarios = [
          { id: uid(), data: "2025-10-08", titular: "Giseli", banco: "AIB", horas: 43, valor: 550 },
          { id: uid(), data: "2025-10-08", titular: "FR", banco: "AIB", horas: 40, valor: 500 },
          { id: uid(), data: "2025-08-10", titular: "Giseli", banco: "AIB", horas: 35, valor: 520 },
        ];
        state.transferencias = [
          { id: uid(), data: "2025-08-10", tipo: "Transferência", de: "Giseli - Corrente (AIB)", para: "FR - Poupanca (Revolut)", valor: 300, descricao: "300 reais para completar aluguel que sera pago na quinta dia 10/10/2025" },
          { id: uid(), data: "2025-08-10", tipo: "Despesa", de: "-", para: "-", valor: 520, descricao: "Salário Giseli" },
        ];
        state.fixas = [
          { id: uid(), nome: "Convelio", titular: "FR", valor: 47.5, data: "2025-10-19", regra: "1ª • Qua" }
        ];
        persist();
        return;
      }
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
    } catch (e) {
      console.error("Erro ao carregar storage", e);
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Navegação
  function initNav() {
    const nav = qs("#nav");
    const sections = {
      dashboard: qs("#tab-dashboard"),
      contas: qs("#tab-contas"),
      gastos: qs("#tab-gastos"),
      salarios: qs("#tab-salarios"),
      transferencias: qs("#tab-transferencias"),
      categorias: qs("#tab-categorias"),
      fixas: qs("#tab-fixas"),
      dividas: qs("#tab-dividas"),
    };

    function activate(tab) {
      qsa(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
      Object.entries(sections).forEach(([k, el]) => {
        if (!el) return;
        el.classList.toggle("hidden", k !== tab);
      });
      // render ao trocar
      switch (tab) {
        case "gastos": renderGastos(); break;
        case "salarios": renderSalarios(); break;
        case "transferencias": renderTransfers(); break;
        case "categorias": renderCategorias(); break;
        case "fixas": renderFixas(); break;
        case "dividas": renderDividas(); break;
      }
    }

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-tab]");
      if (!a) return;
      e.preventDefault();
      activate(a.dataset.tab);
      history.replaceState(null, "", `#${a.dataset.tab}`);
    });

    // rota inicial
    const hash = location.hash.replace("#", "");
    const initial = ["dashboard","contas","gastos","salarios","transferencias","categorias","fixas","dividas"].includes(hash) ? hash : "dashboard";
    activate(initial);
  }

  // Modal reutilizável
  const modal = {
    open(opts) {
      this.opts = opts;
      qs("#modalTitle").textContent = opts.title || "Editar";
      const form = qs("#modalForm");
      form.innerHTML = "";
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (opts.onSubmit) opts.onSubmit(data);
        modal.close();
      };
      form.append(...opts.fields.map(renderField));
      qs("#backdrop").style.display = "flex";
    },
    close() {
      qs("#backdrop").style.display = "none";
      this.opts = null;
    }
  };

  function renderField(f) {
    const wrap = document.createElement("div");
    wrap.className = f.full ? "" : "row";
    const col = document.createElement("div");
    col.className = "col";
    const id = f.id || `f_${uid()}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = f.label || "";
    let input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
      if (f.rows) input.rows = f.rows;
    } else if (f.type === "select") {
      input = document.createElement("select");
      (f.options || []).forEach((opt) => {
        const o = document.createElement("option");
        if (typeof opt === "string") {
          o.value = opt; o.textContent = opt;
        } else {
          o.value = opt.value; o.textContent = opt.label;
        }
        if (f.value != null && String(f.value) === String(o.value)) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
      if (f.step) input.step = f.step;
    }
    input.id = id;
    input.name = f.name || id;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.value != null) input.value = f.value;
    if (f.required) input.required = true;

    col.append(label, input);
    wrap.append(col);
    return wrap;
  }

  function wireModalButtons() {
    qs("#modalClose").addEventListener("click", () => modal.close());
    qs("#modalCancel").addEventListener("click", () => modal.close());
    qs("#backdrop").addEventListener("click", (e) => {
      if (e.target.id === "backdrop") modal.close();
    });
  }

  // Renderizações
  function renderGastos() {
    const tbody = qs("#tblGastos tbody");
    tbody.innerHTML = "";
    state.gastos.forEach((g) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${g.data || ""}</td>
        <td>${g.titular || ""}</td>
        <td>${g.banco || ""}</td>
        <td>${g.descricao || ""}</td>
        <td>${fmtEUR(g.valor)}</td>
        <td class="actions">
          <button class="btn ghost" data-act="edit-gasto" data-id="${g.id}">Editar</button>
          <button class="btn danger" data-act="del-gasto" data-id="${g.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderSalarios() {
    const tbody = qs("#tblSalarios tbody");
    tbody.innerHTML = "";
    state.salarios.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.data}</td>
        <td>${s.titular}</td>
        <td>${s.banco}</td>
        <td>${s.horas ?? ""}</td>
        <td>${fmtEUR(s.valor)}</td>
        <td class="actions">
          <button class="btn danger" data-act="del-salario" data-id="${s.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderTransfers() {
    const tbody = qs("#tblTransfers tbody");
    tbody.innerHTML = "";
    state.transferencias.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.data}</td>
        <td><span class="pill">${t.tipo}</span></td>
        <td>${t.de}</td>
        <td>${t.para}</td>
        <td>${fmtEUR(t.valor)}</td>
        <td>${t.descricao || ""}</td>
        <td class="actions">
          <button class="btn danger" data-act="del-transfer" data-id="${t.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderCategorias() {
    const tbody = qs("#tblCategorias tbody");
    tbody.innerHTML = "";
    state.categorias.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.nome}</td>
        <td><span class="pill">${c.tipo}</span></td>
        <td class="actions">
          <button class="btn ghost" data-act="edit-categoria" data-id="${c.id}">Editar</button>
          <button class="btn danger" data-act="del-categoria" data-id="${c.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderFixas() {
    const tbody = qs("#tblFixas tbody");
    tbody.innerHTML = "";
    state.fixas.forEach((f) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.nome}</td>
        <td>${f.titular}</td>
        <td>${fmtEUR(f.valor)}</td>
        <td>${f.data || ""}</td>
        <td>${f.regra || ""}</td>
        <td class="actions">
          <button class="btn ghost" data-act="edit-fixa" data-id="${f.id}">Editar</button>
          <button class="btn danger" data-act="del-fixa" data-id="${f.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderDividas() {
    const tbody = qs("#tblDividas tbody");
    tbody.innerHTML = "";
    state.dividas.forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.credor}</td>
        <td>${d.titular || ""}</td>
        <td>${fmtEUR(d.valor)}</td>
        <td>${d.vencimento || ""}</td>
        <td>${d.status || ""}</td>
        <td class="actions">
          <button class="btn ghost" data-act="edit-divida" data-id="${d.id}">Editar</button>
          <button class="btn danger" data-act="del-divida" data-id="${d.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Ações por aba (delegadas)
  function wireGastos() {
    qs("#btnNewGasto").addEventListener("click", () => {
      modal.open({
        title: "Novo gasto",
        fields: [
          { label: "Data", name: "data", type: "date", required: true, value: today() },
          { label: "Titular", name: "titular", type: "text", required: true },
          { label: "Banco", name: "banco", type: "text" },
          { label: "Descrição", name: "descricao", type: "textarea", rows: 3 },
          { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true },
        ],
        onSubmit: (data) => {
          state.gastos.unshift({
            id: uid(),
            data: data.data,
            titular: data.titular,
            banco: data.banco,
            descricao: data.descricao,
            valor: Number(data.valor || 0),
          });
          persist(); renderGastos();
        },
      });
    });

    qs("#tblGastos").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "del-gasto") {
        if (!confirm("Tem certeza que deseja excluir este gasto?")) return;
        state.gastos = state.gastos.filter((g) => g.id !== id);
        persist(); renderGastos();
      } else if (act === "edit-gasto") {
        const g = state.gastos.find((x) => x.id === id);
        if (!g) return;
        modal.open({
          title: "Editar gasto",
          fields: [
            { label: "Data", name: "data", type: "date", required: true, value: g.data },
            { label: "Titular", name: "titular", type: "text", required: true, value: g.titular },
            { label: "Banco", name: "banco", type: "text", value: g.banco },
            { label: "Descrição", name: "descricao", type: "textarea", rows: 3, value: g.descricao },
            { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true, value: g.valor },
          ],
          onSubmit: (data) => {
            Object.assign(g, { data: data.data, titular: data.titular, banco: data.banco, descricao: data.descricao, valor: Number(data.valor || 0) });
            persist(); renderGastos();
          },
        });
      }
    });
  }

  function wireSalarios() {
    qs("#btnNewSalario").addEventListener("click", () => {
      modal.open({
        title: "Novo salário",
        fields: [
          { label: "Data", name: "data", type: "date", required: true, value: today() },
          { label: "Titular", name: "titular", type: "text", required: true },
          { label: "Banco", name: "banco", type: "text" },
          { label: "Horas", name: "horas", type: "number", step: "1" },
          { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true },
        ],
        onSubmit: (data) => {
          state.salarios.unshift({
            id: uid(),
            data: data.data,
            titular: data.titular,
            banco: data.banco,
            horas: data.horas ? Number(data.horas) : undefined,
            valor: Number(data.valor || 0),
          });
          persist(); renderSalarios();
        },
      });
    });

    qs("#tblSalarios").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "del-salario") {
        if (!confirm("Tem certeza que deseja excluir este salário?")) return;
        const id = btn.dataset.id;
        state.salarios = state.salarios.filter((s) => s.id !== id);
        persist(); renderSalarios();
      }
    });
  }

  function wireTransfers() {
    qs("#btnNewTransfer").addEventListener("click", () => {
      modal.open({
        title: "Nova transferência",
        fields: [
          { label: "Data", name: "data", type: "date", required: true, value: today() },
          { label: "Tipo", name: "tipo", type: "select", options: ["Transferência", "Despesa"], value: "Transferência" },
          { label: "De", name: "de", type: "text", placeholder: "Ex.: Giseli - Corrente (AIB)" },
          { label: "Para", name: "para", type: "text", placeholder: "Ex.: FR - Poupanca (Revolut)" },
          { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true },
          { label: "Descrição", name: "descricao", type: "textarea", rows: 3 },
        ],
        onSubmit: (data) => {
          state.transferencias.unshift({
            id: uid(),
            data: data.data,
            tipo: data.tipo,
            de: data.de || "-",
            para: data.para || "-",
            valor: Number(data.valor || 0),
            descricao: data.descricao || "",
          });
          persist(); renderTransfers();
        },
      });
    });

    qs("#tblTransfers").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "del-transfer") {
        // Aqui você mencionou que atualmente exclui sem perguntar; adicionamos confirmação:
        if (!confirm("Tem certeza que deseja excluir esta transferência?")) return;
        const id = btn.dataset.id;
        state.transferencias = state.transferencias.filter((t) => t.id !== id);
        persist(); renderTransfers();
      }
    });
  }

  function wireCategorias() {
    qs("#btnNewCategoria").addEventListener("click", () => {
      modal.open({
        title: "Nova categoria",
        fields: [
          { label: "Nome", name: "nome", type: "text", required: true },
          { label: "Tipo", name: "tipo", type: "select", options: ["despesa", "receita"], value: "despesa" },
        ],
        onSubmit: (data) => {
          state.categorias.unshift({ id: uid(), nome: data.nome, tipo: data.tipo });
          persist(); renderCategorias();
        },
      });
    });

    qs("#tblCategorias").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "del-categoria") {
        if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
        state.categorias = state.categorias.filter((c) => c.id !== id);
        persist(); renderCategorias();
      } else if (act === "edit-categoria") {
        const c = state.categorias.find((x) => x.id === id);
        if (!c) return;
        modal.open({
          title: "Editar categoria",
          fields: [
            { label: "Nome", name: "nome", type: "text", required: true, value: c.nome },
            { label: "Tipo", name: "tipo", type: "select", options: ["despesa", "receita"], value: c.tipo },
          ],
          onSubmit: (data) => {
            c.nome = data.nome;
            c.tipo = data.tipo;
            persist(); renderCategorias();
          },
        });
      }
    });
  }

  function wireFixas() {
    qs("#btnNewFixa").addEventListener("click", () => {
      modal.open({
        title: "Nova despesa fixa",
        fields: [
          { label: "Nome", name: "nome", type: "text", required: true },
          { label: "Titular", name: "titular", type: "text", required: true },
          { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true },
          { label: "Data (opcional)", name: "data", type: "date" },
          { label: "Semana/Dia (ex.: 1ª • Qua)", name: "regra", type: "text", placeholder: "1ª • Qua" },
        ],
        onSubmit: (data) => {
          state.fixas.unshift({
            id: uid(),
            nome: data.nome,
            titular: data.titular,
            valor: Number(data.valor || 0),
            data: data.data || "",
            regra: data.regra || "",
          });
          persist(); renderFixas();
        },
      });
    });

    qs("#tblFixas").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "del-fixa") {
        if (!confirm("Tem certeza que deseja excluir esta despesa fixa?")) return;
        state.fixas = state.fixas.filter((f) => f.id !== id);
        persist(); renderFixas();
      } else if (act === "edit-fixa") {
        const f = state.fixas.find((x) => x.id === id);
        if (!f) return;
        modal.open({
          title: "Editar despesa fixa",
          fields: [
            { label: "Nome", name: "nome", type: "text", required: true, value: f.nome },
            { label: "Titular", name: "titular", type: "text", required: true, value: f.titular },
            { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true, value: f.valor },
            { label: "Data (opcional)", name: "data", type: "date", value: f.data },
            { label: "Semana/Dia", name: "regra", type: "text", value: f.regra },
          ],
          onSubmit: (data) => {
            Object.assign(f, {
              nome: data.nome,
              titular: data.titular,
              valor: Number(data.valor || 0),
              data: data.data || "",
              regra: data.regra || "",
            });
            persist(); renderFixas();
          },
        });
      }
    });
  }

  function wireDividas() {
    qs("#btnNewDivida").addEventListener("click", () => {
      modal.open({
        title: "Nova dívida",
        fields: [
          { label: "Credor", name: "credor", type: "text", required: true },
          { label: "Titular", name: "titular", type: "text" },
          { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true },
          { label: "Vencimento", name: "vencimento", type: "date" },
          { label: "Status", name: "status", type: "select", options: ["aberta", "paga", "negociada"], value: "aberta" },
        ],
        onSubmit: (data) => {
          state.dividas.unshift({
            id: uid(),
            credor: data.credor,
            titular: data.titular || "",
            valor: Number(data.valor || 0),
            vencimento: data.vencimento || "",
            status: data.status || "aberta",
          });
          persist(); renderDividas();
        },
      });
    });

    qs("#tblDividas").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "del-divida") {
        if (!confirm("Tem certeza que deseja excluir esta dívida?")) return;
        state.dividas = state.dividas.filter((d) => d.id !== id);
        persist(); renderDividas();
      } else if (act === "edit-divida") {
        const d = state.dividas.find((x) => x.id === id);
        if (!d) return;
        modal.open({
          title: "Editar dívida",
          fields: [
            { label: "Credor", name: "credor", type: "text", required: true, value: d.credor },
            { label: "Titular", name: "titular", type: "text", value: d.titular },
            { label: "Valor (EUR)", name: "valor", type: "number", step: "0.01", required: true, value: d.valor },
            { label: "Vencimento", name: "vencimento", type: "date", value: d.vencimento },
            { label: "Status", name: "status", type: "select", options: ["aberta", "paga", "negociada"], value: d.status || "aberta" },
          ],
          onSubmit: (data) => {
            Object.assign(d, {
              credor: data.credor,
              titular: data.titular || "",
              valor: Number(data.valor || 0),
              vencimento: data.vencimento || "",
              status: data.status || "aberta",
            });
            persist(); renderDividas();
          },
        });
      }
    });
  }

  // Sair
  function wireSair() {
    qs("#btnSair").addEventListener("click", () => {
      if (!confirm("Sair e limpar sessão local?")) return;
      // manter dados; apenas simular logout
      location.href = "login.html";
    });
  }

  // Helpers
  function today() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // Inicialização
  function init() {
    load();
    initNav();
    wireModalButtons();
    wireSair();

    wireGastos();
    wireSalarios();
    wireTransfers();
    wireCategorias();
    wireFixas();
    wireDividas();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
