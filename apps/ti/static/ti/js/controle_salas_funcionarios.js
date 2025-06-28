/**
 * controle_salas_funcionarios.js - Sistema de funcionários para o controle de salas
 * 
 * Este arquivo contém todas as funcionalidades relacionadas aos funcionários:
 * - Busca e cache de funcionários
 * - Dropdown de seleção de funcionários
 * - Atribuição de funcionários às PAs
 * - Atualização da visualização de funcionários
 * - Event listeners relacionados
 * 
 * DEPENDÊNCIAS:
 * - controle_salas_mensagens.js (função mostrarMensagem)
 */

// Variáveis globais para funcionários
const funcionariosApiUrl = '/ti/api/funcionarios/';
const atribuirFuncionarioApiUrl = '/ti/api/atribuir-funcionario-pa/';
let funcionariosCache = [];
let activeDropdown = null;

/**
 * Buscar funcionários da API (com cache)
 * @returns {Array|null} Lista de funcionários ou null em caso de erro
 */
async function fetchFuncionarios() {
  try {
    // Se já tivermos os dados em cache, retorná-los
    if (funcionariosCache && funcionariosCache.length > 0) {
      console.log('[DEBUG] Retornando funcionários do cache, total:', funcionariosCache.length);
      return funcionariosCache;
    }
    
    // Caso contrário, fazer a requisição
    console.log('[DEBUG] Buscando funcionários via API...');
    console.log('[DEBUG] URL da API:', funcionariosApiUrl);
    
    // Verificar se a URL está correta
    if (!funcionariosApiUrl || funcionariosApiUrl === '/ti/api/funcionarios/') {
      console.log('[DEBUG] Usando URL padrão para funcionários. Verifique se esta URL existe no backend');
    }
    
    const response = await $.ajax({
      url: funcionariosApiUrl,
      type: 'GET',
      dataType: 'json',
      beforeSend: function() {
        console.log('[DEBUG] Enviando requisição AJAX para buscar funcionários');
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('[DEBUG] Erro na requisição AJAX:', textStatus, errorThrown);
        console.log('[DEBUG] Status HTTP:', jqXHR.status);
        console.log('[DEBUG] Resposta completa:', jqXHR.responseText);
      }
    });
    
    console.log('[DEBUG] Resposta recebida da API:', response);
    
    if (response.success) {
      console.log('[DEBUG] Funcionários obtidos com sucesso, total:', response.funcionarios.length);
      funcionariosCache = response.funcionarios;
      // Adicionar a opção "Nenhum" se ainda não existir
      if (!funcionariosCache.find(f => f.id === 0)) {
        funcionariosCache.unshift({ id: 0, nome: "Nenhum (Desatribuir)", ramal: "" });
      }
      return funcionariosCache;
    } else {
      console.log('[DEBUG] API retornou erro:', response.error || 'Erro não especificado');
      throw new Error(response.error || 'Erro desconhecido ao buscar funcionários.');
    }
  } catch (error) {
    console.error("[DEBUG] Erro detalhado ao buscar funcionários:", error);
    if (error.responseJSON) {
      console.log('[DEBUG] Detalhes do erro (responseJSON):', error.responseJSON);
    }
    if (error.responseText) {
      console.log('[DEBUG] Resposta de texto:', error.responseText);
    }
    
    let errorMsg = 'Erro desconhecido.';
    if (error.responseJSON && error.responseJSON.error) {
      // Erro vindo da nossa API Django
      errorMsg = error.responseJSON.error;
    } else if (error.statusText) {
      // Erro AJAX genérico (jqXHR object)
      errorMsg = `${error.statusText} (Status: ${error.status || 'N/A'})`;
    } else if (error.message) {
      // Erro JavaScript padrão
      errorMsg = error.message;
    } else if (typeof error === 'string'){
      // Se o erro for uma string
      errorMsg = error;
    }
    mostrarMensagem(`Erro ao buscar funcionários: ${errorMsg}`, 'error');
    return null;
  }
}

/**
 * Criar HTML do dropdown de funcionários
 * @param {Array} funcionarios - Lista de funcionários
 * @param {string} paId - ID da PA
 * @returns {string} HTML do dropdown
 */
