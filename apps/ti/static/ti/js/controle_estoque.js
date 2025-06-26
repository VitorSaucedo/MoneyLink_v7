/**
 * controle_estoque.js
 * Funcionalidades JavaScript para o Controle de Estoque - TI
 * Convertido para jQuery para padronização com o restante do projeto
 */

$(document).ready(function() {
    console.log('Controle de Estoque - TI carregado com sucesso');
    
    // Carregar dados iniciais
    carregarDadosEstoque();
    
    // Configurar os badges de lojas com loading state
    $('.loja-badge').on('click', function() {
        const $badge = $(this);
        const lojaId = $badge.data('loja-id');
        
        // Não fazer nada se o badge já está ativo
        if ($badge.hasClass('active')) {
            return;
        }
        
        // Mostrar loading state
        mostrarLoadingState();
        
        // Salvar o tamanho atual da tabela antes da transição
        salvarTamanhoTabela();
        
        // Adicionar efeito visual de clique
        $badge.addClass('clicked');
        
        // Pequeno delay para mostrar o loading antes de redirecionar
        setTimeout(() => {
            // Redirecionar para a mesma página com o parâmetro de loja
            const url = lojaId ? `${window.location.pathname}?loja=${lojaId}` : window.location.pathname;
            window.location.href = url;
        }, 200);
    });
    
    // Adicionar efeito de hover nos badges
    $('.loja-badge').on('mouseenter', function() {
        if (!$(this).hasClass('active')) {
            $(this).addClass('hover-effect');
        }
    }).on('mouseleave', function() {
        $(this).removeClass('hover-effect');
    });
    
    // Função para mostrar loading state durante transição
    function mostrarLoadingState() {
        const $cardEstoque = $('#card-estoque');
        const $tableContainer = $cardEstoque.find('.table-responsive');
        
        // Adicionar overlay de loading
        if (!$tableContainer.find('.loading-overlay').length) {
            const loadingHtml = `
                <div class="loading-overlay position-absolute w-100 h-100 d-flex align-items-center justify-content-center">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                        <p class="mb-0 text-muted">Atualizando dados da loja...</p>
                    </div>
                </div>
            `;
            $tableContainer.css('position', 'relative').append(loadingHtml);
        }
        
        // Adicionar classe de transição
        $cardEstoque.addClass('store-transition');
    }
    
    // Função para salvar o tamanho atual da tabela
    function salvarTamanhoTabela() {
        const $cardEstoque = $('#card-estoque');
        const currentWidth = $cardEstoque.width();
        const currentHeight = $cardEstoque.height();
        
        // Salvar no localStorage para manter consistência
        localStorage.setItem('ti_estoque_width', currentWidth);
        localStorage.setItem('ti_estoque_height', currentHeight);
    }
    
    // Função para restaurar o tamanho da tabela
    function restaurarTamanhoTabela() {
        const savedWidth = localStorage.getItem('ti_estoque_width');
        const savedHeight = localStorage.getItem('ti_estoque_height');
        
        if (savedWidth && savedHeight) {
            const $cardEstoque = $('#card-estoque');
            
            // Aplicar temporariamente o tamanho salvo para evitar "pulo"
            $cardEstoque.css({
                'min-width': Math.max(900, parseInt(savedWidth)) + 'px',
                'min-height': Math.max(400, parseInt(savedHeight)) + 'px'
            });
            
            // Remover as restrições após um tempo para permitir ajuste natural
            setTimeout(() => {
                $cardEstoque.css({
                    'min-height': '400px' // Manter apenas altura mínima
                });
            }, 1000);
        }
    }
    
    // Função para garantir tamanho mínimo consistente
    function garantirTamanhoConsistente() {
        const $cardEstoque = $('#card-estoque');
        const $tableResponsive = $cardEstoque.find('.table-responsive');
        const $table = $cardEstoque.find('.table');
        
        // Garantir largura mínima do card
        if ($cardEstoque.width() < 900) {
            $cardEstoque.css('min-width', '900px');
        }
        
        // Garantir altura mínima da área da tabela
        if ($tableResponsive.height() < 400) {
            $tableResponsive.css('min-height', '400px');
        }
        
        // Garantir largura mínima da tabela
        if ($table.width() < 800) {
            $table.css('min-width', '800px');
        }
    }
    
    // Corrigir a contagem total para não somar duplicado os periféricos associados a PAs
    // Movido para depois da definição da função
    
    // Função para alternar destaque nas linhas da tabela ao passar o mouse
    var configurarDestaqueTabelaEstoque = function() {
        $('#card-estoque table tbody tr').not('.table-success').each(function() {
            $(this).on('mouseenter', function() {
                // Verifica se o tema escuro está ativo
                if ($('html').attr('data-theme') === 'dark') {
                    $(this).css('backgroundColor', 'rgba(110, 66, 193, 0.2)');
                } else {
                    $(this).css('backgroundColor', 'rgba(112, 246, 17, 0.15)');
                }
            });
            
            $(this).on('mouseleave', function() {
                $(this).css('backgroundColor', '');
            });
        });
    }
    
    // Função para adicionar tooltips nas células da tabela
    var configurarTooltips = function() {
        $('#card-estoque table tbody tr:not(.table-success) td:not(:first-child):not(:last-child)').each(function() {
            const valor = parseInt($(this).text().trim(), 10);
            
            if (valor > 0) {
                // Encontra o tipo do periférico (primeira célula da linha)
                const tipoPerifetico = $(this).closest('tr').find('td:first-child').text().trim();
                
                // Encontra o local (cabeçalho da coluna)
                const indiceColuna = $(this).index();
                const local = $('#card-estoque table thead tr th').eq(indiceColuna).text().trim();
                
                // $(this).attr('title', `${valor} ${tipoPerifetico}(s) em ${local}`);
                // $(this).css('cursor', 'help');
            }
        });
    }

    // Função para adicionar classe de destaque para células sem estoque
    var destacarCelulasVazias = function() {
        $('#card-estoque table tbody tr:not(.table-success) td:not(:first-child):not(:last-child)').each(function() {
            const valor = parseInt($(this).text().trim(), 10);
            
            if (valor === 0) {
                $(this).addClass('text-muted');
            } else if (valor <= 1) {
                $(this).addClass('text-warning');
            }
        });
    }
    
    // Função para reagir a mudanças de tema
    var observarMudancaDeTema = function() {
        // Usa MutationObserver para detectar mudanças no tema
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'data-theme') {
                    // Reaplica as configurações quando o tema mudar
                    configurarDestaqueTabelaEstoque();
                    configurarTooltips();
                    destacarCelulasVazias();
                }
            });
        });
        
        // Observa mudanças no atributo data-theme do documento
        observer.observe($('html')[0], {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
    
    // Funções para manipulação do seletor de lojas
    var atualizarTabelaPorLoja = function(lojaId) {
        // Esta função é chamada quando o usuário seleciona uma loja
        // Nesta implementação, a atualização é feita via redirecionamento da página
        // com parâmetro de loja, por isso o código específico está no handler do evento change acima
        console.log(`Atualizando tabela para loja ID: ${lojaId}`);
    }

    // Função para corrigir a contagem total de periféricos no estoque
    var fixTotalInventoryCount = function() {
        // Seleciona a linha de total (última linha com classe table-success)
        const $totalRow = $('#card-estoque table tbody tr.table-success');
        if ($totalRow.length === 0) return;

        // Para cada célula da linha total (exceto a primeira que é o rótulo e a última que é o total)
        const $cells = $totalRow.find('td:not(:first-child)');
        const $lastCell = $cells.last(); // A última célula é o total global
        
        if ($lastCell.length === 0) return;
        
        // Recalcular o total correto somando apenas os periféricos (não somando computadores)
        let newTotal = 0;
        
        // Pegar apenas as linhas de periféricos (excluindo as linhas de computadores e a linha de total)
        $('#card-estoque table tbody tr:not(.table-success)').each(function() {
            // Verificar se a linha atual é de computadores (contém o texto "Computadores")
            var $firstCell = $(this).find('td:first-child');
            var isComputerRow = $firstCell.length > 0 && $firstCell.text().includes('Computadores');
            
            // Processar apenas se não for uma linha de computadores
            if (!isComputerRow) {
                // Pegar a célula de estoque (segunda célula)
                var $stockCell = $(this).find('td:nth-child(2)');
                if ($stockCell.length > 0) {
                    // Adicionar o valor do estoque ao total
                    var stockValue = parseInt($stockCell.text().trim(), 10) || 0;
                    newTotal += stockValue;
                }
            }
        });
        
        // Atualizar o total global
        $lastCell.text(newTotal);
    }
    
    // Inicializa as funcionalidades
    restaurarTamanhoTabela();
    garantirTamanhoConsistente();
    configurarDestaqueTabelaEstoque();
    configurarTooltips();
    destacarCelulasVazias();
    fixTotalInventoryCount();
    observarMudancaDeTema();
    
    // Garantir tamanho após carregamento completo
    $(window).on('load', function() {
        setTimeout(() => {
            garantirTamanhoConsistente();
        }, 500);
    });
    
    // Ajustar tamanho quando a janela for redimensionada
    $(window).on('resize', function() {
        garantirTamanhoConsistente();
    });
    
    // Função para carregar dados do estoque via AJAX
    function carregarDadosEstoque() {
        // Obter parâmetros da URL
        const urlParams = new URLSearchParams(window.location.search);
        const lojaId = urlParams.get('loja');
        
        // Preparar dados para a requisição
        const requestData = {};
        if (lojaId) {
            requestData.loja = lojaId;
        }
        
        $.ajax({
            url: '/ti/api/controle-estoque-data/',
            method: 'GET',
            data: requestData,
            success: function(response) {
                if (response.success) {
                    const data = response.data;
                    
                    // Renderizar cada seção com os dados recebidos
                    renderizarPerifericos(data);
                    renderizarComputadores(data);
                    renderizarMonitores(data);
                    renderizarResumo(data);
                    renderizarHistorico(data);
                    
                    // Carregar seletor de lojas
                    carregarSeletorLojas(data.lojas, data.loja_selecionada);
                } else {
                    console.error('Erro na API:', response.error);
                    mostrarErroGeral();
                }
            },
            error: function(xhr, status, error) {
                console.error('Erro ao carregar dados:', error);
                mostrarErroGeral();
            }
        });
    }
    
    // Função para renderizar periféricos
    function renderizarPerifericos(data) {
        const $container = $('#perifericos-card-body');
        
        if (data.tipos_perifericos && data.tipos_perifericos.length > 0) {
            const totalPerifericos = data.estatisticas?.perifericos?.total || 0;
            
            let html = `
                <div class="mb-3">
                    <div class="h5 fw-bold text-primary">Total de periféricos: ${totalPerifericos}</div>
                    <small class="text-muted">Disponíveis: ${data.estatisticas?.perifericos?.disponiveis || 0} | Em manutenção: ${data.estatisticas?.perifericos?.manutencao || 0}</small>
                </div>
                <div class="row g-2">
            `;
            
            data.tipos_perifericos.forEach(function(tipo) {
                const icone = obterIconePeriferico(tipo.nome);
                const quantidade = data.perifericos_totais_por_tipo[tipo.id] || 0;
                
                html += `
                    <div class="col-6">
                        <div class="p-2 bg-light rounded">
                            <div class="d-flex align-items-center justify-content-between">
                                <span class="small">
                                    <i class='${icone} me-1'></i>
                                    ${tipo.nome}
                                </span>
                                <span class="badge bg-primary rounded-pill">${quantidade}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            $container.html(html);
        } else {
            $container.html(`
                <div class="py-4">
                    <i class='bx bx-package display-4 text-muted mb-3'></i>
                    <p class="text-muted mb-3">Nenhum periférico cadastrado</p>
                    <a href="/ti/perifericos/cadastrar/" class="btn btn-outline-primary">
                        <i class='bx bx-plus-circle me-1'></i> Adicionar Periférico
                    </a>
                </div>
            `);
        }
    }
    
    // Função para renderizar computadores
    function renderizarComputadores(data) {
        const $container = $('#computadores-card-body');
        
        if (data.computadores_disponiveis_por_marca && data.computadores_disponiveis_por_marca.length > 0) {
            const totalComputadores = data.estatisticas?.computadores?.total || 0;
            
            let html = `
                <div class="mb-3">
                    <div class="h5 fw-bold text-success">Total de computadores: ${totalComputadores}</div>
                    <small class="text-muted">Disponíveis: ${data.estatisticas?.computadores?.disponiveis || 0} | Em uso: ${data.estatisticas?.computadores?.em_uso || 0} | Manutenção: ${data.estatisticas?.computadores?.manutencao || 0}</small>
                </div>
                <div class="row g-2">
            `;
            
            data.computadores_disponiveis_por_marca.forEach(function(item) {
                html += `
                    <div class="col-6">
                        <div class="p-2 bg-light rounded">
                            <div class="d-flex align-items-center justify-content-between">
                                <span class="small">
                                    <i class='bx bx-laptop me-1'></i>
                                    ${item.marca}
                                </span>
                                <span class="badge bg-success rounded-pill">${item.quantidade_disponivel}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            $container.html(html);
        } else {
            $container.html(`
                <div class="py-4">
                    <i class='bx bx-laptop display-4 text-muted mb-3'></i>
                    <p class="text-muted mb-3">Nenhum computador disponível</p>
                    <a href="/ti/computadores/cadastrar/" class="btn btn-outline-success">
                        <i class='bx bx-plus-circle me-1'></i> Adicionar Computador
                    </a>
                </div>
            `);
        }
    }
    
    // Função para renderizar monitores (placeholder - dados não disponíveis na API atual)
    function renderizarMonitores(data) {
        const $container = $('#monitores-card-body');
        
        // Como a API atual não fornece dados de monitores, vamos mostrar uma mensagem
        $container.html(`
            <div class="py-4">
                <i class='bx bx-desktop display-4 text-muted mb-3'></i>
                <p class="text-muted mb-3">Dados de monitores não disponíveis</p>
                <small class="text-muted">Funcionalidade em desenvolvimento</small>
            </div>
        `);
    }
    
    // Função para renderizar resumo geral
    function renderizarResumo(data) {
        const $container = $('#resumo-card-body');
        
        const totalPerifericos = data.estatisticas?.perifericos?.total || 0;
        const totalComputadores = data.estatisticas?.computadores?.total || 0;
        const perifericosDisponiveis = data.estatisticas?.perifericos?.disponiveis || 0;
        const computadoresDisponiveis = data.estatisticas?.computadores?.disponiveis || 0;
        
        let html = `
            <div class="mb-3">
                <div class="h5 fw-bold text-warning">Resumo Geral</div>
                <small class="text-muted">Visão geral do estoque</small>
            </div>
            <div class="row g-2">
                <div class="col-12">
                    <div class="p-2 bg-light rounded mb-2">
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="small">
                                <i class='bx bx-devices me-1'></i>
                                Total de Periféricos
                            </span>
                            <span class="badge bg-primary rounded-pill">${totalPerifericos}</span>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-2 bg-light rounded mb-2">
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="small">
                                <i class='bx bx-laptop me-1'></i>
                                Total de Computadores
                            </span>
                            <span class="badge bg-success rounded-pill">${totalComputadores}</span>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-2 bg-light rounded">
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="small">
                                <i class='bx bx-check-circle me-1'></i>
                                Itens Disponíveis
                            </span>
                            <span class="badge bg-info rounded-pill">${perifericosDisponiveis + computadoresDisponiveis}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $container.html(html);
    }
    
    // Função para renderizar histórico
    function renderizarHistorico(data) {
        const $container = $('#historico-card-body');
        
        if (data.historico && data.historico.length > 0) {
            let html = `
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-sm">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Ação</th>
                                <th>Item</th>
                                <th>PA</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.historico.forEach(function(evento) {
                const badgeClass = evento.acao === 'atribuicao' ? 'bg-success' : 'bg-danger';
                const icone = evento.acao === 'atribuicao' ? 'bx-plus-circle' : 'bx-minus-circle';
                
                html += `
                    <tr>
                        <td>${formatarData(evento.data)}</td>
                        <td>
                            <span class="badge bg-primary">
                                <i class='bx bx-devices me-1'></i>${evento.tipo}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${badgeClass}">
                                <i class='bx ${icone} me-1'></i>${evento.acao}
                            </span>
                        </td>
                        <td>${evento.item}</td>
                        <td>${evento.pa}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            $container.html(html);
        } else {
            $container.html(`
                <div class="py-4 text-center">
                    <i class='bx bx-history display-4 text-muted mb-3'></i>
                    <p class="text-muted mb-0">Nenhuma movimentação registrada</p>
                </div>
            `);
        }
    }
    
    // Função para mostrar erro geral
    function mostrarErroGeral() {
        const containers = [
            '#perifericos-card-body',
            '#computadores-card-body', 
            '#monitores-card-body',
            '#resumo-card-body',
            '#historico-card-body'
        ];
        
        containers.forEach(function(selector) {
            $(selector).html(`
                <div class="py-4 text-center">
                    <i class='bx bx-error-circle display-4 text-danger mb-3'></i>
                    <p class="text-danger mb-2">Erro ao carregar dados</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="carregarDadosEstoque()">
                        <i class='bx bx-refresh me-1'></i> Tentar novamente
                    </button>
                </div>
            `);
        });
    }
    
    // Função para atualizar o resumo geral
    function atualizarResumo() {
        // Esta função será chamada após carregar todos os dados
        const totalPerifericos = parseInt($('#perifericos-card-body .h5').text().match(/\d+/)?.[0] || 0);
        const totalComputadores = parseInt($('#computadores-card-body .h5').text().match(/\d+/)?.[0] || 0);
        const totalMonitores = parseInt($('#monitores-card-body .h5').text().match(/\d+/)?.[0] || 0);
        const totalGeral = totalPerifericos + totalComputadores + totalMonitores;
        
        const $container = $('#resumo-card-body');
        $container.html(`
            <div class="mb-3">
                <div class="h5 fw-bold text-warning">Total de itens no estoque: ${totalGeral}</div>
                <small class="text-muted">Disponíveis e em manutenção</small>
            </div>
            <div class="row g-2">
                <div class="col-12">
                    <div class="p-2 bg-light rounded">
                        <div class="d-flex align-items-center justify-content-start">
                            <span class="small">
                                <i class='bx bx-devices me-1'></i>
                                Periféricos: ${totalPerifericos}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-2 bg-light rounded">
                        <div class="d-flex align-items-center justify-content-start">
                            <span class="small">
                                <i class='bx bx-laptop me-1'></i>
                                Computadores: ${totalComputadores}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-2 bg-light rounded">
                        <div class="d-flex align-items-center justify-content-start">
                            <span class="small">
                                <i class='bx bx-desktop me-1'></i>
                                Monitores: ${totalMonitores}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
    
    // Funções auxiliares
    function obterIconePeriferico(nome) {
        const nomeUpper = nome.toUpperCase();
        if (nomeUpper === 'MOUSE') return 'bx bx-mouse';
        if (nomeUpper === 'TECLADO') return 'bx bxs-keyboard';
        if (nomeUpper === 'MONITOR') return 'bx bx-desktop';
        if (nomeUpper === 'MOUSEPAD') return 'bx bx-square';
        if (nomeUpper === 'FONE' || nomeUpper === 'HEADSET') return 'bx bx-headphone';
        return 'bx bx-devices';
    }
    
    function obterClasseBadge(tipoEvento, tipoItem) {
        if (tipoEvento === 'Adicionado em') {
            return tipoItem === 'computador' ? 'bg-info text-dark' : 'bg-success text-white';
        } else if (tipoEvento === 'Removido de') {
            return tipoItem === 'computador' ? 'bg-warning text-dark' : 'bg-danger text-white';
        }
        return 'bg-secondary text-white';
    }
    
    function formatarData(dataString) {
        if (!dataString) return '-';
        
        try {
            const data = new Date(dataString);
            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dataString;
        }
    }
    
    // Função para obter ícone do periférico baseado no nome
    function obterIconePeriferico(nomePeriferico) {
        const nome = nomePeriferico.toLowerCase();
        
        if (nome.includes('mouse')) return 'bx-mouse';
        if (nome.includes('teclado')) return 'bx-keyboard';
        if (nome.includes('headset') || nome.includes('fone')) return 'bx-headphone';
        if (nome.includes('webcam') || nome.includes('camera')) return 'bx-camera';
        if (nome.includes('cabo') || nome.includes('adaptador')) return 'bx-cable-car';
        if (nome.includes('hub') || nome.includes('switch')) return 'bx-network-chart';
        if (nome.includes('carregador')) return 'bx-battery-charging';
        if (nome.includes('suporte')) return 'bx-support';
        
        return 'bx-devices'; // ícone padrão
    }
    
    // Função para carregar seletor de lojas
    function carregarSeletorLojas(lojas, lojaSelecionada) {
        const $seletor = $('#seletor-loja');
        
        if (lojas && lojas.length > 0) {
            let options = '<option value="">Todas as lojas</option>';
            
            lojas.forEach(function(loja) {
                const selected = lojaSelecionada && parseInt(lojaSelecionada) === loja.id ? 'selected' : '';
                options += `<option value="${loja.id}" ${selected}>${loja.nome}</option>`;
            });
            
            $seletor.html(options);
            
            // Adicionar evento de mudança
            $seletor.off('change').on('change', function() {
                const lojaId = $(this).val();
                const url = lojaId ? `${window.location.pathname}?loja=${lojaId}` : window.location.pathname;
                
                // Mostrar loading
                mostrarLoadingState();
                
                // Redirecionar
                window.location.href = url;
            });
        } else {
            $seletor.html('<option value="">Nenhuma loja disponível</option>');
        }
    }
    
    function renderizarPaginacao(pagination) {
        // Implementar lógica de paginação se necessário
        return '';
    }
    
    // Função para mostrar estado de loading
    function mostrarLoadingState() {
        const loadingHtml = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2 mb-0">Carregando dados...</p>
            </div>
        `;
        
        $('#perifericos-card-body').html(loadingHtml);
        $('#computadores-card-body').html(loadingHtml);
        $('#monitores-card-body').html(loadingHtml);
        $('#resumo-card-body').html(loadingHtml);
        $('#historico-card-body').html(loadingHtml);
    }
    
    function mostrarErroCarregamento(selector, tipo) {
        $(selector).html(`
            <div class="py-4 text-center">
                <i class='bx bx-error-circle display-4 text-danger mb-3'></i>
                <p class="text-danger mb-2">Erro ao carregar ${tipo}</p>
                <button class="btn btn-outline-primary btn-sm" onclick="carregarDadosEstoque()">
                    <i class='bx bx-refresh me-1'></i> Tentar novamente
                </button>
            </div>
        `);
    }
    
    // Atualizar resumo após carregar todos os dados
    setTimeout(function() {
        atualizarResumo();
    }, 1000);
    
});