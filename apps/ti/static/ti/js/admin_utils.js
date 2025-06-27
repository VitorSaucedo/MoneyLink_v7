/**
 * admin_utils.js - Funções utilitárias centralizadas para as páginas de administração do TI
 * 
 * Contém funções auxiliares reutilizáveis para as funcionalidades de administração
 * Versão refatorada para eliminar duplicações de código
 */

// Função para obter a loja selecionada nas páginas de admin
function getSelectedLojaAdmin() {
  return $('select[name="loja"]').val() || 
         $('#loja_selecionada').val() || 
         $('[data-loja-id]').data('loja-id') || 
         new URLSearchParams(window.location.search).get('loja');
}

// Função centralizada para carregar ilhas por sala (consolidada de múltiplos arquivos)
function carregarIlhasPorSala(salaId, targetSelect, callback) {
  if (!salaId) {
    if (targetSelect) {
      targetSelect.empty().html('<option value="">-- Selecione uma Ilha --</option>');
    }
    if (callback) callback([]);
    return;
  }

  const $targetSelect = targetSelect ? $(targetSelect) : $('#ilha, select[name="ilha"]');
  
  // Mostrar loading
  $targetSelect.empty().html('<option value="">Carregando ilhas...</option>');

  $.ajax({
    url: `/ti/api/ilhas-por-sala/${salaId}/`,
    type: 'GET',
    headers: {
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
    },
    dataType: 'json',
    success: function(response) {
      const ilhas = response.ilhas || [];
      
      // Limpar e adicionar opção padrão
      $targetSelect.empty().html('<option value="">-- Selecione uma Ilha --</option>');
      
      // Adicionar ilhas
      ilhas.forEach(function(ilha) {
        $targetSelect.append(`<option value="${ilha.id}" data-quantidade-pas="${ilha.quantidade_pas || 0}">${ilha.nome}</option>`);
      });
      
      if (callback) callback(ilhas);
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar ilhas:', error);
      $targetSelect.empty().html('<option value="">Erro ao carregar ilhas</option>');
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', 'Erro ao carregar ilhas');
      }
      
      if (callback) callback([]);
    }
  });
}

// Função centralizada para carregar PAs por ilha (consolidada de múltiplos arquivos)
function carregarPAsPorIlha(ilhaId, targetSelect, lojaId, callback) {
  if (!ilhaId || !targetSelect) {
    if (targetSelect) {
      $(targetSelect).empty().html('<option value="">-- Selecione uma PA --</option>');
    }
    if (callback) callback([]);
    return;
  }

  const $targetSelect = $(targetSelect);
  
  // Mostrar loading
  $targetSelect.empty().html('<option value="">Carregando PAs...</option>');

  $.ajax({
    url: '/ti/api/listar-posicoes-atendimento/',
    type: 'GET',
    data: {
      ilha: ilhaId,
      loja: lojaId,
      per_page: 100
    },
    headers: {
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
    },
    dataType: 'json',
    success: function(data) {
      const pas = data.success && data.data ? data.data : [];
      
      // Limpar e adicionar opção padrão
      $targetSelect.empty().html('<option value="">-- Selecione uma PA --</option>');
      
      // Adicionar PAs
      pas.forEach(function(pa) {
        $targetSelect.append(`<option value="${pa.id}">PA ${pa.numero}</option>`);
      });
      
      if (callback) callback(pas);
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar PAs:', error);
      $targetSelect.empty().html('<option value="">Erro ao carregar PAs</option>');
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', 'Erro ao carregar PAs');
      }
      
      if (callback) callback([]);
    }
  });
}