function criarDropdownHTML(funcionarios, paId) {
  let itemsHTML = '';
  if (!funcionarios) return '<div class="funcionario-dropdown-menu p-2 text-danger">Erro ao carregar.</div>';

  funcionarios.forEach(func => {
    // Modificado para exibir o ramal próximo ao nome
    let nomeRamal = func.id === 0 ? 
      `<span class="nome">${func.nome}</span>` : 
      `<span class="nome">${func.nome} ${func.ramal ? `<span class="ramal-inline">(Ramal: ${func.ramal})</span>` : ''}</span>`;
    
    const itemClass = func.id === 0 ? 'desatribuir-item' : '';
    itemsHTML += `
      <div class="funcionario-dropdown-item ${itemClass}" data-funcionario-id="${func.id}" data-pa-id="${paId}">
        ${nomeRamal}
        ${func.id !== 0 && !func.ramal ? '<span class="ramal no-ramal">(Sem Ramal)</span>' : ''}
      </div>
    `;
  });

  return `<div class="funcionario-dropdown-menu" id="dropdown-pa-${paId}">${itemsHTML}</div>`;
}

/**
 * Alternar exibição do dropdown de funcionários
 * @param {HTMLElement} button - Botão que foi clicado
 */
async function toggleDropdownFuncionarios(button) {
  console.log('[DEBUG] toggleDropdownFuncionarios iniciado para botão:', button);
  const paId = $(button).data('pa-id');
  console.log('[DEBUG] PA ID obtido:', paId);
  console.log('[DEBUG] Botão data attributes:', $(button).data());
  console.log('[DEBUG] Botão HTML:', button.outerHTML);
  
  // Verificar se paId está definido
  if (!paId) {
    console.error('❌ [DEBUG] paId é undefined ou vazio!');
    console.log('[DEBUG] Botão completo:', button.outerHTML);
    console.log('[DEBUG] Data attributes do botão:', $(button).data());
    mostrarMensagem('Erro: ID da PA não encontrado', 'error');
    return;
  }
  
  const existingDropdown = $(`#dropdown-pa-${paId}`);
  console.log('[DEBUG] Dropdown existente?', existingDropdown.length > 0);

  // Fechar dropdown ativo se existir e não for o atual
  if (activeDropdown && activeDropdown.attr('id') !== `dropdown-pa-${paId}`) {
    console.log('[DEBUG] Fechando dropdown ativo diferente');
    activeDropdown.fadeOut(100, function() { $(this).remove(); });
    activeDropdown = null;
  }

  if (existingDropdown.length > 0) {
    // Se existe, apenas remove (fecha)
    console.log('[DEBUG] Fechando dropdown existente');
    existingDropdown.fadeOut(100, function() { $(this).remove(); });
    activeDropdown = null;
  } else {
    // Se não existe, busca dados, cria e mostra
    console.log('[DEBUG] Criando novo dropdown para PA:', paId);
    
    // Criar um loader flutuante próximo ao botão que clicamos
    const buttonRect = button.getBoundingClientRect();
    console.log('[DEBUG] Posição do botão:', buttonRect);
    const loaderHTML = `<div id="dropdown-loader-${paId}" style="position: fixed; z-index: 9999; left: ${buttonRect.right + 10}px; top: ${buttonRect.top}px;">
                          <div class="spinner-border spinner-border-sm text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                          </div>
                        </div>`;
    $('body').append(loaderHTML);
    console.log('[DEBUG] Loader adicionado, buscando funcionários...');
    
    try {
      const funcionarios = await fetchFuncionarios();
      console.log('[DEBUG] Resultado da busca de funcionários:', funcionarios ? 'Sucesso' : 'Falha');
      $(`#dropdown-loader-${paId}`).remove(); // Remove o loader
      console.log('[DEBUG] Loader removido');
      
      if (funcionarios) {
        console.log('[DEBUG] Criando HTML do dropdown com', funcionarios.length, 'funcionários');
        const dropdownHTML = criarDropdownHTML(funcionarios, paId);
        console.log('[DEBUG] HTML do dropdown criado');
        
        // Anexar dropdown ao body em vez de dentro do card
        $('body').append(dropdownHTML);
        console.log('[DEBUG] Dropdown anexado ao body');
        
        const newDropdown = $(`#dropdown-pa-${paId}`);
        activeDropdown = newDropdown;
        console.log('[DEBUG] Novo dropdown ativo definido');

        // Posicionar baseado na posição absoluta do botão na viewport
        const buttonRect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        // Verificar se o dropdown ficará fora da janela à direita
        let leftPos = buttonRect.left;
        const dropdownWidth = newDropdown.outerWidth() || 300; // Uso estimado se ainda não calculado
        if (leftPos + dropdownWidth > viewportWidth - 20) {
          // Se vai sair da tela, posiciona à esquerda do botão
          leftPos = buttonRect.right - dropdownWidth;
        }
        
        newDropdown.css({
          position: 'fixed', // Posição fixa em relação à viewport
          top: (buttonRect.bottom + 5) + 'px',
          left: leftPos + 'px',
          display: 'none', // Começa escondido para o fadeIn
          zIndex: 9999 // Garante que fica acima de tudo
        });

        newDropdown.fadeIn(150);

        // Adicionar listener para seleção
        newDropdown.find('.funcionario-dropdown-item').on('click', function() {
          const selectedFuncId = $(this).data('funcionario-id');
          console.log('🔍 [DEBUG] Clique no funcionário:', {
            selectedFuncId: selectedFuncId,
            paId: paId,
            dropdownId: newDropdown.attr('id')
          });
          
          // Verificar se paId está definido
          if (!paId) {
            console.error('❌ [DEBUG] paId está undefined no listener do dropdown');
            mostrarMensagem('Erro: ID da PA não encontrado', 'error');
            return;
          }
          
          // Encontrar o card da PA
          const paCard = $(`.pa-card[data-pa-id="${paId}"]`);
          if (paCard.length === 0) {
            console.error('❌ [DEBUG] Card da PA não encontrado:', paId);
            mostrarMensagem('Erro: Card da PA não encontrado', 'error');
            return;
          }
          
          // Fechar dropdown
          newDropdown.fadeOut(100, function() { $(this).remove(); });
          activeDropdown = null;
          
          // Atribuir funcionário
          atribuirFuncionarioAPa(paId, selectedFuncId, paCard);
        });
      } else {
        // Caso fetchFuncionarios falhe, mostrar mensagem de erro
        const errorHtml = `<div id="error-message-${paId}" style="position: fixed; z-index: 9999; left: ${buttonRect.right + 10}px; top: ${buttonRect.top}px; background: white; padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: red;">
                            Falha ao carregar funcionários
                          </div>`;
        $('body').append(errorHtml);
        
        // Remover após alguns segundos
        setTimeout(() => {
          $(`#error-message-${paId}`).fadeOut(300, function() { $(this).remove(); });
        }, 3000);
      }
    } catch (error) {
      console.error('[DEBUG] Erro no toggleDropdownFuncionarios:', error);
      // Remover o loader se existir
      $(`#dropdown-loader-${paId}`).remove();
      // Mostrar mensagem de erro
      const errorHtml = `<div id="error-message-${paId}" style="position: fixed; z-index: 9999; left: ${buttonRect.right + 10}px; top: ${buttonRect.top}px; background: white; padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: red;">
                          Erro ao carregar funcionários: ${error.message || 'Erro desconhecido'}
                        </div>`;
      $('body').append(errorHtml);
      // Remover após alguns segundos
      setTimeout(() => {
        $(`#error-message-${paId}`).fadeOut(300, function() { $(this).remove(); });
      }, 5000);
    }
  }
}

