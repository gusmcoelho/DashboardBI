// Configurações do Google Sheets
var SPREADSHEET_ID = "1tOnZvhaEgJUDV1B8kCheF9NIxqUseGg6LMxA_dqhCkc";
var URL_PLANILHA = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/export?format=xlsx";

// Armazenamento local das tabelas
var dadosPlanilha = {
  clientes: [],
  projetos: [],
  faturamento: [],
  status_projetos: []
};

// Filtro selecionado na tela
var categoriaFiltro = "Todos";

// Ao carregar a página
document.addEventListener("DOMContentLoaded", function() {
  // Iniciar ícones da tela
  lucide.createIcons();

  // Verifica preferência de tema salva ou preferência do sistema
  var savedTheme = localStorage.getItem("theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
  
  if (isDark) {
    document.body.classList.add("dark-mode");
    var icon = document.getElementById("dark-icon");
    var text = document.getElementById("dark-text");
    if (icon && text) {
      icon.setAttribute("data-lucide", "sun");
      text.textContent = "Modo Claro";
      lucide.createIcons();
    }
  }

  // Iniciar os gráficos do Chart.js vazios
  initCharts();

  // Iniciar a busca dos dados e definir o loop de atualização (a cada 8 segundos)
  buscarDadosDoGoogleSheets();
  setInterval(buscarDadosDoGoogleSheets, 8000);
});

// Busca a planilha do Google Sheets e processa os dados
async function buscarDadosDoGoogleSheets() {
  mostrarStatusCarregando();

  try {
    // Busca o arquivo Excel (.xlsx) diretamente do link de exportação do Google
    var resposta = await fetch(URL_PLANILHA);
    if (!resposta.ok) {
      throw new Error("Não foi possível baixar a planilha do Google Sheets. Código: " + resposta.status);
    }

    var arrayBuffer = await resposta.arrayBuffer();
    var dadosExcel = new Uint8Array(arrayBuffer);
    
    // Lê o workbook usando a biblioteca SheetJS (XLSX)
    var workbook = XLSX.read(dadosExcel, { type: "array" });

    // Pega os dados das abas de forma case-insensitive
    var abaClientes = getSheetCaseInsensitive(workbook, "clientes");
    var abaProjetos = getSheetCaseInsensitive(workbook, "projetos");
    var abaFaturamento = getSheetCaseInsensitive(workbook, "faturamento");
    var abaStatusProjetos = getSheetCaseInsensitive(workbook, "status_projetos");

    if (!abaClientes || !abaProjetos || !abaFaturamento) {
      throw new Error("Verifique se as abas 'clientes', 'projetos' e 'faturamento' existem no Google Sheets.");
    }

    // Converte as tabelas para Array de Arrays (AOA)
    var rawClientes = XLSX.utils.sheet_to_json(abaClientes, { header: 1, defval: "" });
    var rawProjetos = XLSX.utils.sheet_to_json(abaProjetos, { header: 1, defval: "" });
    var rawFaturamento = XLSX.utils.sheet_to_json(abaFaturamento, { header: 1, defval: "" });

    // Limpa linhas em branco das tabelas
    dadosPlanilha.clientes = filtrarLinhasVazias(rawClientes);
    dadosPlanilha.projetos = filtrarLinhasVazias(rawProjetos);
    dadosPlanilha.faturamento = filtrarLinhasVazias(rawFaturamento);

    // Carrega aba de status de projetos opcionalmente
    if (abaStatusProjetos) {
      var rawStatusProjetos = XLSX.utils.sheet_to_json(abaStatusProjetos, { header: 1, defval: "" });
      dadosPlanilha.status_projetos = filtrarLinhasVazias(rawStatusProjetos);
    } else {
      dadosPlanilha.status_projetos = [];
    }

    console.log("Dados carregados com sucesso!", dadosPlanilha);

    // Atualiza a tela com as novas informações
    atualizarDashboard();
    mostrarStatusSucesso();

  } catch (erro) {
    console.error("Erro na sincronização:", erro);
    mostrarStatusErro(erro.message);
  }
}

// Filtra e remove linhas que estão totalmente vazias
function filtrarLinhasVazias(tabela) {
  var linhasLimpas = [];
  for (var i = 0; i < tabela.length; i++) {
    var linha = tabela[i];
    var linhaTemConteudo = false;
    
    // Verifica se alguma célula tem texto/número
    for (var j = 0; j < linha.length; j++) {
      if (linha[j] !== undefined && String(linha[j]).trim() !== "") {
        linhaTemConteudo = true;
        break;
      }
    }
    
    // Se a linha tem conteúdo, limpa os espaços de cada célula e adiciona
    if (linhaTemConteudo) {
      var linhaSanitizada = [];
      for (var k = 0; k < linha.length; k++) {
        linhaSanitizada.push(String(linha[k]).trim());
      }
      linhasLimpas.push(linhaSanitizada);
    }
  }
  return linhasLimpas;
}

// Atualiza cartões, gráficos e tabelas do painel
function atualizarDashboard() {
  var clientes = dadosPlanilha.clientes;
  var projetos = dadosPlanilha.projetos;
  var faturamento = dadosPlanilha.faturamento;

  // --- 1. CÁLCULO E PREENCHIMENTO DOS CARDS DE KPI ---

  // A. Clientes Ativos (Quantidade de linhas na aba clientes - cabeçalho)
  var clientesAtivos = clientes.length > 1 ? (clientes.length - 1) : 0;
  document.getElementById("kpi-clientes").textContent = clientesAtivos;

  // B. Faturamento Mensal (Último mês listado na tabela faturamento)
  var faturamentoMensalVal = 0;
  if (faturamento.length > 1) {
    var ultimaLinhaFaturamento = faturamento[faturamento.length - 1];
    faturamentoMensalVal = parseBrazilianNumber(ultimaLinhaFaturamento[1]);
  }
  document.getElementById("kpi-faturamento").textContent = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(faturamentoMensalVal);

  // C. Leads Captados (Soma de todos os leads de todos os meses)
  var leadsTotal = 0;
  for (var i = 1; i < faturamento.length; i++) {
    leadsTotal += Math.round(parseBrazilianNumber(faturamento[i][2]));
  }
  document.getElementById("kpi-leads").textContent = leadsTotal.toLocaleString("pt-BR");

  // D. Projetos Ativos (Total de projetos com progresso menor que 100%)
  var projetosAtivosCount = 0;
  for (var i = 1; i < projetos.length; i++) {
    var progresso = parsePercentage(projetos[i][2]);
    if (progresso < 100) {
      projetosAtivosCount++;
    }
  }
  document.getElementById("kpi-projetos").textContent = projetosAtivosCount;

  // E. Tarefas Concluídas / Média de Progresso Geral dos Projetos
  var somaProgresso = 0;
  var totalProjetosValidos = 0;
  for (var i = 1; i < projetos.length; i++) {
    somaProgresso += parsePercentage(projetos[i][2]);
    totalProjetosValidos++;
  }
  var mediaProgresso = totalProjetosValidos > 0 ? Math.round(somaProgresso / totalProjetosValidos) : 0;
  document.getElementById("kpi-tarefas").textContent = mediaProgresso + "%";

  // --- 2. ATUALIZAR GRÁFICOS DO CHART.JS ---

  // Repassa os dados para o charts.js atualizar as telas
  updateChartsFromData(dadosPlanilha);

  // --- 3. ATUALIZAR TABELA DE DETALHES DOS PROJETOS (DASHBOARD) ---
  atualizarTabelaProjetosDashboard();
}

// Atualiza a tabela HTML de projetos aplicando filtros
function atualizarTabelaProjetosDashboard() {
  var projectsData = dadosPlanilha.projetos;
  var tbody = document.querySelector("#dashboard-projects-table tbody");
  tbody.innerHTML = "";

  if (!projectsData || projectsData.length <= 1) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Nenhum projeto cadastrado.</td></tr>';
    return;
  }

  // Mapeamento estático de categorias baseado no nome do projeto para o filtro
  var categoriesMap = {
    "Site Institucional": "Site",
    "Campanha Tráfego": "Marketing",
    "Integração CRM": "App",
    "Migração Nuvem": "Nuvem",
    "App Mobile": "App"
  };

  for (var i = 1; i < projectsData.length; i++) {
    var row = projectsData[i];
    var name = row[0];
    var budget = parseBrazilianNumber(row[1]);
    var progress = Math.min(100, Math.max(0, Math.round(parsePercentage(row[2]))));

    var category = categoriesMap[name] || "Outros";

    // Aplica o filtro de Categoria da Sidebar
    if (categoriaFiltro !== "Todos" && category !== categoriaFiltro) {
      continue;
    }

    // Calcula a tag/badge do status do projeto
    var statusClass = "em-progresso";
    var statusText = "Em Progresso";
    if (progress === 100) {
      statusClass = "completado";
      statusText = "Concluído";
    } else if (progress < 40) {
      statusClass = "atrasado";
      statusText = "Iniciando";
    }

    var tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${name}</strong></td>
      <td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(budget)}</td>
      <td>
        <div style="display:flex; align-items:center; gap: 8px;">
          <span>${progress}%</span>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
        </div>
      </td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Nenhum projeto corresponde ao filtro selecionado.</td></tr>';
  }
}

