/**
 * controle_salas_perifericos.js - Sistema de periféricos para o controle de salas
 * 
 * DEPENDÊNCIAS: controle_salas_mensagens.js (função mostrarMensagem)
 */

// =============================================================================
// CONFIGURAÇÕES E CONSTANTES
// =============================================================================

const PERIFERICOS_CONFIG = {
  urls: {
    perifericosDisponiveis: '/ti/api/perifericos-disponiveis-por-tipo/',
    atribuirPeriferico: '/ti/atribuicoes-perifericos/cadastrar/',
    removerPeriferico: '/ti/api/remover-periferico-pa/',
    atualizarStatus: '/ti/api/periferico/{periferico_id}/atualizar-status/',
    cadastrarLote: '/ti/atribuicoes-perifericos/cadastrar-lote/'
  },
  classes: {
    perifericoTag: '.periferico-tag',
    paCard: '.pa-card',
    perifericosList: '.perifericos-list',
    faltantesContainer: '.perifericos-faltantes'
  },
  messages: {
    semPerifericos: 'Nenhum periférico atribuído',
    sucessoAtribuicao: 'Alterações salvas com sucesso!',
    erroAtribuicao: 'Erro ao salvar alterações',
    jaExistePendente: 'Este periférico já está pendente para atribuição.',
    sucessoRemocao: 'Periférico removido com sucesso!',
    sucessoAtualizacao: 'Status do periférico atualizado com sucesso!'
  }
};

const PERIFERICOS_TEMPLATES = {
  perifericoTag: (periferico, pendente = false) => `
    <span class="periferico-tag ${pendente ? 'pendente' : ''}" 
          data-periferico-id="${pendente ? 'pendente-' + periferico.id : periferico.id}"
          data-periferico-tipo="${periferico.tipo}">
      ${periferico.tipo} ${periferico.marca} ${periferico.modelo ? `(${periferico.modelo})` : ''}
      ${pendente ? '<i class="bx bx-time-five ms-1" title="Pendente de salvar"></i>' : ''}
    </span>`,

  menuAcoes: `
    <div class="periferico-action-menu">
      <div class="periferico-action-item" data-action="update-status">
        <i class='bx bx-edit-alt me-2'></i>Atualizar Status
      </div>
      <div class="periferico-action-item remove-action ${window.usuarioRestrito ? 'disabled' : ''}" data-action="remove">
        <i class='bx bx-trash me-2'></i>Remover da PA
      </div>
    </div>`,

  menuStatus: (nome) => `
    <div class="periferico-status-menu">
      <div class="periferico-status-header">Atualizar Status: ${nome}</div>
      <div class="periferico-status-item" data-status="manutencao">
        <span class="status-indicator status-manutencao"></span>Em Manutenção
      </div>
      <div class="periferico-status-item" data-status="disponivel">
        <span class="status-indicator status-disponivel"></span>Livre (Disponível)
      </div>
    </div>`,

  botaoFaltante: (paId, tipoId, tipoNome) => `
    <div class="periferico-faltante-item">
      <span class="periferico-faltante-nome">${tipoNome}</span>
      <button type="button" class="btn btn-sm btn-outline-warning add-periferico-btn" 
              data-pa-id="${paId}" data-tipo-id="${tipoId}" data-tipo-nome="${tipoNome}">
        <i class='bx bx-plus-circle me-1'></i> Adicionar ${tipoNome}
      </button>
    </div>`,

  itemDisponivel: (periferico) => `
    <div class="periferico-disponivel-item">
      <div class="periferico-disponivel-info">
        <div class="periferico-disponivel-marca">${periferico.marca}</div>
        <div class="periferico-disponivel-modelo">${periferico.modelo || ''}</div>
      </div>
      <button class="atribuir-periferico-btn" data-periferico-id="${periferico.id}">
        <i class='bx bx-link me-1'></i> Atribuir
      </button>
    </div>`,

  contadorPendentes: (contador) => `
    <div class="pending-count">${contador}</div>
    <div class="btn-group">
      <button type="button" class="btn btn-primary save-all-changes-btn">
        <i class="bx bx-save me-2"></i> Salvar Alterações
      </button>
      <button type="button" class="btn btn-outline-secondary cancel-all-changes-btn" title="Cancelar todas as alterações">
        <i class="bx bx-x"></i>
      </button>
    </div>`,

  notificacaoPendentes: (quantidade) => `
    <div class="perifericos-disponivel-note mt-2 mb-2 p-2 bg-light border-start border-warning border-4 rounded">
      <small><i class='bx bx-info-circle me-1 text-warning'></i> Há ${quantidade} periférico(s) deste tipo na lista de pendências.</small>
    </div>`,

  estadoVazioComPendentes: (quantidade) => `
    <i class='bx bx-package perifericos-icon-empty'></i>
    <p class="mt-2">Não há periféricos disponíveis deste tipo.</p>
    <p class="small text-warning"><i class='bx bx-info-circle me-1'></i> Há ${quantidade} periférico(s) pendente(s) na sua lista de alterações.</p>
    <p class="small">Clique em "Salvar Alterações" para confirmar ou recarregue a página para cancelar.</p>`
};

