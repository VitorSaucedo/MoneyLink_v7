/**
 * admin_dropdown_updates.js - Sistema de atualização de dropdowns para páginas de administração do TI
 * 
 * Funções para atualizar dropdowns dinamicamente nas funcionalidades de administração
 */

// Função para atualizar dropdowns após cadastros nas páginas de admin
function updateAdminDropdowns() {
  const lojaId = window.TIAdminUtils ? window.TIAdminUtils.getSelectedLojaAdmin() : (
    $('select[name="loja"]').val() || 
    $('#loja_selecionada').val() || 
    $('[data-loja-id]').data('loja-id') || 
    new URLSearchParams(window.location.search).get('loja')
  );
  
  // Atualizar lista de salas (específico para admin)
  if ($('#sala, #sala_em_uso, select[name="sala"]').length > 0) {
    updateAdminSalasDropdown(lojaId);
  }
  
  // Atualizar lista de periféricos disponíveis para cadastro
  if ($('select[name="periferico"], #periferico').length > 0) {
    updateAdminPerifericosDropdown(lojaId);
  }
  
  // Atualizar lista de computadores disponíveis para atribuição
  if ($('select[name="computador"], #computador').length > 0) {
    updateAdminComputadoresDropdown(lojaId);
  }
  
  // Atualizar lista de monitores disponíveis para atribuição
  if ($('select[name="monitor"], #monitor').length > 0) {
    updateAdminMonitoresDropdown(lojaId);
  }
}

// Função para atualizar dropdown de salas nas páginas de admin
function updateAdminSalasDropdown(lojaId) {
  const $salaSelect = $('select[name="sala"]');
  
  if (window.TIAdminUtils && window.TIAdminUtils.carregarSalasPorLoja) {
    window.TIAdminUtils.carregarSalasPorLoja(lojaId, $salaSelect);
  } else {
    // Fallback para compatibilidade
    if (!lojaId) {
      $salaSelect.empty().append('<option value="">-- Selecione uma Sala --</option>');
      return;
    }
    
    $.ajax({
      url: '/ti/api/salas-por-loja/',
      type: 'GET',
      data: {
        loja_id: lojaId
      },
      dataType: 'json',
      success: function(response) {
        $salaSelect.empty().append('<option value="">-- Selecione uma Sala --</option>');
        
        if (response.success && response.data && response.data.length > 0) {
          $.each(response.data, function(index, sala) {
            $salaSelect.append(`<option value="${sala.id}">${sala.nome}</option>`);
          });
        }
      },
      error: function(xhr, status, error) {
        console.error('Erro ao carregar salas:', error);
        $salaSelect.empty().append('<option value="">-- Erro ao carregar salas --</option>');
      }
    });
  }
}

// Função para atualizar dropdown de periféricos disponíveis
function updateAdminPerifericosDropdown(lojaId) {
  $.ajax({
    url: '/ti/api/listar-perifericos/',
    type: 'GET',
    data: { 
      status: 'disponivel,manutencao', 
      loja: lojaId,
      per_page: 100 
    },
    success: function(response) {
      if (response.success && response.data) {
        const $selects = $('select[name="periferico"], #periferico');
        $selects.each(function() {
          const $select = $(this);
          const currentVal = $select.val();
          $select.find('option:not(:first)').remove();
          
          $.each(response.data, function(index, periferico) {
            $select.append(`<option value="${periferico.id}">${periferico.tipo.nome} - ${periferico.marca} ${periferico.modelo}</option>`);
          });
          
          if (currentVal) {
            $select.val(currentVal);
          }
        });
      }
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar periféricos para admin:', error);
    }
  });
}

// Função para atualizar dropdown de computadores disponíveis
function updateAdminComputadoresDropdown(lojaId) {
  $.ajax({
    url: '/ti/api/computadores-disponiveis/',
    type: 'GET',
    data: { loja: lojaId },
    success: function(response) {
      if (response.success && response.computadores) {
        const $selects = $('select[name="computador"], #computador');
        $selects.each(function() {
          const $select = $(this);
          const currentVal = $select.val();
          $select.find('option:not(:first)').remove();
          
          $.each(response.computadores, function(index, computador) {
            $select.append(`<option value="${computador.id}">${computador.marca}</option>`);
          });
          
          if (currentVal) {
            $select.val(currentVal);
          }
        });
      }
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar computadores para admin:', error);
    }
  });
}

// Função para atualizar dropdown de monitores disponíveis
function updateAdminMonitoresDropdown(lojaId) {
  $.ajax({
    url: '/ti/api/monitores-disponiveis/',
    type: 'GET',
    data: { loja: lojaId },
    success: function(response) {
      if (response.success && response.monitores) {
        const $selects = $('select[name="monitor"], #monitor');
        $selects.each(function() {
          const $select = $(this);
          const currentVal = $select.val();
          $select.find('option:not(:first)').remove();
          
          $.each(response.monitores, function(index, monitor) {
            $select.append(`<option value="${monitor.id}">${monitor.marca} (${monitor.tamanho})</option>`);
          });
          
          if (currentVal) {
            $select.val(currentVal);
          }
        });
      }
    },
    error: function(xhr, status, error) {
      console.error('Erro ao carregar monitores para admin:', error);
    }
  });
}