// Função centralizada para carregar salas por loja (consolidada de múltiplos arquivos)
function carregarSalasPorLoja(lojaId, targetSelect, callback) {
  if (!lojaId) {
    if (targetSelect) {
      $(targetSelect).empty().html('<option value="">-- Selecione uma Sala --</option>');
    }
    if (callback) callback([]);
    return;
  }

  const $targetSelect = targetSelect ? $(targetSelect) : $('select[name="sala"]');
  
  // Mostrar loading
  $targetSelect.empty().html('<option value="">Carregando salas...</option>');

  $.ajax({
    url: `/ti/api/salas-por-loja/${lojaId}/`,
    type: 'GET',
    headers: {
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
    },
    dataType: 'json',
    success: function(response) {
      const salas = response.data && response.data.salas ? response.data.salas : [];
      
      // Limpar e adicionar opção padrão
      $targetSelect.empty().html('<option value="">-- Selecione uma Sala --</option>');
      
      // Adicionar salas
      salas.forEach(function(sala) {
        $targetSelect.append(`<option value="${sala.id}" data-loja="${sala.loja_id}">${sala.nome}</option>`);
      });
      
      if (callback) callback(salas);
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar salas:', error);
      $targetSelect.empty().html('<option value="">Erro ao carregar salas</option>');
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', 'Erro ao carregar salas');
      }
      
      if (callback) callback([]);
    }
  });
}

// Função para ajustes de layout responsivo nas páginas de admin
function adjustAdminWidths() {
  const containerWidth = $('.container').width();
  const maxElementWidth = Math.min(containerWidth - 30, 1140);
  
  // Ajustar largura dos botões de listagem
  $('.btn-listagem').each(function() {
    $(this).css('maxWidth', '100%');
  });
  
  // Ajustar largura de modais de cadastro
  $('.modal-dialog').each(function() {
    const $modal = $(this);
    if ($modal.hasClass('modal-lg')) {
      $modal.css('maxWidth', maxElementWidth + 'px');
    }
  });
}

// Função para inicializar comportamentos específicos de admin
function initAdminBehaviors() {
  // Marcar formulários de cadastro para processamento AJAX
  $('form').each(function() {
    const $form = $(this);
    const action = $form.attr('action') || '';
    const formId = $form.attr('id') || '';
    
    // Identificar formulários de cadastro específicos de admin
    if (action.includes('/cadastrar/') || action.includes('/create/') || 
        $form.find('input[name*="cadastrar"], button[name*="cadastrar"]').length > 0 ||
        formId.includes('form-') || formId.includes('form_')) {
      $form.addClass('ajax-form');
      $form.attr('data-ajax', 'true');
    }
  });
  
  // Marcar formulários específicos por ID para admin
  $('#form-periferico, #form-computador, #form-sala, #form-ilha, #form-pa, #form-tipo-periferico, #form-monitor, #form-periferico-lote, #form-email, #form-chip').each(function() {
    $(this).addClass('ajax-form').attr('data-ajax', 'true');
  });
  
  // Formulários que não usam AJAX
  $('#form-storm, #form-sistema, #form-coordenador-sala').attr('data-no-ajax', 'true');
  
  // Também marcar formulários com IDs alternativos
  $('[id*="form_"], [id*="form-"]').each(function() {
    // Excluir formulário de ramal que tem data-no-ajax="true"
    if (!$(this).attr('data-no-ajax')) {
      $(this).addClass('ajax-form').attr('data-ajax', 'true');
    }
  });
}

// Função para carregar ilhas por sala (movida do admin.js)
function carregarIlhasPorSala(salaId, targetSelect, callback) {
  if (!salaId || !targetSelect || !targetSelect.length) return;
  
  // Limpar opções existentes completamente
  targetSelect.empty().html('<option value="">-- Selecione uma Ilha --</option>');
  
  // Obter loja selecionada se houver
  const lojaId = getSelectedLojaAdmin();
  
  // Buscar ilhas da sala selecionada via API
  $.ajax({
    url: '/ti/api/ilhas-por-sala/' + salaId + '/',
    type: 'GET',
    data: lojaId ? { loja: lojaId } : {},
    dataType: 'json',
    success: function(data) {
      if (data.ilhas && Array.isArray(data.ilhas)) {
        // Adicionar opções de ilhas ao select
        $.each(data.ilhas, function(index, ilha) {
          // Verificar se a opção já existe para evitar duplicação
          if (targetSelect.find('option[value="' + ilha.id + '"]').length === 0) {
            const $option = $('<option></option>');
            $option.val(ilha.id);
            $option.text(ilha.nome);
            targetSelect.append($option);
          }
        });
      }
      
      // Executar callback se fornecido
      if (typeof callback === 'function') {
        callback(data);
      }
    },
    error: function(error) {
      console.error('Erro ao carregar ilhas:', error);
      if (typeof callback === 'function') {
        callback(null);
      }
    }
  });
}