// =============================================================================
// ELEMENTOS DOM E ESTADO
// =============================================================================

const PERIFERICOS_DOM = {
  modals: {
    confirmRemove: {
      backdrop: $('#confirm-remove-periferico-backdrop'),
      modal: $('#confirm-remove-periferico-modal'),
      nome: $('#modal-periferico-nome'),
      confirmBtn: $('#modal-confirm-remove-btn'),
      cancelBtn: $('#modal-cancel-btn'),
      closeBtn: $('#modal-close-btn')
    },
    perifericosDisponiveis: {
      backdrop: $('#perifericos-disponiveis-backdrop'),
      modal: $('#perifericos-disponiveis-modal'),
      close: $('#perifericos-disponiveis-close'),
      cancel: $('#perifericos-disponiveis-cancel'),
      tipoNome: $('#modal-tipo-nome'),
      loading: $('#perifericos-disponiveis-loading'),
      empty: $('#perifericos-disponiveis-empty'),
      error: $('#perifericos-disponiveis-error'),
      errorMessage: $('#perifericos-disponiveis-error-message'),
      content: $('#perifericos-disponiveis-content')
    }
  },
  saveButton: $('#save-changes-button')
};

// Estado global
const PERIFERICOS_STATE = {
  perifericosPendentes: [],
  perifericosPendentesPorTipo: {},
  activePerifericoActionMenu: null,
  activePerifericoStatusMenu: null,
  dadosPerifericoParaRemover: null,
  modalDadosPa: null,
  modalDadosTipo: null
};

// =============================================================================
// UTILITÁRIOS E FUNÇÕES AUXILIARES
// =============================================================================

async function requestAPI(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
    }
  };
  
  try {
    return await $.ajax(url, { ...defaultOptions, ...options });
  } catch (error) {
    console.error(`Erro na requisição para ${url}:`, error);
    throw error;
  }
}

function posicionarMenu(menu, elemento) {
  const rect = elemento[0].getBoundingClientRect();
  menu.css({
    top: (rect.bottom + window.scrollY + 5) + 'px',
    left: (rect.left + window.scrollX) + 'px',
  });
}

function fecharMenusAtivos() {
  [PERIFERICOS_STATE.activePerifericoActionMenu, PERIFERICOS_STATE.activePerifericoStatusMenu].forEach(menu => {
    if (menu) {
      menu.remove();
    }
  });
  PERIFERICOS_STATE.activePerifericoActionMenu = null;
  PERIFERICOS_STATE.activePerifericoStatusMenu = null;
}

function gerenciarModal(modal, acao, opcoes = {}) {
  switch (acao) {
    case 'abrir':
      if (opcoes.resetar) gerenciarModal(modal, 'resetar');
      if (opcoes.texto) modal.tipoNome?.text(opcoes.texto);
      if (opcoes.nome) modal.nome?.text(opcoes.nome);
      modal.backdrop.addClass('show').fadeIn(200);
      modal.modal.addClass('show').fadeIn(200);
      if (modal === PERIFERICOS_DOM.modals.confirmRemove) $('body').addClass('modal-open');
      if (opcoes.callback) opcoes.callback();
      break;
      
    case 'fechar':
      modal.backdrop.fadeOut(200, function() { $(this).removeClass('show'); });
      modal.modal.fadeOut(200, function() { $(this).removeClass('show'); });
      if (modal === PERIFERICOS_DOM.modals.confirmRemove) {
        $('body').removeClass('modal-open');
        PERIFERICOS_STATE.dadosPerifericoParaRemover = null;
      }
      if (modal === PERIFERICOS_DOM.modals.perifericosDisponiveis) {
        PERIFERICOS_STATE.modalDadosPa = null;
        PERIFERICOS_STATE.modalDadosTipo = null;
      }
      if (opcoes.callback) opcoes.callback();
      break;
      
    case 'resetar':
      modal.loading?.show();
      modal.empty?.hide();
      modal.error?.hide();
      modal.content?.empty().hide();
      break;
  }
}

