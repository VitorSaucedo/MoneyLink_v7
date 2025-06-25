// Variáveis globais
let tabelaAcoes, tabelaMinhasAcoes, tabelaAcoesAdvogado;

// Função para inicializar as máscaras
function inicializarMascaras() {
    $('#filtroCPF, #filtroCPFMinhas, #filtroCPFAdvogado').mask('000.000.000-00');
    $('#valorSentenca').mask('#.##0,00', {reverse: true});
}

// Função para formatar CPF
function formatarCPF(cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Função para criar botões de ação
function criarBotoesAcao(acao, tipo) {
    let botoes = '';
    
    if (tipo === 'aberto') {
        botoes = `
            <div class="btn-group">
                <button type="button" class="btn btn-warning btn-sm" onclick="atualizarStatus(${acao.id})" data-tooltip="Alterar Status">
                    <i class='bx bx-refresh'></i>
                </button>
                <button type="button" class="btn btn-info btn-sm" onclick="visualizarArquivos(${acao.id})" data-tooltip="Visualizar Arquivos">
                    <i class='bx bx-folder-open'></i>
                </button>
                <button type="button" class="btn btn-success btn-sm" onclick="assumirAcao(${acao.id})" data-tooltip="Tomar Ação">
                    <i class='bx bx-user-plus'></i>
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="recusarAcao(${acao.id})" data-tooltip="Recusar Ação">
                    <i class='bx bx-x-circle'></i>
                </button>
            </div>
        `;
    } else if (tipo === 'minhas') {
        // Botões para "Minhas Ações"
        let btnAtualizarSentencaHtml = '';
        
        const sentencaFavoravel = acao.raw_sentenca === 'FAVORAVEL';
        const recursoPrimeiroGrauNenhumOuVazio = !acao.raw_recurso_primeiro_grau || acao.raw_recurso_primeiro_grau === 'NENHUM';
        const recursoSegundoGrauPreenchido = acao.raw_recurso_segundo_grau && acao.raw_recurso_segundo_grau !== 'NENHUM';

        let esconderBotao = false;

        // Condição 1 para esconder: Sentença favorável E recurso de 1º grau é Nenhum/Vazio.
        if (sentencaFavoravel && recursoPrimeiroGrauNenhumOuVazio) {
            esconderBotao = true;
        } 
        // Condição 2 para esconder: Recurso de 2º grau está preenchido.
        // Esta condição é verificada independentemente da primeira, usando OU lógico.
        if (recursoSegundoGrauPreenchido) {
            esconderBotao = true;
        }

        if (!esconderBotao) {
            btnAtualizarSentencaHtml = `
                <button type="button" class="btn btn-success btn-sm" onclick="atualizarSentenca(${acao.id})" data-tooltip="Atualizar Sentença">
                    <i class='bx bx-check-circle'></i>
                </button>`;
        }

        botoes = `
            <div class="btn-group">
                <button type="button" class="btn btn-primary btn-sm" onclick="visualizarDadosAcao(${acao.id})" data-tooltip="Ver Dados">
                    <i class='bx bx-detail'></i>
                </button>
                <button type="button" class="btn btn-info btn-sm" onclick="enviarDocumentos(${acao.id})" data-tooltip="Adicionar Documento">
                    <i class='bx bx-upload'></i>
                </button>
                <button type="button" class="btn btn-warning btn-sm" onclick="atualizarStatus(${acao.id}, 'minhas')" data-tooltip="Atualizar Status">
                    <i class='bx bx-refresh'></i>
                </button>
                ${btnAtualizarSentencaHtml}
                ${acao.documentos_acao && acao.documentos_acao.length > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="visualizarArquivos(${acao.id})" data-tooltip="Ver Arquivos Anexados">
                    <i class='bx bx-folder-open'></i>
                </button>
                ` : ''}
            </div>
        `;
    }
    
    return botoes;
}

// Função para carregar ações em aberto
function carregarAcoesAberto() {
    $.get('/juridico/api/tabelaacoes/', function(response) {
        if (response.status === 'success') {
            const tbody = $('#tabelaAcoes tbody');
            tbody.empty();
            
            // Para cada ação, buscar detalhes completos incluindo documentos
            const promises = response.data.map(acao => {
                return $.get(`/juridico/api_get_acao/${acao.id}/`).then(detalhes => {
                    if (detalhes.success) {
                        acao.documentos_acao = detalhes.data.documentos_acao || [];
                    }
                    return acao;
                }).catch(() => {
                    acao.documentos_acao = [];
                    return acao;
                });
            });
            
            Promise.all(promises).then(acoesCompletas => {
                acoesCompletas.forEach(acao => {
                    if (!acao.advogado_responsavel) {
                        tbody.append(`
                            <tr>
                                <td>${acao.cliente_nome}</td>
                                <td>${formatarCPF(acao.cliente_cpf)}</td>
                                <td>${acao.tipo_acao}</td>
                                <td>${acao.data_criacao}</td>
                                <td>${acao.status}</td>
                                <td>${acao.sentenca || 'N/A'}</td>
                                <td>${acao.loja || 'N/A'}</td>
                                <td class="text-center">${criarBotoesAcao(acao, 'aberto')}</td>
                            </tr>
                        `);
                    }
                });
                
                $('#nenhumResultadoAcoes').toggle(tbody.children().length === 0);
            });
        }
    });
}

// Função para carregar minhas ações
function carregarMinhasAcoes() {
    $.get('/juridico/api/minhas-acoes/', function(response) {
        if (response.status === 'success') {
            const tbody = $('#tabelaMinhasAcoes tbody');
            tbody.empty();
            
            const promises = response.data.map(acaoDaLista => { // acaoDaLista has display values from the list API
                return $.get(`/juridico/api_get_acao/${acaoDaLista.id}/`).then(detalhes => {
                    if (detalhes.success) {
                        // Anexa os documentos e os valores raw necessários para a lógica dos botões
                        acaoDaLista.documentos_acao = detalhes.data.documentos_acao || [];
                        acaoDaLista.raw_sentenca = detalhes.data.sentenca; // Valor raw da sentença
                        acaoDaLista.raw_recurso_primeiro_grau = detalhes.data.recurso_primeiro_grau; // Valor raw do recurso
                        acaoDaLista.raw_recurso_segundo_grau = detalhes.data.recurso_segundo_grau; // CORREÇÃO: Adicionado
                        // Adicionar outros campos raw de `detalhes.data` se necessário para outras lógicas ou display
                        // Ex: acaoDaLista.raw_status_emcaminhamento = detalhes.data.status_emcaminhamento;
                    } else {
                        // Se a chamada detalhada falhar, garante que os campos raw sejam undefined
                        // para que a lógica em criarBotoesAcao não falhe por campos inexistentes.
                        acaoDaLista.documentos_acao = acaoDaLista.documentos_acao || []; // Mantém se já existia
                        acaoDaLista.raw_sentenca = undefined;
                        acaoDaLista.raw_recurso_primeiro_grau = undefined;
                        acaoDaLista.raw_recurso_segundo_grau = undefined; // CORREÇÃO: Adicionado
                        // acaoDaLista.raw_status_emcaminhamento = undefined;
                    }
                    return acaoDaLista; // Retorna acaoDaLista, agora enriquecida ou com fallbacks
                }).catch(() => {
                    // Em caso de erro na chamada AJAX para detalhes
                    acaoDaLista.documentos_acao = acaoDaLista.documentos_acao || [];
                    acaoDaLista.raw_sentenca = undefined;
                    acaoDaLista.raw_recurso_primeiro_grau = undefined;
                    acaoDaLista.raw_recurso_segundo_grau = undefined; // CORREÇÃO: Adicionado
                    // acaoDaLista.raw_status_emcaminhamento = undefined;
                    return acaoDaLista;
                });
            });
            
            Promise.all(promises).then(acoesCompletas => {
                acoesCompletas.forEach(acao => {
                    // Os campos como acao.cliente_nome, acao.tipo_acao, acao.status, acao.sentenca
                    // aqui são os que vieram da lista inicial (api/minhas-acoes) e são usados para display.
                    // A lógica em criarBotoesAcao usará os campos raw_ que adicionamos.
                    tbody.append(`
                        <tr>
                            <td>${acao.cliente_nome}</td>
                            <td>${formatarCPF(acao.cliente_cpf)}</td>
                            <td>${acao.tipo_acao}</td>
                            <td>${acao.data_criacao}</td>
                            <td>${acao.status}</td>
                            <td>${acao.sentenca || 'N/A'}</td>
                            <td>${acao.loja || 'N/A'}</td>
                            <td class="text-center">${criarBotoesAcao(acao, 'minhas')}</td>
                        </tr>
                    `);
                });
                
                $('#nenhumResultadoMinhasAcoes').toggle(tbody.children().length === 0);
            });
        }
    });
}

// Função para carregar ações com advogado
function carregarAcoesAdvogado() {
    $.get('/juridico/api/acoes-com-advogado/', function(response) {
        if (response.status === 'success') {
            const tbody = $('#tabelaAcoesAdvogado tbody');
            tbody.empty();
            
            response.data.forEach(acao => {
                tbody.append(`
                    <tr>
                        <td>${acao.cliente_nome}</td>
                        <td>${formatarCPF(acao.cliente_cpf)}</td>
                        <td>${acao.tipo_acao}</td>
                        <td>${acao.data_criacao}</td>
                        <td>${acao.status}</td>
                        <td>${acao.sentenca || 'N/A'}</td>
                        <td>${acao.loja || 'N/A'}</td>
                        <td>${acao.advogado}</td>
                    </tr>
                `);
            });
            
            $('#nenhumResultadoAcoesAdvogado').toggle(tbody.children().length === 0);
        }
    });
}

// Funções para manipulação dos modais
function conferirArquivos(acaoId) {
    $('#acaoIdConferir').val(acaoId);
    $.get(`/juridico/api_get_acao/${acaoId}/`, function(response) {
        if (response.success) {
            const arquivos = response.data.documentos_acao;
            const tbody = $('#tabelaArquivosConferir');
            tbody.empty();
            
            arquivos.forEach(arquivo => {
                tbody.append(`
                    <tr>
                        <td>${arquivo.titulo}</td>
                        <td>${new Date(arquivo.data_import).toLocaleDateString()}</td>
                        <td class="text-center">
                            <a href="${arquivo.url}" target="_blank" class="btn btn-info btn-sm">
                                <i class='bx bx-show'></i>
                            </a>
                        </td>
                    </tr>
                `);
            });
            
            $('#modalConferirArquivos').modal('show');
        }
    });
}

// Função para visualizar arquivos de uma ação
function visualizarArquivos(acaoId) {
    $.get(`/juridico/api_get_acao/${acaoId}/`, function(response) {
        if (response.success) {
            const arquivos = response.data.documentos_acao;
            const tbody = $('#tabelaArquivos');
            const nenhumArquivo = $('#nenhumArquivo');
            
            tbody.empty();
            
            if (arquivos && arquivos.length > 0) {
                nenhumArquivo.hide();
                arquivos.forEach(arquivo => {
                    tbody.append(`
                        <tr>
                            <td>${arquivo.titulo}</td>
                            <td>${new Date(arquivo.data_import).toLocaleDateString()}</td>
                            <td class="text-center">
                                <button class="btn btn-info btn-sm me-1" onclick="abrirArquivoPelaApi(${arquivo.id})" data-tooltip="Visualizar">
                                    <i class='bx bx-show'></i>
                                </button>
                                <button class="btn btn-primary btn-sm me-1" onclick="baixarArquivoPelaApi(${arquivo.id})" data-tooltip="Baixar">
                                    <i class='bx bx-download'></i>
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="excluirArquivo(${arquivo.id})" data-tooltip="Excluir">
                                    <i class='bx bx-trash'></i>
                                </button>
                            </td>
                        </tr>
                    `);
                });
            } else {
                nenhumArquivo.show();
            }
            
            $('#modalVerArquivos').modal('show');
        } else {
            mostrarToast('error', 'Erro ao carregar arquivos');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao carregar arquivos. Tente novamente.');
    });
}

// Função para abrir um arquivo específico via API
function abrirArquivoPelaApi(arquivoId) {
    $.get(`/juridico/api/visualizar-arquivo/${arquivoId}/`, function(response) {
        if (response.status === 'success' && response.data.url) {
            window.open(response.data.url, '_blank');
        } else {
            mostrarToast('error', response.message || 'URL do arquivo não disponível ou erro ao buscar.');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao contatar a API para visualizar o arquivo.');
    });
}

// Função para baixar um arquivo via API
function baixarArquivoPelaApi(arquivoId) {
    $.get(`/juridico/api/visualizar-arquivo/${arquivoId}/`, function(response) {
        if (response.status === 'success' && response.data.url) {
            const link = document.createElement('a');
            link.href = response.data.url;
            link.download = response.data.titulo || response.data.url.split('/').pop(); // Usa o título ou extrai nome da URL
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            mostrarToast('error', response.message || 'URL do arquivo não disponível ou erro ao buscar para download.');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao contatar a API para baixar o arquivo.');
    });
}

// Função para excluir um arquivo
function excluirArquivo(arquivoId) {
    if (confirm('Tem certeza que deseja excluir este arquivo?')) {
        $.ajax({
            url: `/juridico/api/acoes/excluir-documento/${arquivoId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                if (response.status === 'success') {
                    mostrarToast('success', 'Arquivo excluído com sucesso');
                    // Atualizar a lista de arquivos
                    const acaoId = $('#acaoIdEnviarArquivos').val() || $('#acaoIdAdicionarDocumento').val();
                    visualizarArquivos(acaoId);
                } else {
                    mostrarToast('error', response.message || 'Erro ao excluir arquivo');
                }
            },
            error: function(xhr, status, error) {
                mostrarToast('error', 'Erro ao excluir arquivo: ' + error);
            }
        });
    }
}

