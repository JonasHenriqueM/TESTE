const API_URL = 'http://52.14.93.1:3000';

// Verifica se já existe token salvo ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('aloka_token');
  if (token) {
    document.getElementById('tela-login').style.display = 'none';
  }
});

// Envio do formulário de login
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = document.getElementById('login-usuario').value;
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  try {
    const resp = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });

    const dados = await resp.json();
    if (!resp.ok) {
      erroEl.textContent = dados.error || 'Falha no login';
      return;
    }

    localStorage.setItem('aloka_token', dados.token);
    document.getElementById('tela-login').style.display = 'none';
    location.reload();
  } catch (err) {
    erroEl.textContent = 'Erro de conexão com o servidor.';
  }
});

// Função de logout
function sair() {
  localStorage.removeItem('aloka_token');
  location.reload();
}

// Intercepta todas as chamadas fetch para incluir o cabeçalho Authorization
const fetchOriginal = window.fetch;
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('aloka_token');
  if (token && String(url).includes('52.14.93.1:3000')) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  const response = await fetchOriginal(url, options);

  if ((response.status === 401 || response.status === 403) && !String(url).endsWith('/login')) {
    localStorage.removeItem('aloka_token');
    document.getElementById('tela-login').style.display = 'flex';
  }

  return response;
};

lucide.createIcons();

// Caches locais
let cacheReservas = [];
let cacheEspacos = [];
let cacheEquipamentos = [];
let cacheClientes = [];
let cacheFuncionarios = [];
let cacheEntregas = [];
let cacheMontagens = [];
let cacheFaturas = [];

window.addEventListener('DOMContentLoaded', () => {
  verificarStatusApi();
  carregarDashboard();
});

async function verificarStatusApi() {
  const badge = document.getElementById('statusApiBadge');
  if (!badge) return;
  try {
    const res = await fetch(`${API_URL}/`);
    const data = await res.json();
    badge.className = 'flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${data.status || 'API Online'}`;
  } catch {
    badge.className = 'flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span> API Offline (Porta 3000)`;
  }
}

// --- HELPER: BOTÕES PADRÃO DE AÇÃO (EDITAR / EXCLUIR) ---
function renderBotoesAcao(fnEditar, fnExcluir) {
  return `
    <td class="py-3.5 px-4 text-right whitespace-nowrap">
      <div class="inline-flex items-center gap-1">
        <button type="button" onclick="${fnEditar}" title="Editar registro" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button type="button" onclick="${fnExcluir}" title="Excluir registro" class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </td>
  `;
}

// --- CONTROLE DE MODAIS (<dialog>) ---
function abrirDialog(id) {
  document.getElementById(id).showModal();
}

function fecharDialog(id) {
  document.getElementById(id).close();
}

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

// --- NAVEGAÇÃO ENTRE TELAS ---
function navegarPara(viewId, elementoClicado, tituloGenerico = '') {
  document.querySelectorAll('.page-view').forEach(tela => tela.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('bg-blue-600/20', 'text-blue-400', 'border-l-4', 'border-blue-500', 'rounded-r-lg', 'font-medium');
    btn.classList.add('hover:bg-slate-800', 'hover:text-white', 'rounded-lg');
  });

  elementoClicado.classList.remove('hover:bg-slate-800', 'hover:text-white', 'rounded-lg');
  elementoClicado.classList.add('bg-blue-600/20', 'text-blue-400', 'border-l-4', 'border-blue-500', 'rounded-r-lg', 'font-medium');

  // Limpa o campo de busca ao trocar de tela
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  if (viewId === 'view-dashboard') carregarDashboard();
  if (viewId === 'view-reservas') carregarReservas();
  if (viewId === 'view-funcionarios') carregarFuncionarios();
  if (viewId === 'view-entrega') carregarEntregas();
  if (viewId === 'view-montagens') carregarMontagens();
  if (viewId === 'view-faturas') carregarFaturas();
  if (viewId === 'view-relatorios') carregarRelatorios();
  if (viewId === 'view-generica') {
    document.getElementById('titulo-tela-generica').innerText = tituloGenerico;
    carregarModuloGenerico(tituloGenerico);
  }
}

