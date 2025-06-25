$(document).ready(function() {
    // Carrega os dados ao iniciar
    carregarDadosDashboardPresenca();

    // Configura os filtros para disparar a atualização ao mudar
    $('#data-inicio, #data-fim, #usuario').change(function() {
        carregarDadosDashboardPresenca();
    });

    // Carrega a lista de funcionários para o filtro
    carregarFuncionariosParaFiltro();
});

function carregarDadosDashboardPresenca() {
    const dataInicio = $('#data-inicio').val();
    const dataFim = $('#data-fim').val();
    const usuarioId = $('#usuario').val();

    // Mostra loading na tabela e limpa dashboard
    $('#tabela-registros-ponto tbody').html('<tr><td colspan="6" class="text-center loading">Carregando dados...</td></tr>');
    limparValoresDashboard(); // Função para zerar/resetar os cards

    $.ajax({
        url: '/rh/api/presenca/relatorio/', // URL da API de dashboard de presença
        method: 'GET',
        data: {
            data_inicio: dataInicio,
            data_fim: dataFim,
            usuario_id: usuarioId
        },
        success: function(response) {
            if (response && response.dashboard && response.registros_ponto) {
                atualizarDashboardPresenca(response.dashboard, dataInicio, dataFim);
                atualizarTabelaRegistrosPonto(response.registros_ponto);
            } else {
                mostrarErro('Resposta inesperada do servidor ao carregar dados do dashboard.');
                $('#tabela-registros-ponto tbody').html('<tr><td colspan="6" class="text-center text-danger">Erro ao processar dados</td></tr>');
            }
        },
        error: function(xhr) {
            mostrarErro('Erro ao carregar dados do dashboard: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
            $('#tabela-registros-ponto tbody').html('<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados</td></tr>');
        }
    });
}

function limparValoresDashboard() {
    $('#total-checkins-hoje').text('-');
    $('#total-funcionarios-ativos-contexto').text('-');
    $('#funcionarios-sem-checkin-hoje').text('-');
    $('#total-entradas-hoje').text('-');
    $('#total-saidas-hoje').text('-');
    $('#total-entradas-periodo').text('-');
    $('#total-saidas-periodo').text('-');
    $('#total-ausencias-reportadas').text('-');
    $('#usuarios-com-ausencias').text('-');
    $('#top-observacao-ausencia-texto').text('Aguardando dados...');
    $('#top-observacao-ausencia-count').text('');
    $('#data-ref-hoje-label').text('Data'); 
    $('.card-periodo').hide(); // Esconde cards de período
}

function atualizarDashboardPresenca(dashboardData, dataInicio, dataFim) {
    if (!dashboardData) {
        mostrarErro("Dados do dashboard não recebidos.");
        return;
    }

    // Data de Referência para "Hoje"
    let dataRefLabel = new Date().toLocaleDateString('pt-BR'); // Padrão é hoje
    if (dataFim && (!dataInicio || dataInicio === dataFim)) {
        try {
            const df = new Date(dataFim + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso
            dataRefLabel = df.toLocaleDateString('pt-BR');
        } catch (e) { /* usa o padrão */ }
    }
    $('#data-ref-hoje-label').text(dataRefLabel);

    // Cards de "Hoje"
    $('#total-checkins-hoje').text(dashboardData.total_checkins_hoje || '0');
    $('#total-funcionarios-ativos-contexto').text(dashboardData.total_funcionarios_ativos_contexto || '0');
    $('#funcionarios-sem-checkin-hoje').text(dashboardData.funcionarios_sem_checkin_hoje || '0');
    $('#total-entradas-hoje').text(dashboardData.total_entradas_hoje || '0');
    $('#total-saidas-hoje').text(dashboardData.total_saidas_hoje || '0');

    // Cards de "Período" (mostrar apenas se houver filtro de data_inicio ou data_fim)
    if (dataInicio || dataFim) {
        $('#total-entradas-periodo').text(dashboardData.total_entradas_periodo || '0');
        $('#total-saidas-periodo').text(dashboardData.total_saidas_periodo || '0');
        $('.card-periodo').show();
    } else {
        $('.card-periodo').hide();
    }

    // Cards de Ausências
    $('#total-ausencias-reportadas').text(dashboardData.total_ausencias_reportadas || '0');
    $('#usuarios-com-ausencias').text(dashboardData.usuarios_com_ausencias || '0');
    if (dashboardData.top_observacoes_ausencias && dashboardData.top_observacoes_ausencias.length > 0) {
        const topObs = dashboardData.top_observacoes_ausencias[0];
        $('#top-observacao-ausencia-texto').text(topObs.observacao || 'Não especificada');
        $('#top-observacao-ausencia-count').text(`(${topObs.count} ocorrência${topObs.count !== 1 ? 's' : ''})`);
    } else {
        $('#top-observacao-ausencia-texto').text('Nenhuma observação predominante');
        $('#top-observacao-ausencia-count').text('');
    }
}

function carregarFuncionariosParaFiltro() { // Renomeada de carregarFuncionarios
    $.ajax({
        url: '/rh/api/presenca/funcionarios/', 
        method: 'GET',
        success: function(response) {
            const select = $('#usuario');
            select.empty();
            select.append('<option value="">Todos os Funcionários</option>');
            if (Array.isArray(response)) {
                response.forEach(function(funcionario) {
                    select.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                });
            } else {
                mostrarErro('Resposta inesperada ao carregar funcionários para filtro.');
            }
        },
        error: function(xhr) {
            mostrarErro('Erro ao carregar lista de funcionários para filtro: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
        }
    });
}

function atualizarTabelaRegistrosPonto(registros) { // Renomeada e adaptada
    const tbody = $('#tabela-registros-ponto tbody');
    tbody.empty();

    if (!registros || registros.length === 0) {
        tbody.html('<tr><td colspan="6" class="text-center">Nenhum registro de ponto encontrado para os filtros selecionados</td></tr>');
        return;
    }

    registros.forEach(function(registro) {
        const tr = $('<tr>').addClass('fade-in');
        tr.append(`<td>${registro.data}</td>`);
        tr.append(`<td>${registro.hora}</td>`);
        tr.append(`<td>${registro.usuario_nome || 'N/A'}</td>`);
        tr.append(`<td>${registro.departamento || 'N/A'}</td>`);
        tr.append(`<td>${registro.tipo || 'N/A'}</td>`);
        tr.append(`<td>${registro.ip_usado || 'N/A'}</td>`);
        tbody.append(tr);
    });
}

function mostrarErro(mensagem) {
    console.error(mensagem);
    const errorContainer = $('#error-messages');
    if (errorContainer.length) {
        // Usar um ID único para cada alerta para permitir múltiplos erros sem auto-fechamento rápido demais
        const alertId = 'alert-' + new Date().getTime(); 
        errorContainer.append(
            `<div class="alert alert-danger alert-dismissible fade show" role="alert" id="${alertId}">
                ${mensagem}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
             </div>`
        );
        // Auto-remover o alerta após alguns segundos para não poluir a tela
        setTimeout(() => {
            $(`#${alertId}`).alert('close');
        }, 7000); // 7 segundos
    } else {
        alert(mensagem); 
    }
} 