// =============================================================================
// FUNÇÕES PRINCIPAIS DE PERIFÉRICOS
// =============================================================================

function atualizarPerifericosNaPA(paCardElement, perifericos = [], tiposFaltantes = []) {
  const perifericosList = paCardElement.querySelector(PERIFERICOS_CONFIG.classes.perifericosList);
  if (!perifericosList) return;
  
  renderizarListaPerifericos(perifericosList, perifericos);
  gerenciarPerifericosFaltantes(paCardElement, tiposFaltantes);
  reativarEventosPerifericos(paCardElement);
}

function renderizarListaPerifericos(container, perifericos) {
  container.innerHTML = perifericos.length > 0 
    ? perifericos.map(p => PERIFERICOS_TEMPLATES.perifericoTag(p)).join('')
    : `<span class="text-muted">${PERIFERICOS_CONFIG.messages.semPerifericos}</span>`;
}

function gerenciarPerifericosFaltantes(paCardElement, tiposFaltantes) {
  const faltantesContainer = paCardElement.querySelector(PERIFERICOS_CONFIG.classes.faltantesContainer);
  if (!faltantesContainer) return;
  
  const faltantesListElement = faltantesContainer.querySelector('.perifericos-faltantes-list');
  
  if (tiposFaltantes?.length > 0) {
    faltantesContainer.classList.remove('d-none');
    if (faltantesListElement) {
      const paId = paCardElement.getAttribute('data-pa-id');
      faltantesListElement.innerHTML = tiposFaltantes.map(tipoNome => {
        const tipoId = window.tiposPerifericosComuns?.find(t => t.nome === tipoNome)?.id;
        return PERIFERICOS_TEMPLATES.botaoFaltante(paId, tipoId, tipoNome);
      }).join('');
      
      // Adicionar eventos aos botões
      faltantesListElement.querySelectorAll('.add-periferico-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const tipoId = this.getAttribute('data-tipo-id');
          const tipoNome = this.getAttribute('data-tipo-nome');
          abrirModalPerifericosDisponiveis(tipoId, tipoNome);
        });
      });
    }
  } else {
    faltantesContainer.classList.add('d-none');
  }
}

function reativarEventosPerifericos(paCardElement) {
  paCardElement.querySelectorAll(PERIFERICOS_CONFIG.classes.perifericoTag).forEach(tag => {
    // Verificar se o usuário é restrito antes de adicionar event listener
    if (window.usuarioRestrito) {
      // Para usuários restritos, adicionar classe visual e cursor não permitido
      tag.classList.add('disabled');
      tag.style.cursor = 'not-allowed';
      tag.style.opacity = '0.7';
      
      // Adicionar event listener que apenas mostra mensagem de aviso
      tag.addEventListener('click', function(e) {
        e.stopPropagation();
        mostrarMensagem('Você não tem permissão para gerenciar periféricos.', 'warning');
      });
    } else {
      // Para usuários normais, comportamento padrão
      tag.addEventListener('click', function(e) {
        e.stopPropagation();
        abrirMenuAcoesPeriferico($(this));
      });
    }
  });
}

