// Dashboard de Agendamentos - JavaScript
$(document).ready(function() {
    // Variáveis globais
    let chartStatus, chartTimeline, chartFuncionarios, chartHorarios;
    let filtrosDashboard = {};
    let filtrosTabela = {};

    // Inicialização
    inicializarDashboard();

    // Funções de inicialização
    function inicializarDashboard() {
        console.log('Inicializando Dashboard de Agendamentos...');
        definirDatasPadrao();
        configurarEventos();
        configurarFiltros();
        carregarFuncionarios();
        carregarEquipes();
        carregarSetores();
        carregarDados();
    }

    function definirDatasPadrao() {
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        // Definir datas para o dashboard
        document.getElementById('dashboard-data-inicio').value = primeiroDiaMes.toISOString().split('T')[0];
        document.getElementById('dashboard-data-fim').value = hoje.toISOString().split('T')[0];
        
        // Definir datas para a tabela
        document.getElementById('tabela-data-inicio').value = primeiroDiaMes.toISOString().split('T')[0];
        document.getElementById('tabela-data-fim').value = hoje.toISOString().split('T')[0];
    }





    function configurarEventos() {
        // Eventos do Dashboard
        document.getElementById('aplicar-filtros-dashboard').addEventListener('click', aplicarFiltrosDashboard);
        document.getElementById('limpar-filtros-dashboard').addEventListener('click', limparFiltrosDashboard);

        // Eventos da Tabela de Agendamentos
        document.getElementById('aplicar-filtros-tabela').addEventListener('click', aplicarFiltrosTabela);
        document.getElementById('exportar-dados').addEventListener('click', exportarDados);
        document.getElementById('refresh-data').addEventListener('click', () => {
            carregarAgendamentos();
            exibirNotificacao('Dados atualizados', 'success');
        });
        document.getElementById('limpar-filtros-tabela').addEventListener('click', limparFiltrosTabela);



        // Formatação automática do CPF
        document.getElementById('tabela-cliente-cpf-filtro').addEventListener('input', function(e) {
            e.target.value = formatarCPFInput(e.target.value);
        });
    }

    function configurarFiltros() {
        // Configurar máscara de CPF se necessário
        const cpfInput = document.getElementById('cliente-cpf-filtro');
        if (cpfInput) {
            cpfInput.addEventListener('keypress', function(e) {
                // Permitir apenas números, backspace e delete
                if (!/[\d]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                }
            });
        }
    }

    // Função para carregar funcionários
    async function carregarFuncionarios() {
        try {
            const response = await fetch('/siape/api/get/funcionarios-lista/');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Preencher seletores de funcionário
            const selects = ['dashboard-funcionario-filtro', 'tabela-funcionario-filtro'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Todos os funcionários</option>';
                
                data.funcionarios.forEach(funcionario => {
                    const option = document.createElement('option');
                    option.value = funcionario.id;
                    option.textContent = funcionario.nome;
                    select.appendChild(option);
                });
            });
            
        } catch (error) {
            console.error('Erro ao carregar funcionários:', error);
            exibirNotificacao('Erro ao carregar lista de funcionários', 'error');
        }
    }

    async function carregarEquipes() {
        try {
            const response = await fetch('/siape/api/get/equipes-para-filtro/');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Preencher seletores de equipe
            const selects = ['tabela-equipe-filtro'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Todas as equipes</option>';
                
                data.equipes.forEach(equipe => {
                    const option = document.createElement('option');
                    option.value = equipe.id;
                    option.textContent = equipe.nome;
                    select.appendChild(option);
                });
            });
            
        } catch (error) {
            console.error('Erro ao carregar equipes:', error);
            exibirNotificacao('Erro ao carregar lista de equipes', 'error');
        }
    }

    async function carregarSetores() {
        try {
            const response = await fetch('/siape/api/get/setores-para-filtro/');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Preencher seletores de setor
            const selects = ['tabela-setor-filtro'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Todos os setores</option>';
                
                data.setores.forEach(setor => {
                    const option = document.createElement('option');
                    option.value = setor.id;
                    option.textContent = `${setor.nome} (${setor.departamento_nome})`;
                    select.appendChild(option);
                });
            });
            
        } catch (error) {
            console.error('Erro ao carregar setores:', error);
            exibirNotificacao('Erro ao carregar lista de setores', 'error');
        }
    }

    // Função principal para carregar dados
    async function carregarDados() {
        try {
            mostrarCarregamento(true);
            
            // Carregar estatísticas do dashboard
            await carregarEstatisticas();
            
            // Carregar agendamentos detalhados
            await carregarAgendamentos();
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            exibirNotificacao('Erro ao carregar dados do dashboard', 'error');
        } finally {
            mostrarCarregamento(false);
        }
    }

    // Carregar estatísticas e gráficos
    async function carregarEstatisticas() {
        try {
            const params = new URLSearchParams(filtrosDashboard);
            const response = await fetch(`/siape/api/get/dashboard-agendamentos-overview/?${params}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Verificar se os dados existem antes de tentar usar
            // console.log('Dados recebidos da API:', data);
            
            if (data.cards) {
                atualizarCards(data.cards);
            } else {
                console.warn('Dados de cards não recebidos');
                // Usar valores padrão
                atualizarCards({
                    total_agendamentos: 0,
                    agendamentos_hoje: 0,
                    taxa_conversao: 0,
                    total_fechamentos: 0
                });
            }
            
            if (data.graficos) {
                atualizarGraficos(data.graficos);
            } else {
                console.warn('Dados de gráficos não recebidos');
            }
            
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            throw error;
        }
    }

    // Atualizar cards de estatísticas
    function atualizarCards(cards) {
        if (!cards) {
            console.warn('Dados de cards não disponíveis');
            return;
        }

        document.getElementById('total-agendamentos').textContent = cards.total_agendamentos || 0;
        document.getElementById('agendamentos-hoje').textContent = cards.agendamentos_hoje || 0;
        document.getElementById('taxa-conversao').textContent = `${cards.taxa_conversao || 0}%`;
        document.getElementById('total-fechamentos').textContent = cards.total_fechamentos || 0;
        
        animarNumeros();
    }

    // Atualizar gráficos
    function atualizarGraficos(graficos) {
        // Verificar se graficos existe e tem as propriedades esperadas
        if (!graficos) {
            console.warn('Dados de gráficos não disponíveis');
            return;
        }
        
        if (graficos.status_distribuicao) {
            criarGraficoStatus(graficos.status_distribuicao);
        }
        if (graficos.timeline) {
            criarGraficoTimeline(graficos.timeline);
        }
        if (graficos.top_funcionarios) {
            criarGraficoFuncionarios(graficos.top_funcionarios);
        }
        if (graficos.horarios_populares) {
            criarGraficoHorarios(graficos.horarios_populares);
        }
    }

    // Gráfico de distribuição por status
    function criarGraficoStatus(statusData) {
        if (!statusData || typeof statusData !== 'object') {
            console.warn('Dados de status inválidos:', statusData);
            return;
        }

        const ctx = document.getElementById('chart-status').getContext('2d');
        
        if (window.chartStatus) {
            window.chartStatus.destroy();
        }

        const labels = Object.keys(statusData);
        const data = Object.values(statusData);
        const cores = ['#667eea', '#f39c12', '#00b894', '#e17055'];

        window.chartStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: cores,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    // Gráfico de timeline
    function criarGraficoTimeline(timelineData) {
        if (!timelineData || typeof timelineData !== 'object') {
            console.warn('Dados de timeline inválidos:', timelineData);
            return;
        }

        const ctx = document.getElementById('chart-timeline').getContext('2d');
        
        if (window.chartTimeline) {
            window.chartTimeline.destroy();
        }

        const labels = Object.keys(timelineData).sort().map(date => {
            return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        const data = Object.keys(timelineData).sort().map(date => timelineData[date]);

        window.chartTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Agendamentos por dia',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Gráfico de funcionários
    function criarGraficoFuncionarios(funcionariosData) {
        if (!funcionariosData || !Array.isArray(funcionariosData)) {
            console.warn('Dados de funcionários inválidos:', funcionariosData);
            return;
        }

        const ctx = document.getElementById('chart-funcionarios').getContext('2d');
        
        if (window.chartFuncionarios) {
            window.chartFuncionarios.destroy();
        }

        const labels = funcionariosData.slice(0, 10).map(f => f.nome);
        const agendamentos = funcionariosData.slice(0, 10).map(f => f.total_agendamentos);
        const fechamentos = funcionariosData.slice(0, 10).map(f => f.total_fechamentos);

        window.chartFuncionarios = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Agendamentos',
                        data: agendamentos,
                        backgroundColor: '#667eea',
                        borderRadius: 5
                    },
                    {
                        label: 'Fechamentos',
                        data: fechamentos,
                        backgroundColor: '#00b894',
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Gráfico de horários
    function criarGraficoHorarios(horariosData) {
        if (!horariosData || !Array.isArray(horariosData)) {
            console.warn('Dados de horários inválidos:', horariosData);
            return;
        }

        const ctx = document.getElementById('chart-horarios').getContext('2d');
        
        if (window.chartHorarios) {
            window.chartHorarios.destroy();
        }

        const labels = horariosData.map(h => h.hora_formatada);
        const data = horariosData.map(h => h.total);

        window.chartHorarios = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Agendamentos',
                    data: data,
                    backgroundColor: '#f39c12',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Carregar agendamentos para tabela
    async function carregarAgendamentos() {
        try {
            const params = new URLSearchParams({
                ...filtrosTabela,
                per_page: 10000 // Carregar todos os registros
            });
            
            const response = await fetch(`/siape/api/get/agendamentos-detalhes/?${params}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            atualizarTabela(data.agendamentos);
            atualizarInformacoesTabela(data.agendamentos.length);
            
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            throw error;
        }
    }

    // Atualizar tabela de agendamentos
    function atualizarTabela(agendamentos) {
        const tbody = document.getElementById('tabela-agendamentos-body');
        
        if (agendamentos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <div class="text-muted">Nenhum agendamento encontrado</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = agendamentos.map(agendamento => `
            <tr>
                <td>
                    <div class="fw-bold">${agendamento.data}</div>
                    <small class="text-muted">${agendamento.hora}</small>
                </td>
                <td>
                    <div class="fw-bold">${agendamento.cliente.nome}</div>
                </td>
                <td>
                    <span class="font-monospace">${formatarCPF(agendamento.cliente.cpf)}</span>
                </td>
                <td>${agendamento.funcionario.nome}</td>
                <td><span class="badge bg-info">${agendamento.funcionario.equipe}</span></td>
                <td><span class="badge bg-secondary">${agendamento.funcionario.setor}</span></td>
                <td>
                    <span class="status-badge status-${agendamento.status.toLowerCase().replace('_', '-')}">
                        ${agendamento.status_display}
                    </span>
                </td>
                <td>${agendamento.cliente.renda_bruta}</td>
                <td>${agendamento.cliente.total_saldo}</td>
                <td>
                    <div class="text-truncate-custom" title="${agendamento.observacao}">
                        ${agendamento.observacao || '-'}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Atualizar informações da tabela
    function atualizarInformacoesTabela(totalRegistros) {
        const infoEl = document.getElementById('pagination-info-text');
        
        if (totalRegistros === 0) {
            infoEl.textContent = 'Nenhum agendamento encontrado';
        } else if (totalRegistros === 1) {
            infoEl.textContent = '1 agendamento encontrado';
        } else {
            infoEl.textContent = `${totalRegistros} agendamentos encontrados`;
        }
    }

    // Filtros do Dashboard
    function aplicarFiltrosDashboard() {
        // Obter valores dos filtros do dashboard
        filtrosDashboard = {
            data_inicio: document.getElementById('dashboard-data-inicio').value || '',
            data_fim: document.getElementById('dashboard-data-fim').value || '',
            funcionario_id: document.getElementById('dashboard-funcionario-filtro').value || '',
            status: document.getElementById('dashboard-status-filtro').value || ''
        };

        // Filtrar valores vazios
        Object.keys(filtrosDashboard).forEach(key => {
            if (!filtrosDashboard[key]) {
                delete filtrosDashboard[key];
            }
        });

        // Recarregar apenas as estatísticas
        carregarEstatisticas();
        exibirNotificacao('Dashboard atualizado com sucesso', 'success');
    }

    function limparFiltrosDashboard() {
        // Limpar campos do dashboard
        document.getElementById('dashboard-data-inicio').value = '';
        document.getElementById('dashboard-data-fim').value = '';
        document.getElementById('dashboard-funcionario-filtro').value = '';
        document.getElementById('dashboard-status-filtro').value = '';

        // Redefinir datas padrão
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        document.getElementById('dashboard-data-inicio').value = primeiroDiaMes.toISOString().split('T')[0];
        document.getElementById('dashboard-data-fim').value = hoje.toISOString().split('T')[0];
        
        // Limpar filtros
        filtrosDashboard = {};
        
        // Recarregar estatísticas
        carregarEstatisticas();
        exibirNotificacao('Filtros do dashboard removidos', 'info');
    }

    // Filtros da Tabela
    function aplicarFiltrosTabela() {
        // Obter valores dos filtros da tabela
        filtrosTabela = {
            data_inicio: document.getElementById('tabela-data-inicio').value || '',
            data_fim: document.getElementById('tabela-data-fim').value || '',
            funcionario_id: document.getElementById('tabela-funcionario-filtro').value || '',
            status: document.getElementById('tabela-status-filtro').value || '',
            equipe_id: document.getElementById('tabela-equipe-filtro').value || '',
            setor_id: document.getElementById('tabela-setor-filtro').value || '',
            cliente_nome: document.getElementById('tabela-cliente-nome-filtro').value || '',
            cliente_cpf: document.getElementById('tabela-cliente-cpf-filtro').value.replace(/\D/g, '') || ''
        };

        // Filtrar valores vazios
        Object.keys(filtrosTabela).forEach(key => {
            if (!filtrosTabela[key]) {
                delete filtrosTabela[key];
            }
        });

        // Recarregar apenas a tabela
        carregarAgendamentos();
        exibirNotificacao('Filtros da tabela aplicados com sucesso', 'success');
    }

    function limparFiltrosTabela() {
        // Limpar campos da tabela
        document.getElementById('tabela-data-inicio').value = '';
        document.getElementById('tabela-data-fim').value = '';
        document.getElementById('tabela-funcionario-filtro').value = '';
        document.getElementById('tabela-status-filtro').value = '';
        document.getElementById('tabela-equipe-filtro').value = '';
        document.getElementById('tabela-setor-filtro').value = '';
        document.getElementById('tabela-cliente-nome-filtro').value = '';
        document.getElementById('tabela-cliente-cpf-filtro').value = '';

        // Redefinir datas padrão
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        document.getElementById('tabela-data-inicio').value = primeiroDiaMes.toISOString().split('T')[0];
        document.getElementById('tabela-data-fim').value = hoje.toISOString().split('T')[0];
        
        // Limpar filtros
        filtrosTabela = {};
        
        // Recarregar tabela
        carregarAgendamentos();
        exibirNotificacao('Filtros da tabela removidos', 'info');
    }



    async function exportarDados() {
        try {
            mostrarCarregamento(true);
            
            const params = new URLSearchParams(filtrosTabela);
            const response = await fetch(`/siape/api/get/relatorio-agendamentos/?${params}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Converter para CSV e fazer download
            const csv = converterParaCSV(data.relatorio);
            baixarCSV(csv, 'relatorio_agendamentos.csv');
            
            exibirNotificacao('Relatório exportado com sucesso', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            exibirNotificacao('Erro ao exportar relatório', 'error');
        } finally {
            mostrarCarregamento(false);
        }
    }



    // Funções utilitárias
    function mostrarCarregamento(mostrar) {
        const overlay = document.querySelector('.loading-overlay');
        if (mostrar) {
            if (!overlay) {
                const div = document.createElement('div');
                div.className = 'loading-overlay';
                div.innerHTML = '<div class="loading-spinner"></div>';
                document.body.appendChild(div);
            }
        } else {
            if (overlay) {
                overlay.remove();
            }
        }
    }

    function animarNumeros() {
        const cards = document.querySelectorAll('.stat-number');
        cards.forEach(card => {
            card.classList.add('fade-in');
            setTimeout(() => card.classList.remove('fade-in'), 500);
        });
    }

    function formatarCPF(cpf) {
        if (!cpf) return '';
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    function formatarCPFInput(valor) {
        // Remove tudo que não é dígito
        valor = valor.replace(/\D/g, '');
        
        // Limita a 11 dígitos
        if (valor.length > 11) {
            valor = valor.slice(0, 11);
        }
        
        // Aplica a máscara
        if (valor.length > 9) {
            valor = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (valor.length > 6) {
            valor = valor.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (valor.length > 3) {
            valor = valor.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        
        return valor;
    }

    function converterParaCSV(dados) {
        if (!dados || dados.length === 0) return '';
        
        const cabecalho = Object.keys(dados[0]).join(';');
        const linhas = dados.map(item => Object.values(item).join(';'));
        
        return [cabecalho, ...linhas].join('\n');
    }

    function baixarCSV(csv, nomeArquivo) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', nomeArquivo);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exibirNotificacao(mensagem, tipo = 'info') {
        // Garantir que o container de notificações existe
        if (!document.querySelector('.notification-container')) {
            criarContainerNotificacao();
        }

        const container = document.querySelector('.notification-container');
        const id = Date.now();
        
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-times-circle', 
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const notification = document.createElement('div');
        notification.className = `notification-item alert-${tipo} with-progress`;
        notification.innerHTML = `
            <i class="fas ${iconMap[tipo]}"></i>
            <span class="notification-message">${mensagem}</span>
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
            <div class="progress-bar"></div>
        `;
        
        container.appendChild(notification);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.classList.add('fade');
                setTimeout(() => {
                    if (notification && notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    function criarContainerNotificacao() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }


});
