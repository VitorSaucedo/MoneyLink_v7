$(document).ready(function() {
    // Função para obter o CSRF token
    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.cookie.split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];
    }
    
    // Função para carregar dados dos e-mails via AJAX
    function carregarEmails() {
        $.ajax({
            url: '/ti/api/emails-data/',
            type: 'GET',
            beforeSend: function() {
                $('#loading-indicator').show();
                $('#table-container').hide();
                $('#error-container').hide();
            },
            success: function(response) {
                console.log('📊 Resposta da API de e-mails recebida:', response);
                
                if (response.success) {
                    // A API retorna os dados em response.data.emails
                    const emails = response.data && response.data.emails ? response.data.emails : [];
                    console.log('📧 E-mails encontrados:', emails.length, emails);
                    
                    popularTabela(emails);
                    $('#loading-indicator').hide();
                    $('#table-container').show();
                } else {
                    mostrarErro('Erro ao carregar dados: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('❌ Erro na requisição de e-mails:', xhr.responseText);
                mostrarErro('Erro ao carregar dados: ' + error);
            }
        });
    }
    
    // Função para popular a tabela com os dados
    function popularTabela(emails) {
        console.log('🔄 Populando tabela de e-mails com:', emails);
        
        var tbody = $('#emails-tbody');
        tbody.empty();
        
        // Validar se emails é um array
        if (!Array.isArray(emails)) {
            console.error('❌ Dados de e-mails não são um array:', typeof emails, emails);
            emails = []; // Usar array vazio como fallback
        }
        
        if (emails.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="table-cell empty-state">
                        <i class='bx bx-info-circle me-2'></i>
                        Nenhum e-mail cadastrado
                    </td>
                </tr>
            `);
            return;
        }
        
        emails.forEach(function(email) {
            var ramal = email.ramal !== '-' ? email.ramal : '-';
            var funcionario = email.funcionario !== '-' ? email.funcionario : '-';
            var setor = email.setor !== '-' ? `<span class="sector-display">${email.setor}</span>` : '<span class="sector-display sector-empty">Sem setor</span>';
            var emailRecuperacao = email.email_recuperacao !== '-' ? email.email_recuperacao : '-';
            var funcionarioTitle = email.funcionario !== '-' ? email.funcionario : 'Funcionário não definido';
            
            // Tratamento da senha
            var senha = email.senha ? '••••••••' : '-';
            var senhaTitle = email.senha ? email.senha : 'Sem senha';
            
            var row = `
                <tr class="table-row" data-email-id="${email.id}" data-status="${email.status_value}">
                    <td class="table-cell">${ramal}</td>
                    <td class="table-cell email-address" title="${funcionarioTitle}">${email.email}</td>
                    <td class="table-cell employee-name">${funcionario}</td>
                    <td class="table-cell sector-cell">${setor}</td>
                    <td class="table-cell password-cell" title="${senhaTitle}">${senha}</td>
                    <td class="table-cell">
                        <span class="status-badge status-${email.status_value}" title="Clique para alterar o status">
                            ${email.status}
                        </span>
                    </td>
                    <td class="table-cell">${emailRecuperacao}</td>
                </tr>
            `;
            
            tbody.append(row);
        });
    }
    
    // Função para mostrar erro
    function mostrarErro(mensagem) {
        console.error('🚨 Erro no controle de e-mails:', mensagem);
        $('#loading-indicator').hide();
        $('#table-container').hide();
        $('#error-message').text(mensagem);
        $('#error-container').show();
    }
    
    // Carregar dados ao inicializar a página
    carregarEmails();
    
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
    
    // Busca por ramal, e-mail ou nome do funcionário
    function performSearch() {
        var searchTerm = $('#search-emails').val().toLowerCase();
        $('#emails-table tbody tr').each(function() {
            var $row = $(this);
            
            // Verificar se é a linha de "empty state"
            if ($row.find('.empty-state').length > 0) {
                return; // Pular esta linha
            }
            
            var ramal = $row.find('td:nth-child(1)').text().toLowerCase(); // Coluna Ramal
            var email = $row.find('td:nth-child(2)').text().toLowerCase(); // Coluna E-mail
            var funcionario = $row.find('td:nth-child(3)').text().toLowerCase(); // Coluna Funcionário
            var setor = $row.find('td:nth-child(4)').text().toLowerCase(); // Coluna Setor
            
            if (ramal.includes(searchTerm) || email.includes(searchTerm) || funcionario.includes(searchTerm) || setor.includes(searchTerm)) {
                $row.show();
            } else {
                $row.hide();
            }
        });
    }
    
    // Executar busca em tempo real
    $('#search-emails').on('input keyup paste', performSearch);
    
    // Função para busca via servidor (opcional para grandes volumes de dados)
    function performServerSearch() {
        var searchTerm = $('#search-emails').val().trim();
        
        // Se o termo de busca estiver vazio, recarregar todos os dados
        if (searchTerm === '') {
            carregarEmails();
            return;
        }
        
        // Fazer busca no servidor
        $.ajax({
            url: '/ti/api/emails-data/',
            type: 'GET',
            data: {
                'search': searchTerm
            },
            success: function(response) {
                if (response.success) {
                    // A API retorna os dados em response.data.emails
                    const emails = response.data && response.data.emails ? response.data.emails : [];
                    popularTabela(emails);
                } else {
                    mostrarErro('Erro na busca: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                mostrarErro('Erro na busca: ' + error);
            }
        });
    }
    
    // Função para atualizar o status do e-mail
    function atualizarStatusEmail(emailId, novoStatus) {
        var csrftoken = getCsrfToken();
        $.ajax({
            url: '/ti/api/email/atualizar-status/',
            type: 'POST',
            data: {
                'email_id': emailId,
                'status': novoStatus,
                'csrfmiddlewaretoken': csrftoken
            },
            beforeSend: function(xhr, settings) {
                if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                    xhr.setRequestHeader("X-CSRFToken", csrftoken);
                }
            },
            success: function(response) {
                if (response.success) {
                    // Recarregar os dados da tabela para manter sincronização
                    carregarEmails();
                    
                    // Mostrar mensagem de sucesso
                    mostrarNotificacao(response.message, 'success');
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
    
    // Adicionar evento de clique no status
    $(document).on('click', '.status-badge', function() {
        var $row = $(this).closest('tr');
        var emailId = $row.data('email-id');
        var currentStatus = $row.data('status');
        
        // Mostrar menu de opções de status
        var statusOptions = {
            'ativo': 'Em uso',
            'funcionario_desligado': 'Func desligado',
            'sem_senha': 'Sem senha',
            'sem_recuperacao': 'Sem n° recup',
            'renovado': 'Renovado',
            'inativo': 'Sem uso'
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
            atualizarStatusEmail(emailId, novoStatus);
            $('.status-menu').remove();
        });
        
        // Fechar o menu ao clicar fora dele
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.status-menu').length && !$(e.target).closest('.status-badge').length) {
                $('.status-menu').remove();
            }
        });
    });
});