function abrirMenuAcoesPeriferico(perifericoTag) {
  fecharMenusAtivos();

  const perifericoId = perifericoTag.data('periferico-id');
  const paCard = perifericoTag.closest(PERIFERICOS_CONFIG.classes.paCard);
  const paId = paCard.data('pa-id');
  const perifericoNomeCompleto = perifericoTag.text().trim();
  const perifericoTipo = perifericoTag.data('periferico-tipo') || perifericoNomeCompleto.split(' ')[0];

  $('body').append(PERIFERICOS_TEMPLATES.menuAcoes);
  PERIFERICOS_STATE.activePerifericoActionMenu = $('.periferico-action-menu');
  
  posicionarMenu(PERIFERICOS_STATE.activePerifericoActionMenu, perifericoTag);

  PERIFERICOS_STATE.activePerifericoActionMenu.find('.periferico-action-item').hover(
    function() { 
      if (!$(this).hasClass('disabled')) {
        $(this).addClass('hover'); 
      }
    },
    function() { $(this).removeClass('hover'); }
  );

  const acoes = {
    'update-status': () => abrirMenuAtualizarStatusPeriferico(perifericoId, perifericoNomeCompleto, perifericoTipo, paId, perifericoTag),
    'remove': () => {
      if (window.usuarioRestrito) {
        mostrarMensagem('Você não tem permissão para remover periféricos.', 'warning');
        return;
      }
      abrirModalConfirmacao(perifericoId, paId, perifericoNomeCompleto, perifericoTag);
    }
  };

  PERIFERICOS_STATE.activePerifericoActionMenu.find('.periferico-action-item').on('click', function(event) {
    event.stopPropagation();
    
    // Verificar se o item está desabilitado
    if ($(this).hasClass('disabled')) {
      return;
    }
    
    fecharMenusAtivos();
    const acao = $(this).data('action');
    if (acoes[acao]) acoes[acao]();
  });

  $(document).on('click.closePerifericoActionMenu', function(event) {
    if (PERIFERICOS_STATE.activePerifericoActionMenu && 
        !$(event.target).closest('.periferico-action-menu').length && 
        !perifericoTag.is(event.target) && 
        !perifericoTag.find(event.target).length) {
      fecharMenusAtivos();
      $(document).off('click.closePerifericoActionMenu');
    }
  });
}

function abrirMenuAtualizarStatusPeriferico(perifericoId, perifericoNome, perifericoTipo, paId, perifericoTagElement) {
  fecharMenusAtivos();

  $('body').append(PERIFERICOS_TEMPLATES.menuStatus(perifericoNome));
  PERIFERICOS_STATE.activePerifericoStatusMenu = $('.periferico-status-menu');
  
  posicionarMenu(PERIFERICOS_STATE.activePerifericoStatusMenu, perifericoTagElement);
  PERIFERICOS_STATE.activePerifericoStatusMenu.show();

  PERIFERICOS_STATE.activePerifericoStatusMenu.find('.periferico-status-item').hover(
    function() { $(this).addClass('hover'); },
    function() { $(this).removeClass('hover'); }
  );

  PERIFERICOS_STATE.activePerifericoStatusMenu.find('.periferico-status-item').on('click', function(event) {
    event.stopPropagation();
    const novoStatus = $(this).data('status');
    fecharMenusAtivos();
    
    if (novoStatus === 'manutencao' && typeof window.definirDadosParaManutencao === 'function') {
      window.definirDadosParaManutencao({
        tipoItem: 'periferico',
        itemId: perifericoId,
        paId: paId,
        itemNome: perifericoNome,
        itemElement: perifericoTagElement,
        perifericoTipo: perifericoTipo
      });
      
      if (typeof window.abrirModalObservacoesManutencao === 'function') {
        window.abrirModalObservacoesManutencao(perifericoNome);
      }
    } else {
      atualizarStatusPerifericoNoServidor(perifericoId, novoStatus, paId, perifericoTagElement, perifericoTipo, null);
    }
  });
  
  $(document).off('click.closePerifericoStatusMenu');
  $(document).on('click.closePerifericoStatusMenu', function(event) {
    if (PERIFERICOS_STATE.activePerifericoStatusMenu && 
        !$(event.target).closest('.periferico-status-menu').length && 
        !perifericoTagElement.is(event.target) && 
        !$(event.target).closest(perifericoTagElement).length) {
      fecharMenusAtivos();
      $(document).off('click.closePerifericoStatusMenu');
    }
  });
}

