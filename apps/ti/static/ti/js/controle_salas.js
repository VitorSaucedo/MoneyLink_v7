/**
 * controle_salas.js - Controlador principal do sistema de controle de salas
 * 
 * DEPENDÊNCIAS: controle_salas_carregamento.js, controle_salas_perifericos.js, 
 * controle_salas_funcionarios.js, controle_salas_manutencao.js, controle_salas_computadores.js
 */

// =============================================================================
// VARIÁVEIS GLOBAIS
// =============================================================================

// Função para obter configurações do Django template
function obterConfiguracoesDjango() {
  const container = document.querySelector('.container[data-usuario-restrito]');
  return {
    usuarioRestrito: container ? container.getAttribute('data-usuario-restrito') === 'true' : false
  };
}

// Inicializar variáveis globais
const DJANGO_CONFIG = obterConfiguracoesDjango();
window.usuarioRestrito = DJANGO_CONFIG.usuarioRestrito;

// =============================================================================
// CONFIGURAÇÕES E CONSTANTES
// =============================================================================

const CONFIG = {
  urls: {
    atualizarStatus: '/ti/api/atualizar-status-pa/'
  },
  classes: {
    salaTab: '#salas-tab .nav-link',
    ilhaTab: '.ilhas-tabs .nav-link',
    paCard: '.pa-card',
    paGrid: '.pa-grid-dual-column',
    statusIndicator: '.pa-status-indicator'
  },
  animation: {
    duration: 500,
    transitionClass: 'slider-wrapper'
  },
  timeouts: {
    autoRemoveMessage: 5000,
    layoutDelay: 100,
    animationBuffer: 50,
    reloadDelay: 300
  }
};

const TEMPLATES = {
  message: (tipo, mensagem, icon, alertClass) => `
    <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
      <i class="${icon} me-2"></i> ${mensagem}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`,

  statusMenu: `
    <div class="status-dropdown-menu" style="position: absolute; z-index: 1000; background-color: white; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 3px 10px rgba(0,0,0,0.2); padding: 8px 0; min-width: 160px;">
      <div class="status-option" style="padding: 8px 12px; display: flex; align-items: center; cursor: pointer;" data-status="ocupada">
        <span style="width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 10px; background-color: #0d6efd;"></span>
        <span style="font-size: 0.9rem; color: #333;">Ocupada</span>
      </div>
      <div class="status-option" style="padding: 8px 12px; display: flex; align-items: center; cursor: pointer;" data-status="manutencao">
        <span style="width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 10px; background-color: #ffc107;"></span>
        <span style="font-size: 0.9rem; color: #333;">Manutenção</span>
      </div>
      <div class="status-option" style="padding: 8px 12px; display: flex; align-items: center; cursor: pointer;" data-status="inativa">
        <span style="width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 10px; background-color: #dc3545;"></span>
        <span style="font-size: 0.9rem; color: #333;">Vazia</span>
      </div>
    </div>`,

  reloadButton: `
    <button class="btn btn-sm btn-outline-secondary btn-reload-sala" 
            style="position: absolute; right: 15px; top: 15px;"
            title="Recarregar dados desta sala">
      <i class="fas fa-sync-alt"></i> Atualizar
    </button>`
};

const MESSAGE_CONFIG = {
  success: { alertClass: 'alert-success', icon: 'fas fa-check-circle' },
  error: { alertClass: 'alert-danger', icon: 'fas fa-exclamation-circle' },
  warning: { alertClass: 'alert-warning', icon: 'fas fa-exclamation-triangle' },
  info: { alertClass: 'alert-info', icon: 'fas fa-info-circle' },
  default: { alertClass: 'alert-primary', icon: 'fas fa-info-circle' }
};