// ===== FUNÇÕES DE VALIDAÇÃO CENTRALIZADAS =====

// Função para validar formato de ramal
function validarFormatoRamal(ramal) {
  return /^\d{4}$/.test(ramal);
}

// Função centralizada para verificar se ramal já existe (consolidada de múltiplos arquivos)
function verificarRamalExistente(ramal, funcionarioId, callback) {
  if (!ramal || !funcionarioId) {
    if (callback) callback(null);
    return;
  }
  
  $.ajax({
    url: '/ti/api/verificar-ramal/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
    },
    data: JSON.stringify({
      ramal: ramal,
      funcionario_id: funcionarioId
    }),
    dataType: 'json',
    success: function(data) {
      if (callback) callback(data);
    },
    error: function(xhr, status, error) {
      console.error('Erro ao verificar ramal:', error);
      if (callback) callback(null);
    }
  });
}

// Função centralizada para validar formulários de ramal (consolidada de múltiplos arquivos)
function validateAdminRamalForm($form, event) {
  const $ramalInput = $form.find('#numero_ramal, input[name="numero_ramal"]');
  const $funcionarioSelect = $form.find('#funcionario_ramal, select[name="funcionario_ramal"]');
  
  if ($ramalInput.length && $funcionarioSelect.length) {
    const ramal = $ramalInput.val().trim();
    const funcionarioId = $funcionarioSelect.val();
    
    if (!ramal || !funcionarioId) {
      if (event) event.preventDefault();
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', 'Preencha todos os campos obrigatórios');
      }
      
      return false;
    }
    
    if (!validarFormatoRamal(ramal)) {
      if (event) event.preventDefault();
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminValidationNotification('numero_ramal', 'O ramal deve ter exatamente 4 dígitos numéricos');
      }
      
      return false;
    }
  }
  
  return true;
}

// Função centralizada para validar formulários de computador (consolidada de múltiplos arquivos)
function validateAdminComputadorForm($form, event) {
  const $statusSelect = $form.find('#status_computador, select[name="status_computador"]');
  
  if ($statusSelect.length) {
    const status = $statusSelect.val();
    
    if (status === 'em_uso') {
      const $paSelect = $form.find('#pa_em_uso, select[name="pa_em_uso"]');
      
      if ($paSelect.length && !$paSelect.val()) {
        if (event) event.preventDefault();
        
        if (window.TIAdminNotifications) {
          window.TIAdminNotifications.showAdminNotification('error', 'Selecione uma Posição de Atendimento para computadores em uso');
        }
        
        return false;
      }
    } else if (status === 'manutencao') {
      const $obsTextarea = $form.find('#observacoes_manutencao, textarea[name="observacoes_manutencao"]');
      
      if ($obsTextarea.length && !$obsTextarea.val().trim()) {
        if (event) event.preventDefault();
        
        if (window.TIAdminNotifications) {
          window.TIAdminNotifications.showAdminNotification('error', 'Informe o motivo da manutenção');
        }
        
        return false;
      }
    }
  }
  
  return true;
}

// Função centralizada para configurar campos condicionais (consolidada de múltiplos arquivos)
function setupConditionalFields() {
  // Configurar campos condicionais do status do computador
  const $statusComputador = $('#status_computador');
  const $camposEmUso = $('#campos_em_uso');
  const $camposManutencao = $('#campos_manutencao');
  
  if ($statusComputador.length) {
    function atualizarCamposCondicionais() {
      const status = $statusComputador.val();
      
      // Esconder todos os campos condicionais primeiro
      $('.campos-condicionais').hide();
      
      // Resetar validação visual
      $('#pa_em_uso, #observacoes_manutencao').removeClass('is-invalid');
      
      if (status === 'em_uso') {
        $camposEmUso.show();
        $('#pa_em_uso').prop('required', true);
        $('#observacoes_manutencao').prop('required', false);
      } else if (status === 'manutencao') {
        $camposManutencao.show();
        $('#observacoes_manutencao').prop('required', true);
        $('#pa_em_uso').prop('required', false);
      } else {
        $('#pa_em_uso, #observacoes_manutencao').prop('required', false);
      }
    }
    
    // Atualizar ao carregar a página
    atualizarCamposCondicionais();
    
    // Atualizar quando o status mudar
    $statusComputador.on('change', atualizarCamposCondicionais);
  }
}

