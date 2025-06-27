$(document).ready(function() {
    // Carregar dados dos chips ao inicializar a página
    carregarChips();
    
    // Função para carregar dados dos chips via AJAX
    function carregarChips() {
        $.ajax({
            url: '/ti/api/chips-data/',
            type: 'GET',
            success: function(response) {
                console.log('📊 Resposta da API recebida:', response);
                
                if (response.success) {
                    // Verificar se os dados existem e são válidos
                    const chips = response.data && response.data.chips ? response.data.chips : [];
                    console.log('📋 Chips encontrados:', chips.length, chips);
                    
                    popularTabela(chips);
                    $('#loading-indicator').hide();
                    $('#table-container').show();
                } else {
                    mostrarErro('Erro ao carregar dados: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('❌ Erro na requisição:', xhr.responseText);
                mostrarErro('Erro ao carregar dados: ' + error);
            }
        });
    }
    
    // Função para mostrar erro
    function mostrarErro(mensagem) {
        console.error('🚨 Erro:', mensagem);
        $('#loading-indicator').hide();
        $('#error-message').text(mensagem);
        $('#error-container').show();
    }
    
    // Função para popular a tabela com os dados
    function popularTabela(chips) {
        console.log('🔄 Populando tabela com:', chips);
        
        var tbody = $('#chips-tbody');
        tbody.empty();
        
        // Validar se chips é um array
        if (!Array.isArray(chips)) {
            console.error('❌ Dados não são um array:', typeof chips, chips);
            chips = []; // Usar array vazio como fallback
        }
        
        if (chips.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="table-cell empty-state">
                        <i class='bx bx-info-circle me-2'></i>
                        Nenhum chip cadastrado
                    </td>
                </tr>
            `);
            return;
        }
        
        chips.forEach(function(chip) {
            var row = criarLinhaChip(chip);
            tbody.append(row);
        });
        
        // Aplicar classes de cores para os status de recarga após popular a tabela
        aplicarClassesRecarga();
    }
    
    // Função para criar uma linha da tabela para um chip
    function criarLinhaChip(chip) {
        var ramal = chip.ramal || '-';
        var numero = formatarNumeroChip(chip.numero);
        var funcionario = chip.funcionario || '-';
        var setor = chip.setor || 'Sem setor';
        var setorClass = (chip.setor && chip.setor !== '-') ? 'sector-display' : 'sector-display sector-empty';
        
        // Formatação das datas - a API já retorna formatadas em dd/mm/yyyy
        var dataEntrega = (chip.data_entrega && chip.data_entrega !== '-') ? chip.data_entrega : 'Sem data';
        var dataEntregaISO = converterDataParaISO(chip.data_entrega);
        var dataEntregaClass = (chip.data_entrega && chip.data_entrega !== '-') ? 'date-badge' : 'date-badge date-empty';
        var dataEntregaTitle = (chip.data_entrega && chip.data_entrega !== '-') ? 'Clique para alterar a data de entrega' : 'Clique para definir a data de entrega';
        
        var dataCriacao = (chip.data_criacao_recarga && chip.data_criacao_recarga !== '-') ? chip.data_criacao_recarga : 'Sem data';
        var dataCriacaoISO = converterDataParaISO(chip.data_criacao_recarga);
        
        var dataBan = (chip.data_banimento && chip.data_banimento !== '-') ? chip.data_banimento : 'Sem ban';
        var dataBanISO = converterDataParaISO(chip.data_banimento);
        var dataBanClass = (chip.data_banimento && chip.data_banimento !== '-') ? 'date-badge date-ban' : 'date-badge date-empty';
        var dataBanTitle = (chip.data_banimento && chip.data_banimento !== '-') ? 'Clique para alterar a data de banimento' : 'Clique para definir a data de banimento';
        
        // Status - usar o status_value para o data-status e status para exibição
        var statusValue = chip.status_value || chip.status;
        var statusTexto = chip.status || obterTextoStatus(statusValue);
        
        // Status de recarga - usar a data ISO para cálculo
        var statusRecarga = calcularStatusRecarga(dataCriacaoISO);
        
        return `
            <tr class="table-row" data-status="${statusValue}" data-chip-id="${chip.id}">
                <td class="table-cell">${ramal}</td>
                <td class="table-cell chip-number">${numero}</td>
                <td class="table-cell employee-name">${funcionario}</td>
                <td class="table-cell sector-cell">
                    <span class="${setorClass}">${setor}</span>
                </td>
                <td class="table-cell date-cell editable-date" data-chip-id="${chip.id}" data-field="data_entrega">
                    <span class="${dataEntregaClass}" title="${dataEntregaTitle}" data-date="${dataEntregaISO}">
                        ${dataEntrega}
                    </span>
                </td>
                <td class="table-cell date-cell editable-date" data-chip-id="${chip.id}" data-field="data_criacao_recarga">
                    <span class="date-badge" title="Clique para alterar a data de criação/recarga" data-date="${dataCriacaoISO}">
                        ${dataCriacao}
                    </span>
                </td>
                <td class="table-cell date-cell editable-date" data-chip-id="${chip.id}" data-field="data_banimento">
                    <span class="${dataBanClass}" title="${dataBanTitle}" data-date="${dataBanISO}">
                        ${dataBan}
                    </span>
                </td>
                <td class="table-cell status-cell editable-status" data-chip-id="${chip.id}" data-field="status">
                    <span class="status-badge status-${statusValue}" title="Clique para alterar o status">
                        ${statusTexto}
                    </span>
                </td>
                <td class="table-cell recarregar-cell">
                    ${statusRecarga}
                </td>
            </tr>
        `;
    }
    
    // Função para converter data dd/mm/yyyy para yyyy-mm-dd
    function converterDataParaISO(dataFormatada) {
        if (!dataFormatada || dataFormatada === '-') return '';
        
        var partes = dataFormatada.split('/');
        if (partes.length === 3) {
            return partes[2] + '-' + partes[1] + '-' + partes[0];
        }
        return '';
    }
    
    // Função para formatar número do chip
    function formatarNumeroChip(numero) {
        // Implementar formatação se necessário
        return numero;
    }
    
    // Função para formatar data
    function formatarData(dataISO) {
        if (!dataISO) return '';
        var data = new Date(dataISO + 'T00:00:00');
        return data.toLocaleDateString('pt-BR');
    }
    
    // Função para obter texto do status
    function obterTextoStatus(status) {
        var statusOptions = {
            'ativo': 'Ativo',
            'banido': 'Banido',
            'livre': 'Livre',
            'reutilizado': 'Reutilizado',
            'perdido': 'Perdido',
            'recarregar': 'Recarregar',
            'desativado': 'Desativado'
        };
        return statusOptions[status] || status;
    }
    
    // Função para calcular status de recarga
    function calcularStatusRecarga(dataCriacao) {
        if (!dataCriacao) return '<span class="badge bg-secondary">Sem data</span>';
        
        var hoje = new Date();
        var dataCriacaoObj = new Date(dataCriacao + 'T00:00:00');
        var diffTime = Math.abs(hoje - dataCriacaoObj);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 90) {
            return '<span class="badge bg-danger">Recarregar</span>';
        } else if (diffDays > 83) {
            return '<span class="badge bg-warning">Recarregar em breve</span>';
        } else {
            return '<span class="badge bg-success">Ok</span>';
        }
    }
    
    // Busca por ramal, nome do funcionário ou número do chip
    function performSearch() {
        var searchTerm = $('#search-chips').val().toLowerCase();
        
        $('#chips-table tbody tr').each(function() {
            var $row = $(this);
            var ramal = $row.find('td:eq(0)').text().toLowerCase();
            var numero = $row.find('td:eq(1)').text().toLowerCase();
            var funcionario = $row.find('td:eq(2)').text().toLowerCase();
            var setor = $row.find('td:eq(3)').text().toLowerCase();
            var chipStatus = $row.find('td:eq(7) .status-badge').text().toLowerCase().trim();
            var statusRecarga = $row.find('td:eq(8) .badge').text().toLowerCase().trim();
            
            var matchesSearch = ramal.includes(searchTerm) || 
                               numero.includes(searchTerm) || 
                               funcionario.includes(searchTerm) || 
                               setor.includes(searchTerm) || 
                               chipStatus.includes(searchTerm) || 
                               statusRecarga.includes(searchTerm);
            
            $row.toggle(matchesSearch);
        });
    }
    
    // Executar busca em tempo real
    $('#search-chips').on('input keyup paste', performSearch);
    
    // Função para aplicar classes de cores para os status de recarga
    function aplicarClassesRecarga() {
        $('.recarregar-cell .badge').each(function() {
            var $badge = $(this);
            if ($badge.text() === 'Recarregar') {
                $badge.addClass('bg-danger');
            } else if ($badge.text() === 'Recarregar em breve') {
                $badge.addClass('bg-warning');
            } else if ($badge.text() === 'Ok') {
                $badge.addClass('bg-success');
            }
        });
    }
    
    // Função para mostrar notificações
    function mostrarNotificacao(mensagem, tipo) {
        // Remover notificações anteriores
        $('.notificacao').remove();
        
        // Criar elemento de notificação
        var $notificacao = $('<div class="notificacao notificacao-' + tipo + '">' + mensagem + '</div>');
        
        // Adicionar ao corpo do documento
        $('body').append($notificacao);
        
        // Mostrar com animação
        $notificacao.fadeIn();
        
        // Esconder após 3 segundos
        setTimeout(function() {
            $notificacao.fadeOut(function() {
                $(this).remove();
            });
        }, 3000);
    }
    
    // Função para atualizar o status do chip
    function atualizarStatusChip(chipId, novoStatus) {
        var csrftoken = getCsrfToken();
        $.ajax({
            url: '/ti/api/chip/atualizar-data-recarga/' + chipId + '/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                valor: novoStatus,
                campo: 'status'
            }),
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    // Atualizar o status na tabela
                    var $row = $(`tr[data-chip-id="${chipId}"]`);
                    var $statusCell = $row.find('.status-cell .status-badge');
                    
                    // Remover todas as classes de status
                    $statusCell.removeClass('status-ativo status-banido status-livre status-reutilizado status-perdido status-recarregar status-desativado');
                    
                    // Adicionar a classe apropriada baseada no novo status
                    $statusCell.addClass('status-' + novoStatus);
                    
                    // Atualizar o texto do badge
                    var statusOptions = {
                        'ativo': 'Ativo',
                        'banido': 'Banido',
                        'livre': 'Livre',
                        'reutilizado': 'Reutilizado',
                        'perdido': 'Perdido',
                        'recarregar': 'Recarregar',
                        'desativado': 'Desativado'
                    };
                    var statusTexto = statusOptions[novoStatus] || novoStatus;
                    $statusCell.text(statusTexto);
                    
                    // Atualizar o atributo data-status da linha
                    $row.attr('data-status', novoStatus);
                    
                    // Mostrar mensagem de sucesso
                    mostrarNotificacao('Status atualizado com sucesso!', 'success');
                } else {
                    // Mostrar mensagem de erro
                    mostrarNotificacao('Erro ao atualizar status: ' + response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                mostrarNotificacao('Erro ao atualizar status: ' + error, 'error');
            }
        });
    }
    
    // Função para atualizar campos de data do chip
    function atualizarCampoChip(chipId, novoValor, campo, textoExibicao) {
        var csrftoken = getCsrfToken();
        var dados = { data_recarga: novoValor, campo: campo };
        
        $.ajax({
            url: '/ti/api/chip/atualizar-data-recarga/' + chipId + '/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(dados),
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    var $row = $(`tr[data-chip-id="${chipId}"]`);
                    
                    // Para campos de data
                    var $dateBadge = $row.find(`[data-field="${campo}"] .date-badge`);
                    
                    if (novoValor === '') {
                        if (campo === 'data_banimento') {
                            $dateBadge.text('Sem ban');
                        } else {
                            $dateBadge.text('Sem data');
                        }
                        $dateBadge.addClass('date-empty');
                        $dateBadge.removeClass('date-ban');
                    } else {
                        $dateBadge.text(textoExibicao);
                        $dateBadge.removeClass('date-empty');
                        
                        if (campo === 'data_banimento') {
                            $dateBadge.addClass('date-ban');
                        }
                    }
                    
                    $dateBadge.data('date', novoValor);
                    
                    // Mostrar mensagem de sucesso
                    mostrarNotificacao('Data atualizada com sucesso!', 'success');
                } else {
                    // Mostrar mensagem de erro
                    mostrarNotificacao('Erro ao atualizar: ' + response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                mostrarNotificacao('Erro ao atualizar: ' + error, 'error');
            }
        });
    }
    
    // Adicionar evento de clique no status
    $(document).on('click', '.status-badge', function() {
        var $row = $(this).closest('tr');
        var chipId = $row.data('chip-id');
        var currentStatus = $row.data('status');
        
        // Mostrar menu de opções de status
        var statusOptions = {
            'ativo': 'Ativo',
            'banido': 'Banido',
            'livre': 'Livre',
            'reutilizado': 'Reutilizado',
            'perdido': 'Perdido',
            'recarregar': 'Recarregar',
            'desativado': 'Desativado'
        };
        
        var menuHtml = '<div class="status-menu">';
        menuHtml += '<h5>Selecione o novo status:</h5>';
        menuHtml += '<ul>';
        
        for (var status in statusOptions) {
            var activeClass = (status === currentStatus) ? 'active' : '';
            menuHtml += `<li class="${activeClass}" data-status="${status}">${statusOptions[status]}</li>`;
        }
        
        menuHtml += '</ul>';
        menuHtml += '</div>';
        
        // Remover qualquer menu existente
        $('.status-menu, .date-menu').remove();
        
        // Adicionar o novo menu
        $('body').append(menuHtml);
        
        // Posicionar o menu próximo ao status clicado
        var offset = $(this).offset();
        $('.status-menu').css({
            top: offset.top + $(this).outerHeight(),
            left: offset.left
        });
        
        // Adicionar evento de clique nas opções do menu
        $('.status-menu li').on('click', function() {
            var novoStatus = $(this).data('status');
            atualizarStatusChip(chipId, novoStatus);
            $('.status-menu').remove();
        });
        
        // Fechar o menu ao clicar fora dele
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.status-menu').length && !$(e.target).closest('.status-badge').length) {
                $('.status-menu').remove();
            }
        });
    });
    
    // A funcionalidade de troca de setor foi removida
    
    // Adicionar evento de clique nas datas
    $(document).on('click', '.date-badge', function() {
        var $badge = $(this);
        var $row = $badge.closest('tr');
        var chipId = $row.data('chip-id');
        var campo = $row.find('.editable-date').data('field');
        var currentDate = $badge.data('date');
        
        var menuHtml = '<div class="date-menu status-menu">';
        menuHtml += '<h5>Selecione a data:</h5>';
        menuHtml += '<div style="padding: 10px;">';
        menuHtml += `<input type="date" class="form-control date-picker" value="${currentDate}" style="margin-bottom: 10px;">`;
        menuHtml += '<div style="text-align: center;">';
        menuHtml += '<button class="btn btn-sm btn-primary me-2 save-date">Salvar</button>';
        menuHtml += '<button class="btn btn-sm btn-secondary cancel-date">Cancelar</button>';
        if (currentDate) {
            menuHtml += '<button class="btn btn-sm btn-danger ms-2 clear-date">Limpar</button>';
        }
        menuHtml += '</div>';
        menuHtml += '</div>';
        menuHtml += '</div>';
        
        // Remover qualquer menu existente
        $('.status-menu, .date-menu').remove();
        
        // Adicionar o novo menu
        $('body').append(menuHtml);
        
        // Posicionar o menu próximo à data clicada
        var offset = $badge.offset();
        $('.date-menu').css({
            top: offset.top + $badge.outerHeight(),
            left: offset.left
        });
        
        // Eventos dos botões
        $('.save-date').on('click', function() {
            var novaData = $('.date-picker').val();
            if (novaData) {
                var dataParts = novaData.split('-');
                var dataFormatada = dataParts[2] + '/' + dataParts[1] + '/' + dataParts[0];
                atualizarCampoChip(chipId, novaData, campo, dataFormatada);
            }
            $('.date-menu').remove();
        });
        
        $('.cancel-date').on('click', function() {
            $('.date-menu').remove();
        });
        
        $('.clear-date').on('click', function() {
            atualizarCampoChip(chipId, '', campo, '');
            $('.date-menu').remove();
        });
        
        // Fechar o menu ao clicar fora dele
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.date-menu').length && !$(e.target).closest('.date-badge').length) {
                $('.date-menu').remove();
            }
        });
    });
    
    // Código de edição antigo removido - agora usamos badges clicáveis
    
    // Função para obter o token CSRF
    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.cookie.split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];
    }
});