const STATUS_CONFIG = {
  livre: { 
    class: 'status-livre', 
    badgeClass: 'bg-success', 
    title: 'Livre', 
    text: 'Livre' 
  },
  ocupada: { 
    class: 'status-ocupada', 
    badgeClass: 'bg-primary', 
    title: 'Ocupada', 
    text: 'Ocupada' 
  },
  manutencao: { 
    class: 'status-manutencao', 
    badgeClass: 'bg-warning text-dark', 
    title: 'Em Manutenção', 
    text: 'Em Manutenção' 
  },
  inativa: { 
    class: 'status-inativa', 
    badgeClass: 'bg-danger', 
    title: 'Inativa', 
    text: 'Inativa' 
  }
};

// =============================================================================
// ESTADO GLOBAL
// =============================================================================

const STATE = {
  currentSalaId: null,
  currentIlhaIds: {},
  previousSalaId: null,
  previousIlhaIds: {}
};

// =============================================================================
// UTILITÁRIOS E FUNÇÕES AUXILIARES
// =============================================================================

function mostrarMensagem(mensagem, tipo) {
  try {
    const config = MESSAGE_CONFIG[tipo] || MESSAGE_CONFIG.default;
    const $messageContainer = $('#message-container');
    
    if (!$messageContainer.length) {
      console.warn('Container de mensagens não encontrado');
      return;
    }
    
    $messageContainer.empty();
    
    const messageHTML = TEMPLATES.message(tipo, mensagem, config.icon, config.alertClass);
    const $messageElement = $(messageHTML).appendTo($messageContainer);
    
    setTimeout(() => {
      try {
        if ($messageElement.length && $messageElement.alert) {
          $messageElement.alert('close');
        } else {
          $messageElement.fadeOut(300, function() { $(this).remove(); });
        }
      } catch (e) {
        console.warn('Erro ao fechar mensagem:', e);
        $messageElement.fadeOut(300, function() { $(this).remove(); });
      }
    }, CONFIG.timeouts.autoRemoveMessage);
  } catch (error) {
    console.error('Erro ao mostrar mensagem:', error);
  }
}

// Funções de animação removidas - usando transição fade simples

// =============================================================================
// SISTEMA DE ANIMAÇÕES E LAYOUT
// =============================================================================

function animateTabTransition(containerSelector, currentSelector, targetSelector, direction) {
  try {
    // Verificar se os seletores são válidos
    if (!currentSelector || currentSelector.includes('null') || currentSelector.includes('undefined')) {
      console.warn('Seletor de painel atual inválido:', currentSelector);
      return;
    }
    
    if (!targetSelector || targetSelector.includes('null') || targetSelector.includes('undefined')) {
      console.warn('Seletor de painel alvo inválido:', targetSelector);
      return;
    }
    
    const container = document.querySelector(containerSelector);
    const currentPane = document.querySelector(currentSelector);
    const targetPane = document.querySelector(targetSelector);
    
    if (!container) {
      console.error(`Container não encontrado: ${containerSelector}`);
      return;
    }
    
    if (!currentPane) {
      console.error(`Painel atual não encontrado: ${currentSelector}`);
      return;
    }
    
    if (!targetPane) {
      console.error(`Painel alvo não encontrado: ${targetSelector}`);
      return;
    }
    
    // Transição simples com fade para evitar problemas de largura
    currentPane.style.opacity = '1';
    targetPane.style.opacity = '0';
    targetPane.style.display = 'block';
    targetPane.classList.add('show', 'active');
    
    // Fade out do painel atual
    currentPane.style.transition = `opacity ${CONFIG.animation.duration / 1000}s ease-in-out`;
    currentPane.style.opacity = '0';
    
    // Fade in do painel alvo
    targetPane.style.transition = `opacity ${CONFIG.animation.duration / 1000}s ease-in-out`;
    setTimeout(() => {
      targetPane.style.opacity = '1';
    }, 50);
    
    setTimeout(() => {
      // Cleanup
      currentPane.classList.remove('show', 'active');
      currentPane.style.display = 'none';
      currentPane.style.opacity = '';
      currentPane.style.transition = '';
      targetPane.style.opacity = '';
      targetPane.style.transition = '';
      
      $(document).trigger('tabTransitionComplete', [targetSelector]);
      
      setTimeout(() => {
        organizarLayoutPAs();
      }, CONFIG.timeouts.animationBuffer);
    }, CONFIG.animation.duration);
  } catch (error) {
    console.error('Erro na animação de transição de aba:', error);
    // Fallback: transição simples sem animação
    const currentPane = document.querySelector(currentSelector);
    const targetPane = document.querySelector(targetSelector);
    if (currentPane && targetPane) {
      currentPane.classList.remove('show', 'active');
      targetPane.classList.add('show', 'active');
    }
  }
}