// Função para desabilitar/habilitar botão de submit
function toggleSubmitButton($button, isEnabled, loadingText = 'Salvando...') {
  const originalText = $button.data('original-text') || $button.text() || $button.val();
  
  if (!$button.data('original-text')) {
    $button.data('original-text', originalText);
  }
  
  if (isEnabled) {
    $button.prop('disabled', false);
    if ($button.is('button')) {
      $button.text(originalText);
    } else {
      $button.val(originalText);
    }
  } else {
    $button.prop('disabled', true);
    if ($button.is('button')) {
      $button.text(loadingText);
    } else {
      $button.val(loadingText);
    }
  }
}

// Mapeamento de formulários para URLs AJAX (movido do admin.js)
const formAjaxUrls = {
  'form-periferico': '/ti/api/ajax/periferico/cadastrar/',
  'form-computador': '/ti/api/ajax/computador/cadastrar/',
  'form-sala': '/ti/api/ajax/sala/cadastrar/',
  'form-ilha': '/ti/api/ajax/ilha/cadastrar/',
  'form-pa': '/ti/api/ajax/posicao-atendimento/cadastrar/',
  'form-tipo-periferico': '/ti/api/ajax/tipo-periferico/cadastrar/',
  'form-monitor': '/ti/api/ajax/monitor/cadastrar/',
  // 'form-coordenador-sala': '/ti/api/ajax/coordenador-sala/cadastrar/', // Removido - URL não existe
  'form-periferico-lote': '/ti/api/ajax/periferico/cadastrar/',
  'form-email': '/ti/api/ajax/email/cadastrar/',
  // 'form-storm': '/ti/api/ajax/storm/cadastrar/', // Removido - URL não existe
  // 'form-sistema': '/ti/api/ajax/sistema/cadastrar/', // Removido - URL não existe
  'form-chip': '/ti/api/ajax/chip/cadastrar/',
  // Também suportar IDs com underscores
  'form_periferico': '/ti/api/ajax/periferico/cadastrar/',
  'form_computador': '/ti/api/ajax/computador/cadastrar/',
  'form_sala': '/ti/api/ajax/sala/cadastrar/',
  'form_ilha': '/ti/api/ajax/ilha/cadastrar/',
  'form_pa': '/ti/api/ajax/posicao-atendimento/cadastrar/',
  'form_tipo_periferico': '/ti/api/ajax/tipo-periferico/cadastrar/',
  'form_monitor': '/ti/api/ajax/monitor/cadastrar/',
  // 'form_coordenador_sala': '/ti/api/ajax/coordenador-sala/cadastrar/', // Removido - URL não existe
  'form_periferico_lote': '/ti/api/ajax/periferico/cadastrar/',
  'form_email': '/ti/api/ajax/email/cadastrar/',
  // 'form_storm': '/ti/api/ajax/storm/cadastrar/', // Removido - URL não existe
  // 'form_sistema': '/ti/api/ajax/sistema/cadastrar/', // Removido - URL não existe
  'form_chip': '/ti/api/ajax/chip/cadastrar/',
};

// Função para obter URL AJAX baseada no ID do formulário
function getFormAjaxUrl(formId) {
  return formAjaxUrls[formId] || null;
}