// Função para obter o CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function assumirAcao(acaoId) {
    $('#acaoIdAssumir').val(acaoId);
    $('#modalAssumirAcao').modal('show');
}

function recusarAcao(acaoId) {
    $('#acaoIdRecusar').val(acaoId);
    $('#modalRecusarAcao').modal('show');
}

function atualizarStatus(acaoId, contexto = 'aberto') {
    $('#acaoIdAtualizarStatus').val(acaoId);
    
    // Limpar formulário e redefinir campos condicionais
    $('#formAtualizarStatus')[0].reset();
    $('#protocoloGroup').hide();
    $('#motivoIncompletoGroup').hide();

    const statusSelect = $('#status');
    statusSelect.empty(); // Remove todas as opções existentes
    statusSelect.append($('<option>', { value: '', text: 'Selecione o status...' }));

    if (contexto === 'minhas') {
        // Opções de status para "Minhas Ações"
        statusSelect.append($('<option>', { value: 'EM_DESPACHO', text: 'Em Despacho' }));
        statusSelect.append($('<option>', { value: 'PROTOCOLADO', text: 'Protocolado' }));
        // Adicionar 'FINALIZADO' se fizer sentido após sentença
        // statusSelect.append($('<option>', { value: 'FINALIZADO', text: 'Finalizado' }));

    } else { // Contexto 'aberto' ou padrão
        statusSelect.append($('<option>', { value: 'EM_ESPERA', text: 'Em Espera' }));
        statusSelect.append($('<option>', { value: 'INCOMPLETO', text: 'Incompleto' }));
        // Não incluir EM_DESPACHO e PROTOCOLADO aqui, pois são para advogados
    }
    
    $('#modalAtualizarStatus').modal('show');
}

