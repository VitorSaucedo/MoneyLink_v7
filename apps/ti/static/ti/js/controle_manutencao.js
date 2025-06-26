// Arquivo JS para a página de Controle de Manutenção - TI
// Implementação completa via JavaScript/jQuery sem dependência de Python no template

$(document).ready(function() {
    // Carregar dados ao inicializar a página
    carregarDadosManutencao();
    
    // Função para carregar dados de manutenção via AJAX
    function carregarDadosManutencao() {
        $.ajax({
            url: window.location.href, // Usar a mesma URL da página
            type: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest' // Identificar como requisição AJAX
            },
            success: function(data) {
                if (data.success) {
                    preencherResumo(data.contagem_por_tipo, data.total_itens_manutencao);
                    preencherTabela(data.itens_manutencao);
                    ocultarLoading();
                } else {
                    mostrarErro('Erro ao carregar dados de manutenção');
                }
            },
            error: function(xhr, status, error) {
                console.error('Erro na requisição AJAX:', error);
                mostrarErro('Erro ao carregar dados. Tente recarregar a página.');
            }
        });
    }
    
    // Função para preencher o resumo de contagem
    function preencherResumo(contagemPorTipo, totalItens) {
        $('#count-mouse').text(contagemPorTipo.Mouse || 0);
        $('#count-mousepad').text(contagemPorTipo.Mousepad || 0);
        $('#count-teclado').text(contagemPorTipo.Teclado || 0);
        $('#count-monitor').text(contagemPorTipo.Monitor || 0);
        $('#count-fone').text(contagemPorTipo.Fone || 0);
        $('#count-computador').text(contagemPorTipo.Computador || 0);
        $('#count-total').text(totalItens || 0);
        
        // Mostrar "Outros Periféricos" apenas se houver itens
        if (contagemPorTipo.Outros_Periféricos && contagemPorTipo.Outros_Periféricos > 0) {
            $('#count-outros').text(contagemPorTipo.Outros_Periféricos);
            $('#outros-perifericos-item').show();
        } else {
            $('#outros-perifericos-item').hide();
        }
        
        $('#integrated-summary-list').show();
    }
    
    // Função para preencher a tabela de itens
    function preencherTabela(itensManutencao) {
        var $tableBody = $('#table-body');
        $tableBody.empty();
        
        if (itensManutencao && itensManutencao.length > 0) {
            $.each(itensManutencao, function(index, item) {
                var row = criarLinhaTabela(item);
                $tableBody.append(row);
            });
            $('#table-container').show();
            $('#no-items-message').hide();
        } else {
            $('#table-container').hide();
            $('#no-items-message').show();
        }
        
        // Reativar eventos dos botões após criar a tabela
        ativarEventosBotoes();
    }
    
    // Função para criar uma linha da tabela
    function criarLinhaTabela(item) {
        var csrfToken = $('[name=csrfmiddlewaretoken]').val() || getCookie('csrftoken');
        
        return `
            <tr>
                <td>${item.nome_item || ''}</td>
                <td>${item.marca_modelo || ''}</td>
                <td>${item.sala_origem || 'N/A'}</td>
                <td>${item.ilha_origem || 'N/A'}</td>
                <td>${item.ultima_localizacao || 'N/A'}</td>
                <td>${item.observacoes || '-'}</td>
                <td>
                    <div class="acoes-container">
                        <form method="POST" action="${item.url_marcar_consertado}" style="display: inline;">
                            <input type="hidden" name="csrfmiddlewaretoken" value="${csrfToken}">
                            <button type="submit" class="btn-consertado">
                                <i class="fas fa-check-circle"></i> Marcar como Consertado
                            </button>
                        </form>
                        <form method="POST" action="${item.url_excluir}" style="display: inline;" class="form-excluir">
                            <input type="hidden" name="csrfmiddlewaretoken" value="${csrfToken}">
                            <button type="button" class="btn-excluir">
                                <i class="fas fa-trash"></i> Excluir Periférico
                            </button>
                        </form>
                    </div>
                </td>
            </tr>
        `;
    }
    
    // Função para ativar eventos dos botões
    function ativarEventosBotoes() {
        // Evento de clique para botões de excluir
        $('.btn-excluir').off('click').on('click', function() {
            var $form = $(this).closest('.form-excluir');
            var confirmacao = confirm('Tem certeza que deseja excluir este periférico permanentemente? Esta ação não pode ser desfeita.');
            
            if (confirmacao) {
                $form.submit();
            }
        });
        
        // Evento de submit para formulários de marcar como consertado
        $('.btn-consertado').closest('form').off('submit').on('submit', function(e) {
            e.preventDefault();
            var $form = $(this);
            var url = $form.attr('action');
            
            $.ajax({
                url: url,
                type: 'POST',
                data: $form.serialize(),
                success: function(response) {
                    if (response.success) {
                        // Recarregar dados após sucesso
                        carregarDadosManutencao();
                        mostrarMensagem('Item marcado como consertado com sucesso!', 'success');
                    } else {
                        mostrarMensagem(response.message || 'Erro ao marcar item como consertado', 'error');
                    }
                },
                error: function() {
                    mostrarMensagem('Erro ao processar solicitação', 'error');
                }
            });
        });
    }
    
    // Função para ocultar indicador de loading
    function ocultarLoading() {
        $('#loading-indicator').hide();
    }
    
    // Função para mostrar erro
    function mostrarErro(mensagem) {
        $('#loading-indicator').hide();
        $('#integrated-summary-list').hide();
        $('#table-container').hide();
        $('#no-items-message').html(`<p class="text-danger">${mensagem}</p>`).show();
    }
    
    // Função para mostrar mensagens de feedback
    function mostrarMensagem(mensagem, tipo) {
        var classe = tipo === 'success' ? 'alert-success' : 'alert-danger';
        var $alert = $(`<div class="alert ${classe} alert-dismissible fade show" role="alert">
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`);
        
        $('.container').prepend($alert);
        
        // Auto-remover após 5 segundos
        setTimeout(function() {
            $alert.fadeOut();
        }, 5000);
    }
    
    // Função para obter CSRF token dos cookies
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    
    // Função para recarregar dados (pode ser chamada externamente)
    window.recarregarDadosManutencao = function() {
        $('#loading-indicator').show();
        $('#integrated-summary-list').hide();
        $('#table-container').hide();
        $('#no-items-message').hide();
        carregarDadosManutencao();
    };
});