/**
 * Atribuir funcionário à PA via AJAX
 * @param {string} paId - ID da PA
 * @param {string} funcionarioId - ID do funcionário
 * @param {jQuery} paCardElement - Elemento do card da PA
 */
function atribuirFuncionarioAPa(paId, funcionarioId, paCardElement) {
  // Debug: Log dos parâmetros recebidos
  console.log('🔍 [DEBUG] atribuirFuncionarioAPa chamada com:', {
    paId: paId,
    funcionarioId: funcionarioId,
    paCardElement: paCardElement ? 'Elemento encontrado' : 'Elemento não encontrado'
  });

  // Validar dados antes de enviar
  if (!paId || !funcionarioId) {
    console.error('❌ [DEBUG] Dados inválidos:', { paId, funcionarioId });
    mostrarMensagem('Dados inválidos: PA ID e Funcionário ID são obrigatórios', 'error');
    return;
  }

  // Preparar dados
  const dados = {
    pa_id: paId,
    funcionario_id: funcionarioId
  };

  // Obter CSRF token
  const csrfToken = $('[name=csrfmiddlewaretoken]').val();
  console.log('🔍 [DEBUG] CSRF Token:', csrfToken ? 'Token encontrado' : 'Token NÃO encontrado');
  
  if (!csrfToken) {
    console.error('❌ [DEBUG] CSRF Token não encontrado');
    mostrarMensagem('Token CSRF não encontrado. Recarregue a página.', 'error');
    return;
  }

  // Debug: Log dos dados que serão enviados
  console.log('🔍 [DEBUG] Dados que serão enviados:', dados);
  console.log('🔍 [DEBUG] URL da API:', atribuirFuncionarioApiUrl);

  $.ajax({
    url: atribuirFuncionarioApiUrl,
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json; charset=utf-8'
    },
    data: JSON.stringify(dados),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    beforeSend: function(xhr, settings) {
      console.log('🔍 [DEBUG] Enviando requisição AJAX:', {
        url: settings.url,
        method: settings.type,
        data: settings.data,
        headers: settings.headers
      });
    },
    success: function(response) {
      console.log('✅ [DEBUG] Resposta de sucesso:', response);
      if (response.success) {
        // Atualizar a interface da PA principal
        atualizarVisualizacaoFuncionarioPA(paCardElement, response.funcionario, response.novo_status);
        
        // Atualizar outras PAs afetadas (se funcionário foi removido de outras PAs)
        if (response.pas_afetadas && response.pas_afetadas.length > 0) {
          response.pas_afetadas.forEach(paAfetada => {
            // Encontrar o card da PA afetada
            const paAfetadaCard = $(`.pa-card[data-pa-id="${paAfetada.id}"]`);
            if (paAfetadaCard.length) {
              // Atualizar a interface da PA afetada (com funcionário = null)
              atualizarVisualizacaoFuncionarioPA(paAfetadaCard, null, paAfetada.status);
            }
          });
          
          // Mensagem específica mencionando a remoção de outras PAs
          if (response.funcionario) {
            // Construir a descrição da PA afetada
            let paAfetadaDesc = '';
            if (response.pas_afetadas.length > 0) {
              const paAfetada = response.pas_afetadas[0]; // Pega a primeira afetada para a mensagem
              paAfetadaDesc = ` Foi removido da PA ${paAfetada.numero} (Sala: ${paAfetada.sala}, Ilha: ${paAfetada.ilha}).`;
            } else {
              paAfetadaDesc = ''; // Nenhuma outra PA afetada
            }
            // Usar o número da PA alvo (response.pa_numero)
            mostrarMensagem(`Funcionário ${response.funcionario.nome_completo} atribuído à PA ${response.pa_numero}.${paAfetadaDesc}`, 'success');
          } else {
            // Mensagem para desatribuição (funcionário removido)
            mostrarMensagem(`Funcionário removido da PA ${response.pa_numero}.`, 'success');
          }
        } else {
          // Mensagem padrão (caso não haja funcionário ou PAs afetadas - fallback)
          if (response.funcionario) {
            mostrarMensagem(response.message || `Funcionário ${response.funcionario.nome_completo} atribuído à PA ${response.pa_numero} com sucesso!`, 'success');
          } else {
            mostrarMensagem(response.message || `Funcionário atribuído à PA ${response.pa_numero} com sucesso!`, 'success');
          }
        }
      } else {
        console.error('❌ [DEBUG] Resposta com erro:', response);
        mostrarMensagem('Erro ao atribuir funcionário: ' + (response.error || 'Erro desconhecido'), 'error');
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.error('❌ [DEBUG] Erro AJAX completo:', {
        status: jqXHR.status,
        statusText: jqXHR.statusText,
        textStatus: textStatus,
        errorThrown: errorThrown,
        responseText: jqXHR.responseText,
        responseJSON: jqXHR.responseJSON
      });
      
      let errorMsg = 'Erro ao comunicar com o servidor para atribuição.';
      
      // Tentar extrair mensagem de erro mais específica
      if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
        errorMsg = jqXHR.responseJSON.error;
      } else if (jqXHR.responseText) {
        try {
          const errorResponse = JSON.parse(jqXHR.responseText);
          if (errorResponse.error) {
            errorMsg = errorResponse.error;
          }
        } catch (e) {
          // Se não conseguir fazer parse do JSON, usar o texto bruto
          errorMsg = jqXHR.responseText;
        }
      }
      
      mostrarMensagem(errorMsg, 'error');
    }
  });
}