// Função para gerar mensagem de sucesso baseada no tipo de formulário
function getSuccessMessage(formId) {
  if (formId.includes('periferico')) {
    return 'Periférico cadastrado com sucesso!';
  } else if (formId.includes('computador')) {
    return 'Computador cadastrado com sucesso!';
  } else if (formId.includes('sala')) {
    return 'Sala cadastrada com sucesso!';
  } else if (formId.includes('ilha')) {
    return 'Ilha cadastrada com sucesso!';
  } else if (formId.includes('pa')) {
    return 'Posição de Atendimento cadastrada com sucesso!';
  } else if (formId.includes('tipo')) {
    return 'Tipo de Periférico cadastrado com sucesso!';
  } else if (formId.includes('monitor')) {
    return 'Monitor cadastrado com sucesso!';
  } else if (formId.includes('coordenador')) {
    return 'Coordenador associado com sucesso!';
  } else if (formId.includes('email')) {
    return 'E-mail cadastrado com sucesso!';
  } else if (formId.includes('storm')) {
    return 'Storm cadastrado com sucesso!';
  } else if (formId.includes('sistema')) {
    return 'Sistema cadastrado com sucesso!';
  } else if (formId.includes('chip')) {
    return 'Chip cadastrado com sucesso!';
  }
  return 'Cadastrado com sucesso!';
}

// Função para verificar se um formulário deveria usar AJAX
function shouldUseAjax(formElement) {
  const $form = $(formElement);
  const formId = $form.attr('id') || '';
  const action = $form.attr('action') || '';
  
  // Verificar se o formulário está explicitamente marcado para não usar AJAX
  if ($form.attr('data-no-ajax') === 'true' || $form.hasClass('no-ajax')) {
    return false;
  }
  
  // Verificar se é um formulário de cadastro que deveria usar AJAX
  const isCadastroForm = (
    formId.includes('form') && (
      formId.includes('cadastro') || 
      formId.includes('cadastrar') || 
      formId.includes('create') ||
      $form.find('button[type="submit"]').text().toLowerCase().includes('cadastrar') ||
      $form.find('button[type="submit"]').text().toLowerCase().includes('salvar') ||
      $form.find('input[type="submit"]').val() && (
        $form.find('input[type="submit"]').val().toLowerCase().includes('cadastrar') ||
        $form.find('input[type="submit"]').val().toLowerCase().includes('salvar')
      )
    )
  );
  
  return isCadastroForm || formAjaxUrls[formId] || $form.hasClass('ajax-form') ||
         action.includes('/cadastrar/') || action.includes('/create/') || 
         $form.find('input[name*="cadastrar"], button[name*="cadastrar"]').length > 0;
}

// Função para processar resposta de erro AJAX
function parseAjaxError(xhr) {
  let errorMessage = 'Erro ao salvar. Tente novamente.';
  
  if (xhr.responseJSON && xhr.responseJSON.message) {
    errorMessage = xhr.responseJSON.message;
  } else if (xhr.responseText) {
    try {
      const errorData = JSON.parse(xhr.responseText);
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // Se não conseguir fazer parse, usar mensagem padrão
    }
  }
  
  return errorMessage;
}

// Função para enviar formulário via AJAX (movida do admin.js)
function submitFormAjax(form, successMessage) {
  const $form = $(form);
  const formData = new FormData(form);
  const action = $form.attr('action') || window.location.pathname;
  const method = $form.attr('method') || 'POST';
  
  // Desabilitar botão de submit durante envio
  const $submitBtn = $form.find('button[type="submit"], input[type="submit"]');
  const originalText = $submitBtn.text() || $submitBtn.val();
  
  // Função para restaurar botão
  const restoreButton = () => {
    $submitBtn.prop('disabled', false);
    if ($submitBtn.is('button')) {
      $submitBtn.text(originalText);
    } else {
      $submitBtn.val(originalText);
    }
  };
  
  if ($submitBtn.is('button')) {
    $submitBtn.prop('disabled', true).text('Salvando...');
  } else {
    $submitBtn.prop('disabled', true).val('Salvando...');
  }
  
  $.ajax({
    url: action,
    type: method,
    data: formData,
    processData: false,
    contentType: false,
    success: function(response) {
      // Mostrar mensagem de sucesso
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('success', successMessage || 'Salvo com sucesso!');
      }
      
      // Limpar formulário
      $form[0].reset();
      
      // Atualizar dropdowns se necessário
      if (window.TIAdminDropdowns) {
        window.TIAdminDropdowns.updateAdminDropdowns();
      }
      
      // Fechar modal se estiver em um
      const $modal = $form.closest('.modal');
      if ($modal.length && $modal.modal) {
        $modal.modal('hide');
      }
    },
    error: function(xhr, status, error) {
      const errorMessage = parseAjaxError(xhr);
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', errorMessage);
      }
      console.error('Erro no formulário:', error);
    },
    complete: function() {
      // Reabilitar botão
      setTimeout(restoreButton, 100);
    }
  });
}