async function atualizarStatusPerifericoNoServidor(perifericoId, novoStatus, paId, perifericoTagElement, perifericoTipo, observacoes) {
  try {
    const response = await requestAPI(`${PERIFERICOS_CONFIG.urls.atualizarStatus}${perifericoId}/atualizar_status/`, {
      method: 'POST',
      data: JSON.stringify({ status: novoStatus, pa_id: paId, observacoes: observacoes }),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json'
    });

    if (response.success) {
      mostrarMensagem(response.message || PERIFERICOS_CONFIG.messages.sucessoAtualizacao, 'success');
      
      if (response.periferico_removido_da_pa) {
        perifericoTagElement.fadeOut(300, function() { 
          const perifericosList = $(this).closest(PERIFERICOS_CONFIG.classes.perifericosList);
          $(this).remove();
          if (perifericosList.children(PERIFERICOS_CONFIG.classes.perifericoTag).length === 0) {
            perifericosList.html(`<span class="text-muted">${PERIFERICOS_CONFIG.messages.semPerifericos}</span>`);
          }
        });
      }
    } else {
      mostrarMensagem('Erro ao atualizar status do periférico: ' + response.error, 'error');
    }
  } catch (error) {
    console.error('Erro AJAX ao atualizar status do periférico:', error.responseText);
    mostrarMensagem(error.responseJSON?.error || 'Erro ao comunicar com o servidor para atualizar status do periférico.', 'error');
  }
}

function abrirModalConfirmacao(perifericoId, paId, perifericoNome, perifericoElement) {
  PERIFERICOS_STATE.dadosPerifericoParaRemover = { perifericoId, paId, perifericoElement };
  gerenciarModal(PERIFERICOS_DOM.modals.confirmRemove, 'abrir', { nome: perifericoNome });
}

async function removerPerifericoDaPA(perifericoId, paId, perifericoElement) {
  const paCard = perifericoElement.closest(PERIFERICOS_CONFIG.classes.paCard);
  
  try {
    const response = await requestAPI(PERIFERICOS_CONFIG.urls.removerPeriferico, {
      method: 'POST',
      data: JSON.stringify({ periferico_id: perifericoId, pa_id: paId }),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json'
    });

    if (response.success) {
      perifericoElement.fadeOut(300, function() { 
        $(this).remove(); 
        const perifericosList = paCard.find(PERIFERICOS_CONFIG.classes.perifericosList);
        if (perifericosList.children(PERIFERICOS_CONFIG.classes.perifericoTag).length === 0) {
          perifericosList.html(`<span class="text-muted">${PERIFERICOS_CONFIG.messages.semPerifericos}</span>`);
        }
      });
      
      if (response.tipos_faltantes) {
        atualizarPerifericosNaPA(paCard[0], response.perifericos || [], response.tipos_faltantes);
      }
      
      mostrarMensagem(response.message || PERIFERICOS_CONFIG.messages.sucessoRemocao, 'success');
      
      // Forçar recarga dos dados da PA
      const salaId = paCard.closest('.tab-pane').attr('id')?.replace('sala-', '');
      const ilhaId = paCard.closest('[id^="ilha-"]').attr('id')?.split('-')[1];
      if (salaId && typeof carregarDadosSala === 'function') {
        setTimeout(() => carregarDadosSala(salaId, ilhaId, true), 500);
      }
    } else {
      mostrarMensagem('Erro ao remover periférico: ' + response.error, 'error');
    }
  } catch (error) {
    console.error('Erro AJAX:', error.responseText);
    mostrarMensagem(error.responseJSON?.error || 'Erro ao comunicar com o servidor.', 'error');
  }
}

// =============================================================================
// SISTEMA DE PENDÊNCIAS
// =============================================================================

function atualizarContadorAtribuicoesPendentes() {
  const contador = PERIFERICOS_STATE.perifericosPendentes.length;
  if (contador > 0) {
    PERIFERICOS_DOM.saveButton.html(PERIFERICOS_TEMPLATES.contadorPendentes(contador)).removeClass('d-none');
  } else {
    PERIFERICOS_DOM.saveButton.addClass('d-none');
  }
}