// Filtros da Sidebar
function aplicarFiltros() {
  var catSelect = document.getElementById("filter-categoria");
  categoriaFiltro = catSelect.value;
  atualizarTabelaProjetosDashboard();

  // Fecha a sidebar no mobile após aplicar o filtro
  var sidebar = document.querySelector(".sidebar");
  if (sidebar && sidebar.classList.contains("active")) {
    toggleSidebar();
  }
}

// Abre o Google Sheets em nova aba
function abrirPlanilhaGoogle() {
  window.open("https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit?usp=sharing", "_blank");
}

// Converte valores monetários/dinheiro em texto brasileiro para números comuns
function parseBrazilianNumber(val) {
  if (val === undefined || val === null) return 0;
  var cleanVal = String(val).trim();
  
  // Remove cifrão e espaços
  cleanVal = cleanVal.replace(/R\$\s?/g, "");
  
  // Se contiver vírgula de decimais (padrão brasileiro)
  if (cleanVal.includes(",")) {
    cleanVal = cleanVal.replace(/\./g, "").replace(",", ".");
  } else {
    // Caso tenha apenas ponto
    var pointsCount = (cleanVal.match(/\./g) || []).length;
    if (pointsCount > 1) {
      cleanVal = cleanVal.replace(/\./g, "");
    } else if (pointsCount === 1) {
      var parts = cleanVal.split(".");
      if (parts[1].length === 3) {
        cleanVal = cleanVal.replace(/\./g, "");
      }
    }
  }
  return parseFloat(cleanVal) || 0;
}