function atualizarSentenca(acaoId) {
    $('#acaoIdAtualizarSentenca').val(acaoId); // Set the hidden ID field

    // Fetch current action data to pre-fill the modal
    $.get(`/juridico/api_get_acao/${acaoId}/`, function(response) {
        if (response.success) {
            const acao = response.data;

            // Reset the form first to clear previous states
            $('#formAtualizarSentenca')[0].reset();
            // Important: Re-set the acao_id in the hidden input as form.reset() might clear it
            $('#acaoIdAtualizarSentenca').val(acaoId);

            // Pre-fill common fields
            $('#tipoSentenca').val(acao.sentenca || ''); // existing sentenca value or empty

            let valorSentencaModal = '';
            if (acao.valor_sentenca) { 
                valorSentencaModal = acao.valor_sentenca.replace('.', ',');
            }
            $('#valorSentenca').val(valorSentencaModal);
            $('#dataSentenca').val(acao.data_sentenca || '');
            $('#recursoPrimeiroGrau').val(acao.recurso_primeiro_grau || 'NENHUM');
            $('#dataRecursoPrimeiroGrau').val(acao.data_recurso_primeiro_grau || '');
            $('#resultadoRecursoPrimeiroGrau').val(acao.resultado_recurso_primeiro_grau || '');
            $('#recursoSegundoGrau').val(acao.recurso_segundo_grau || 'NENHUM');
            $('#dataRecursoSegundoGrau').val(acao.data_recurso_segundo_grau || '');
            $('#resultadoRecursoSegundoGrau').val(acao.resultado_recurso_segundo_grau || '');

            // Definir Grau da Sentença (readonly) com base na existência de recurso de primeiro grau
            const grauSentencaInput = $('#grauSentenca');
            if (acao.recurso_primeiro_grau && acao.recurso_primeiro_grau !== 'NENHUM') {
                grauSentencaInput.val('SEGUNDO_GRAU');
            } else {
                grauSentencaInput.val('PRIMEIRO_GRAU');
            }
            
            controlarCamposSentenca(); 
            $('#modalAtualizarSentenca').modal('show');

        } else {
            mostrarToast('error', response.message || 'Erro ao carregar dados da ação para atualizar sentença.');
            $('#formAtualizarSentenca')[0].reset();
            $('#acaoIdAtualizarSentenca').val(acaoId);
            $('#grauSentenca').val('PRIMEIRO_GRAU'); 
            controlarCamposSentenca();
            $('#modalAtualizarSentenca').modal('show');
        }
    }).fail(function() {
        mostrarToast('error', 'Falha ao buscar dados da ação. Tente novamente.');
        $('#formAtualizarSentenca')[0].reset();
        $('#acaoIdAtualizarSentenca').val(acaoId);
        $('#grauSentenca').val('PRIMEIRO_GRAU'); 
        controlarCamposSentenca();
        $('#modalAtualizarSentenca').modal('show');
    });
}