/**
 * Atualizar a visualização do funcionário no card da PA
 * @param {jQuery} paCard - Elemento do card da PA
 * @param {Object|null} funcionarioData - Dados do funcionário ou null
 * @param {string} novoStatus - Novo status da PA
 */
function atualizarVisualizacaoFuncionarioPA(paCard, funcionarioData, novoStatus) {
  const paFuncionarioDiv = paCard.find('.pa-funcionario > div:first-child'); // O div que contém o nome/botão
  const paId = paCard.data('pa-id');

  // Limpar completamente o conteúdo da div
  paFuncionarioDiv.empty();
  
  // Sempre adicionar o label "Funcionário:" primeiro
  paFuncionarioDiv.append('<strong>Funcionário:</strong> ');

  if (funcionarioData) {
    // Adicionar nome do funcionário
    paFuncionarioDiv.append(`<span class="funcionario-nome">${funcionarioData.nome_completo}</span>`);
    
    // Adicionar o botão de ramal
    let buttonHTML;
    if (funcionarioData.ramal) {
        buttonHTML = `
          <button type="button" class="btn btn-sm ramal-badge ms-2" data-pa-id="${paId}" data-action="change">
            Ramal: ${funcionarioData.ramal} <i class='bx bxs-down-arrow bx-xs ms-1'></i>
          </button>`;
    } else {
        buttonHTML = `
          <button type="button" class="btn btn-sm ramal-badge ms-2" data-pa-id="${paId}" data-action="change">
            Sem Ramal <i class='bx bxs-down-arrow bx-xs ms-1'></i>
          </button>`;
    }
    paFuncionarioDiv.append(buttonHTML);
  } else {
    // PA sem funcionário - adicionar "Não atribuído"
    paFuncionarioDiv.append('<span class="text-muted">Não atribuído</span>');
    
    // Adicionar botão de atribuir
    const assignButtonHTML = `
      <button type="button" class="btn btn-sm btn-outline-primary ms-2 assign-funcionario-btn" data-pa-id="${paId}" data-action="assign">
        <i class='bx bx-user-plus me-1'></i> Atribuir
      </button>`;
    paFuncionarioDiv.append(assignButtonHTML);
  }

  // Atualizar o status visual da PA (bolinha e badge)
  if (typeof atualizarVisualizacaoStatusPA === 'function') {
    atualizarVisualizacaoStatusPA(paCard[0], novoStatus);
  }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

$(document).ready(function() {
  // Event Listener para os botões de ramal e atribuir (delegação de evento)
  $(document).on('click', '.ramal-badge, .assign-funcionario-btn', function(e) {
    e.preventDefault();
    e.stopPropagation(); // Impede que feche imediatamente se clicar no botão
    
    console.log('[DEBUG] Clique em ramal-badge ou assign-funcionario-btn');
    console.log('[DEBUG] Elemento clicado:', this);
    console.log('[DEBUG] Classe do elemento:', $(this).attr('class'));
    console.log('[DEBUG] PA ID:', $(this).data('pa-id'));
    toggleDropdownFuncionarios(this);
  });

  // Event Listener para fechar dropdown ao clicar fora
  $(document).on('click', function(event) {
    if (activeDropdown && !$(event.target).closest('.funcionario-dropdown-menu').length && !$(event.target).closest('.ramal-badge, .assign-funcionario-btn').length) {
      activeDropdown.fadeOut(100, function() { $(this).remove(); });
      activeDropdown = null;
    }
  });
});

// Tornar funções disponíveis globalmente
window.fetchFuncionarios = fetchFuncionarios;
window.criarDropdownHTML = criarDropdownHTML;
window.toggleDropdownFuncionarios = toggleDropdownFuncionarios;
window.mostrarDropdownFuncionarios = toggleDropdownFuncionarios; // Alias para compatibilidade
window.atribuirFuncionarioAPa = atribuirFuncionarioAPa;
window.atualizarVisualizacaoFuncionarioPA = atualizarVisualizacaoFuncionarioPA;

// Tornar variáveis globais disponíveis
window.funcionariosCache = funcionariosCache;
window.activeDropdown = activeDropdown;