function adicionarAtribuicaoPendente(perifericoId, paId, marca, modelo, tipo, tipoId) {
  const existente = PERIFERICOS_STATE.perifericosPendentes.find(p => p.perifericoId === perifericoId && p.paId === paId);
  if (existente) {
    mostrarMensagem(PERIFERICOS_CONFIG.messages.jaExistePendente, 'warning');
    return;
  }
  
  const tipoIdFinal = tipoId || PERIFERICOS_STATE.modalDadosTipo?.id;
  if (!tipoIdFinal) {
    console.error('Erro: tipoId não fornecido');
    return;
  }
  
  PERIFERICOS_STATE.perifericosPendentes.push({ perifericoId, paId, marca, modelo, tipo, tipoId: tipoIdFinal });
  
  if (!PERIFERICOS_STATE.perifericosPendentesPorTipo[tipoIdFinal]) {
    PERIFERICOS_STATE.perifericosPendentesPorTipo[tipoIdFinal] = [];
  }
  PERIFERICOS_STATE.perifericosPendentesPorTipo[tipoIdFinal].push(perifericoId);
  
  atualizarContadorAtribuicoesPendentes();
  adicionarPerifericoPendenteVisualmente(paId, perifericoId, tipo, marca, modelo);
}

function adicionarPerifericoPendenteVisualmente(paId, perifericoId, tipo, marca, modelo) {
  const paCard = $(`.pa-card[data-pa-id="${paId}"]`);
  if (!paCard.length) return;
  
  const perifericosList = paCard.find(PERIFERICOS_CONFIG.classes.perifericosList);
  
  if (perifericosList.text().trim() === PERIFERICOS_CONFIG.messages.semPerifericos) {
    perifericosList.empty();
  }
  
  const perifericoData = { id: perifericoId, tipo, marca, modelo };
  perifericosList.append(PERIFERICOS_TEMPLATES.perifericoTag(perifericoData, true));
  
  paCard.find('.periferico-faltante-item').filter(function() {
    return $(this).find('.periferico-faltante-nome').text().trim() === tipo;
  }).fadeOut(300, function() {
    $(this).remove();
    if (paCard.find('.periferico-faltante-item').length === 0) {
      paCard.find(PERIFERICOS_CONFIG.classes.faltantesContainer).fadeOut(300);
    }
  });
}

// =============================================================================
// MODAL DE PERIFÉRICOS DISPONÍVEIS
// =============================================================================

function abrirModalPerifericosDisponiveis(tipoId, tipoNome) {
  gerenciarModal(PERIFERICOS_DOM.modals.perifericosDisponiveis, 'abrir', { 
    resetar: true, 
    texto: tipoNome, 
    callback: () => carregarPerifericosDisponiveis(tipoId) 
  });
}

async function carregarPerifericosDisponiveis(tipoId) {
  try {
    const response = await requestAPI(`${PERIFERICOS_CONFIG.urls.perifericosDisponiveis}${tipoId}/`);
    
    PERIFERICOS_DOM.modals.perifericosDisponiveis.loading.hide();
    
    if (response.success && response.perifericos?.length > 0) {
      const perifericosPendentesDesseTipo = PERIFERICOS_STATE.perifericosPendentesPorTipo[tipoId] || [];
      const perifericosFiltrados = response.perifericos.filter(
        periferico => !perifericosPendentesDesseTipo.includes(periferico.id)
      );
      
      if (perifericosFiltrados.length > 0) {
        renderizarPerifericosDisponiveis(perifericosFiltrados);
        PERIFERICOS_DOM.modals.perifericosDisponiveis.content.show();
        
        if (perifericosPendentesDesseTipo.length > 0) {
          PERIFERICOS_DOM.modals.perifericosDisponiveis.content.prepend(PERIFERICOS_TEMPLATES.notificacaoPendentes(perifericosPendentesDesseTipo.length));
        }
      } else {
        mostrarEstadoVazioComPendentes(perifericosPendentesDesseTipo.length);
      }
    } else {
      PERIFERICOS_DOM.modals.perifericosDisponiveis.empty.show();
    }
  } catch (error) {
    console.error('Erro ao carregar periféricos disponíveis:', error);
    PERIFERICOS_DOM.modals.perifericosDisponiveis.loading.hide();
    PERIFERICOS_DOM.modals.perifericosDisponiveis.errorMessage.text(
      error.responseJSON?.error || error.statusText || error.message || 'Erro ao comunicar com o servidor'
    );
    PERIFERICOS_DOM.modals.perifericosDisponiveis.error.show();
  }
}

function mostrarEstadoVazioComPendentes(quantidadePendentes) {
  if (quantidadePendentes > 0) {
    PERIFERICOS_DOM.modals.perifericosDisponiveis.empty.html(PERIFERICOS_TEMPLATES.estadoVazioComPendentes(quantidadePendentes));
  }
  PERIFERICOS_DOM.modals.perifericosDisponiveis.empty.show();
}