// Nova função para controlar campos da sentença com lógica detalhada
function controlarCamposSentenca() {
    const tipoSentenca = $('#tipoSentenca').val();
    const grauSentenca = $('#grauSentenca').val(); // Este é readonly, definido em atualizarSentenca
    const recursoPrimeiroGrau = $('#recursoPrimeiroGrau').val();
    const resultadoRecursoPrimeiroGrau = $('#resultadoRecursoPrimeiroGrau').val();
    const recursoSegundoGrau = $('#recursoSegundoGrau').val();
    // const resultadoRecursoSegundoGrau = $('#resultadoRecursoSegundoGrau').val(); // Não usado diretamente na lógica de visibilidade aqui

    // Ocultar todos os grupos condicionais primeiro
    $('#dataSentencaGroup, #valorSentencaGroup, #recursoPrimeiroGrauBlock, #recursoSegundoGrauBlock').hide();
    $('#dataRecursoPrimeiroGrauGroup, #resultadoRecursoPrimeiroGrauGroup').hide();
    $('#dataRecursoSegundoGrauGroup, #resultadoRecursoSegundoGrauGroup').hide();

    // Desabilitar campos que podem ser controlados. 
    // Limpar apenas inputs de texto/data que são editáveis em algum ponto do fluxo atual.
    $('#valorSentenca').prop('disabled', true).val(''); // Valor sempre resetado e reavaliado
    
    // Datas de recurso e sentença: desabilitar. Serão re-habilitadas e preenchidas conforme a lógica.
    // Seus valores (preenchidos por atualizarSentenca) não são limpos aqui, para preservar dados históricos se forem exibidos desabilitados.
    $('#dataSentenca').prop('disabled', true);
    $('#dataRecursoPrimeiroGrau').prop('disabled', true);
    $('#dataRecursoSegundoGrau').prop('disabled', true);
    
    // Para selects, apenas desabilitar inicialmente. Seus valores serão gerenciados pela lógica abaixo ou mantidos se já selecionados.
    $('#resultadoRecursoPrimeiroGrau, #resultadoRecursoSegundoGrau, #recursoPrimeiroGrau, #recursoSegundoGrau').prop('disabled', true);

    if (!tipoSentenca) {
        // Se não há tipo de sentença, garantir que selects de resultado sejam resetados se estavam habilitados
        $('#resultadoRecursoPrimeiroGrau').val('');
        $('#resultadoRecursoSegundoGrau').val('');
        return;
    }

    if (tipoSentenca === 'FAVORAVEL') {
        if (grauSentenca === 'PRIMEIRO_GRAU') {
            $('#dataSentencaGroup').show();
            $('#dataSentenca').prop('disabled', false);
            $('#recursoPrimeiroGrauBlock').show();
            $('#recursoPrimeiroGrau').prop('disabled', false);

            if (recursoPrimeiroGrau !== 'NENHUM') {
                $('#dataRecursoPrimeiroGrauGroup').show();
                $('#dataRecursoPrimeiroGrau').prop('disabled', false);
                $('#resultadoRecursoPrimeiroGrauGroup').show();
                $('#resultadoRecursoPrimeiroGrau').prop('disabled', false);
            } else { // Recurso de 1º Grau é NENHUM
                $('#valorSentencaGroup').show();
                $('#valorSentenca').prop('disabled', false);
                // Resetar resultado do 1º grau se o recurso for Nenhum
                $('#resultadoRecursoPrimeiroGrau').val('').prop('disabled', true);
            }
        } else if (grauSentenca === 'SEGUNDO_GRAU') {
            // Já passou do 1º grau, então mostramos resultado do 1º e opções para o 2º
            $('#recursoPrimeiroGrauBlock').show(); // Mostrar bloco para ver/confirmar resultado do 1º
            $('#recursoPrimeiroGrau').prop('disabled', true); // Não deve ser alterado aqui
            $('#dataRecursoPrimeiroGrauGroup').show();
            $('#dataRecursoPrimeiroGrau').prop('disabled', true); // Não deve ser alterado aqui

            $('#resultadoRecursoPrimeiroGrauGroup').show();
            $('#resultadoRecursoPrimeiroGrau').prop('disabled', false); // Pode editar resultado do 1º grau
            
            $('#recursoSegundoGrauBlock').show();
            $('#recursoSegundoGrau').prop('disabled', false);

            if (recursoSegundoGrau !== 'NENHUM') {
                $('#dataRecursoSegundoGrauGroup').show();
                $('#dataRecursoSegundoGrau').prop('disabled', false);
                $('#resultadoRecursoSegundoGrauGroup').show();
                $('#resultadoRecursoSegundoGrau').prop('disabled', false);
            } else { // Recurso de 2º Grau é NENHUM
                // Se o resultado do 1º grau foi favorável E não há recurso de 2º grau
                if (resultadoRecursoPrimeiroGrau === 'FAVORAVEL') {
                    $('#valorSentencaGroup').show();
                    $('#valorSentenca').prop('disabled', false);
                }
                 // Resetar resultado do 2º grau se o recurso for Nenhum
                $('#resultadoRecursoSegundoGrau').val('').prop('disabled', true);
            }
        }
    } else if (tipoSentenca === 'NAO_FAVORAVEL' || tipoSentenca === 'PENDENTE') {
        // Para Não Favorável ou Pendente, nenhum campo adicional é mostrado.
        // Resetar valores dos campos de recurso e resultado, pois não se aplicam.
        $('#recursoPrimeiroGrau').val('NENHUM');
        $('#resultadoRecursoPrimeiroGrau').val('');
        $('#dataRecursoPrimeiroGrau').val('');
        $('#recursoSegundoGrau').val('NENHUM');
        $('#resultadoRecursoSegundoGrau').val('');
        $('#dataRecursoSegundoGrau').val('');
        $('#valorSentenca').val('');
    }
}

// Função global para abrir o modal de adicionar documento
function enviarDocumentos(acaoId) {
    $('#acaoIdAdicionarDocumento').val(acaoId);
    $('#formAdicionarDocumento')[0].reset();
    $('#modalAdicionarDocumento').modal('show');
}

