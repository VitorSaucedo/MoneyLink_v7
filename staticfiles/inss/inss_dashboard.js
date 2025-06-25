$(document).ready(function() {    // Constantes para os IDs e URLs
    const API_URL = '/inss/api/dashboard/';
    
    // Elementos do DOM
    const $periodoSelect = $('#periodo-select');
    const $periodoDisplay = $('#periodo-display');
    
    // Cards de métricas
    const $totalAgendamentos = $('#valor-total-agendamentos');
    const $confirmados = $('#valor-confirmados');
    const $finalizados = $('#valor-finalizados');
    const $atrasados = $('#valor-atrasados');
    
    // Elementos financeiros
    const $tacMedio = $('#valor-tac-medio');
    const $tacMenor = $('#valor-tac-menor');
    const $tacMaior = $('#valor-tac-maior');
    const $efetividadeGeral = $('#valor-efetividade');
    
    // Tabelas
    const $efetividadeLojaBody = $('#efetividade-loja-tbody');
    const $situacaoTacBody = $('#situacao-tac-tbody');
    const $tabelaTacsBody = $('#corpo-tabela-tacs');
    
    // Insights
    const $insightsContent = $('#insights-content');
    
    // Timestamp
    const $lastUpdateTime = $('#last-update-time');
    
    // Período atual, inicialmente 'mes'
    let periodoAtual = $periodoSelect.val() || 'mes';
    
    // Inicialização: carrega os dados pela primeira vez
    carregarDadosDashboard();
    
    // Event listener para mudança no seletor de período
    $periodoSelect.on('change', function() {
        periodoAtual = $(this).val();
        carregarDadosDashboard();
    });
    
    /**
     * Função principal que carrega dados do dashboard da API
     */
    function carregarDadosDashboard() {
        // Mostra indicadores de carregamento
        mostrarCarregando();
        
        // Faz a chamada AJAX para a API
        $.ajax({
            url: API_URL,
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                // Processa os dados retornados
                atualizarDashboard(data);
                // Atualiza timestamp
                $lastUpdateTime.text(new Date().toLocaleString('pt-BR'));
            },
            error: function(xhr, status, error) {
                console.error("Erro ao carregar dados do dashboard:", error);
                mostrarErro("Não foi possível carregar os dados. Tente novamente mais tarde.");
            }
        });
    }
    
    /**
     * Atualiza todos os elementos do dashboard com os dados da API
     * @param {Object} data - O objeto JSON retornado pela API
     */
    function atualizarDashboard(data) {
        if (!data) return;
        
        // 1. Atualiza informações do período
        atualizarInfoPeriodo(data.periodo);
        
        // 2. Atualiza métricas de agendamentos
        atualizarMetricasAgendamentos(data.metricas_agendamentos);
        
        // 3. Atualiza métricas financeiras
        atualizarMetricasFinanceiras(data.metricas_financeiras);
        
        // 4. Atualiza tabela de efetividade por loja
        atualizarEfetividadeLoja(data.efetividade_loja);
        
        // 5. Atualiza tabela de situação TAC
        atualizarSituacaoTAC(data.situacao_tac);
        
        // 6. Atualiza insights (se disponíveis)
        if (data.insights) {
            atualizarInsights(data.insights);
        } else {
            // Se não houver insights, esconde o card ou mostra mensagem padrão
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período selecionado.</p>');
        }
    }
    
    /**
     * Atualiza informações do período no topo do dashboard
     */
    function atualizarInfoPeriodo(periodo) {
        if (!periodo) return;
        
        // Atualiza a exibição do período (de YYYY-MM-DD para DD/MM/YYYY)
        $periodoDisplay.text(periodo.inicio + ' a ' + periodo.fim);
        
        // Garante que o select esteja na opção correta (útil para redirecionamentos)
        $periodoSelect.val(periodo.tipo);
    }
    
    /**
     * Atualiza os contadores de métricas de agendamentos
     */
    function atualizarMetricasAgendamentos(metricas) {
        if (!metricas) return;
        
        // Atualiza os valores nos elementos HTML
        $totalAgendamentos.text(metricas.total || 0);
        $confirmados.text(metricas.confirmados || 0);
        $finalizados.text(metricas.finalizados || 0);
        $atrasados.text(metricas.atrasados || 0);
    }
    
    /**
     * Atualiza os contadores de métricas financeiras
     */
    function atualizarMetricasFinanceiras(metricas) {
        if (!metricas) return;
        
        // Atualiza os valores nos elementos HTML
        $tacMedio.text(metricas.tac_medio || 'R$ 0,00');
        $tacMenor.text(metricas.tac_menor || 'R$ 0,00');
        $tacMaior.text(metricas.tac_maior || 'R$ 0,00');
        $efetividadeGeral.text(metricas.efetividade_geral || '0%');
    }
    
    /**
     * Atualiza a tabela de efetividade por loja
     */
    function atualizarEfetividadeLoja(efetividadeData) {
        if (!efetividadeData || !efetividadeData.length) {
            $efetividadeLojaBody.html('<tr><td colspan="3" class="text-center text-muted">Nenhum dado disponível para o período.</td></tr>');
            return;
        }
        
        // Limpa o conteúdo atual da tabela
        $efetividadeLojaBody.empty();
        
        // Adiciona uma linha para cada loja na lista
        efetividadeData.forEach(function(loja) {
            const $row = $('<tr></tr>');
            
            // Adiciona as células com formatação apropriada
            $row.append(`<td>${loja.loja_nome}</td>`);
            $row.append(`<td>${loja.comparecimento}</td>`);
            $row.append(`<td>${loja.fechamento}</td>`);
            
            // Adiciona a linha à tabela
            $efetividadeLojaBody.append($row);
        });
    }
    
    /**
     * Atualiza a tabela de situação TAC
     */
    function atualizarSituacaoTAC(tacData) {
        if (!tacData || !tacData.length) {
            $tabelaTacsBody.html('<tr><td colspan="4" class="text-center text-muted">Nenhum TAC registrado no período.</td></tr>');
            return;
        }
        
        // Limpa o conteúdo atual da tabela
        $tabelaTacsBody.empty();
        
        // Adiciona uma linha para cada registro TAC
        tacData.forEach(function(tac) {
            const $row = $('<tr></tr>');
            
            // Adiciona as células com formatação apropriada
            // Agora com colunas separadas para Loja e Tipo
            $row.append(`<td>${tac.loja}</td>`);
            $row.append(`<td>${tac.tipo || 'N/A'}</td>`);
            $row.append(`<td>${tac.valor}</td>`);
            
            // Aplica classes CSS conforme o status do TAC
            let statusClass = '';
            if (tac.status.includes("PAGO")) {
                statusClass = 'text-success';
            } else if (tac.status.includes("NÃO PAGO")) {
                statusClass = 'text-danger';
            } else {
                statusClass = 'text-warning';
            }
            
            $row.append(`<td class="${statusClass}">${tac.status}</td>`);
            
            // Adiciona a linha à tabela
            $tabelaTacsBody.append($row);
        });
    }
    
    /**
     * Atualiza o card de insights de desempenho
     */
    function atualizarInsights(insights) {
        if (!insights) {
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período.</p>');
            return;
        }
        
        // Limpa o conteúdo atual
        $insightsContent.empty();
        
        // Estrutura para os insights
        const insightSections = [
            { id: 'agendamentos', icon: 'bx-line-chart', title: 'Agendamentos', color: 'primary' },
            { id: 'vendas', icon: 'bx-dollar-circle', title: 'Vendas/Conversão', color: 'success' },
            { id: 'tac', icon: 'bx-receipt', title: 'TAC', color: 'warning' },
            { id: 'recomendacoes', icon: 'bx-trending-up', title: 'Recomendações', color: 'info' }
        ];
        
        // Adiciona cada seção de insight se estiver disponível
        insightSections.forEach(function(section) {
            if (insights[section.id]) {
                const $section = $(`
                    <div class="analise-section mb-3">
                        <h6 class="text-${section.color}"><i class='bx ${section.icon} me-1'></i>${section.title}</h6>
                        <p class="card-text">${insights[section.id].replace(/\\n/g, '<br>')}</p>
                    </div>
                `);
                $insightsContent.append($section);
            }
        });
        
        // Se não houver nenhum insight, mostra mensagem padrão
        if ($insightsContent.children().length === 0) {
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período.</p>');
        }
    }
    
    /**
     * Mostra indicadores de carregamento
     */
    function mostrarCarregando() {
        // Indicador de carregamento para efetividade de loja
        $efetividadeLojaBody.html('<tr><td colspan="3" class="text-center text-muted p-3"><i class="bx bx-loader-alt bx-spin me-2"></i>Carregando dados...</td></tr>');
        
        // Indicador de carregamento para situação TAC
        $tabelaTacsBody.html('<tr><td colspan="4" class="text-center text-muted p-3"><i class="bx bx-loader-alt bx-spin me-2"></i>Carregando dados...</td></tr>');
        
        // Indicador de carregamento para insights
        $insightsContent.html('<p class="text-center text-muted"><i class="bx bx-loader-alt bx-spin me-2"></i>Gerando análise...</p>');
        
        // Indicação visual nos cards (opcional)
        $totalAgendamentos.addClass('loading').text('...');
        $confirmados.addClass('loading').text('...');
        $finalizados.addClass('loading').text('...');
        $atrasados.addClass('loading').text('...');
        
        $tacMedio.addClass('loading').text('...');
        $tacMenor.addClass('loading').text('...');
        $tacMaior.addClass('loading').text('...');
        $efetividadeGeral.addClass('loading').text('...');
    }
    
    /**
     * Mostra mensagem de erro no dashboard
     */
    function mostrarErro(mensagem) {
        const erroHtmlTresColunas = `<tr><td colspan="3" class="text-center text-danger p-3"><i class="bx bx-error-circle me-2"></i>${mensagem}</td></tr>`;
        const erroHtmlQuatroColunas = `<tr><td colspan="4" class="text-center text-danger p-3"><i class="bx bx-error-circle me-2"></i>${mensagem}</td></tr>`;
        
        $efetividadeLojaBody.html(erroHtmlTresColunas);
        $tabelaTacsBody.html(erroHtmlQuatroColunas);
        $insightsContent.html(`<p class="text-center text-danger"><i class="bx bx-error-circle me-2"></i>${mensagem}</p>`);
        
        // Zera os contadores
        $totalAgendamentos.text('0');
        $confirmados.text('0');
        $finalizados.text('0');
        $atrasados.text('0');
        
        $tacMedio.text('R$ 0,00');
        $tacMenor.text('R$ 0,00');
        $tacMaior.text('R$ 0,00');
        $efetividadeGeral.text('0%');
    }
    
    // Atualizar dados a cada 5 minutos
    setInterval(carregarDadosDashboard, 5 * 60 * 1000);
});