function organizarLayoutPAs() {
  document.querySelectorAll(CONFIG.classes.paGrid).forEach(grid => {
    const leftColumn = grid.querySelector('.pa-column-left');
    const rightColumn = grid.querySelector('.pa-column-right');
    
    if (!leftColumn || !rightColumn) return;
    
    const todasPAs = Array.from(grid.querySelectorAll(CONFIG.classes.paCard))
      .map(pa => ({
        element: pa,
        numero: parseInt(pa.querySelector('.pa-title span').textContent.replace('PA ', ''))
      }))
      .sort((a, b) => a.numero - b.numero);
    
    if (todasPAs.length === 0) return;
    
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';
    
    const metade = Math.ceil(todasPAs.length / 2);
    const grupoPAsEsquerda = todasPAs.filter(pa => pa.numero <= metade).sort((a, b) => b.numero - a.numero);
    const grupoPAsDireita = todasPAs.filter(pa => pa.numero > metade).sort((a, b) => b.numero - a.numero);
    
    grupoPAsEsquerda.forEach(pa => leftColumn.appendChild(pa.element));
    grupoPAsDireita.forEach(pa => rightColumn.appendChild(pa.element));
  });
}

function adjustResponsiveLayout() {
  const windowWidth = window.innerWidth;
  const paGrids = document.querySelectorAll(CONFIG.classes.paGrid);
  
  paGrids.forEach(grid => {
    grid.classList.toggle('mobile-layout', windowWidth <= 992);
  });
  
  organizarLayoutPAs();
}

// =============================================================================
// SISTEMA DE STATUS DAS PAs
// =============================================================================

function atualizarStatusPA(paId, novoStatus, paCard) {
  $.ajax({
    url: CONFIG.urls.atualizarStatus,
    method: 'POST',
    headers: { 
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val(),
      'Content-Type': 'application/json; charset=utf-8'
    },
    data: JSON.stringify({
      pa_id: paId,
      status: novoStatus
    }),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: function(response) {
      if (response.success) {
        atualizarVisualizacaoStatusPA(paCard, novoStatus);
        mostrarMensagem('Status da PA atualizado com sucesso!', 'success');
      } else {
        mostrarMensagem('Erro ao atualizar status: ' + (response.error || response.message || 'Erro desconhecido'), 'error');
      }
    },
    error: function() {
      mostrarMensagem('Erro ao comunicar com o servidor', 'error');
    }
  });
}

function atualizarVisualizacaoStatusPA(paCard, novoStatus) {
  try {
    const config = STATUS_CONFIG[novoStatus];
    if (!config) {
      console.warn(`Configuração de status não encontrada para: ${novoStatus}`);
      return;
    }
    
    if (!paCard) {
      console.error('PA Card não fornecido para atualização de status');
      return;
    }
    
    // Atualizar indicador de status
    const statusIndicator = paCard.querySelector(CONFIG.classes.statusIndicator);
    if (statusIndicator) {
      statusIndicator.className = `pa-status-indicator ${config.class}`;
      statusIndicator.setAttribute('title', config.title);
    } else {
      console.warn('Indicador de status não encontrado na PA');
    }
    
    // Atualizar badge de status - corrigido o seletor
    const statusBadge = paCard.querySelector('.pa-status-group .badge');
    if (statusBadge) {
      statusBadge.className = `badge ${config.badgeClass}`;
      statusBadge.textContent = config.text;
    } else {
      console.warn('Badge de status não encontrado na PA');
    }
  } catch (error) {
    console.error('Erro ao atualizar visualização do status da PA:', error);
  }
}