// Função para visualizar dados detalhados da ação
function visualizarDadosAcao(acaoId) {
    // Mostrar indicador de carregamento
    document.getElementById('infoAcaoConteudo').innerHTML = `
        <div class="text-center p-5">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
            <p class="mt-3">Carregando informações da ação...</p>
        </div>
    `;
    
    // Abrir o modal enquanto carrega
    $('#modalVerDadosAcao').modal('show');
    
    // Buscar informações da ação
    $.get(`/juridico/api_get_acao/${acaoId}/`, function(response) {
        if (response.success) {
            const acao = response.data;
            
            // Atualizar título do modal
            document.getElementById('modalVerDadosAcaoLabel').innerHTML = `
                <i class='bx bx-info-circle me-2'></i>Detalhes da Ação - ${acao.nome_cliente}
            `;
            
            // Construir HTML para as informações do cliente
            const clienteHTML = `
                <div class="info-section mb-4">
                    <h6 class="info-section-title"><i class='bx bx-user me-2'></i>Informações do Cliente</h6>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <strong>Nome:</strong> ${acao.nome_cliente || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>CPF:</strong> ${acao.cpf_cliente ? formatarCPF(acao.cpf_cliente) : 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Contato:</strong> ${acao.contato_cliente || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Senha INSS:</strong> ${acao.senha_inss || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
            
            // Construir HTML para as informações da ação
            const acaoHTML = `
                <div class="info-section mb-4">
                    <h6 class="info-section-title"><i class='bx bx-file me-2'></i>Informações da Ação</h6>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <strong>Tipo de Ação:</strong> ${acao.tipo_acao || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Status:</strong> 
                            <span class="badge bg-${getStatusColor(acao.status_emcaminhamento)}">
                                ${acao.status_emcaminhamento || 'N/A'}
                            </span>
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Data de Criação:</strong> ${acao.data_criacao || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Última Atualização:</strong> ${acao.data_atualizacao || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Número do Protocolo:</strong> ${acao.numero_protocolo || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Vendedor Responsável:</strong> ${acao.responsavel_nome || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Loja:</strong> ${acao.loja || 'N/A'}
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>Advogado Responsável:</strong> ${acao.advogado_nome || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
            
            // Construir HTML para as informações de sentença, se disponíveis
            let sentencaHTML = '';
            if (acao.sentenca) {
                sentencaHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-gavel me-2'></i>Informações da Sentença</h6>
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <strong>Sentença:</strong> ${acao.sentenca || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Grau da Sentença:</strong> ${acao.grau_sentenca || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Valor da Sentença:</strong> ${acao.valor_sentenca || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Data da Sentença:</strong> ${acao.data_sentenca || 'N/A'}
                            </div>
                            ${acao.grau_sentenca === 'PRIMEIRO_GRAU' && acao.recurso_primeiro_grau ? `
                            <div class="col-md-6 mb-2">
                                <strong>Recurso 1º Grau:</strong> ${acao.recurso_primeiro_grau_display || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Data do Recurso 1º Grau:</strong> ${acao.data_recurso_primeiro_grau || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Resultado do Recurso 1º Grau:</strong> ${acao.resultado_recurso_primeiro_grau || 'N/A'}
                            </div>
                            ` : ''}
                            ${acao.grau_sentenca === 'SEGUNDO_GRAU' && acao.recurso_segundo_grau ? `
                            <div class="col-md-6 mb-2">
                                <strong>Recurso 2º Grau:</strong> ${acao.recurso_segundo_grau_display || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Data do Recurso 2º Grau:</strong> ${acao.data_recurso_segundo_grau || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Resultado do Recurso 2º Grau:</strong> ${acao.resultado_recurso_segundo_grau || 'N/A'}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Construir HTML para os pagamentos, se disponíveis
            let pagamentoHTML = '';
            if (acao.pagamento) {
                pagamentoHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-money me-2'></i>Informações de Pagamento</h6>
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <strong>Tipo de Pagamento:</strong> ${acao.pagamento.tipo_pagamento || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Valor Total:</strong> ${acao.pagamento.valor_total || 'N/A'}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Status:</strong> ${acao.pagamento.status || 'N/A'}
                            </div>
                            ${acao.pagamento.valor_entrada ? `
                            <div class="col-md-6 mb-2">
                                <strong>Valor de Entrada:</strong> ${acao.pagamento.valor_entrada}
                            </div>
                            ` : ''}
                            ${acao.pagamento.parcelas_totais > 0 ? `
                            <div class="col-md-4 mb-2">
                                <strong>Parcelas Totais:</strong> ${acao.pagamento.parcelas_totais}
                            </div>
                            <div class="col-md-4 mb-2">
                                <strong>Parcelas Pagas:</strong> ${acao.pagamento.parcelas_pagas}
                            </div>
                            <div class="col-md-4 mb-2">
                                <strong>Parcelas Restantes:</strong> ${acao.pagamento.parcelas_restantes}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Separar arquivos e documentos
            const arquivos = acao.documentos_acao ? acao.documentos_acao.filter(item => item.tipo === 'arquivo') : [];
            const documentos = acao.documentos_acao ? acao.documentos_acao.filter(item => item.tipo === 'documento') : [];
            
            // Construir HTML para os arquivos
            let arquivosHTML = '';
            if (arquivos.length > 0) {
                let arquivosRows = '';
                arquivos.forEach(arquivo => {
                    arquivosRows += `
                        <tr>
                            <td>${arquivo.titulo}</td>
                            <td>${new Date(arquivo.data_import).toLocaleDateString()}</td>
                            <td class="text-center">
                                <button class="btn btn-info btn-sm" onclick="abrirArquivoPelaApi(${arquivo.id}, '${arquivo.tipo}')" data-tooltip="Visualizar Arquivo">
                                    <i class='bx bx-show'></i>
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="baixarArquivoPelaApi(${arquivo.id}, '${arquivo.tipo}')" data-tooltip="Baixar Arquivo">
                                    <i class='bx bx-download'></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                arquivosHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-file-blank me-2'></i>Arquivos</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th>Título</th>
                                        <th>Data de Upload</th>
                                        <th class="text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${arquivosRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                arquivosHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-file-blank me-2'></i>Arquivos</h6>
                        <div class="alert alert-info text-center">
                            <i class='bx bx-info-circle me-2'></i>Nenhum arquivo encontrado para esta ação.
                        </div>
                    </div>
                `;
            }
            
            // Construir HTML para os documentos
            let documentosHTML = '';
            if (documentos.length > 0) {
                let documentosRows = '';
                documentos.forEach(documento => {
                    documentosRows += `
                        <tr>
                            <td>${documento.titulo}</td>
                            <td>${new Date(documento.data_import).toLocaleDateString()}</td>
                            <td class="text-center">
                                <button class="btn btn-info btn-sm" onclick="abrirArquivoPelaApi(${documento.id}, '${documento.tipo}')" data-tooltip="Visualizar Documento">
                                    <i class='bx bx-show'></i>
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="baixarArquivoPelaApi(${documento.id}, '${documento.tipo}')" data-tooltip="Baixar Documento">
                                    <i class='bx bx-download'></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                documentosHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-file me-2'></i>Documentos</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th>Título</th>
                                        <th>Data de Upload</th>
                                        <th class="text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${documentosRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                documentosHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-file me-2'></i>Documentos</h6>
                        <div class="alert alert-info text-center">
                            <i class='bx bx-info-circle me-2'></i>Nenhum documento encontrado para esta ação.
                        </div>
                    </div>
                `;
            }
            
            // Atualizar o conteúdo do modal
            document.getElementById('infoAcaoConteudo').innerHTML = `
                ${clienteHTML}
                ${acaoHTML}
                ${sentencaHTML}
                ${pagamentoHTML}
                ${arquivosHTML}
                ${documentosHTML}
            `;
        } else {
            // Exibir mensagem de erro
            document.getElementById('infoAcaoConteudo').innerHTML = `
                <div class="alert alert-danger">
                    <i class='bx bx-error-circle me-2'></i>${response.message || 'Erro ao carregar informações da ação'}
                </div>
            `;
            mostrarToast('error', 'Erro ao carregar dados da ação.');
        }
    }).fail(function() {
        document.getElementById('infoAcaoConteudo').innerHTML = `
            <div class="alert alert-danger">
                <i class='bx bx-error-circle me-2'></i>Erro ao carregar informações da ação. Tente novamente.
            </div>
        `;
        mostrarToast('error', 'Erro ao carregar dados da ação. Tente novamente.');
    });
}

// Função para adicionar tooltips a todos os botões
function inicializarTooltips() {
    console.log('Inicializando tooltips para todos os botões');
    
    // Adicionar tooltips aos botões de fechar modais
    $('.btn-close').attr('data-tooltip', 'Fechar');
    
    // Adicionar tooltips a todos os botões com ícones, baseado no ícone
    $('button i.bx, a i.bx').each(function() {
        const botao = $(this).parent('button, a');
        if (!botao.attr('data-tooltip')) {
            const icone = $(this).attr('class');
            let tooltip = '';
            
            // Determinar o tooltip com base na classe do ícone
            if (icone.includes('bx-show')) tooltip = 'Visualizar';
            else if (icone.includes('bx-download')) tooltip = 'Baixar';
            else if (icone.includes('bx-edit')) tooltip = 'Editar';
            else if (icone.includes('bx-trash')) tooltip = 'Excluir';
            else if (icone.includes('bx-refresh')) tooltip = 'Atualizar';
            else if (icone.includes('bx-file')) tooltip = 'Documento';
            else if (icone.includes('bx-folder')) tooltip = 'Arquivos';
            else if (icone.includes('bx-check')) tooltip = 'Confirmar';
            else if (icone.includes('bx-x')) tooltip = 'Cancelar';
            else if (icone.includes('bx-plus')) tooltip = 'Adicionar';
            else if (icone.includes('bx-user-plus')) tooltip = 'Assumir Ação';
            else if (icone.includes('bx-info-circle')) tooltip = 'Informações';
            else if (icone.includes('bx-check-circle')) tooltip = 'Sentença';
            else if (icone.includes('bx-save')) tooltip = 'Salvar';
            else if (icone.includes('bx-upload')) tooltip = 'Enviar';
            
            if (tooltip) {
                botao.attr('data-tooltip', tooltip);
            }
        }
    });
    
    // Adicionar tooltips específicos para botões de ações nas tabelas
    $('button[onclick*="visualizarDadosAcao"]').attr('data-tooltip', 'Visualizar Detalhes');
    $('button[onclick*="editarAcao"]').attr('data-tooltip', 'Editar Ação');
    $('button[onclick*="atualizarStatus"]').attr('data-tooltip', 'Alterar Status');
    $('button[onclick*="verArquivos"]').attr('data-tooltip', 'Ver Arquivos');
    $('button[onclick*="atualizarSentenca"]').attr('data-tooltip', 'Atualizar Sentença');
    $('button[onclick*="inativarAcao"]').attr('data-tooltip', 'Inativar Ação');
    $('button[onclick*="reativarAcao"]').attr('data-tooltip', 'Reativar Ação');
    $('button[onclick*="assumirAcao"]').attr('data-tooltip', 'Assumir Ação');
    $('button[onclick*="recusarAcao"]').attr('data-tooltip', 'Recusar Ação');
    $('button[onclick*="enviarDocumentos"]').attr('data-tooltip', 'Adicionar Documento');
    $('button[onclick*="abrirArquivoPelaApi"]').attr('data-tooltip', 'Visualizar Arquivo');
    $('button[onclick*="baixarArquivoPelaApi"]').attr('data-tooltip', 'Baixar Arquivo');
    
    // Adicionar tooltips aos botões de submit
    $('button[type="submit"]').each(function() {
        if (!$(this).attr('data-tooltip')) {
            let texto = $(this).text().trim();
            if (texto) {
                $(this).attr('data-tooltip', texto);
            }
        }
    });
}

// Funções para manipulação dos formulários
$(document).ready(function() {
    inicializarMascaras();
    inicializarTooltips();
    
    // Carregar dados iniciais
    carregarAcoesAberto();
    carregarMinhasAcoes();
    carregarAcoesAdvogado();
    
    // Inicializar tooltips após abertura de qualquer modal
    $('.modal').on('shown.bs.modal', function() {
        setTimeout(inicializarTooltips, 100); // Pequeno atraso para garantir que o DOM esteja pronto
    });
    
    // Inicializar tooltips após qualquer alteração no DOM
    $(document).on('DOMNodeInserted', function(e) {
        if ($(e.target).find('button').length > 0 || $(e.target).is('button')) {
            setTimeout(inicializarTooltips, 100);
        }
    });
    
    // Manipulação do formulário de filtro de ações em aberto
    $('#formFiltroAcoes input, #formFiltroAcoes select').on('change', function() {
        const nome = $('#filtroNome').val();
        const cpf = $('#filtroCPF').val();
        const status = $('#filtroStatus').val();
        const tipoAcao = $('#filtroTipoAcao').val();
        
        $.get('/juridico/api/tabelaacoes/', {
            nome: nome,
            cpf: cpf,
            status: status,
            tipo_acao: tipoAcao
        }, function(response) {
            if (response.status === 'success') {
                const tbody = $('#tabelaAcoes tbody');
                tbody.empty();
                
                // Para cada ação, buscar detalhes completos incluindo documentos
                const promises = response.data.map(acao => {
                    return $.get(`/juridico/api_get_acao/${acao.id}/`).then(detalhes => {
                        if (detalhes.success) {
                            acao.documentos_acao = detalhes.data.documentos_acao || [];
                        }
                        return acao;
                    }).catch(() => {
                        acao.documentos_acao = [];
                        return acao;
                    });
                });
                
                Promise.all(promises).then(acoesCompletas => {
                    acoesCompletas.forEach(acao => {
                        if (!acao.advogado_responsavel) {
                            tbody.append(`
                                <tr>
                                    <td>${acao.cliente_nome}</td>
                                    <td>${formatarCPF(acao.cliente_cpf)}</td>
                                    <td>${acao.tipo_acao}</td>
                                    <td>${acao.data_criacao}</td>
                                    <td>${acao.status}</td>
                                    <td>${acao.sentenca || 'N/A'}</td>
                                    <td>${acao.loja || 'N/A'}</td>
                                    <td class="text-center">${criarBotoesAcao(acao, 'aberto')}</td>
                                </tr>
                            `);
                        }
                    });
                    
                    $('#nenhumResultadoAcoes').toggle(tbody.children().length === 0);
                });
            }
        });
    });
    
    // Manipulação do formulário de filtro de minhas ações
    $('#formFiltroMinhasAcoes input, #formFiltroMinhasAcoes select').on('change', function() {
        const nome = $('#filtroNomeMinhas').val();
        const cpf = $('#filtroCPFMinhas').val();
        const status = $('#filtroStatusMinhas').val();
        
        $.get('/juridico/api/minhas-acoes/', {
            nome: nome,
            cpf: cpf,
            status: status
        }, function(response) {
            if (response.status === 'success') {
                const tbody = $('#tabelaMinhasAcoes tbody');
                tbody.empty();
                
                // Para cada ação, buscar detalhes completos incluindo documentos
                const promises = response.data.map(acao => {
                    return $.get(`/juridico/api_get_acao/${acao.id}/`).then(detalhes => {
                        if (detalhes.success) {
                            acao.documentos_acao = detalhes.data.documentos_acao || [];
                        }
                        return acao;
                    }).catch(() => {
                        acao.documentos_acao = [];
                        return acao;
                    });
                });
                
                Promise.all(promises).then(acoesCompletas => {
                    acoesCompletas.forEach(acao => {
                        tbody.append(`
                            <tr>
                                <td>${acao.cliente_nome}</td>
                                <td>${formatarCPF(acao.cliente_cpf)}</td>
                                <td>${acao.tipo_acao}</td>
                                <td>${acao.data_criacao}</td>
                                <td>${acao.status}</td>
                                <td>${acao.sentenca || 'N/A'}</td>
                                <td>${acao.loja || 'N/A'}</td>
                                <td class="text-center">${criarBotoesAcao(acao, 'minhas')}</td>
                            </tr>
                        `);
                    });
                    
                    $('#nenhumResultadoMinhasAcoes').toggle(tbody.children().length === 0);
                });
            }
        });
    });
    
    // Manipulação do formulário de filtro de ações com advogado
    $('#formFiltroAcoesAdvogado input, #formFiltroAcoesAdvogado select').on('change', function() {
        const nome = $('#filtroNomeAdvogado').val();
        const cpf = $('#filtroCPFAdvogado').val();
        const status = $('#filtroStatusAdvogado').val();
        const advogado = $('#filtroAdvogado').val();
        
        $.get('/juridico/api/acoes-com-advogado/', {
            nome: nome,
            cpf: cpf,
            status: status,
            advogado: advogado
        }, function(response) {
            if (response.status === 'success') {
                const tbody = $('#tabelaAcoesAdvogado tbody');
                tbody.empty();
                
                response.data.forEach(acao => {
                    tbody.append(`
                        <tr>
                            <td>${acao.cliente_nome}</td>
                            <td>${formatarCPF(acao.cliente_cpf)}</td>
                            <td>${acao.tipo_acao}</td>
                            <td>${acao.data_criacao}</td>
                            <td>${acao.status}</td>
                            <td>${acao.sentenca || 'N/A'}</td>
                            <td>${acao.loja || 'N/A'}</td>
                            <td>${acao.advogado}</td>
                        </tr>
                    `);
                });
                
                $('#nenhumResultadoAcoesAdvogado').toggle(tbody.children().length === 0);
            }
        });
    });
    
    // Manipulação do formulário de assumir ação
    $('#formAssumirAcao').on('submit', function(e) {
        e.preventDefault();
        const acaoId = $('#acaoIdAssumir').val();
        
        $.post('/juridico/api/acoes/assumir/', {
            acao_id: acaoId
        }, function(response) {
            if (response.status === 'success') {
                $('#modalAssumirAcao').modal('hide');
                mostrarToast('success', 'Ação assumida com sucesso!');
                carregarAcoesAberto();
                carregarMinhasAcoes();
            } else {
                mostrarToast('error', response.message);
            }
        });
    });
    
    // Manipulação do formulário de recusar ação
    $('#formRecusarAcao').on('submit', function(e) {
        e.preventDefault();
        const acaoId = $('#acaoIdRecusar').val();
        const motivo = $('#motivoRecusa').val();
        
        $.post('/juridico/api/acoes/inativar/', {
            acao_id: acaoId,
            motivo: motivo
        }, function(response) {
            if (response.status === 'success') {
                $('#modalRecusarAcao').modal('hide');
                mostrarToast('success', 'Ação recusada com sucesso!');
                carregarAcoesAberto();
            } else {
                mostrarToast('error', response.message);
            }
        });
    });
    
    // Evento de submit do formulário de sentença
    $('#formAtualizarSentenca').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const tipoSentenca = $('#tipoSentenca').val();
        
        // Se for não favorável ou pendente, envia apenas ID, tipo de sentença e NENHUM para recurso
        if (tipoSentenca === 'NAO_FAVORAVEL' || tipoSentenca === 'PENDENTE') {
            formData.delete('grau_sentenca');
            formData.delete('valor_sentenca');
            formData.delete('data_sentenca');
            formData.delete('recurso_primeiro_grau');
            formData.delete('data_recurso_primeiro_grau');
            formData.delete('recurso_segundo_grau');
            formData.delete('data_recurso_segundo_grau');
            
            // Adiciona NENHUM como valor padrão para recurso_primeiro_grau
            formData.append('recurso_primeiro_grau', 'NENHUM');
        }
        
        $.ajax({
            url: '/juridico/api/acoes/atualizar-sentenca/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    $('#modalAtualizarSentenca').modal('hide');
                    mostrarToast('success', 'Sentença atualizada com sucesso!');
                    carregarAcoesAberto();
                } else {
                    mostrarToast('error', response.message || 'Erro ao atualizar sentença');
                }
            },
            error: function(xhr) {
                mostrarToast('error', xhr.responseJSON?.message || 'Erro ao atualizar sentença');
            }
        });
    });
    
    // Evento de change do tipo de sentença
    $('#tipoSentenca').on('change', controlarCamposSentenca);
    
    // Evento de change do recurso primeiro grau
    $('#recursoPrimeiroGrau').on('change', controlarCamposSentenca);
    // Evento de change do resultado do recurso primeiro grau
    $('#resultadoRecursoPrimeiroGrau').on('change', controlarCamposSentenca);
    
    // Evento de change do recurso segundo grau
    $('#recursoSegundoGrau').on('change', controlarCamposSentenca);
    // Evento de change do resultado do recurso segundo grau (se for influenciar algo no futuro)
    // $('#resultadoRecursoSegundoGrau').on('change', controlarCamposSentenca);

    // Manipulação do formulário de conferir arquivos
    $('#formConferirArquivos').on('submit', function(e) {
        e.preventDefault();
        const acaoId = $('#acaoIdConferir').val();
        const status = $('#statusConferencia').val();
        const motivo = $('#motivoIncompleto').val();
        
        $.post('/juridico/api/acoes/atualizar-status/', {
            acao_id: acaoId,
            status: status,
            motivo_incompleto: motivo
        }, function(response) {
            if (response.status === 'success') {
                $('#modalConferirArquivos').modal('hide');
                mostrarToast('success', 'Status atualizado com sucesso!');
                carregarAcoesAberto();
            } else {
                mostrarToast('error', response.message);
            }
        });
    });

    // Evento de submit do formulário de adicionar documento
    $('#formAdicionarDocumento').on('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        $.ajax({
            url: '/juridico/api/acoes/upload-documento-acao/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    $('#modalAdicionarDocumento').modal('hide');
                    mostrarToast('success', 'Documento anexado com sucesso!');
                    // Recarregar as listas de ações para atualizar os botões de visualizar arquivos
                    carregarAcoesAberto();
                    carregarMinhasAcoes();
                } else {
                    mostrarToast('error', response.message || 'Erro ao anexar documento');
                }
            },
            error: function(xhr) {
                mostrarToast('error', xhr.responseJSON?.message || 'Erro ao anexar documento');
            }
        });
    });

    // Evento para mostrar/ocultar campos condicionais no modal de status
    $('#status').on('change', function() {
        const selectedStatus = $(this).val();
        
        // Ocultar todos os campos condicionais primeiro
        $('#protocoloGroup, #motivoIncompletoGroup').hide();
        
        // Mostrar campos específicos com base no status selecionado
        if (selectedStatus === 'PROTOCOLADO') {
            $('#protocoloGroup').show();
        } else if (selectedStatus === 'INCOMPLETO') {
            $('#motivoIncompletoGroup').show();
        }
    });
    
    // Manipulação do formulário de atualizar status
    $('#formAtualizarStatus').on('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        
        // Garante que o acao_id seja enviado corretamente para o backend.
        // A função atualizarStatus(acaoId) armazena o ID no elemento #acaoIdAtualizarStatus.
        const acaoId = $('#acaoIdAtualizarStatus').val();
        if (acaoId) {
            // Define o 'acao_id' no formData. Se já existir um campo 'acao_id' 
            // (por exemplo, se o input HTML tiver name="acao_id"), 
            // seu valor será sobrescrito. Se não existir, será adicionado.
            // Isso garante que o backend receba 'acao_id' com o valor correto.
            formData.set('acao_id', acaoId);
        } else {
            console.error('ID da ação (acaoIdAtualizarStatus) não encontrado ou vazio no formulário de atualização de status.');
            mostrarToast('error', 'Erro crítico: ID da ação não pôde ser determinado para a atualização.');
            return; // Impede o envio do formulário se o ID da ação estiver ausente
        }
        
        $.ajax({
            url: '/juridico/api/acoes/atualizar-status/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    $('#modalAtualizarStatus').modal('hide');
                    mostrarToast('success', 'Status atualizado com sucesso!');
                    // Recarregar as listas de ações
                    carregarAcoesAberto();
                    carregarMinhasAcoes();
                } else {
                    mostrarToast('error', response.message || 'Erro ao atualizar status');
                }
            },
            error: function(xhr) {
                mostrarToast('error', xhr.responseJSON?.message || 'Erro ao atualizar status');
            }
        });
    });

    // Evento de change do grau da sentença
});

// Evento de change do grau da sentença
$('#grauSentenca').on('change', function() {
    controlarCamposSentenca(); // Reavaliar a lógica de mostrar/ocultar campos
});

// Função para obter a cor do status
function getStatusColor(status) {
    switch(status) {
        case 'EM_ESPERA':
        case 'Em Espera':
            return 'secondary';
        case 'INCOMPLETO':
        case 'Incompleto':
            return 'warning';
        case 'EM_DESPACHO':
        case 'Em Despacho':
            return 'info';
        case 'PROTOCOLADO':
        case 'Protocolado':
            return 'primary';
        case 'FINALIZADO':
        case 'Finalizado':
            return 'success';
        case 'RECUSADO':
        case 'Recusado':
            return 'danger';
        default:
            return 'secondary';
    }
}

// Função para mostrar mensagens toast
function mostrarToast(tipo, mensagem) {
    const toastId = `toast-${Date.now()}`;
    const toastHTML = `
        <div id="${toastId}" class="toast ${tipo}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">${tipo === 'success' ? 'Sucesso' : 'Erro'}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>
            <div class="toast-body">
                ${mensagem}
            </div>
        </div>
    `;
    
    $('#toastContainer').append(toastHTML);
    const toast = new bootstrap.Toast(document.getElementById(toastId), {
        delay: 5000
    });
    toast.show();
    
    // Remover o toast após ser escondido
    $(`#${toastId}`).on('hidden.bs.toast', function() {
        $(this).remove();
    });
}

// Manipulação de campos condicionais
$('#status').on('change', function() {
    const status = $(this).val();
    $('#protocoloGroup').toggle(status === 'PROTOCOLADO');
    $('#motivoIncompletoGroup').toggle(status === 'INCOMPLETO');
});

$('#statusConferencia').on('change', function() {
    const status = $(this).val();
    $('#divMotivoIncompleto').toggle(status === 'INCOMPLETO');
});