function renderizarPerifericosDisponiveis(perifericos) {
  PERIFERICOS_DOM.modals.perifericosDisponiveis.content.empty();
  perifericos.forEach(periferico => {
    PERIFERICOS_DOM.modals.perifericosDisponiveis.content.append(PERIFERICOS_TEMPLATES.itemDisponivel(periferico));
  });
}

async function salvarTodasAsAtribuicoes($button) {
  if (PERIFERICOS_STATE.perifericosPendentes.length === 0) return;
  
  const originalHtml = $button.html();
  $button.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-2"></i> Salvando...');
  
  mostrarMensagem(`Salvando ${PERIFERICOS_STATE.perifericosPendentes.length} atribuições de periféricos...`, 'info');
  
  const dadosLote = PERIFERICOS_STATE.perifericosPendentes.map(atribuicao => ({
    periferico: atribuicao.perifericoId,
    posicao_atendimento: atribuicao.paId,
    data_atribuicao: new Date().toISOString().replace('Z', '')
  }));
  
  try {
    await requestAPI(PERIFERICOS_CONFIG.urls.cadastrarLote, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
      },
      data: JSON.stringify({ atribuicoes: dadosLote })
    });
    
    PERIFERICOS_STATE.perifericosPendentes = [];
    PERIFERICOS_STATE.perifericosPendentesPorTipo = {};
    
    mostrarMensagem(PERIFERICOS_CONFIG.messages.sucessoAtribuicao, 'success');
    window.location.reload();
  } catch (error) {
    console.error('Erro ao processar periféricos em lote:', error.responseText);
    $button.prop('disabled', false).html(originalHtml);
    mostrarMensagem(PERIFERICOS_CONFIG.messages.erroAtribuicao, 'error');
  }
}