// =========================================================
// 1. DASHBOARD
// =========================================================
async function carregarDashboard() {
  try {
    const [espRes, eqRes, resRes, cliRes] = await Promise.all([
      fetch(`${API_URL}/espacos`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/equipamentos`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/reservas`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/clientes`).then(r => r.json()).catch(() => [])
    ]);

    document.getElementById('kpi-espacos').innerText = Array.isArray(espRes) ? espRes.length : 0;
    document.getElementById('kpi-equipamentos').innerText = Array.isArray(eqRes) ? eqRes.length : 0;
    document.getElementById('kpi-reservas').innerText = Array.isArray(resRes) ? resRes.length : 0;
    document.getElementById('kpi-clientes').innerText = Array.isArray(cliRes) ? cliRes.length : 0;

    const tbody = document.getElementById('corpoTabela');
    if (!Array.isArray(resRes) || resRes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">Nenhuma reserva cadastrada no banco ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = resRes.slice(0, 8).map(r => {
      const espaco = r.espaco_nome || r.nomeespaco;
      const equips = r.equipamentos_nome || r.equipamentoslocados || r.equipamento_nome;
      const recursoResumo = espaco 
        ? (equips && equips !== '-' ? `${espaco} + ${equips}` : espaco)
        : (equips && equips !== '-' ? `Somente Equip.: ${equips}` : 'Recurso Locado');

      const statusTexto = (r.statusreserva || r.status || 'PENDENTE').toUpperCase();
      let badgeClass = 'bg-amber-100 text-amber-700';
      if (statusTexto === 'CONFIRMADA') {
        badgeClass = 'bg-emerald-100 text-emerald-700';
      } else if (statusTexto === 'CANCELADA') {
        badgeClass = 'bg-red-100 text-red-700';
      }

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3 px-4 text-slate-500">#${r.id_reserva || '-'} (${formatarData(r.datareserva || r.data)})</td>
          <td class="py-3 px-4 font-medium text-slate-800">${r.cliente_nome || r.nomecliente || `Cliente #${r.id_cliente}`}</td>
          <td class="py-3 px-4 text-slate-600">${recursoResumo}</td>
          <td class="py-3 px-4 font-semibold text-slate-800">R$ ${Number(r.valortotal || r.valor || 0).toFixed(2)}</td>
          <td class="py-3 px-4"><span class="px-2.5 py-1 text-xs font-medium ${badgeClass} rounded-full">${statusTexto}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro no dashboard:', err);
  }
}

// =========================================================
// 2. RESERVAS (LISTAR, CONSULTAR POR ID, CRIAR, EDITAR, EXCLUIR)
// =========================================================
let listaOpcoesEquipamentosCache = [];

function montarOptionsEquipamentos(idSelecionado = '') {
  const opcoes = listaOpcoesEquipamentosCache.map(eq => {
    const valor = Number(eq.valorequipamento || eq.valor || 0).toFixed(2);
    const selected = Number(eq.id_equipamento) === Number(idSelecionado) ? 'selected' : '';
    return `<option value="${eq.id_equipamento}" ${selected}>#${eq.id_equipamento} - ${eq.nomeequipamento} (R$ ${valor})</option>`;
  }).join('');

  return `<option value="">Nenhum / Selecione...</option>${opcoes}`;
}

function adicionarLinhaEquipamentoReserva(idEquipamento = '', quantidade = 1) {
  const container = document.getElementById('listaEquipamentosReserva');
  const linha = document.createElement('div');
  linha.className = 'linha-equipamento-reserva flex items-center gap-2';

  linha.innerHTML = `
    <select class="select-equipamento flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      ${montarOptionsEquipamentos(idEquipamento)}
    </select>
    <input type="number" min="1" value="${quantidade || 1}" title="Quantidade" placeholder="Qtd"
      class="input-qtd-equipamento w-20 border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500">
    <button type="button" onclick="this.parentElement.remove()" title="Remover equipamento"
      class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
      ✕
    </button>
  `;

  container.appendChild(linha);
}

async function abrirDialogReserva(reservaParaEditar = null) {
  abrirDialog('dialogReserva');
  const isEdicao = Boolean(reservaParaEditar);

  document.getElementById('resIdEdicao').value = isEdicao ? reservaParaEditar.id_reserva : '';
  document.getElementById('tituloDialogReserva').innerText = isEdicao 
    ? `Editar Reserva #${reservaParaEditar.id_reserva}` 
    : 'Nova Reserva';
  document.getElementById('btnSalvarReserva').innerText = isEdicao ? 'Atualizar Reserva' : 'Salvar Reserva';
  document.getElementById('grupoStatusReserva').classList.toggle('hidden', !isEdicao);

  try {
    const [cliList, espList, eqList] = await Promise.all([
      fetch(`${API_URL}/clientes`).then(r => r.json()),
      fetch(`${API_URL}/espacos`).then(r => r.json()),
      fetch(`${API_URL}/equipamentos`).then(r => r.json())
    ]);

    listaOpcoesEquipamentosCache = eqList;

    document.getElementById('resCliente').innerHTML = 
      `<option value="">Selecione um cliente...</option>` +
      cliList.map(c => `<option value="${c.id_cliente}">#${c.id_cliente} - ${c.nome}</option>`).join('');

    document.getElementById('resEspaco').innerHTML = 
      `<option value="" data-endereco="">Nenhum (Somente Equipamentos)</option>` +
      espList.map(e => {
        const valor = Number(e.valorespaco || e.valor || 0).toFixed(2);
        const end = (e.endereco || e.localizacao || '').replace(/"/g, '&quot;');
        return `<option value="${e.id_espaco}" data-endereco="${end}">#${e.id_espaco} - ${e.nomeespaco} (R$ ${valor})</option>`;
      }).join('');

    const containerEquip = document.getElementById('listaEquipamentosReserva');
    containerEquip.innerHTML = '';

    if (isEdicao) {
      document.getElementById('resCliente').value = reservaParaEditar.id_cliente || '';
      document.getElementById('resEspaco').value = reservaParaEditar.id_espaco || '';
      document.getElementById('resData').value = (reservaParaEditar.datareserva || '').toString().slice(0, 10);
      document.getElementById('resHoraInicio').value = (reservaParaEditar.horainicio || '').toString().slice(0, 5);
      document.getElementById('resHoraFim').value = (reservaParaEditar.horafim || '').toString().slice(0, 5);
      document.getElementById('resStatus').value = reservaParaEditar.statusreserva || 'CONFIRMADA';
      aoSelecionarEspacoReserva();
      if (!reservaParaEditar.id_espaco && reservaParaEditar.enderecoevento) {
        document.getElementById('resEnderecoEvento').value = reservaParaEditar.enderecoevento;
      }

      const itens = Array.isArray(reservaParaEditar.itens_equipamentos) ? reservaParaEditar.itens_equipamentos : [];
      if (itens.length > 0) {
        itens.forEach(item => adicionarLinhaEquipamentoReserva(item.id_equipamento, item.quantidade));
      } else {
        adicionarLinhaEquipamentoReserva();
      }
    } else {
      document.getElementById('resData').value = '';
      document.getElementById('resHoraInicio').value = '';
      document.getElementById('resHoraFim').value = '';
      aoSelecionarEspacoReserva();
      adicionarLinhaEquipamentoReserva();
    }
  } catch (err) {
    console.error('Erro ao carregar opções para reserva:', err);
  }
}

async function carregarReservas() {
  const tbody = document.getElementById('lista-reservas-api');
  try {
    const res = await fetch(`${API_URL}/reservas`);
    const lista = await res.json();
    cacheReservas = lista;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="py-10 text-center text-slate-400 text-sm">Nenhuma reserva encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(r => {
      const horaInicio = (r.horainicio || '').toString().slice(0, 5) || '-';
      const horaFim = (r.horafim || '').toString().slice(0, 5) || '-';
      const status = r.statusreserva || 'Ativa';
      const nomeEspaco = r.espaco_nome;

      let badgeCor = 'bg-emerald-100 text-emerald-700';
      if (status === 'PENDENTE') badgeCor = 'bg-amber-100 text-amber-700';
      if (status === 'CANCELADA') badgeCor = 'bg-red-100 text-red-700';

      const temEquipamento = Boolean(r.equipamentos_nome && r.equipamentos_nome !== '-');
      const statusEntrega = r.status_entrega || 'Não agendada';
      const isAgendada = statusEntrega.toLowerCase() === 'agendada';
      const badgeEntrega = isAgendada
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-600';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-sm">
          <td class="py-3.5 px-4 text-slate-500">#${r.id_reserva}</td>
          <td class="py-3.5 px-4 font-medium text-slate-800">${r.cliente_nome || `Cliente #${r.id_cliente}`}</td>
          <td class="py-3.5 px-4 text-slate-600">
            ${nomeEspaco 
              ? `<span class="font-medium text-slate-700">${nomeEspaco}</span>` 
              : `<span class="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium whitespace-nowrap">Somente Equipamentos</span>`}
          </td>
          <td class="py-3.5 px-4 text-slate-600 whitespace-nowrap">R$ ${Number(r.valorespaco || 0).toFixed(2)}</td>
          <td class="py-3.5 px-4 text-slate-600 text-xs">${r.equipamentos_nome || '-'}</td>
          <td class="py-3.5 px-4 text-slate-600 whitespace-nowrap">R$ ${Number(r.valorequipamentos || 0).toFixed(2)}</td>
          <td class="py-3.5 px-4 whitespace-nowrap text-slate-600">${formatarData(r.datareserva)} <span class="block text-xs text-slate-400">(${horaInicio} - ${horaFim})</span></td>
          <td class="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">R$ ${Number(r.valortotal || 0).toFixed(2)}</td>
          <td class="py-3.5 px-4"><span class="px-2.5 py-1 text-xs font-medium ${badgeCor} rounded-full">${status}</span></td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            ${!temEquipamento
              ? ``
              : `<span class="px-2.5 py-1 text-xs font-medium ${badgeEntrega} rounded-full">${statusEntrega}</span>`}
          </td>
          ${renderBotoesAcao(`editarReserva(${r.id_reserva})`, `excluirReserva(${r.id_reserva})`)}
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-red-500 text-sm">Erro: ${err.message}</td></tr>`;
  }
}

// Consulta específica no PostgreSQL (GET /reservas/:id) antes de abrir edição
async function editarReserva(idReserva) {
  try {
    const res = await fetch(`${API_URL}/reservas/${idReserva}`);
    const reserva = await res.json();
    if (!res.ok) throw new Error(reserva.error || 'Reserva não encontrada');
    abrirDialogReserva(reserva);
  } catch (err) {
    alert(`Erro ao consultar reserva #${idReserva}: ${err.message}`);
  }
}

async function excluirReserva(idReserva) {
  if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente a Reserva #${idReserva}?`)) return;
  await enviarDelete(`/reservas/${idReserva}`, () => {
    carregarReservas();
    carregarDashboard();
  });
}

function aoSelecionarEspacoReserva() {
  const selectEspaco = document.getElementById('resEspaco');
  const inputEndereco = document.getElementById('resEnderecoEvento');
  const opcaoSelecionada = selectEspaco.options[selectEspaco.selectedIndex];
  const enderecoEspaco = opcaoSelecionada ? opcaoSelecionada.getAttribute('data-endereco') : '';

  if (selectEspaco.value) {
    inputEndereco.value = enderecoEspaco || 'Endereço do espaço ALOKA selecionado';
    inputEndereco.readOnly = true;
    inputEndereco.classList.add('bg-slate-100', 'text-slate-500');
  } else {
    inputEndereco.value = '';
    inputEndereco.readOnly = false;
    inputEndereco.classList.remove('bg-slate-100', 'text-slate-500');
  }
}

async function salvarReserva(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('resIdEdicao').value;

  const linhas = document.querySelectorAll('#listaEquipamentosReserva .linha-equipamento-reserva');
  const equipamentos = [];
  linhas.forEach(linha => {
    const idEq = Number(linha.querySelector('.select-equipamento').value);
    const qtd = Number(linha.querySelector('.input-qtd-equipamento').value) || 1;
    if (idEq > 0) {
      equipamentos.push({ id_equipamento: idEq, quantidade: qtd });
    }
  });

  if (idEdicao) {
    const payloadUpdate = {
      id_cliente: Number(document.getElementById('resCliente').value),
      id_espaco: document.getElementById('resEspaco').value ? Number(document.getElementById('resEspaco').value) : null,
      enderecoevento: document.getElementById('resEspaco').value ? null : (document.getElementById('resEnderecoEvento').value || null),
      data: document.getElementById('resData').value,
      hora_inicio: document.getElementById('resHoraInicio').value,
      hora_fim: document.getElementById('resHoraFim').value,
      statusreserva: document.getElementById('resStatus').value,
      equipamentos
    };

    await enviarRequisicao('PUT', `/reservas/${idEdicao}`, payloadUpdate, 'dialogReserva', event.target, () => {
      carregarDashboard();
      carregarReservas();
    });
    return;
  }

  const payload = {
    id_cliente: Number(document.getElementById('resCliente').value),
    id_espaco: document.getElementById('resEspaco').value ? Number(document.getElementById('resEspaco').value) : null,
    enderecoevento: document.getElementById('resEnderecoEvento').value || null,
    data: document.getElementById('resData').value,
    hora_inicio: document.getElementById('resHoraInicio').value,
    hora_fim: document.getElementById('resHoraFim').value,
    equipamentos
  };

  await enviarRequisicao('POST', '/reservas', payload, 'dialogReserva', event.target, () => {
    carregarDashboard();
    carregarReservas();
  });
}

// =========================================================
// 3. ESPAÇOS, EQUIPAMENTOS E CLIENTES (MODULAR + BUSCA ILIKE)
// =========================================================
function renderizarListaGenerica(modulo, lista) {
  const tbody = document.getElementById('lista-generica-api');
  let colunas = 7;
  if (modulo === 'Equipamentos') colunas = 8;
  if (modulo === 'Clientes') colunas = 6;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="${colunas}" class="py-10 text-center text-slate-400">Nenhum registro encontrado em ${modulo}.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(item => {
    if (modulo === 'Espaços') {
      const id = item.id_espaco || item.id;
      const valorFormatado = Number(item.valorespaco || item.valordiaria || item.valor || 0).toFixed(2);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-6 text-slate-500">#${id}</td>
          <td class="py-3.5 px-6 font-medium text-slate-800">${item.nomeespaco || item.nome_espaco || item.nome}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.capacidade || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.endereco || item.localizacao || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.descricao || '-'}</td>
          <td class="py-3.5 px-6 font-semibold text-slate-800">R$ ${valorFormatado}</td>
          ${renderBotoesAcao(`editarEspaco(${id})`, `excluirItemGenerico('espacos', ${id}, 'Espaços')`)}
        </tr>`;
    }
    if (modulo === 'Equipamentos') {
      const id = item.id_equipamento || item.id;
      const valorEq = Number(item.valorequipamento || item.valor || 0).toFixed(2);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-6 text-slate-500">#${id}</td>
          <td class="py-3.5 px-6 font-medium text-slate-800">${item.nomeequipamento || item.nome_equipamento || item.nome}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.numeropatrimonio || item.numero_patrimonio || item.patrimonio || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.marca || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.quantidade ?? item.qtd ?? '-'}</td>
          <td class="py-3.5 px-6 font-semibold text-slate-800">R$ ${valorEq}</td>
          <td class="py-3.5 px-6 text-slate-600">${item.observacoes || item.observacao || item.obs || '-'}</td>
          ${renderBotoesAcao(`editarEquipamento(${id})`, `excluirItemGenerico('equipamentos', ${id}, 'Equipamentos')`)}
        </tr>`;
    }
    const idCli = item.id_cliente || item.id;
    const tel = item.telefone || (Array.isArray(item.telefones) && item.telefones[0]) || '-';
    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3.5 px-6 text-slate-500">#${idCli}</td>
        <td class="py-3.5 px-6 font-medium text-slate-800">${item.nome}</td>
        <td class="py-3.5 px-6 text-slate-600">${item.contato || item.email || '-'}</td>
        <td class="py-3.5 px-6 text-slate-600">${item.endereco || '-'}</td>
        <td class="py-3.5 px-6 text-slate-600">${tel}</td>
        ${renderBotoesAcao(`editarCliente(${idCli})`, `excluirItemGenerico('clientes', ${idCli}, 'Clientes')`)}
      </tr>`;
  }).join('');

  lucide.createIcons();
}

async function carregarModuloGenerico(modulo) {
  const thead = document.getElementById('head-generica-api');
  const tbody = document.getElementById('lista-generica-api');
  const btnNovo = document.getElementById('btn-novo-generico');

  let endpoint = '';
  let colunas = 7;

  if (modulo === 'Espaços') {
    endpoint = '/espacos';
    colunas = 7;
    btnNovo.onclick = () => abrirDialogItem('espacos');
    thead.innerHTML = `
      <tr>
        <th class="py-3.5 px-6">ID</th>
        <th class="py-3.5 px-6">Nome</th>
        <th class="py-3.5 px-6">Capacidade</th>
        <th class="py-3.5 px-6">Endereço</th>
        <th class="py-3.5 px-6">Descrição</th>
        <th class="py-3.5 px-6">Valor</th>
        <th class="py-3.5 px-4 text-right">Ações</th>
      </tr>`;
  } else if (modulo === 'Equipamentos') {
    endpoint = '/equipamentos';
    colunas = 8;
    btnNovo.onclick = () => abrirDialogItem('equipamentos');
    thead.innerHTML = `
      <tr>
        <th class="py-3.5 px-6">ID</th>
        <th class="py-3.5 px-6">Equipamento</th>
        <th class="py-3.5 px-6">Número Patrimônio</th>
        <th class="py-3.5 px-6">Marca</th>
        <th class="py-3.5 px-6">Quantidade</th>
        <th class="py-3.5 px-6">Valor Unit.</th>
        <th class="py-3.5 px-6">Observações</th>
        <th class="py-3.5 px-4 text-right">Ações</th>
      </tr>`;
  } else if (modulo === 'Clientes') {
    endpoint = '/clientes';
    colunas = 6;
    btnNovo.onclick = () => abrirDialogCliente();
    thead.innerHTML = `
      <tr>
        <th class="py-3.5 px-6">ID</th>
        <th class="py-3.5 px-6">Nome</th>
        <th class="py-3.5 px-6">Contato</th>
        <th class="py-3.5 px-6">Endereço</th>
        <th class="py-3.5 px-6">Telefone</th>
        <th class="py-3.5 px-4 text-right">Ações</th>
      </tr>`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`);
    const lista = await res.json();

    if (modulo === 'Espaços') cacheEspacos = lista;
    if (modulo === 'Equipamentos') cacheEquipamentos = lista;
    if (modulo === 'Clientes') cacheClientes = lista;

    renderizarListaGenerica(modulo, lista);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="${colunas}" class="py-8 text-center text-red-500">Erro ao carregar ${modulo}: ${err.message}</td></tr>`;
  }
}

async function excluirItemGenerico(endpoint, id, moduloAtual) {
  if (!confirm(`Tem certeza que deseja excluir o registro #${id} de ${moduloAtual}?`)) return;
  await enviarDelete(`/${endpoint}/${id}`, () => {
    carregarDashboard();
    carregarModuloGenerico(moduloAtual);
  });
}

// --- DIALOG ESPAÇOS / EQUIPAMENTOS ---
function alternarCamposItem() {
  const tipo = document.getElementById('itemTipo').value;
  const isEspaco = tipo === 'espacos';
  document.getElementById('labelItemDetalhe').innerText = isEspaco ? 'Capacidade' : 'Nº Patrimônio';
  document.getElementById('itemDetalhe').placeholder = isEspaco ? 'Ex: 20 pessoas' : 'Ex: #045';
  document.getElementById('camposExtrasEspaco').classList.toggle('hidden', !isEspaco);
  document.getElementById('camposExtrasEquipamento').classList.toggle('hidden', isEspaco);
}

function abrirDialogItem(tipoPadrao = 'espacos', itemEdicao = null) {
  abrirDialog('dialogItem');
  const isEdicao = Boolean(itemEdicao);
  const selectTipo = document.getElementById('itemTipo');

  selectTipo.value = tipoPadrao;
  selectTipo.disabled = isEdicao;
  alternarCamposItem();

  document.getElementById('itemIdEdicao').value = isEdicao ? (itemEdicao.id_espaco || itemEdicao.id_equipamento || itemEdicao.id) : '';
  document.getElementById('tituloDialogItem').innerText = isEdicao 
    ? `Editar ${tipoPadrao === 'espacos' ? 'Espaço' : 'Equipamento'} #${document.getElementById('itemIdEdicao').value}`
    : 'Adicionar Item';
  document.getElementById('btnSalvarItem').innerText = isEdicao ? 'Atualizar Item' : 'Cadastrar Item';

  if (isEdicao && tipoPadrao === 'espacos') {
    document.getElementById('itemNome').value = itemEdicao.nomeespaco || itemEdicao.nome || '';
    document.getElementById('itemDetalhe').value = itemEdicao.capacidade || '';
    document.getElementById('itemValor').value = itemEdicao.valorespaco || itemEdicao.valor || '';
    document.getElementById('itemEndereco').value = itemEdicao.endereco || itemEdicao.localizacao || '';
    document.getElementById('itemDescricao').value = itemEdicao.descricao || '';
  } else if (isEdicao && tipoPadrao === 'equipamentos') {
    document.getElementById('itemNome').value = itemEdicao.nomeequipamento || itemEdicao.nome || '';
    document.getElementById('itemDetalhe').value = itemEdicao.numeropatrimonio || itemEdicao.patrimonio || '';
    document.getElementById('itemValor').value = itemEdicao.valorequipamento || itemEdicao.valor || '';
    document.getElementById('itemMarca').value = itemEdicao.marca || '';
    document.getElementById('itemQuantidade').value = itemEdicao.quantidade ?? 1;
    document.getElementById('itemObservacoes').value = itemEdicao.observacoes || '';
  } else {
    document.getElementById('itemNome').value = '';
    document.getElementById('itemDetalhe').value = '';
    document.getElementById('itemValor').value = '';
    document.getElementById('itemEndereco').value = '';
    document.getElementById('itemDescricao').value = '';
    document.getElementById('itemMarca').value = '';
    document.getElementById('itemQuantidade').value = 1;
    document.getElementById('itemObservacoes').value = '';
  }
}

function editarEspaco(id) {
  const esp = cacheEspacos.find(e => (e.id_espaco || e.id) === id);
  if (esp) abrirDialogItem('espacos', esp);
}

// Consulta específica no PostgreSQL (GET /equipamentos/:id)
async function editarEquipamento(id) {
  try {
    const res = await fetch(`${API_URL}/equipamentos/${id}`);
    const eq = await res.json();
    if (!res.ok) throw new Error(eq.error || 'Equipamento não encontrado');
    abrirDialogItem('equipamentos', eq);
  } catch (err) {
    alert(`Erro ao consultar equipamento #${id}: ${err.message}`);
  }
}

async function salvarItem(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('itemIdEdicao').value;
  const tipo = document.getElementById('itemTipo').value;
  const nome = document.getElementById('itemNome').value;
  const detalhe = document.getElementById('itemDetalhe').value;
  const valor = parseFloat(document.getElementById('itemValor').value);

  const payload = tipo === 'espacos'
    ? {
        nomeespaco: nome,
        nome: nome,
        capacidade: detalhe,
        endereco: document.getElementById('itemEndereco').value || null,
        descricao: document.getElementById('itemDescricao').value || null,
        valorespaco: valor,
        valor: valor
      }
    : {
        nomeequipamento: nome,
        nome: nome,
        numeropatrimonio: detalhe,
        marca: document.getElementById('itemMarca').value || null,
        quantidade: Number(document.getElementById('itemQuantidade').value || 1),
        observacoes: document.getElementById('itemObservacoes').value || null,
        valorequipamento: valor,
        valor: valor
      };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/${tipo}/${idEdicao}` : `/${tipo}`;

  await enviarRequisicao(method, url, payload, 'dialogItem', event.target, () => {
    document.getElementById('itemTipo').disabled = false;
    carregarDashboard();
    if (!document.getElementById('view-generica').classList.contains('hidden')) {
      carregarModuloGenerico(tipo === 'espacos' ? 'Espaços' : 'Equipamentos');
    }
  });
}

// --- DIALOG CLIENTE ---
function abrirDialogCliente(cliEdicao = null) {
  abrirDialog('dialogCliente');
  const isEdicao = Boolean(cliEdicao);
  const id = isEdicao ? (cliEdicao.id_cliente || cliEdicao.id) : '';

  document.getElementById('cliIdEdicao').value = id;
  document.getElementById('tituloDialogCliente').innerText = isEdicao ? `Editar Cliente #${id}` : 'Novo Cliente';
  document.getElementById('btnSalvarCliente').innerText = isEdicao ? 'Atualizar Cliente' : 'Salvar Cliente';

  if (isEdicao) {
    const tipo = cliEdicao.cnpj ? 'PJ' : 'PF';
    document.getElementById('cliTipo').value = tipo;
    alternarTipoCliente();
    document.getElementById('cliNome').value = cliEdicao.nome || '';
    document.getElementById('cliDocumento').value = cliEdicao.cpf || cliEdicao.cnpj || cliEdicao.documento || '';
    document.getElementById('cliRg').value = cliEdicao.rg || '';
    document.getElementById('cliTelefone').value = cliEdicao.telefone || (Array.isArray(cliEdicao.telefones) ? cliEdicao.telefones[0] : '') || '';
    document.getElementById('cliEmail').value = cliEdicao.email || cliEdicao.contato || '';
    document.getElementById('cliEndereco').value = cliEdicao.endereco || '';
  } else {
    document.getElementById('cliTipo').value = 'PF';
    alternarTipoCliente();
    document.getElementById('cliNome').value = '';
    document.getElementById('cliTelefone').value = '';
    document.getElementById('cliEmail').value = '';
    document.getElementById('cliEndereco').value = '';
  }
}

// Consulta específica no PostgreSQL (GET /clientes/:id)
async function editarCliente(id) {
  try {
    const res = await fetch(`${API_URL}/clientes/${id}`);
    const cli = await res.json();
    if (!res.ok) throw new Error(cli.error || 'Cliente não encontrado');
    abrirDialogCliente(cli);
  } catch (err) {
    alert(`Erro ao consultar cliente #${id}: ${err.message}`);
  }
}

function alternarTipoCliente() {
  const tipo = document.getElementById('cliTipo').value;
  const labelDoc = document.getElementById('labelCliDocumento');
  const inputDoc = document.getElementById('cliDocumento');
  const grupoRg = document.getElementById('grupoCliRg');
  const gridDocs = document.getElementById('gridDocumentosCliente');

  inputDoc.value = '';

  if (tipo === 'PF') {
    labelDoc.innerText = 'CPF (11 dígitos)';
    inputDoc.maxLength = 11;
    inputDoc.pattern = '\\d{11}';
    inputDoc.title = 'Informe exatamente 11 números';
    inputDoc.placeholder = 'Somente 11 números';
    grupoRg.classList.remove('hidden');
    gridDocs.classList.replace('grid-cols-1', 'grid-cols-2');
  } else {
    labelDoc.innerText = 'CNPJ (14 dígitos)';
    inputDoc.maxLength = 14;
    inputDoc.pattern = '\\d{14}';
    inputDoc.title = 'Informe exatamente 14 números';
    inputDoc.placeholder = 'Somente 14 números';
    document.getElementById('cliRg').value = '';
    grupoRg.classList.add('hidden');
    gridDocs.classList.replace('grid-cols-2', 'grid-cols-1');
  }
}

async function salvarCliente(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('cliIdEdicao').value;
  const tipo = document.getElementById('cliTipo').value;
  const doc = document.getElementById('cliDocumento').value.trim();
  const rgVal = document.getElementById('cliRg').value.trim();

  const payload = {
    tipo: tipo,
    tipocliente: tipo,
    nome: document.getElementById('cliNome').value,
    documento: doc,
    cpf: tipo === 'PF' ? doc : null,
    rg: tipo === 'PF' && rgVal ? rgVal : null,
    cnpj: tipo === 'PJ' ? doc : null,
    telefone: document.getElementById('cliTelefone').value,
    email: document.getElementById('cliEmail').value,
    contato: document.getElementById('cliEmail').value,
    endereco: document.getElementById('cliEndereco').value
  };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/clientes/${idEdicao}` : '/clientes';

  await enviarRequisicao(method, url, payload, 'dialogCliente', event.target, () => {
    alternarTipoCliente();
    carregarDashboard();
    if (!document.getElementById('view-generica').classList.contains('hidden')) {
      carregarModuloGenerico('Clientes');
    }
  });
}

// =========================================================
// 4. FUNCIONÁRIOS (LISTAR, CRIAR, EDITAR, EXCLUIR)
// =========================================================
async function carregarFuncionarios() {
  const tbody = document.getElementById('lista-funcionarios-api');
  try {
    const res = await fetch(`${API_URL}/funcionarios`);
    const lista = await res.json();
    cacheFuncionarios = lista;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-slate-400 text-sm">Nenhum funcionário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(f => `
      <tr class="border-b border-slate-100 hover:bg-slate-50 text-sm">
        <td class="py-3.5 px-6 text-slate-500">#${f.id_funcionario}</td>
        <td class="py-3.5 px-6 font-medium text-slate-800">${f.nome || f.nomefuncionario || f.nome_funcionario || '-'}</td>
        <td class="py-3.5 px-6 text-slate-600">${f.cargo || f.funcao || '-'}</td>
        <td class="py-3.5 px-6 text-slate-600">${f.turno || '-'}</td>
        <td class="py-3.5 px-6 text-slate-600">${f.contato || f.telefone || f.email || '-'}</td>
        ${renderBotoesAcao(`editarFuncionario(${f.id_funcionario})`, `excluirFuncionario(${f.id_funcionario})`)}
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">Erro: ${err.message}</td></tr>`;
  }
}

function abrirDialogFuncionario(funcEdicao = null) {
  abrirDialog('dialogFuncionario');
  const isEdicao = Boolean(funcEdicao);
  document.getElementById('funcIdEdicao').value = isEdicao ? funcEdicao.id_funcionario : '';
  document.getElementById('tituloDialogFuncionario').innerText = isEdicao ? `Editar Funcionário #${funcEdicao.id_funcionario}` : 'Novo Funcionário';
  document.getElementById('btnSalvarFuncionario').innerText = isEdicao ? 'Atualizar Funcionário' : 'Salvar Funcionário';

  document.getElementById('funcNome').value = isEdicao ? (funcEdicao.nome || funcEdicao.nomefuncionario || '') : '';
  document.getElementById('funcCargo').value = isEdicao ? (funcEdicao.cargo || funcEdicao.funcao || '') : '';
  document.getElementById('funcTurno').value = isEdicao ? (funcEdicao.turno || 'MANHÃ').toUpperCase() : 'MANHÃ';
  document.getElementById('funcContato').value = isEdicao ? (funcEdicao.contato || funcEdicao.telefone || '') : '';
}

function editarFuncionario(id) {
  const func = cacheFuncionarios.find(f => f.id_funcionario === id);
  if (func) abrirDialogFuncionario(func);
}

async function salvarFuncionario(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('funcIdEdicao').value;
  const payload = {
    nome: document.getElementById('funcNome').value,
    cargo: document.getElementById('funcCargo').value,
    turno: document.getElementById('funcTurno').value,
    contato: document.getElementById('funcContato').value
  };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/funcionarios/${idEdicao}` : '/funcionarios';

  await enviarRequisicao(method, url, payload, 'dialogFuncionario', event.target, carregarFuncionarios);
}

async function excluirFuncionario(id) {
  if (!confirm(`Tem certeza que deseja excluir o Funcionário #${id}?`)) return;
  await enviarDelete(`/funcionarios/${id}`, carregarFuncionarios);
}

// =========================================================
// 5. ENTREGAS (LISTAR, CRIAR, EDITAR, EXCLUIR)
// =========================================================
async function carregarEntregas() {
  const tbody = document.getElementById('lista-entregas-api');
  try {
    const res = await fetch(`${API_URL}/entregas`);
    const lista = await res.json();
    cacheEntregas = lista;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-slate-400 text-sm">Nenhuma entrega agendada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map((ent, idx) => {
      const idEnt = ent.id_entrega || ent.id_reserva;
      const horarioFmt = ent.horario ? ent.horario.toString().slice(0, 5) : '';
      const tipo = ent.tipoentrega || 'ENTREGA EM EVENTO PRÓPRIO';
      const isMontagem = tipo === 'MONTAGEM';
      const badgeClass = isMontagem
        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
        : 'bg-amber-100 text-amber-800 border border-amber-200';
      const badgeLabel = isMontagem ? 'Montagem (Espaço ALOKA)' : 'Evento Próprio';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-sm">
          <td class="py-3.5 px-6 font-medium text-slate-700">#${ent.id_reserva}</td>
          <td class="py-3.5 px-6 font-medium text-slate-800">${ent.cliente_nome || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${ent.enderecoentrega || ent.cliente_endereco || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${ent.equipamento_nome || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${ent.funcionario_nome || '-'}</td>
          <td class="py-3.5 px-6 text-slate-600">${formatarData(ent.data)} ${horarioFmt ? `às ${horarioFmt}` : ''}</td>
          <td class="py-3.5 px-6"><span class="px-2.5 py-1 text-xs font-medium ${badgeClass} rounded-full whitespace-nowrap">${badgeLabel}</span></td>
          ${renderBotoesAcao(`editarEntrega(${idx})`, `excluirEntrega(${idEnt})`)}
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-red-500 text-sm">Erro: ${err.message}</td></tr>`;
  }
}

async function abrirDialogEntrega(entEdicao = null) {
  abrirDialog('dialogEntrega');
  const isEdicao = Boolean(entEdicao);
  const idEnt = isEdicao ? (entEdicao.id_entrega || entEdicao.id_reserva) : '';

  document.getElementById('entIdEdicao').value = idEnt;
  document.getElementById('tituloDialogEntrega').innerText = isEdicao
    ? `Editar Entrega (Reserva #${entEdicao.id_reserva})`
    : 'Nova Entrega';
  document.getElementById('btnSalvarEntrega').innerText = isEdicao ? 'Atualizar Entrega' : 'Agendar Entrega';

  const selectReserva = document.getElementById('entReserva');
  selectReserva.disabled = isEdicao;

  try {
    const [resList, entList, funcs] = await Promise.all([
      fetch(`${API_URL}/reservas`).then(r => r.json()),
      fetch(`${API_URL}/entregas`).then(r => r.json()),
      fetch(`${API_URL}/funcionarios`).then(r => r.json())
    ]);

    cacheReservas = resList;
    cacheEntregas = entList;

    const idsComEntrega = new Set(entList.map(e => Number(e.id_reserva)));

    const reservasDisponiveis = resList.filter(r => {
      const semEspaco = !r.id_espaco && !r.espaco_nome;
      if (isEdicao) return Number(r.id_reserva) === Number(entEdicao.id_reserva);
      return semEspaco && !idsComEntrega.has(Number(r.id_reserva));
    });

    if (!reservasDisponiveis.length) {
      selectReserva.innerHTML = `<option value="">Nenhuma reserva elegível disponível</option>`;
    } else {
      selectReserva.innerHTML = (isEdicao ? '' : `<option value="">Selecione uma reserva...</option>`) +
        reservasDisponiveis.map(r => {
          const dataFmt = formatarData(r.datareserva);
          const horaFmt = (r.horainicio || '').toString().slice(0, 5);
          return `<option value="${r.id_reserva}">#${r.id_reserva} - ${r.cliente_nome} (${dataFmt} ${horaFmt ? `às ${horaFmt}` : ''})</option>`;
        }).join('');
    }

    document.getElementById('entFuncionario').innerHTML =
      `<option value="">Selecione o técnico responsável...</option>` +
      funcs.map(f => `<option value="${f.id_funcionario}">#${f.id_funcionario} - ${f.nome || f.nomefuncionario}</option>`).join('');

    if (isEdicao) {
      selectReserva.value = entEdicao.id_reserva;
      document.getElementById('entEndereco').value = entEdicao.enderecoentrega || entEdicao.cliente_endereco || '';
      document.getElementById('entData').value = (entEdicao.data || '').toString().slice(0, 10);
      document.getElementById('entHorario').value = (entEdicao.horario || '').toString().slice(0, 5);
      document.getElementById('entTipo').value = entEdicao.tipoentrega || 'ENTREGA EM EVENTO PRÓPRIO';
      if (entEdicao.id_funcionario) document.getElementById('entFuncionario').value = entEdicao.id_funcionario;
    } else {
      document.getElementById('entEndereco').value = '';
      document.getElementById('entData').value = '';
      document.getElementById('entHorario').value = '';
      document.getElementById('entTipo').value = 'ENTREGA EM EVENTO PRÓPRIO';
    }
  } catch (e) {
    console.error('Erro ao carregar dados para entrega:', e);
  }
}

function aoSelecionarReservaEntrega() {
  const idRes = Number(document.getElementById('entReserva').value);
  const reserva = cacheReservas.find(r => Number(r.id_reserva) === idRes);

  if (reserva) {
    document.getElementById('entData').value = (reserva.datareserva || '').toString().slice(0, 10);
    document.getElementById('entHorario').value = (reserva.horainicio || '').toString().slice(0, 5);
    document.getElementById('entEndereco').value = reserva.enderecoevento || reserva.cliente_endereco || '';
  } else {
    document.getElementById('entData').value = '';
    document.getElementById('entHorario').value = '';
    document.getElementById('entEndereco').value = '';
  }
}

function editarEntrega(index) {
  const ent = cacheEntregas[index];
  if (ent) abrirDialogEntrega(ent);
}

async function salvarEntrega(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('entIdEdicao').value;
  const idReserva = Number(document.getElementById('entReserva').value);

  const payload = {
    id_reserva: idReserva,
    enderecoentrega: document.getElementById('entEndereco').value,
    id_funcionario: Number(document.getElementById('entFuncionario').value),
    data: document.getElementById('entData').value,
    horario: document.getElementById('entHorario').value,
    tipoentrega: document.getElementById('entTipo').value
  };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/entregas/${idEdicao}` : '/entregas';

  await enviarRequisicao(method, url, payload, 'dialogEntrega', event.target, () => {
    carregarEntregas();
    carregarReservas();
  });
}

async function excluirEntrega(id) {
  if (!confirm(`Tem certeza que deseja excluir o registro de entrega #${id}?`)) return;
  await enviarDelete(`/entregas/${id}`, () => {
    carregarEntregas();
    carregarReservas();
  });
}

// =========================================================
// 6. MONTAGENS (LISTAR, CRIAR, EDITAR, EXCLUIR)
// =========================================================
async function carregarMontagens() {
  const tbody = document.getElementById('lista-montagens-api');
  try {
    const res = await fetch(`${API_URL}/montagens`);
    const lista = await res.json();
    cacheMontagens = lista;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-slate-400 text-sm">Nenhuma montagem técnica vinculada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map((m, idx) => {
      const idMont = m.id_montagem || `${m.id_reserva}/${m.id_equipamento}/${m.id_funcionario}`;
      const horaFmt = (m.horainicio || m.horario || '').toString().slice(0, 5);
      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-sm">
          <td class="py-3.5 px-6 font-medium text-slate-700">#${m.id_reserva}</td>
          <td class="py-3.5 px-6">
            <p class="font-medium text-slate-800">${m.cliente_nome}</p>
            <p class="text-xs text-slate-500">${m.local_nome}</p>
          </td>
          <td class="py-3.5 px-6 font-medium text-slate-700">${m.equipamento_nome}</td>
          <td class="py-3.5 px-6">
            <p class="font-medium text-slate-800">${m.funcionario_nome}</p>
            <p class="text-xs text-slate-500">${m.funcionario_cargo || ''}</p>
          </td>
          <td class="py-3.5 px-6 text-slate-600">${formatarData(m.datareserva)} ${horaFmt ? `às ${horaFmt}` : ''}</td>
          ${renderBotoesAcao(`editarMontagem(${idx})`, `excluirMontagem('${idMont}')`)}
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">Erro: ${err.message}</td></tr>`;
  }
}

async function abrirDialogMontagem(montEdicao = null) {
  abrirDialog('dialogMontagem');
  const isEdicao = Boolean(montEdicao);
  const idMont = isEdicao ? (montEdicao.id_montagem || `${montEdicao.id_reserva}/${montEdicao.id_equipamento}/${montEdicao.id_funcionario}`) : '';

  document.getElementById('montIdEdicao').value = idMont;
  document.getElementById('tituloDialogMontagem').innerText = isEdicao ? 'Editar Montagem Técnica' : 'Nova Montagem Técnica';
  document.getElementById('btnSalvarMontagem').innerText = isEdicao ? 'Atualizar Montagem' : 'Vincular Montagem';

  const selectReserva = document.getElementById('montReserva');
  selectReserva.disabled = isEdicao;

  try {
    const [resList, montList, eqList, funcList] = await Promise.all([
      fetch(`${API_URL}/reservas`).then(r => r.json()),
      fetch(`${API_URL}/montagens`).then(r => r.json()),
      fetch(`${API_URL}/equipamentos`).then(r => r.json()),
      fetch(`${API_URL}/funcionarios`).then(r => r.json())
    ]);

    cacheReservas = resList;
    cacheMontagens = montList;

    const idsComMontagem = new Set(montList.map(m => Number(m.id_reserva)));

    const reservasDisponiveis = resList.filter(r => {
      const comEspaco = Boolean(r.id_espaco || r.espaco_nome);
      if (isEdicao) return Number(r.id_reserva) === Number(montEdicao.id_reserva);
      return comEspaco && !idsComMontagem.has(Number(r.id_reserva));
    });

    if (!reservasDisponiveis.length) {
      selectReserva.innerHTML = `<option value="">Nenhuma reserva elegível disponível</option>`;
    } else {
      selectReserva.innerHTML = (isEdicao ? '' : `<option value="">Selecione uma reserva...</option>`) +
        reservasDisponiveis.map(r => {
          const dataFmt = formatarData(r.datareserva);
          const horaFmt = (r.horainicio || '').toString().slice(0, 5);
          return `<option value="${r.id_reserva}">#${r.id_reserva} - ${r.cliente_nome} (${r.espaco_nome} • ${dataFmt} ${horaFmt ? `às ${horaFmt}` : ''})</option>`;
        }).join('');
    }

    document.getElementById('montEquipamento').innerHTML = eqList.map(eq =>
      `<option value="${eq.id_equipamento}">#${eq.id_equipamento} - ${eq.nomeequipamento}</option>`
    ).join('');

    document.getElementById('montFuncionario').innerHTML =
      `<option value="">Selecione o técnico responsável...</option>` +
      funcList.map(f => `<option value="${f.id_funcionario}">#${f.id_funcionario} - ${f.nome || f.nomefuncionario}</option>`).join('');

    if (isEdicao) {
      selectReserva.value = montEdicao.id_reserva;
      document.getElementById('montData').value = (montEdicao.datareserva || '').toString().slice(0, 10);
      document.getElementById('montHorario').value = (montEdicao.horainicio || montEdicao.horario || '').toString().slice(0, 5);
      if (montEdicao.id_equipamento) document.getElementById('montEquipamento').value = montEdicao.id_equipamento;
      if (montEdicao.id_funcionario) document.getElementById('montFuncionario').value = montEdicao.id_funcionario;
    } else {
      document.getElementById('montData').value = '';
      document.getElementById('montHorario').value = '';
    }
  } catch (e) {
    console.error('Erro ao carregar dados para montagem:', e);
  }
}

function aoSelecionarReservaMontagem() {
  const idRes = Number(document.getElementById('montReserva').value);
  const reserva = cacheReservas.find(r => Number(r.id_reserva) === idRes);

  if (reserva) {
    document.getElementById('montData').value = (reserva.datareserva || '').toString().slice(0, 10);
    document.getElementById('montHorario').value = (reserva.horainicio || '').toString().slice(0, 5);
    if (reserva.id_equipamento) {
      document.getElementById('montEquipamento').value = reserva.id_equipamento;
    }
  } else {
    document.getElementById('montData').value = '';
    document.getElementById('montHorario').value = '';
  }
}

function editarMontagem(index) {
  const m = cacheMontagens[index];
  if (m) abrirDialogMontagem(m);
}

async function salvarMontagem(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('montIdEdicao').value;
  const payload = {
    id_reserva: Number(document.getElementById('montReserva').value),
    id_equipamento: Number(document.getElementById('montEquipamento').value),
    id_funcionario: Number(document.getElementById('montFuncionario').value)
  };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/montagens/${idEdicao}` : '/montagens';

  await enviarRequisicao(method, url, payload, 'dialogMontagem', event.target, carregarMontagens);
}

async function excluirMontagem(idMont) {
  if (!confirm('Tem certeza que deseja desvincular/excluir esta montagem?')) return;
  await enviarDelete(`/montagens/${idMont}`, carregarMontagens);
}

// =========================================================
// 7. FATURAS (LISTAR, CRIAR, EDITAR, EXCLUIR)
// =========================================================
async function carregarFaturas() {
  const tbody = document.getElementById('lista-faturas-api');
  try {
    const res = await fetch(`${API_URL}/faturas`);
    const lista = await res.json();
    cacheFaturas = lista;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-slate-400 text-sm">Nenhuma fatura encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map((fat, idx) => {
      const idFat = fat.id_fatura || fat.id_reserva;
      const isFaturado = Boolean(fat.datapagamento);
      const statusTexto = fat.status_fatura || (isFaturado ? 'Faturado' : 'Pagamento Pendente');
      const badgeClass = isFaturado
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-amber-100 text-amber-800 border border-amber-200';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-sm">
          <td class="py-3.5 px-6 font-medium text-slate-700">#${fat.id_reserva}</td>
          <td class="py-3.5 px-6 font-medium text-slate-800">${fat.cliente_nome || '-'}</td>
          <td class="py-3.5 px-6 font-bold text-slate-800 whitespace-nowrap">R$ ${Number(fat.valortotal || 0).toFixed(2)}</td>
          <td class="py-3.5 px-6 text-slate-600">${formatarData(fat.datavencimento)}</td>
          <td class="py-3.5 px-6 text-slate-600">${fat.datapagamento ? formatarData(fat.datapagamento) : '-'}</td>
          <td class="py-3.5 px-6 text-slate-600 text-xs">${fat.comprovante || '-'}</td>
          <td class="py-3.5 px-6">
            <span class="px-2.5 py-1 text-xs font-medium ${badgeClass} rounded-full whitespace-nowrap">${statusTexto}</span>
          </td>
          ${renderBotoesAcao(`editarFatura(${idx})`, `excluirFatura(${idFat})`)}
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-red-500 text-sm">Erro: ${err.message}</td></tr>`;
  }
}

async function abrirDialogFatura(fatEdicao = null) {
  abrirDialog('dialogFatura');
  const isEdicao = Boolean(fatEdicao);
  const idFat = isEdicao ? (fatEdicao.id_fatura || fatEdicao.id_reserva) : '';

  document.getElementById('fatIdEdicao').value = idFat;
  document.getElementById('tituloDialogFatura').innerText = isEdicao
    ? `Editar Fatura (Reserva #${fatEdicao.id_reserva})`
    : 'Nova Fatura';
  document.getElementById('btnSalvarFatura').innerText = isEdicao ? 'Atualizar Fatura' : 'Gerar Fatura';

  const selectReserva = document.getElementById('fatReserva');
  selectReserva.disabled = isEdicao;

  try {
    const [resList, fatList] = await Promise.all([
      fetch(`${API_URL}/reservas`).then(r => r.json()),
      fetch(`${API_URL}/faturas`).then(r => r.json())
    ]);

    cacheReservas = resList;
    cacheFaturas = fatList;

    const idsComFatura = new Set(fatList.map(f => Number(f.id_reserva)));

    const reservasSemFatura = resList.filter(r => {
      if (isEdicao) return Number(r.id_reserva) === Number(fatEdicao.id_reserva);
      return !idsComFatura.has(Number(r.id_reserva));
    });

    if (!reservasSemFatura.length) {
      selectReserva.innerHTML = `<option value="">Todas as reservas já possuem fatura</option>`;
    } else {
      selectReserva.innerHTML = (isEdicao ? '' : `<option value="">Selecione uma reserva...</option>`) +
        reservasSemFatura.map(r => {
          const valor = Number(r.valortotal || 0).toFixed(2);
          return `<option value="${r.id_reserva}">#${r.id_reserva} - ${r.cliente_nome} (R$ ${valor})</option>`;
        }).join('');
    }

    if (isEdicao) {
      selectReserva.value = fatEdicao.id_reserva;
      document.getElementById('fatValor').value = Number(fatEdicao.valortotal || 0).toFixed(2);
      document.getElementById('fatVencimento').value = (fatEdicao.datavencimento || '').toString().slice(0, 10);
      document.getElementById('fatPagamento').value = fatEdicao.datapagamento ? fatEdicao.datapagamento.toString().slice(0, 10) : '';
      document.getElementById('fatComprovante').value = fatEdicao.comprovante || '';
    } else {
      document.getElementById('fatValor').value = '';
      document.getElementById('fatVencimento').value = '';
      document.getElementById('fatPagamento').value = '';
      document.getElementById('fatComprovante').value = '';
    }
  } catch (e) {
    console.error('Erro ao carregar reservas para fatura:', e);
  }
}

function aoSelecionarReservaFatura() {
  const idRes = Number(document.getElementById('fatReserva').value);
  const reserva = cacheReservas.find(r => Number(r.id_reserva) === idRes);

  if (reserva) {
    document.getElementById('fatValor').value = Number(reserva.valortotal || 0).toFixed(2);
    if (reserva.datareserva) {
      const [ano, mes, dia] = reserva.datareserva.toString().slice(0, 10).split('-').map(Number);
      const dataVencimento = new Date(Date.UTC(ano, mes - 1, dia - 5));
      document.getElementById('fatVencimento').value = dataVencimento.toISOString().slice(0, 10);
    }
  } else {
    document.getElementById('fatValor').value = '';
    document.getElementById('fatVencimento').value = '';
  }
}

function editarFatura(index) {
  const fat = cacheFaturas[index];
  if (fat) abrirDialogFatura(fat);
}

async function salvarFatura(event) {
  event.preventDefault();
  const idEdicao = document.getElementById('fatIdEdicao').value;
  const payload = {
    id_reserva: Number(document.getElementById('fatReserva').value),
    valortotal: parseFloat(document.getElementById('fatValor').value),
    datavencimento: document.getElementById('fatVencimento').value,
    datapagamento: document.getElementById('fatPagamento').value || null,
    comprovante: document.getElementById('fatComprovante').value || null
  };

  const method = idEdicao ? 'PUT' : 'POST';
  const url = idEdicao ? `/faturas/${idEdicao}` : '/faturas';

  await enviarRequisicao(method, url, payload, 'dialogFatura', event.target, carregarFaturas);
}

async function excluirFatura(id) {
  if (!confirm(`Tem certeza que deseja excluir a Fatura #${id}?`)) return;
  await enviarDelete(`/faturas/${id}`, carregarFaturas);
}

// =========================================================
// 8. RELATÓRIOS (CONSULTA COM GROUP BY + HAVING)
// =========================================================
async function carregarRelatorios() {
  const tbody = document.getElementById('lista-relatorios-api');
  if (!tbody) return;

  const min = document.getElementById('filtroMinReservas')?.value || 2;
  tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400">Consultando relatório no banco...</td></tr>`;

  try {
    const res = await fetch(`${API_URL}/relatorios/clientes-frequentes?min_reservas=${encodeURIComponent(min)}`);
    const lista = await res.json();

    if (!res.ok) throw new Error(lista.error || 'Erro ao carregar relatório');

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400">Nenhum cliente encontrado com ${min} ou mais reservas ativas.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(item => `
      <tr class="hover:bg-slate-50">
        <td class="py-3.5 px-6 text-slate-500">#${item.id_cliente}</td>
        <td class="py-3.5 px-6 font-medium text-slate-800">${item.cliente_nome}</td>
        <td class="py-3.5 px-6 text-slate-600">${item.email}</td>
        <td class="py-3.5 px-6 font-semibold text-blue-600">${item.total_reservas} reserva(s)</td>
        <td class="py-3.5 px-6 font-bold text-slate-800">R$ ${Number(item.total_gasto || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-500">Erro: ${err.message}</td></tr>`;
  }
}

// =========================================================
// 9. REQUISIÇÕES HTTP GENÉRICAS E UTILITÁRIOS
// =========================================================
async function enviarRequisicao(method, endpoint, payload, dialogId, form, onSuccess) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar registro');

    fecharDialog(dialogId);
    form.reset();
    if (onSuccess) onSuccess();
  } catch (err) {
    alert(`Erro na API (${method} ${endpoint}): ${err.message}`);
  }
}

async function enviarDelete(endpoint, onSuccess) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir registro');

    if (onSuccess) onSuccess();
  } catch (err) {
    alert(`Erro na API (DELETE ${endpoint}): ${err.message}`);
  }
}

function formatarData(valorData) {
  if (!valorData) return '-';
  const dataObj = new Date(valorData);
  return isNaN(dataObj) ? valorData : dataObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Busca por substring no PostgreSQL (ILIKE) para Clientes/Equipamentos e filtro local nas demais abas
let timeoutBusca = null;

function filtrarTabela() {
  clearTimeout(timeoutBusca);
  const termo = document.getElementById('searchInput').value.trim();

  timeoutBusca = setTimeout(async () => {
    const telaGenericaVisivel = !document.getElementById('view-generica').classList.contains('hidden');
    const moduloAtual = document.getElementById('titulo-tela-generica').innerText;

    if (telaGenericaVisivel && (moduloAtual === 'Clientes' || moduloAtual === 'Equipamentos')) {
      const endpoint = moduloAtual === 'Clientes' ? '/clientes' : '/equipamentos';
      const url = termo
        ? `${API_URL}${endpoint}?busca=${encodeURIComponent(termo)}`
        : `${API_URL}${endpoint}`;

      try {
        const res = await fetch(url);
        const lista = await res.json();
        if (moduloAtual === 'Clientes') cacheClientes = lista;
        if (moduloAtual === 'Equipamentos') cacheEquipamentos = lista;
        renderizarListaGenerica(moduloAtual, lista);
      } catch (err) {
        console.error('Erro na busca ILIKE:', err);
      }
      return;
    }

    document.querySelectorAll('main:not(.hidden) tbody tr').forEach(linha => {
      linha.style.display = linha.innerText.toLowerCase().includes(termo.toLowerCase()) ? '' : 'none';
    });
  }, 300);
}