// Função para enviar formulário via AJAX com URL específica (movida do admin.js)
function submitFormAjaxCustom(form, ajaxUrl, successMessage) {
  const $form = $(form);
  const formData = new FormData(form);
  
  // Desabilitar botão de submit durante envio
  const $submitBtn = $form.find('button[type="submit"], input[type="submit"]');
  const originalText = $submitBtn.text() || $submitBtn.val();
  
  // Função para restaurar botão
  const restoreButton = () => {
    $submitBtn.prop('disabled', false);
    if ($submitBtn.is('button')) {
      $submitBtn.text(originalText);
    } else {
      $submitBtn.val(originalText);
    }
  };
  
  if ($submitBtn.is('button')) {
    $submitBtn.prop('disabled', true).text('Salvando...');
  } else {
    $submitBtn.prop('disabled', true).val('Salvando...');
  }
  
  $.ajax({
    url: ajaxUrl,
    type: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    success: function(response) {
      if (response.success) {
        // Mostrar mensagem de sucesso
        if (window.TIAdminNotifications) {
          window.TIAdminNotifications.showAdminNotification('success', response.message || successMessage);
        }
        
        // Limpar formulário
        $form[0].reset();
        
        // Atualizar dropdowns se necessário
        if (window.TIAdminDropdowns) {
          window.TIAdminDropdowns.updateAdminDropdowns();
        }
        
        // Fechar modal se estiver em um
        const $modal = $form.closest('.modal');
        if ($modal.length && $modal.modal) {
          $modal.modal('hide');
        }
      } else {
        if (window.TIAdminNotifications) {
          window.TIAdminNotifications.showAdminNotification('error', response.message || 'Erro ao salvar.');
        }
      }
    },
    error: function(xhr, status, error) {
      const errorMessage = parseAjaxError(xhr);
      
      if (window.TIAdminNotifications) {
        window.TIAdminNotifications.showAdminNotification('error', errorMessage);
      }
      console.error('Erro no formulário:', error);
    },
    complete: function() {
      // Reabilitar botão
      setTimeout(restoreButton, 100);
    }
  });
}

// Expor funções AJAX globalmente
window.submitFormAjax = submitFormAjax;
window.submitFormAjaxCustom = submitFormAjaxCustom;

// Exportar funções para uso global
window.TIAdminUtils = {
  // Funções básicas
  getSelectedLojaAdmin: getSelectedLojaAdmin,
  adjustAdminWidths: adjustAdminWidths,
  initAdminBehaviors: initAdminBehaviors,
  
  // Funções de carregamento de dados (centralizadas)
  carregarIlhasPorSala: carregarIlhasPorSala,
  carregarPAsPorIlha: carregarPAsPorIlha,
  carregarSalasPorLoja: carregarSalasPorLoja,
  
  // Funções de validação (centralizadas)
  validarFormatoRamal: validarFormatoRamal,
  verificarRamalExistente: verificarRamalExistente,
  validateAdminRamalForm: validateAdminRamalForm,
  validateAdminComputadorForm: validateAdminComputadorForm,
  setupConditionalFields: setupConditionalFields,
  
  // Funções de formulários
  toggleSubmitButton: toggleSubmitButton,
  getFormAjaxUrl: getFormAjaxUrl,
  getSuccessMessage: getSuccessMessage,
  shouldUseAjax: shouldUseAjax,
  parseAjaxError: parseAjaxError,
  submitFormAjax: submitFormAjax,
  submitFormAjaxCustom: submitFormAjaxCustom
};