function cancelarTodasAsAtribuicoes() {
  if (PERIFERICOS_STATE.perifericosPendentes.length === 0) return;
  
  if (confirm(`Tem certeza que deseja cancelar todas as ${PERIFERICOS_STATE.perifericosPendentes.length} atribuições pendentes?`)) {
    $('.periferico-tag.pendente').fadeOut(200, function() { $(this).remove(); });
    
    PERIFERICOS_STATE.perifericosPendentes = [];
    PERIFERICOS_STATE.perifericosPendentesPorTipo = {};
    
    atualizarContadorAtribuicoesPendentes();
    mostrarMensagem('Todas as atribuições pendentes foram canceladas.', 'info');
    
    setTimeout(() => window.location.reload(), 300);
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

const PerifericosEventHandlers = {
  init() {
    this.setupPerifericoEvents();
    this.setupModalEvents();
    this.setupButtonEvents();
  },
  
  setupPerifericoEvents() {
    $(document).on('click', PERIFERICOS_CONFIG.classes.perifericoTag, function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      // Verificar se o usuário é restrito
      if (window.usuarioRestrito) {
        mostrarMensagem('Você não tem permissão para gerenciar periféricos.', 'warning');
        return;
      }
      
      abrirMenuAcoesPeriferico($(this));
    });
  },
  
  setupModalEvents() {
    // Modal de confirmação
    PERIFERICOS_DOM.modals.confirmRemove.confirmBtn.on('click', function() {
      if (PERIFERICOS_STATE.dadosPerifericoParaRemover) {
        removerPerifericoDaPA(
          PERIFERICOS_STATE.dadosPerifericoParaRemover.perifericoId, 
          PERIFERICOS_STATE.dadosPerifericoParaRemover.paId, 
          PERIFERICOS_STATE.dadosPerifericoParaRemover.perifericoElement
        );
        gerenciarModal(PERIFERICOS_DOM.modals.confirmRemove, 'fechar');
      }
    });

    // Eventos de fechar modal
    const eventosFecharModal = [
      { elementos: [PERIFERICOS_DOM.modals.confirmRemove.cancelBtn, PERIFERICOS_DOM.modals.confirmRemove.closeBtn], modal: PERIFERICOS_DOM.modals.confirmRemove },
      { elementos: [PERIFERICOS_DOM.modals.perifericosDisponiveis.close, PERIFERICOS_DOM.modals.perifericosDisponiveis.cancel], modal: PERIFERICOS_DOM.modals.perifericosDisponiveis }
    ];

    eventosFecharModal.forEach(({ elementos, modal }) => {
      elementos.forEach(btn => {
        btn.on('click', (e) => {
          e.preventDefault();
          gerenciarModal(modal, 'fechar');
        });
      });
    });

    // Fechar ao clicar no backdrop
    [PERIFERICOS_DOM.modals.confirmRemove, PERIFERICOS_DOM.modals.perifericosDisponiveis].forEach(modal => {
      modal.backdrop.on('click', function(event) {
        if (event.target === this) {
          gerenciarModal(modal, 'fechar');
        }
      });
    });
  },
  
  setupButtonEvents() {
    // Botões de adicionar periférico faltante
    $(document).on('click', '.add-periferico-btn', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Verificar se o botão está desabilitado
      if ($(this).prop('disabled')) {
        return;
      }
      
      const { paId, tipoId, tipoNome } = $(this).data();
      
      PERIFERICOS_STATE.modalDadosPa = { id: paId };
      PERIFERICOS_STATE.modalDadosTipo = { id: tipoId, nome: tipoNome };
      
      abrirModalPerifericosDisponiveis(tipoId, tipoNome);
    });

    // Botões de atribuir periférico
    $(document).on('click', '.atribuir-periferico-btn', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const button = $(this);
      const perifericoId = button.data('periferico-id');
      const item = button.closest('.periferico-disponivel-item');
      const perifericoMarca = item.find('.periferico-disponivel-marca').text();
      const perifericoModelo = item.find('.periferico-disponivel-modelo').text();
      
      if (PERIFERICOS_STATE.modalDadosPa && PERIFERICOS_STATE.modalDadosTipo) {
        const tipoNome = PERIFERICOS_STATE.modalDadosTipo.nome;
        adicionarAtribuicaoPendente(perifericoId, PERIFERICOS_STATE.modalDadosPa.id, perifericoMarca, perifericoModelo, PERIFERICOS_STATE.modalDadosTipo.nome, PERIFERICOS_STATE.modalDadosTipo.id);
        
        button.prop('disabled', true).html('<i class="bx bx-check me-1"></i>');
        gerenciarModal(PERIFERICOS_DOM.modals.perifericosDisponiveis, 'fechar');
        
        mostrarMensagem(`${tipoNome} ${perifericoMarca} adicionado à lista de pendências.`, 'info');
      } else {
        console.error('Dados incompletos para atribuição de periférico');
        mostrarMensagem('Erro: Dados incompletos para atribuição', 'error');
        button.prop('disabled', false).html('<i class="bx bx-link me-1"></i> Atribuir');
      }
    });

    // Botões de salvar/cancelar alterações
    $(document).on('click', '.save-all-changes-btn', function() {
      salvarTodasAsAtribuicoes($(this));
    });

    $(document).on('click', '.cancel-all-changes-btn', function(e) {
      e.preventDefault();
      e.stopPropagation();
      cancelarTodasAsAtribuicoes();
    });
  }
};

// =============================================================================
// INICIALIZAÇÃO E EXPOSIÇÃO GLOBAL
// =============================================================================

$(document).ready(function() {
  PerifericosEventHandlers.init();
});

// Exposição de funções para uso global (compatibilidade com código existente)
Object.assign(window, {
  atualizarPerifericosNaPA,
  fecharMenusPerifericoAtivos: fecharMenusAtivos,
  atualizarContadorAtribuicoesPendentes,
  adicionarAtribuicaoPendente,
  adicionarPerifericoPendenteVisualmente,
  abrirModalPerifericosDisponiveis,
  mostrarModalPerifericosDisponiveis: abrirModalPerifericosDisponiveis, // Alias para compatibilidade
  mostrarMenuPeriferico: abrirMenuAcoesPeriferico, // Alias para compatibilidade
  confirmarRemocaoPeriferico: abrirModalConfirmacao, // Alias para compatibilidade
  atualizarStatusPerifericoNoServidor,
  perifericosPendentes: PERIFERICOS_STATE.perifericosPendentes,
  perifericosPendentesPorTipo: PERIFERICOS_STATE.perifericosPendentesPorTipo
});