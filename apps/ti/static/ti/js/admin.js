/**
 * admin.js - Módulo de administração do TI
 * 
 * Este arquivo contém as funcionalidades principais para a página de administração do TI:
 * - Sistema de formulários AJAX
 * - Carregamento dinâmico de ilhas por sala selecionada
 * - Validação de formulários (especialmente ramais)
 * - Campos condicionais no cadastro de computador
 * 
 * DEPENDÊNCIAS:
 * - admin_utils.js (funções utilitárias específicas de admin)
 * - admin_notifications.js (sistema de notificações de admin)
 * - admin_dropdown_updates.js (atualização de dropdowns de admin)
 */

// Função auxiliar para compatibilidade (caso admin_utils.js não esteja carregado)
function getSelectedLoja() {
  return window.TIAdminUtils ? window.TIAdminUtils.getSelectedLojaAdmin() : 
         ($('select[name="loja"]').val() || 
          $('#loja_selecionada').val() || 
          $('[data-loja-id]').data('loja-id') || 
          new URLSearchParams(window.location.search).get('loja'));
}

$(document).ready(function() {
  console.log('🚀 Inicializando admin.js');
  
  // =============================
  // Verificação de Dependências e Elementos DOM
  // =============================
  console.log('🔍 Verificando dependências disponíveis:', {
    TIAdminUtils: !!window.TIAdminUtils,
    TIAdminNotifications: !!window.TIAdminNotifications,
    TIAdminDropdowns: !!window.TIAdminDropdowns,
    jQuery: !!window.jQuery,
    version: window.jQuery ? window.jQuery.fn.jquery : 'N/A'
  });

  // =============================
  // Nota: As funcionalidades principais de admin foram movidas para módulos especializados:
  // - admin_utils.js: funções utilitárias e AJAX
  // - admin_init.js: inicialização e interceptação de formulários
  // - admin_notifications.js: sistema de notificações
  // - admin_dropdown_updates.js: atualização de dropdowns
  // =============================

  // =============================
  // Ajustes de Layout Responsivo
  // =============================
  
  // Executar ajustes de largura no carregamento e redimensionamento
  const adjustWidths = window.TIAdminUtils ? window.TIAdminUtils.adjustAdminWidths : function() {
    const containerWidth = $('.container').width();
    const maxElementWidth = Math.min(containerWidth - 30, 1140);
    
    // Ajustar largura dos botões
    $('.btn-listagem').each(function() {
      $(this).css('maxWidth', '100%');
    });
  };
  
  adjustWidths();
  $(window).on('resize', adjustWidths);
  
  // ======================================
  // Lógica para Associação de Ramal
  // ======================================
  
  // Aguardar um pouco para garantir que o DOM esteja completamente carregado
  setTimeout(function() {
    const btnAssociarRamal = document.getElementById('btn-associar-ramal');
    const formAssociarRamal = document.getElementById('form-associar-ramal');
    const selectFuncionario = document.getElementById('select-funcionario-ramal');
    const inputRamal = document.getElementById('input-ramal-numero');
    
    console.log('🔍 Verificando elementos do formulário de associar ramal:', {
      btnAssociarRamal: !!btnAssociarRamal,
      formAssociarRamal: !!formAssociarRamal,
      selectFuncionario: !!selectFuncionario,
      inputRamal: !!inputRamal,
      totalFuncionarios: selectFuncionario ? selectFuncionario.options.length - 1 : 0
    });

    if (btnAssociarRamal && formAssociarRamal && selectFuncionario && inputRamal) {
      console.log('✅ Todos os elementos encontrados, configurando evento do botão');
      
      // Remover qualquer listener anterior para evitar duplicação
      btnAssociarRamal.removeEventListener('click', handleAssociarRamal);
      
      // Função para lidar com o clique do botão
      function handleAssociarRamal() {
        console.log('🔄 Botão Associar Ramal clicado');
        
        const funcionarioId = selectFuncionario.value;
        const ramalNumero = inputRamal.value;

        console.log('📋 Dados do formulário:', {
          funcionarioId: funcionarioId,
          ramalNumero: ramalNumero
        });

        if (!funcionarioId || !ramalNumero) {
          alert('Por favor, selecione um funcionário e digite um ramal.');
          return;
        }
        
        if (!/^\d{4}$/.test(ramalNumero)) {
          alert('O ramal deve conter exatamente 4 dígitos numéricos.');
          return;
        }

        // Obter token CSRF
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        // Desabilitar botão durante a requisição
        btnAssociarRamal.disabled = true;
        btnAssociarRamal.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Associando...';

        console.log('🚀 Enviando requisição para associar ramal');

        fetch('/ti/api/associar-ramal-funcionario/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
              funcionario_id: funcionarioId,
              ramal_numero: ramalNumero
            })
          })
          .then(response => {
            console.log('📥 Resposta recebida:', response.status);
            return response.json();
          })
          .then(data => {
            console.log('📊 Dados da resposta:', data);
            
            if (data.success) {
              alert(data.message);
              // Remove o funcionário da lista e limpa os campos
              const optionToRemove = selectFuncionario.querySelector(`option[value="${funcionarioId}"]`);
              if (optionToRemove) {
                optionToRemove.remove();
              }
              selectFuncionario.value = '';
              inputRamal.value = '';
            } else {
              alert('Erro: ' + data.error);
            }
          })
          .catch(error => {
            console.error('❌ Erro na requisição:', error);
            alert('Ocorreu um erro de comunicação com o servidor.');
          })
          .finally(() => {
            // Reabilitar botão
            btnAssociarRamal.disabled = false;
            btnAssociarRamal.innerHTML = '<i class="bx bx-link-alt"></i> Associar Ramal';
          });
      }
      
      // Adicionar o event listener
      btnAssociarRamal.addEventListener('click', handleAssociarRamal);
      
    } else {
      console.warn('⚠️ Elementos do formulário de associar ramal não encontrados');
    }
  }, 500); // Aguardar 500ms para garantir que tudo carregou
  
  // ===============================
  // Carregamento de Ilhas por Sala
  // ===============================
  
    const $salaSelect = $('#sala');
  const $ilhaSelect = $('#ilha');
  const $quantidadePasInput = $('#quantidade_pas');
  const ilhasInfo = {}; // Armazena informações das ilhas
  
  // Função removida - agora usa TIAdminUtils.carregarIlhasPorSala
  
  if ($salaSelect.length && $ilhaSelect.length) {
    // Evento de mudança na seleção de sala (usando função centralizada)
    $salaSelect.off('change.ilhas').on('change.ilhas', function() {
      const salaId = $(this).val();
      
      if (window.TIAdminUtils && window.TIAdminUtils.carregarIlhasPorSala) {
        window.TIAdminUtils.carregarIlhasPorSala(salaId, $ilhaSelect);
      } else {
        $ilhaSelect.empty().html('<option value="">-- Selecione uma Ilha --</option>');
      }
    });
    
    // Atualizar valor máximo do campo quantidade com base na ilha selecionada
    if ($ilhaSelect.length && $quantidadePasInput.length) {
      console.log('🎯 Configurando evento change para ilha. Elementos encontrados:', {
        ilhaSelect: $ilhaSelect.length,
        quantidadePasInput: $quantidadePasInput.length
      });
      
      $ilhaSelect.on('change', function() {
        const ilhaId = $(this).val();
        const $infoText = $('#quantidade-pas-info');
        
        console.log('🔄 Evento change da ilha disparado. ID:', ilhaId);
        console.log('📍 Elemento info encontrado:', $infoText.length);
        
        // Usar função do módulo de dropdowns para atualizar informações
        if (window.TIAdminDropdowns && window.TIAdminDropdowns.atualizarQuantidadePAs) {
          console.log('✅ Módulo TIAdminDropdowns disponível, chamando atualizarQuantidadePAs');
          window.TIAdminDropdowns.atualizarQuantidadePAs(ilhaId, $quantidadePasInput, $infoText);
        } else {
          console.error('❌ Módulo TIAdminDropdowns não disponível:', {
            TIAdminDropdowns: !!window.TIAdminDropdowns,
            atualizarQuantidadePAs: !!(window.TIAdminDropdowns && window.TIAdminDropdowns.atualizarQuantidadePAs)
          });
        }
      });
    } else {
      console.warn('⚠️ Elementos não encontrados para configurar evento de ilha:', {
        ilhaSelect: $ilhaSelect.length,
        quantidadePasInput: $quantidadePasInput.length
      });
    }
  }

  // ==============================================
  // Formulário de Cadastro de E-mail
  // ==============================================
  
  // Atualizar campos automaticamente quando funcionário for selecionado
  $('#email_funcionario').on('change', function() {
    const funcionarioId = $(this).val();
    
    if (funcionarioId) {
      // Aqui você pode fazer uma requisição AJAX para buscar dados do funcionário
      // Por enquanto, vamos apenas indicar que os campos serão preenchidos automaticamente
      console.log('Funcionário selecionado:', funcionarioId);
      console.log('Ramal e setor serão atribuídos automaticamente no backend');
    }
  });
  
  $('#form-email').on('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const submitBtn = $(this).find('button[type="submit"]');
    const originalText = submitBtn.html();
    
    // Desabilitar botão e mostrar loading
    submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Salvando...');
    
    $.ajax({
      url: '/ti/api/ajax/email/cadastrar/',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function(response) {
        if (response.success) {
          // Mostrar mensagem de sucesso
          if (window.TIAdminNotifications && window.TIAdminNotifications.showSuccess) {
            window.TIAdminNotifications.showSuccess(response.message);
          } else {
            alert(response.message);
          }
          
          // Limpar formulário
          $('#form-email')[0].reset();
          
          // Atualizar dropdowns se disponível
          if (window.TIAdminDropdowns && window.TIAdminDropdowns.atualizarDropdownsEmail) {
            window.TIAdminDropdowns.atualizarDropdownsEmail();
          }
        } else {
          // Mostrar mensagem de erro
          if (window.TIAdminNotifications && window.TIAdminNotifications.showError) {
            window.TIAdminNotifications.showError(response.message);
          } else {
            alert('Erro: ' + response.message);
          }
        }
      },
      error: function(xhr, status, error) {
        const errorMsg = 'Erro ao cadastrar e-mail: ' + error;
        if (window.TIAdminNotifications && window.TIAdminNotifications.showError) {
          window.TIAdminNotifications.showError(errorMsg);
        } else {
          alert(errorMsg);
        }
      },
      complete: function() {
        // Reabilitar botão
        submitBtn.prop('disabled', false).html(originalText);
      }
    });
  });

  // ==============================================
  // Campos condicionais no cadastro de computador
  // ==============================================
  const $statusComputador = $('#status_computador');
  const $camposEmUso = $('#campos_em_uso');
  const $camposManutencao = $('#campos_manutencao');
  const $salaEmUso = $('#sala_em_uso');
  const $ilhaEmUso = $('#ilha_em_uso');
  const $paEmUso = $('#pa_em_uso');
  const $obsManutencao = $('#observacoes_manutencao');
  const $formComputador = $statusComputador.closest('form');

  // Atualizar visibilidade dos campos com base no status selecionado
  if ($statusComputador.length) {
    // Função para atualizar campos condicionais
    function atualizarCamposCondicionais() {
      const status = $statusComputador.val();
      
      // Esconder todos os campos condicionais primeiro
      $('.campos-condicionais').hide();
      
      // Resetar validação visual
      $paEmUso.removeClass('is-invalid');
      $obsManutencao.removeClass('is-invalid');
      
      if (status === 'em_uso') {
        // Mostrar campos para "Em Uso"
        $camposEmUso.show();
        
        // Tornar PA obrigatória quando status é "Em Uso"
        $paEmUso.prop('required', true);
        $obsManutencao.prop('required', false);
      } else if (status === 'manutencao') {
        // Mostrar campos para "Em Manutenção"
        $camposManutencao.show();
        
        // Tornar observações de manutenção obrigatórias
        $obsManutencao.prop('required', true);
        $paEmUso.prop('required', false);
      } else {
        // Para outros status, nenhum campo condicional é obrigatório
        $paEmUso.prop('required', false);
        $obsManutencao.prop('required', false);
      }
    }
    
    // Atualizar ao carregar a página
    atualizarCamposCondicionais();
    
    // Atualizar quando o status mudar
    $statusComputador.on('change', atualizarCamposCondicionais);
    
    // Validação do formulário de computadores antes do envio
    if ($formComputador.length) {
      $formComputador.on('submit', function(e) {
        const status = $statusComputador.val();
        
        if (status === 'em_uso') {
          // Verificar se uma PA foi selecionada
          if (!$paEmUso.val()) {
            e.preventDefault();
            $paEmUso.addClass('is-invalid');
            
            // Se sala ou ilha não foram selecionadas, mostrar feedback
            if (!$salaEmUso.val()) {
              $salaEmUso.addClass('is-invalid');
              alert('Selecione uma sala para associar o computador em uso.');
            } else if (!$ilhaEmUso.val()) {
              $ilhaEmUso.addClass('is-invalid');
              alert('Selecione uma ilha para associar o computador em uso.');
            } else {
              alert('Selecione uma Posição de Atendimento (PA) para associar o computador em uso.');
            }
            return false;
          }
        } else if (status === 'manutencao') {
          // Verificar se foram fornecidas observações de manutenção
          if (!$obsManutencao.val().trim()) {
            e.preventDefault();
            $obsManutencao.addClass('is-invalid');
            alert('Informe o motivo da manutenção para o computador.');
            return false;
          }
        }
        
        return true;
      });
    }
    
    // Carregar ilhas quando a sala for selecionada (para o caso de "Em Uso")
    $salaEmUso.off('change.ilhas-em-uso').on('change.ilhas-em-uso', function() {
      const salaId = $(this).val();
      
      // Limpar validação visual
      $(this).removeClass('is-invalid');
      
      // Limpar e resetar dropdowns dependentes
      $ilhaEmUso.empty().html('<option value="">-- Selecione uma Ilha --</option>');
      $paEmUso.empty().html('<option value="">-- Primeiro selecione uma ilha --</option>');
      
      if (!salaId) return;
      
      // Usar função centralizada para carregar ilhas
      if (window.TIAdminUtils && window.TIAdminUtils.carregarIlhasPorSala) {
        window.TIAdminUtils.carregarIlhasPorSala(salaId, $ilhaEmUso);
      }
    });
    
          // Carregar PAs quando a ilha for selecionada
    $ilhaEmUso.off('change.pas').on('change.pas', function() {
      const ilhaId = $(this).val();
      
      // Limpar validação visual
      $(this).removeClass('is-invalid');
      
      if (!ilhaId) return;
      
      // Obter loja selecionada se houver
      const lojaId = getSelectedLoja();
      
      // Usar função centralizada para carregar PAs
      if (window.TIAdminUtils && window.TIAdminUtils.carregarPAsPorIlha) {
        window.TIAdminUtils.carregarPAsPorIlha(ilhaId, $paEmUso, lojaId);
      }
    });
    
    // Limpar validação quando o usuário interage com o campo de observações
    $obsManutencao.on('input', function() {
      $(this).removeClass('is-invalid');
    });
    
    // Limpar validação quando o usuário seleciona uma PA
    $paEmUso.on('change', function() {
      $(this).removeClass('is-invalid');
    });
  }

  // =============================
  // Validação do formulário Ramal
  // =============================
  
  const $formRamal = $('#form-ramal');
  const $ramalInput = $('#numero_ramal');
  const $funcionarioSelect = $('#funcionario_ramal');
  const $ramalFeedback = $('#ramal-feedback');
  const $submitButton = $formRamal.length ? $formRamal.find('button[type="submit"]') : null;

  if ($formRamal.length && $ramalInput.length && $funcionarioSelect.length && $submitButton && $submitButton.length) {
    // Função para ativar/desativar o botão de envio (usando módulo utilitário)
    const toggleSubmitButton = function(isValid) {
      if (window.TIAdminUtils && window.TIAdminUtils.toggleSubmitButton) {
        window.TIAdminUtils.toggleSubmitButton($submitButton, isValid);
        
        // Adicionar classes específicas de estilo
        if (isValid) {
          $submitButton.removeClass('btn-secondary').addClass('btn-primary');
        } else {
          $submitButton.removeClass('btn-primary').addClass('btn-secondary');
        }
      } else {
        // Fallback
        if (isValid) {
          $submitButton.prop('disabled', false).removeClass('btn-secondary').addClass('btn-primary');
        } else {
          $submitButton.prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary');
        }
      }
    };

    // Função para verificar se o ramal já existe (usando módulo centralizado)
    const verificarRamalExistente = function() {
      const ramal = $ramalInput.val().trim();
      const funcionarioId = $funcionarioSelect.val();
      
      // Limpar estados anteriores
      $ramalInput.removeClass('is-invalid is-valid');
      $ramalFeedback.hide().text('');
      
      // Validação básica usando módulo utilitário
      if (!ramal || !funcionarioId || 
          (window.TIAdminUtils && !window.TIAdminUtils.validarFormatoRamal(ramal))) {
        toggleSubmitButton(false);
        return;
      }

      // Usar função centralizada se disponível
      if (window.TIAdminUtils && window.TIAdminUtils.verificarRamalExistente) {
        window.TIAdminUtils.verificarRamalExistente(ramal, funcionarioId)
          .then(function(data) {
            if (data.existe === true) {
              $ramalInput.addClass('is-invalid');
              $ramalFeedback.text('Este ramal já está atribuído ao funcionário ' + data.funcionario_nome);
              $ramalFeedback.show();
              toggleSubmitButton(false);
            } else {
              $ramalInput.addClass('is-valid');
              toggleSubmitButton(true);
            }
          })
          .catch(function(error) {
            console.error('Erro ao verificar ramal:', error);
            toggleSubmitButton(true);
          });
        return;
      }

      // Fallback para compatibilidade
      $ramalInput.addClass('is-loading');
      toggleSubmitButton(false);
      
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
          $ramalInput.removeClass('is-loading');
          
          if (data.existe === true) {
            $ramalInput.addClass('is-invalid');
            $ramalFeedback.text('Este ramal já está atribuído ao funcionário ' + data.funcionario_nome);
            $ramalFeedback.show();
            toggleSubmitButton(false);
          } else {
            $ramalInput.addClass('is-valid');
            toggleSubmitButton(true);
          }
        },
        error: function(xhr, status, error) {
          console.error('Erro ao verificar ramal:', error);
          $ramalInput.removeClass('is-loading');
          toggleSubmitButton(true);
        }
      });
    };

    // Inicialmente, desabilitar o botão
    toggleSubmitButton(false);

    // Validar ramal durante digitação
    $ramalInput.on('input', function() {
      // Limpar feedback anterior
      $ramalFeedback.text('');
      $ramalInput.removeClass('is-invalid is-valid');
      $ramalFeedback.hide();
      
      const ramal = $(this).val().trim();
      
      // Validação de formato (apenas dígitos)
      if (ramal.length > 0 && !/^\d+$/.test(ramal)) {
        $ramalFeedback.text('O ramal deve conter apenas dígitos numéricos.');
        $ramalInput.addClass('is-invalid');
        $ramalFeedback.show();
        toggleSubmitButton(false);
        return;
      }
      
      // Verificar apenas quando tiver 4 dígitos exatos
      if (ramal.length === 4 && /^\d{4}$/.test(ramal) && $funcionarioSelect.val()) {
        // Verificar após pequeno delay para evitar muitas requisições
        if (window.ramalTimeoutId) {
          clearTimeout(window.ramalTimeoutId);
        }
        window.ramalTimeoutId = setTimeout(verificarRamalExistente, 500);
      } else {
        toggleSubmitButton(false);
      }
    });
    
    // Verificar quando o select de funcionário mudar
    $funcionarioSelect.on('change', function() {
      if ($ramalInput.val().trim().length === 4) {
        verificarRamalExistente();
      } else {
        toggleSubmitButton(false);
      }
    });
    
    // Verificar quando o campo de ramal perder o foco
    $ramalInput.on('blur', function() {
      const ramal = $(this).val().trim();
      if (ramal.length === 4 && /^\d{4}$/.test(ramal)) {
        verificarRamalExistente();
      }
    });

    // Verificar ramal no submit do formulário (verificação final)
    $formRamal.on('submit', function(e) {
      e.preventDefault();
      
      const ramal = $ramalInput.val().trim();
      const funcionarioId = $funcionarioSelect.val();
      
      // Validação básica
      if (!ramal || !funcionarioId) {
        if (!ramal) {
          $ramalFeedback.text('Por favor, digite um ramal.');
          $ramalInput.addClass('is-invalid');
          $ramalFeedback.show();
        }
        toggleSubmitButton(false);
        return;
      }
      
      // Validação de formato
      if (!/^\d{4}$/.test(ramal)) {
        $ramalFeedback.text('O ramal deve ter exatamente 4 dígitos numéricos.');
        $ramalInput.addClass('is-invalid');
        toggleSubmitButton(false);
        return;
      }

      // Se já estiver marcado como inválido, não submete
      if ($ramalInput.hasClass('is-invalid')) {
        toggleSubmitButton(false);
        return;
      }

      // Verificação final antes do envio
      $.ajax({
        url: '/ti/api/verificar-ramal/',
        type: 'POST',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
          ramal: ramal,
          funcionario_id: funcionarioId
        }),
        contentType: 'application/json',
        success: function(data) {
          if (data.existe) {
            // Ramal já existe - não permite envio
            $ramalFeedback.text('Este ramal já está atribuído ao funcionário ' + data.funcionario_nome);
            $ramalInput.addClass('is-invalid');
            $ramalFeedback.show();
            toggleSubmitButton(false);
          } else {
            // Ramal disponível - permite envio
            toggleSubmitButton(true);
            $formRamal.off('submit').submit();
          }
        },
        error: function(error) {
          console.error('Erro ao verificar ramal:', error);
          // Em caso de erro, permite continuar com confirmação
          if (confirm('Ocorreu um erro ao verificar o ramal. Deseja continuar mesmo assim?')) {
            toggleSubmitButton(true);
            $formRamal.off('submit').submit();
          }
        }
      });
      return false;
    });
  }
});