function criarMenuStatus(statusIndicator, paId, paCard) {
  try {
    if (!statusIndicator) {
      console.error('Status indicator não fornecido para criar menu');
      return;
    }
    
    if (!paId || !paCard) {
      console.error('PA ID ou PA Card não fornecidos para criar menu');
      return;
    }
    
    // Remover menus existentes
    document.querySelectorAll('.status-dropdown-menu').forEach(menu => menu.remove());
    
    // Criar novo menu
    document.body.insertAdjacentHTML('beforeend', TEMPLATES.statusMenu);
    const menu = document.querySelector('.status-dropdown-menu');
    
    if (!menu) {
      console.error('Falha ao criar menu de status');
      return;
    }
    
    // Posicionar menu
    const rect = statusIndicator.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = (rect.left - 70) + 'px';
  
    // Adicionar hover effects e eventos
    menu.querySelectorAll('.status-option').forEach(option => {
      option.addEventListener('mouseover', () => option.style.backgroundColor = '#f5f5f5');
      option.addEventListener('mouseout', () => option.style.backgroundColor = 'white');
      option.addEventListener('click', function() {
        const novoStatus = this.getAttribute('data-status');
        if (menu && menu.parentNode) {
          menu.remove();
        }
        atualizarStatusPA(paId, novoStatus, paCard);
      });
    });
    
    // Fechar menu ao clicar fora
    const closeHandler = (evt) => {
      if (menu && !menu.contains(evt.target) && evt.target !== statusIndicator) {
        if (menu.parentNode) {
          menu.remove();
        }
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  } catch (error) {
    console.error('Erro ao criar menu de status:', error);
  }
}

// =============================================================================
// SISTEMA DE NAVEGAÇÃO E ABAS
// =============================================================================

function initializeTabState() {
  $('.tab-pane').not('.active').hide().css('display', 'none');
  
  const firstSalaButton = document.querySelector('#salas-tab .nav-link.active');
  if (firstSalaButton) {
    STATE.currentSalaId = firstSalaButton.getAttribute('data-sala-id');
    STATE.previousSalaId = STATE.currentSalaId;
    
    console.log('Estado inicial da sala definido:', STATE.currentSalaId);
    
    document.querySelectorAll('.tab-pane[id^="sala-"]').forEach(salaPane => {
      const salaId = salaPane.id.replace('sala-', '');
      const activeIlhaTab = salaPane.querySelector('.ilhas-tabs .nav-link.active');
      if (activeIlhaTab) {
        STATE.currentIlhaIds[salaId] = activeIlhaTab.getAttribute('data-ilha-id');
        STATE.previousIlhaIds[salaId] = STATE.currentIlhaIds[salaId];
        console.log(`Estado inicial da ilha ${salaId}:`, STATE.currentIlhaIds[salaId]);
      }
    });
  } else {
    console.warn('Nenhuma aba de sala ativa encontrada na inicialização');
  }
}

function handleSalaNavigation(tab) {
  const targetSalaId = tab.getAttribute('data-sala-id');
  
  if (STATE.currentSalaId === targetSalaId) return;
  
  // Carregamento otimizado se disponível
  if (window.modoCarregamento === 'otimizado') {
    window.mostrarLoadingNaSala(targetSalaId);
    window.carregarDadosSala(targetSalaId);
  }
  
  // Atualizar classes ativas
  document.querySelectorAll('#salas-tab .nav-link').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  
  // Se é a primeira vez (STATE.currentSalaId é null), apenas mostrar o painel alvo
  if (!STATE.currentSalaId) {
    const targetPane = document.querySelector(`#sala-${targetSalaId}`);
    if (targetPane) {
      // Esconder todos os painéis primeiro
      document.querySelectorAll('.tab-pane[id^="sala-"]').forEach(pane => {
        pane.classList.remove('show', 'active');
        pane.style.display = 'none';
      });
      
      // Mostrar o painel alvo
      targetPane.style.display = 'block';
      targetPane.classList.add('show', 'active');
      
      STATE.previousSalaId = STATE.currentSalaId;
      STATE.currentSalaId = targetSalaId;
      
      setTimeout(organizarLayoutPAs, CONFIG.timeouts.layoutDelay);
      return;
    }
  }
  
  // Determinar direção e animar
  const direction = parseInt(targetSalaId) > parseInt(STATE.currentSalaId) ? 'right' : 'left';
  
  const currentPane = document.querySelector(`#sala-${STATE.currentSalaId}`);
  const targetPane = document.querySelector(`#sala-${targetSalaId}`);
  
  if (currentPane && targetPane) {
    [currentPane, targetPane].forEach(pane => pane.style.display = 'block');
  }
  
  animateTabTransition(
    '#salas-tab-content',
    `#sala-${STATE.currentSalaId}`,
    `#sala-${targetSalaId}`,
    direction
  );
  
  STATE.previousSalaId = STATE.currentSalaId;
  STATE.currentSalaId = targetSalaId;
  
  setTimeout(organizarLayoutPAs, CONFIG.timeouts.layoutDelay);
}

function handleIlhaNavigation(tab) {
  const novoIlhaId = tab.getAttribute('data-ilha-id');
  const salaId = tab.closest('.tab-pane').id.replace('sala-', '');
  const ilhaAtivaAntesDoClique = STATE.currentIlhaIds[salaId];

  if (ilhaAtivaAntesDoClique === novoIlhaId) return;

  // Carregamento otimizado se disponível
  if (window.modoCarregamento === 'otimizado') {
    window.mostrarLoadingNaSala(salaId, novoIlhaId);
    window.carregarDadosSala(salaId, novoIlhaId);
  }
  
  // Atualizar classes ativas
  document.querySelectorAll(`#ilhas-sala-${salaId}-tab .nav-link`).forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  
  const direction = parseInt(novoIlhaId) > parseInt(ilhaAtivaAntesDoClique || 0) ? 'right' : 'left';
  
  const currentIlhaPaneSelector = `#ilha-${ilhaAtivaAntesDoClique}-sala-${salaId}`;
  const targetIlhaPaneSelector = `#ilha-${novoIlhaId}-sala-${salaId}`;
  
  const currentIlhaPane = document.querySelector(currentIlhaPaneSelector);
  const targetIlhaPane = document.querySelector(targetIlhaPaneSelector);

  if (!targetIlhaPane) {
    // Reverter alterações se o painel não existe
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
    const abaAnterior = document.querySelector(`#ilhas-sala-${salaId}-tab .nav-link[data-ilha-id="${ilhaAtivaAntesDoClique}"]`);
    if (abaAnterior) {
      abaAnterior.classList.add('active');
      abaAnterior.setAttribute('aria-selected', 'true');
    }
    mostrarMensagem(`Erro: Conteúdo da ilha ${novoIlhaId} não encontrado.`, 'error');
    return;
  }
  
  if (currentIlhaPane && targetIlhaPane) {
    [currentIlhaPane, targetIlhaPane].forEach(pane => pane.style.display = 'block');
    
    animateTabTransition(
      `#ilhas-sala-${salaId}-content`,
      currentIlhaPaneSelector,
      targetIlhaPaneSelector,
      direction
    );
  } else if (!currentIlhaPane && targetIlhaPane) {
    targetIlhaPane.style.display = 'block';
    targetIlhaPane.classList.add('show', 'active');
    setTimeout(organizarLayoutPAs, CONFIG.timeouts.layoutDelay);
    $(document).trigger('tabTransitionComplete', [targetIlhaPaneSelector]);
    
    STATE.previousIlhaIds[salaId] = ilhaAtivaAntesDoClique;
    STATE.currentIlhaIds[salaId] = novoIlhaId;
    return;
  }
  
  STATE.previousIlhaIds[salaId] = ilhaAtivaAntesDoClique;
  STATE.currentIlhaIds[salaId] = novoIlhaId;
  
  setTimeout(organizarLayoutPAs, CONFIG.animation.duration + CONFIG.timeouts.animationBuffer);
}

// =============================================================================
// SISTEMA DE BOTÃO DE RECARGA
// =============================================================================

function adicionarBotaoRecarga() {
  try {
    $('.btn-reload-sala').remove();
    
    if (!STATE.currentSalaId) {
      console.warn('Nenhuma sala ativa para adicionar botão de recarga');
      return;
    }
    
    const $salaPane = $(`#sala-${STATE.currentSalaId}`);
    if ($salaPane.length === 0) {
      console.warn(`Painel da sala ${STATE.currentSalaId} não encontrado`);
      return;
    }
    
    if ($salaPane.find('.btn-reload-sala').length > 0) {
      return; // Botão já existe
    }
    
    const $headerSection = $salaPane.find('.sala-header').length > 0 ? 
                          $salaPane.find('.sala-header') : 
                          $salaPane.find('.container-fluid');
    
    if ($headerSection.length === 0) {
      console.warn('Seção de cabeçalho não encontrada para adicionar botão de recarga');
      return;
    }
    
    $headerSection.css('position', 'relative').append(TEMPLATES.reloadButton);
    
    $headerSection.find('.btn-reload-sala').on('click', function() {
      try {
        const $icon = $(this).find('i');
        $icon.addClass('fa-spin');
        $(this).prop('disabled', true);
        
        const ilhaAtiva = STATE.currentIlhaIds[STATE.currentSalaId];
        
        if (typeof window.mostrarLoadingNaSala === 'function') {
          window.mostrarLoadingNaSala(STATE.currentSalaId, ilhaAtiva);
        }
        
        if (typeof window.carregarDadosSala === 'function') {
          window.carregarDadosSala(STATE.currentSalaId, ilhaAtiva, true).finally(() => {
            $icon.removeClass('fa-spin');
            $(this).prop('disabled', false);
          });
        } else {
          // Fallback se as funções não estiverem disponíveis
          setTimeout(() => {
            $icon.removeClass('fa-spin');
            $(this).prop('disabled', false);
            location.reload();
          }, 1000);
        }
      } catch (error) {
        console.error('Erro ao executar recarga da sala:', error);
        const $icon = $(this).find('i');
        $icon.removeClass('fa-spin');
        $(this).prop('disabled', false);
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar botão de recarga:', error);
  }
}

// =============================================================================
// SISTEMA DE FILTRO DE LOJA
// =============================================================================

function setupLojaFilter() {
  // Verificar se o carregamento otimizado está ativo
  if (window.modoCarregamento === 'otimizado') {
    return; // O sistema de carregamento cuidará do filtro
  }
  
  // Fallback para o método tradicional (se o carregamento otimizado não estiver disponível)
  $('#select-loja').on('change', function() {
    const lojaId = $(this).val();
    const url = new URL(window.location.href);
    
    // Sempre definir o parâmetro loja, já que não temos mais opção "Todas as Lojas"
    if (lojaId) {
      url.searchParams.set('loja', lojaId);
    }
    
    mostrarMensagem('Carregando salas da loja selecionada...', 'info');
    window.location.href = url.toString();
  });
  
  $('#form-filtro-loja').on('submit', function(e) {
    e.preventDefault();
    $('#select-loja').trigger('change');
  });
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

const EventHandlers = {
  init() {
    this.setupStatusIndicators();
    this.setupTabNavigation();
    this.setupResponsiveLayout();
    this.setupTabClicks();
  },
  
  setupStatusIndicators() {
    try {
      document.querySelectorAll(CONFIG.classes.statusIndicator).forEach(statusIndicator => {
        statusIndicator.addEventListener('click', function(e) {
          try {
            e.preventDefault();
            e.stopPropagation();
            
            const paCard = this.closest(CONFIG.classes.paCard);
            if (!paCard) {
              console.warn('PA Card não encontrado para indicador de status');
              return;
            }
            
            const paId = paCard.getAttribute('data-pa-id');
            if (!paId) {
              console.warn('PA ID não encontrado no card');
              return;
            }
            
            criarMenuStatus(this, paId, paCard);
          } catch (error) {
            console.error('Erro ao processar clique no indicador de status:', error);
          }
        });
      });
    } catch (error) {
      console.error('Erro ao configurar indicadores de status:', error);
    }
  },
  
  setupTabNavigation() {
    try {
      // Salas
      document.querySelectorAll(CONFIG.classes.salaTab).forEach(tab => {
        tab.addEventListener('click', function(e) {
          try {
            e.preventDefault();
            handleSalaNavigation(this);
          } catch (error) {
            console.error('Erro ao navegar para sala:', error);
          }
        });
      });
      
      // Ilhas
      document.querySelectorAll(CONFIG.classes.ilhaTab).forEach(tab => {
        tab.addEventListener('click', function(e) {
          try {
            e.preventDefault();
            handleIlhaNavigation(this);
          } catch (error) {
            console.error('Erro ao navegar para ilha:', error);
          }
        });
      });
    } catch (error) {
      console.error('Erro ao configurar navegação de abas:', error);
    }
  },
  
  setupResponsiveLayout() {
    try {
      adjustResponsiveLayout();
      window.addEventListener('resize', adjustResponsiveLayout);
      
      document.querySelectorAll('.nav-tabs .nav-link').forEach(tabLink => {
        tabLink.addEventListener('click', function() {
          try {
            setTimeout(organizarLayoutPAs, 600);
          } catch (error) {
            console.error('Erro ao organizar layout das PAs:', error);
          }
        });
      });
    } catch (error) {
      console.error('Erro ao configurar layout responsivo:', error);
    }
  },
  
  setupTabClicks() {
    try {
      // Garantir que as abas de Bootstrap não controlem a exibição
      $('button[data-bs-toggle="tab"]').on('click', function(e) {
        e.preventDefault();
        return false;
      });
      
      // Adicionar botão de recarga nas mudanças de sala
      document.querySelectorAll('#salas-tab .nav-link').forEach(tab => {
        try {
          const originalClickHandler = tab.onclick;
          tab.onclick = function(e) {
            try {
              if (originalClickHandler) originalClickHandler.call(this, e);
              setTimeout(adicionarBotaoRecarga, CONFIG.timeouts.reloadDelay);
            } catch (error) {
              console.error('Erro ao processar clique na aba:', error);
            }
          };
        } catch (error) {
          console.error('Erro ao configurar clique da aba:', error);
        }
      });
    } catch (error) {
      console.error('Erro ao configurar cliques das abas:', error);
    }
  }
};

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================

$(document).ready(function() {
  try {
    // Aguardar inicialização do carregamento otimizado
    setTimeout(() => {
      try {
        setupLojaFilter();
        
        // Só inicializar estado das abas se não estivermos usando carregamento otimizado
        if (window.modoCarregamento !== 'otimizado') {
          initializeTabState();
          adicionarBotaoRecarga();
          
          // Executar organização do layout
          organizarLayoutPAs();
          setTimeout(() => {
            try {
              organizarLayoutPAs();
            } catch (error) {
              console.error('Erro ao organizar layout das PAs (timeout):', error);
            }
          }, CONFIG.animation.duration);
        }
        
        EventHandlers.init();
        
        // Adicionar eventos para reorganizar PAs
        document.addEventListener('DOMContentLoaded', () => {
          try {
            if (window.modoCarregamento !== 'otimizado') {
              organizarLayoutPAs();
            }
          } catch (error) {
            console.error('Erro ao organizar layout das PAs (DOMContentLoaded):', error);
          }
        });
      } catch (error) {
        console.error('Erro durante a inicialização do controle de salas:', error);
        mostrarMensagem('Erro ao inicializar a página. Recarregue a página.', 'error');
      }
    }, 200); // Aguardar carregamento otimizado inicializar
  } catch (error) {
    console.error('Erro crítico na inicialização:', error);
  }
});

// =============================================================================
// EXPOSIÇÃO GLOBAL
// =============================================================================

Object.assign(window, {
  mostrarMensagem,
  animateTabTransition,
  organizarLayoutPAs,
  adjustResponsiveLayout,
  atualizarStatusPA,
  atualizarVisualizacaoStatusPA,
  EventHandlers
});