// Função para carregar PAs por ilha (movida do admin.js)
function carregarPAsPorIlha(ilhaId, targetSelect, lojaId) {
  const $paSelect = $('#pa_em_uso, select[name="pa"], select[name="pa_em_uso"]');
  
  if (window.TIAdminUtils && window.TIAdminUtils.carregarPAsPorIlha) {
    window.TIAdminUtils.carregarPAsPorIlha(ilhaId, $paSelect, lojaId);
  } else {
    // Fallback para compatibilidade
    if (!ilhaId) {
      $paSelect.empty().append('<option value="">-- Selecione uma PA --</option>');
      return;
    }
    
    const requestData = {
      ilha: ilhaId,
      per_page: 100
    };
    
    if (lojaId) {
      requestData.loja = lojaId;
    }
    
    $.ajax({
      url: '/ti/api/listar-posicoes-atendimento/',
      type: 'GET',
      data: requestData,
      dataType: 'json',
      success: function(response) {
        $paSelect.empty().append('<option value="">-- Selecione uma PA --</option>');
        
        if (response.success && response.data && response.data.length > 0) {
          $.each(response.data, function(index, pa) {
            $paSelect.append(`<option value="${pa.id}">PA ${pa.numero}</option>`);
          });
        } else {
          $paSelect.append('<option value="">-- Nenhuma PA disponível --</option>');
        }
      },
      error: function(xhr, status, error) {
        console.error('Erro ao carregar PAs:', error);
        $paSelect.empty().append('<option value="">-- Erro ao carregar PAs --</option>');
      }
    });
  }
}

// Função para obter informações detalhadas de uma ilha
function obterInfoIlha(ilhaId, callback) {
  console.log('🌐 obterInfoIlha chamada para ilha:', ilhaId);
  
  if (!ilhaId) {
    console.log('❌ ID da ilha não fornecido');
    if (callback) callback(null);
    return;
  }
  
  const url = '/ti/api/ilha-info/' + ilhaId + '/';
  console.log('📡 Fazendo requisição para:', url);
  
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json',
    success: function(data) {
      console.log('✅ Resposta recebida da API:', data);
      if (callback) callback(data);
    },
    error: function(xhr, status, error) {
      console.error('❌ Erro na requisição AJAX:', {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText,
        error: error
      });
      if (callback) callback(null);
    }
  });
}

// Função para atualizar informações de quantidade de PAs baseada na ilha selecionada (movida do admin.js)
function atualizarQuantidadePAs(ilhaId, $quantidadePasInput, $infoText) {
  console.log('🔄 atualizarQuantidadePAs chamada com ilhaId:', ilhaId);
  
  if (!ilhaId) {
    // Se nenhuma ilha selecionada, limitar para 1
    $quantidadePasInput.attr('max', 1);
    $quantidadePasInput.val(1);
    if ($infoText && $infoText.length) {
      $infoText.text('Selecione uma ilha para ver o máximo disponível');
    }
    console.log('❌ Nenhuma ilha selecionada');
    return;
  }
  
  // Mostrar loading
  if ($infoText && $infoText.length) {
    $infoText.text('Carregando informações da ilha...');
  }
  
  // Obter informações detalhadas da ilha
  obterInfoIlha(ilhaId, function(data) {
    console.log('📊 Resposta da API ilha-info:', data);
    
    if (data && data.success && data.ilha) {
      const capacidadeDisponivel = data.ilha.pas_disponiveis !== undefined ? data.ilha.pas_disponiveis : 1;
      console.log('✅ PAs disponíveis:', capacidadeDisponivel);
      
      $quantidadePasInput.attr('max', capacidadeDisponivel);
      $quantidadePasInput.val(Math.min($quantidadePasInput.val() || 1, capacidadeDisponivel));
      
      // Atualizar texto informativo
      if ($infoText && $infoText.length) {
        $infoText.text('Máximo disponível: ' + capacidadeDisponivel + ' PAs');
      }
    } else {
      console.error('❌ Erro ao obter informações da ilha:', ilhaId, data);
      $quantidadePasInput.attr('max', 1);
      $quantidadePasInput.val(1);
      if ($infoText && $infoText.length) {
        $infoText.text('Erro ao carregar informações da ilha');
      }
    }
  });
}

// Exportar funções para uso global
window.TIAdminDropdowns = {
  updateAdminDropdowns: updateAdminDropdowns,
  updateAdminSalasDropdown: updateAdminSalasDropdown,
  updateAdminPerifericosDropdown: updateAdminPerifericosDropdown,
  updateAdminComputadoresDropdown: updateAdminComputadoresDropdown,
  updateAdminMonitoresDropdown: updateAdminMonitoresDropdown,
  carregarPAsPorIlha: carregarPAsPorIlha,
  obterInfoIlha: obterInfoIlha,
  atualizarQuantidadePAs: atualizarQuantidadePAs
};