// Converte e trata porcentagens de planilhas (ex: 0.92 = 92% ou "92%")
function parsePercentage(val) {
  if (val === undefined || val === null) return 0;
  var cleanVal = String(val).trim();
  
  if (cleanVal.includes("%")) {
    cleanVal = cleanVal.replace(/%/g, "");
    return parseFloat(cleanVal) || 0;
  }
  
  var num = parseFloat(cleanVal) || 0;
  // Se for uma fração decimal vinda do Excel/Google Sheets
  if (num > 0 && num <= 1.0) {
    num = num * 100;
  }
  return num;
}

// --- CONTROLES VISUAIS DO STATUS DE CONEXÃO ---

function mostrarStatusCarregando() {
  var spinIcon = document.getElementById("sync-spin-icon");
  if (spinIcon) {
    spinIcon.classList.add("animate-spin");
  }
}

function mostrarStatusSucesso() {
  var spinIcon = document.getElementById("sync-spin-icon");
  var textStatus = document.getElementById("sheets-sync-status");
  var headerSyncEl = document.querySelector("#dashboard-last-sync span");
  var statusBox = document.getElementById("sync-status");

  var agora = new Date().toLocaleTimeString("pt-BR");
  var msg = "Conectado ao Sheets às " + agora;

  if (spinIcon) spinIcon.classList.remove("animate-spin");
  if (textStatus) textStatus.textContent = msg;
  if (headerSyncEl) headerSyncEl.textContent = msg;
  if (statusBox) statusBox.className = "connection-status connected";

  // Efeito rápido de animação
  var pulseEl = document.getElementById("dashboard-last-sync");
  if (pulseEl) {
    pulseEl.style.transform = "scale(1.08)";
    setTimeout(function() {
      pulseEl.style.transform = "none";
    }, 400);
  }
}

function mostrarStatusErro(mensagem) {
  var spinIcon = document.getElementById("sync-spin-icon");
  var textStatus = document.getElementById("sheets-sync-status");
  var headerSyncEl = document.querySelector("#dashboard-last-sync span");
  var statusBox = document.getElementById("sync-status");

  var msg = "Erro na sincronização: " + mensagem;

  if (spinIcon) {
    spinIcon.classList.remove("animate-spin");
    spinIcon.style.color = "#EF4444";
  }
  if (textStatus) {
    textStatus.textContent = msg;
    textStatus.style.color = "#EF4444";
  }
  if (headerSyncEl) {
    headerSyncEl.textContent = msg;
  }
  if (statusBox) {
    statusBox.className = "connection-status";
  }
}

// Controla a visibilidade da sidebar em dispositivos móveis
function toggleSidebar() {
  var sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  
  sidebar.classList.toggle("active");
  
  var btn = document.getElementById("menu-toggle-btn");
  if (btn) {
    var icon = btn.querySelector("i");
    if (icon) {
      if (sidebar.classList.contains("active")) {
        icon.setAttribute("data-lucide", "x");
      } else {
        icon.setAttribute("data-lucide", "menu");
      }
      // Re-renderiza o ícone do Lucide
      lucide.createIcons();
    }
  }
}

// Busca uma aba na planilha de forma case-insensitive
function getSheetCaseInsensitive(workbook, name) {
  if (!workbook || !workbook.SheetNames) return null;
  var sheets = workbook.SheetNames;
  var target = name.toLowerCase();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].toLowerCase() === target) {
      return workbook.Sheets[sheets[i]];
    }
  }
  return null;
}

// Alterna entre os modos claro e escuro
function toggleDarkMode() {
  var isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  
  var icon = document.getElementById("dark-icon");
  var text = document.getElementById("dark-text");
  
  if (icon && text) {
    if (isDark) {
      icon.setAttribute("data-lucide", "sun");
      text.textContent = "Modo Claro";
    } else {
      icon.setAttribute("data-lucide", "moon");
      text.textContent = "Modo Escuro";
    }
    lucide.createIcons();
  }

  // Atualiza as cores do Chart.js dinamicamente se a função estiver disponível
  if (typeof updateChartThemes === "function") {
    updateChartThemes(isDark);
  }
}
