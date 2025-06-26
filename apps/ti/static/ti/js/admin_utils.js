/**
 * admin_utils.js - Utilitários específicos para funcionalidades de administração do TI
 * 
 * Funções auxiliares e utilitários específicos para as páginas de administração
 */

// Função utilitária para obter a loja selecionada (específica para admin)
function getSelectedLojaAdmin() {
  return $('select[name="loja"]').val() || 
         $('#loja_selecionada').val() || 
         $('[data-loja-id]').data('loja-id') || 
         new URLSearchParams(window.location.search).get('loja');
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

// Função para validar formato de ramal
function validarFormatoRamal(ramal) {
  return /^\d{4}$/.test(ramal);
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
  getSelectedLojaAdmin: getSelectedLojaAdmin,
  adjustAdminWidths: adjustAdminWidths,
  initAdminBehaviors: initAdminBehaviors,
  carregarIlhasPorSala: carregarIlhasPorSala,
  validarFormatoRamal: validarFormatoRamal,
  toggleSubmitButton: toggleSubmitButton,
  getFormAjaxUrl: getFormAjaxUrl,
  getSuccessMessage: getSuccessMessage,
  shouldUseAjax: shouldUseAjax,
  parseAjaxError: parseAjaxError,
  formAjaxUrls: formAjaxUrls
};