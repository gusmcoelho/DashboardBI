let chartFaturamento = null;
let chartStatus = null;
let chartClientes = null;

// Função utilitária para converter números formatados em português/R$
function parseBrazilianNumber(val) {
  if (val === undefined || val === null) return 0;
  let cleanVal = String(val).trim();
  // Remove R$ e espaços
  cleanVal = cleanVal.replace(/R\$\s?/g, "");
  // Verifica separadores decimais e milhares
  if (cleanVal.includes(',')) {
    cleanVal = cleanVal.replace(/\./g, '').replace(/,/g, '.');
  } else {
    const pointsCount = (cleanVal.match(/\./g) || []).length;
    if (pointsCount > 1) {
      cleanVal = cleanVal.replace(/\./g, '');
    } else if (pointsCount === 1) {
      const parts = cleanVal.split('.');
      if (parts[1].length === 3) {
        cleanVal = cleanVal.replace(/\./g, '');
      }
    }
  }
  return parseFloat(cleanVal) || 0;
}

// Inicializa os gráficos vazios ou com dados padrão
function initCharts() {
  const ctxFaturamento = document.getElementById('chart-faturamento-mensal').getContext('2d');
  const ctxStatus = document.getElementById('chart-status-projetos').getContext('2d');
  const ctxClientes = document.getElementById('chart-top-clientes').getContext('2d');

  // Configuração padrão do Chart.js
  Chart.defaults.font.family = "'Outfit', sans-serif";
  Chart.defaults.color = '#64748B';

  // 1. Gráfico de Faturamento Mensal (Linha)
  chartFaturamento = new Chart(ctxFaturamento, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: [],
          borderColor: '#00B0C8',
          backgroundColor: 'rgba(0, 176, 200, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Leads Captados',
          data: [],
          borderColor: '#3B82F6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 6
          }
        },
        tooltip: {
          padding: 12,
          backgroundColor: '#1E293B',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.datasetIndex === 0) {
                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
              } else {
                label += context.parsed.y;
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: '#E2E8F0'
          },
          ticks: {
            callback: function(value) {
              return 'R$ ' + value.toLocaleString('pt-BR');
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function(value) {
              return value + ' leads';
            }
          }
        }
      }
    }
  });

  // 2. Gráfico de Status (Donut)
  chartStatus = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#00B0C8', // Teal
          '#3B82F6', // Blue
          '#F97316', // Orange
          '#10B981', // Green
          '#8B5CF6'  // Purple
        ],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 15
          }
        }
      }
    }
  });

  // 3. Gráfico Top Clientes (Barra Horizontal)
  chartClientes = new Chart(ctxClientes, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Faturamento Acumulado (R$)',
        data: [],
        backgroundColor: '#00B0C8',
        borderRadius: 4,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Faturamento: ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.x);
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#E2E8F0'
          },
          ticks: {
            callback: function(value) {
              return 'R$ ' + value.toLocaleString('pt-BR');
            }
          }
        },
        y: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Atualiza todos os gráficos a partir do banco de dados de planilhas
function updateChartsFromData(data) {
  if (!data) return;

  // --- 1. Atualizar Faturamento Mensal e Leads ---
  if (data.faturamento && data.faturamento.length > 1) {
    const labels = [];
    const valuesFaturamento = [];
    const valuesLeads = [];

    // Ignora a primeira linha de cabeçalho
    for (let i = 1; i < data.faturamento.length; i++) {
      const row = data.faturamento[i];
      if (row && row[0]) {
        labels.push(row[0]);
        valuesFaturamento.push(parseBrazilianNumber(row[1]));
        valuesLeads.push(parseBrazilianNumber(row[2]));
      }
    }

    chartFaturamento.data.labels = labels;
    chartFaturamento.data.datasets[0].data = valuesFaturamento;
    chartFaturamento.data.datasets[1].data = valuesLeads;
    chartFaturamento.update();
  }

  // --- 2. Atualizar Distribuição de Status de Projetos ---
  if (data.status_projetos && data.status_projetos.length > 1) {
    const labels = [];
    const values = [];

    for (let i = 1; i < data.status_projetos.length; i++) {
      const row = data.status_projetos[i];
      if (row && row[0]) {
        labels.push(row[0]);
        values.push(parseBrazilianNumber(row[1]));
      }
    }

    chartStatus.data.labels = labels;
    chartStatus.data.datasets[0].data = values;
    chartStatus.update();
  }

  // --- 3. Atualizar Top 5 Clientes ---
  if (data.clientes && data.clientes.length > 1) {
    let list = [];
    for (let i = 1; i < data.clientes.length; i++) {
      const row = data.clientes[i];
      if (row && row[0]) {
        list.push({
          name: row[0],
          value: parseBrazilianNumber(row[1])
        });
      }
    }

    // Ordenar decrescente e pegar top 5
    list.sort((a, b) => b.value - a.value);
    list = list.slice(0, 5);

    chartClientes.data.labels = list.map(item => item.name);
    chartClientes.data.datasets[0].data = list.map(item => item.value);
    chartClientes.update();
  }
}
