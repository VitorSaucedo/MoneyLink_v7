document.addEventListener('DOMContentLoaded', function() {
    // Carregar dados ao inicializar a página
    carregarDados();
    // Função de busca
    function searchTable() {
        const input = document.getElementById('searchInput');
        const filter = input.value.toLowerCase();
        const activeTable = document.querySelector('.sistema-table.active');
        
        if (!activeTable) return;
        
        const rows = activeTable.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            let found = false;
            
            cells.forEach(cell => {
                if (cell.textContent.toLowerCase().includes(filter)) {
                    found = true;
                }
            });
            
            row.style.display = found ? '' : 'none';
        });
    }
    
    // Função para alternar sistema
    function toggleSistema() {
        const select = document.getElementById('sistemaSelect');
        const selectedSistema = select.value;
        const tables = document.querySelectorAll('.sistema-table');
        
        tables.forEach(table => {
            table.classList.remove('active');
        });
        
        if (selectedSistema) {
            const targetTable = document.getElementById(selectedSistema + 'Table');
            if (targetTable) {
                targetTable.classList.add('active');
            }
        }
        
        // Limpar busca ao trocar de sistema
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchTable();
        }
    }
    
    // Event listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchTable);
    }
    
    const sistemaSelect = document.getElementById('sistemaSelect');
    if (sistemaSelect) {
        sistemaSelect.addEventListener('change', toggleSistema);
        
        // Ativar primeira opção por padrão
        if (sistemaSelect.options.length > 1) {
            sistemaSelect.selectedIndex = 1;
            toggleSistema();
        }
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
    
    // Função para atualizar o status do Storm
    function atualizarStatusStorm(stormId, novoStatus) {
        var csrftoken = getCsrfToken();
        $.ajax({
            url: '/ti/api/storm/atualizar-status/' + stormId + '/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                status: novoStatus
            }),
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    // Atualizar o status na tabela
                    var $row = $(`tr[data-storm-id="${stormId}"]`);
                    var $statusCell = $row.find('.status-cell .status-badge');
                    
                    // Remover todas as classes de status
                    $statusCell.removeClass('status-ativo status-desativado');
                    
                    // Adicionar a classe apropriada baseada no novo status
                    $statusCell.addClass('status-' + novoStatus);
                    
                    // Atualizar o texto do badge
                    var statusTexto = response.status_display || (novoStatus === 'ativo' ? 'Ativo' : 'Desativado');
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
    
    // Adicionar evento de clique no status do Storm
    $(document).on('click', '.status-badge', function() {
        var $row = $(this).closest('tr');
        var stormId = $row.data('storm-id') || $row.find('.editable-status').data('storm-id');
        var currentStatus = $row.data('status') || $(this).closest('.status-cell').find('select.status-edit').val();
        
        // Verificar se é da tabela Storm
        if (!stormId || $row.data('sistema') !== 'storm') {
            return;
        }
        
        // Mostrar menu de opções de status para Storm
        var statusOptions = {
            'ativo': 'Ativo',
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
        $('.status-menu').remove();
        
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
            if (novoStatus !== currentStatus) {
                atualizarStatusStorm(stormId, novoStatus);
            }
            $('.status-menu').remove();
        });
        
        // Fechar o menu ao clicar fora dele
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.status-menu').length && !$(e.target).closest('.status-badge').length) {
                $('.status-menu').remove();
            }
        });
    });
    
    // Função para carregar dados via AJAX
    function carregarDados() {
        var csrftoken = getCsrfToken();
        
        $.ajax({
            url: '/ti/api/controle-acessos/dados/',
            type: 'GET',
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    // Preencher tabela Storm
                    preencherTabelaStorm(response.storm_data || []);
                    
                    // Preencher tabela Sistema
                    preencherTabelaSistema(response.sistema_data || []);
                    
                    // Esconder loading e mostrar conteúdo
                    $('#loading-indicator').hide();
                    $('#main-content').show();
                    
                    // Ativar primeira opção por padrão
                    const sistemaSelect = document.getElementById('sistemaSelect');
                    if (sistemaSelect && sistemaSelect.options.length > 0) {
                        sistemaSelect.selectedIndex = 0;
                        toggleSistema();
                    }
                } else {
                    mostrarNotificacao('Erro ao carregar dados: ' + (response.message || 'Erro desconhecido'), 'error');
                    $('#loading-indicator').hide();
                    $('#main-content').show();
                }
            },
            error: function(xhr, status, error) {
                mostrarNotificacao('Erro ao carregar dados: ' + error, 'error');
                $('#loading-indicator').hide();
                $('#main-content').show();
            }
        });
    }
    
    // Função para preencher tabela Storm
    function preencherTabelaStorm(dados) {
        const tbody = $('#storm-table-body');
        tbody.empty();
        
        if (dados.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="table-cell empty-state">
                        <i class='bx bx-info-circle me-2'></i>
                        Nenhum acesso Storm encontrado
                    </td>
                </tr>
            `);
            return;
        }
        
        dados.forEach(function(storm) {
            const ramal = storm.funcionario?.ramal || '-';
            const nomeCompleto = storm.funcionario?.nome_completo || '-';
            const cpf = storm.funcionario?.cpf || '-';
            const emailAdm = storm.email_administrativo || '-';
            const situacao = storm.situacao || 'desativado';
            const situacaoDisplay = storm.situacao_display || (situacao === 'ativo' ? 'Ativo' : 'Desativado');
            const usuario = storm.usuario || '-';
            const senhaTitle = storm.senha ? storm.senha : 'Sem senha';
            
            const row = `
                <tr class="table-row" data-sistema="storm" data-storm-id="${storm.id}" data-status="${situacao}">
                    <td class="table-cell ramal-number">${ramal}</td>
                    <td class="table-cell employee-name">${nomeCompleto}</td>
                    <td class="table-cell cpf-cell">${cpf}</td>
                    <td class="table-cell email-cell">${emailAdm}</td>
                    <td class="table-cell status-cell editable-status" data-storm-id="${storm.id}" data-field="situacao">
                        <span class="status-badge status-${situacao}" title="Clique para alterar o status">
                            ${situacaoDisplay}
                        </span>
                        <select class="status-edit form-control" style="display: none;">
                            <option value="ativo" ${situacao === 'ativo' ? 'selected' : ''}>Ativo</option>
                            <option value="desativado" ${situacao === 'desativado' ? 'selected' : ''}>Desativado</option>
                        </select>
                    </td>
                    <td class="table-cell user-cell">${usuario}</td>
                    <td class="table-cell password-cell" title="${senhaTitle}">••••••••</td>
                </tr>
            `;
            tbody.append(row);
        });
    }
    
    // Função para preencher tabela Sistema
    function preencherTabelaSistema(dados) {
        const tbody = $('#sistema-table-body');
        tbody.empty();
        
        if (dados.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="5" class="table-cell empty-state">
                        <i class='bx bx-info-circle me-2'></i>
                        Nenhum acesso Sistema encontrado
                    </td>
                </tr>
            `);
            return;
        }
        
        dados.forEach(function(sistema) {
            const nomeCompleto = sistema.funcionario?.nome_completo || '-';
            const acesso = sistema.acesso || '-';
            const cargo = sistema.cargo || '-';
            const departamentoSetor = sistema.departamento_setor || '-';
            const senhaTitle = sistema.senha ? sistema.senha : 'Sem senha';
            
            const row = `
                <tr class="table-row" data-sistema="sistema">
                    <td class="table-cell employee-name">${nomeCompleto}</td>
                    <td class="table-cell user-cell">${acesso}</td>
                    <td class="table-cell password-cell" title="${senhaTitle}">••••••••</td>
                    <td class="table-cell">${cargo}</td>
                    <td class="table-cell sector-name">${departamentoSetor}</td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // Função para obter o token CSRF
    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.cookie.split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];
    }
});