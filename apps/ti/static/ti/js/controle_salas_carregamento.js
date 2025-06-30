/**
 * controle_salas_carregamento.js - Sistema de carregamento otimizado via JavaScript
 * 
 * Este arquivo gerencia o carregamento dinâmico dos dados da página de controle de salas,
 * incluindo salas, ilhas e PAs, com filtros por loja e usuário restrito.
 */

// =============================================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// =============================================================================

window.modoCarregamento = 'otimizado'; // Sinaliza que está usando carregamento otimizado

const CARREGAMENTO_CONFIG = {
  urls: {
    dadosControleSalas: '/ti/api/controle-salas-data/',
    funcionarios: '/ti/api/funcionarios/',
    perifericos: '/ti/api/perifericos-disponiveis-por-tipo/{tipo_id}/',
    computadores: '/ti/api/computadores-disponiveis/'
  },
  cache: {
    habilitado: true,
    dadosGlobais: null,
    ultimaLoja: null,
    expiracaoMinutos: 5
  },
  timeouts: {
    requisicao: 15000,
    loading: 300,
    retry: 3000
  }
};

// Estado global do carregamento
const ESTADO_CARREGAMENTO = {
  carregandoLoja: false,
  carregandoSala: false,
  carregandoIlha: false,
  dadosCache: new Map(),
  configuracoesDjango: null
};

// =============================================================================
// FUNÇÕES DE INICIALIZAÇÃO
// =============================================================================

function inicializarCarregamento() {
  try {
    // Obter configurações do Django (usuário restrito, etc.)
    ESTADO_CARREGAMENTO.configuracoesDjango = obterConfiguracoesDjango();
    
    // Carregar dados iniciais baseado na loja selecionada
    const lojaId = ESTADO_CARREGAMENTO.configuracoesDjango.lojaSelecionada;
    
    if (lojaId) {
      carregarDadosLoja(lojaId);
    } else {
      mostrarEstadoVazio();
    }
    
    // Configurar eventos
    configurarEventosCarregamento();
  } catch (error) {
    console.error('Erro ao inicializar carregamento:', error);
    mostrarErroCarregamento('Erro ao inicializar sistema de carregamento');
  }
}

function obterConfiguracoesDjango() {
  const container = document.querySelector('#controle-salas-container');
  
  if (!container) {
    console.warn('Container principal não encontrado');
    return {
      usuarioRestrito: false,
      salasPermitidas: [],
      lojaSelecionada: null,
      lojaAtualNome: ''
    };
  }
  
  return {
    usuarioRestrito: container.getAttribute('data-usuario-restrito') === 'true',
    salasPermitidas: container.getAttribute('data-salas-permitidas')?.split(',').filter(s => s) || [],
    lojaSelecionada: container.getAttribute('data-loja-selecionada') || null,
    lojaAtualNome: container.getAttribute('data-loja-atual-nome') || ''
  };
}

function configurarEventosCarregamento() {
  // Event listener para mudança de loja
  $('#select-loja').off('change.carregamento').on('change.carregamento', function() {
    const lojaId = $(this).val();
    if (lojaId) {
      carregarDadosLoja(lojaId);
    } else {
      mostrarEstadoVazio();
    }
  });
  
  // Event listener para submit do formulário (previne reload da página)
  $('#form-filtro-loja').off('submit.carregamento').on('submit.carregamento', function(e) {
    e.preventDefault();
    const lojaId = $('#select-loja').val();
    
    if (lojaId) {
      // Atualizar URL sem recarregar página
      const url = new URL(window.location);
      url.searchParams.set('loja', lojaId);
      window.history.pushState({}, '', url);
      
      carregarDadosLoja(lojaId);
    }
  });
}

// =============================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS
// =============================================================================

async function carregarDadosLoja(lojaId, forcar = false) {
  if (ESTADO_CARREGAMENTO.carregandoLoja && !forcar) {
    console.log('Carregamento de loja já em andamento');
    return;
  }
  
  try {
    ESTADO_CARREGAMENTO.carregandoLoja = true;
    
    // Mostrar loading geral
    mostrarLoadingGeral('Carregando salas da loja...');
    
    // Verificar cache se não for forçado
    if (!forcar && CARREGAMENTO_CONFIG.cache.habilitado) {
      const dadosCache = obterDadosCache(`loja_${lojaId}`);
      if (dadosCache) {
        console.log('Usando dados do cache para loja:', lojaId);
        await renderizarDadosLoja(dadosCache, lojaId);
        return;
      }
    }
    
    // Fazer requisição para a API
    const response = await $.ajax({
      url: CARREGAMENTO_CONFIG.urls.dadosControleSalas,
      method: 'GET',
      data: { loja_id: lojaId },
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
      },
      timeout: CARREGAMENTO_CONFIG.timeouts.requisicao
    });
    
    if (response.success) {
      // Salvar no cache
      if (CARREGAMENTO_CONFIG.cache.habilitado) {
        salvarDadosCache(`loja_${lojaId}`, response.data);
      }
      
      // Renderizar dados
      await renderizarDadosLoja(response.data, lojaId);
    } else {
      throw new Error(response.error || 'Erro desconhecido ao carregar dados');
    }
    
  } catch (error) {
    console.error('Erro ao carregar dados da loja:', error);
    mostrarErroCarregamento('Erro ao carregar dados da loja: ' + error.message);
  } finally {
    ESTADO_CARREGAMENTO.carregandoLoja = false;
    ocultarLoadingGeral();
  }
}

async function carregarDadosSala(salaId, ilhaId = null, forcar = false) {
  if (ESTADO_CARREGAMENTO.carregandoSala && !forcar) {
    console.log('Carregamento de sala já em andamento');
    return;
  }
  
  try {
    ESTADO_CARREGAMENTO.carregandoSala = true;
    
    const lojaId = $('#select-loja').val();
    
    // Mostrar loading específico da sala
    mostrarLoadingNaSala(salaId, ilhaId);
    
    // Fazer requisição específica para a sala
    const response = await $.ajax({
      url: CARREGAMENTO_CONFIG.urls.dadosControleSalas,
      method: 'GET',
      data: { 
        loja_id: lojaId,
        sala_id: salaId,
        ilha_id: ilhaId 
      },
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
      },
      timeout: CARREGAMENTO_CONFIG.timeouts.requisicao
    });
    
    if (response.success) {
      await renderizarDadosSala(response.data, salaId, ilhaId);
    } else {
      throw new Error(response.error || 'Erro desconhecido ao carregar sala');
    }
    
      } catch (error) {
      console.error('Erro ao carregar dados da sala:', error);
      mostrarErroNaSala(salaId, 'Erro ao carregar dados da sala: ' + error.message);
    } finally {
      ESTADO_CARREGAMENTO.carregandoSala = false;
    }
  }

async function renderizarDadosSala(dados, salaId, ilhaId) {
  try {
    if (!dados.salas || dados.salas.length === 0) {
      mostrarErroNaSala(salaId, 'Nenhum dado encontrado para esta sala');
      return;
    }
    
    const sala = dados.salas[0]; // Como filtramos por salaId, deve haver apenas uma sala
    
    if (ilhaId) {
      // Renderizar apenas a ilha específica
      const ilha = sala.ilhas?.find(i => i.id.toString() === ilhaId.toString());
      if (ilha) {
        const $painelIlha = $(`#ilha-${ilhaId}-sala-${salaId}`);
        $painelIlha.find('.pa-container').html(await renderizarPAsIlha(ilha, dados));
      } else {
        mostrarErroNaSala(salaId, `Ilha ${ilhaId} não encontrada`);
      }
    } else {
      // Renderizar sala completa
      await renderizarConteudoSala(sala, dados);
    }
    
    // Reorganizar layout das PAs após renderização
    setTimeout(() => {
      if (window.organizarLayoutPAs) {
        window.organizarLayoutPAs();
      }
      
      // Reconfigurar eventos dos botões após renderização dinâmica
      reconfigurarEventosPAs();
    }, 100);
    
  } catch (error) {
    console.error('Erro ao renderizar dados da sala:', error);
    mostrarErroNaSala(salaId, 'Erro ao exibir dados da sala');
  }
}

// =============================================================================
// FUNÇÕES DE RENDERIZAÇÃO
// =============================================================================

async function renderizarDadosLoja(dados, lojaId) {
  try {
    // Atualizar informação da loja atual
    atualizarInfoLoja(lojaId);
    
    // Verificar se há salas para mostrar
    if (!dados.salas || dados.salas.length === 0) {
      mostrarEstadoVazio();
      return;
    }
    
    // Aplicar filtros de usuário restrito se necessário
    const salasFilteradas = aplicarFiltrosUsuario(dados.salas);
    
    if (salasFilteradas.length === 0) {
      mostrarEstadoSemPermissao();
      return;
    }
    
    // Renderizar abas de salas
    await renderizarAbasSalas(salasFilteradas);
    
    // Renderizar conteúdo da primeira sala (se houver)
    if (salasFilteradas.length > 0) {
      await renderizarConteudoSala(salasFilteradas[0], dados);
    }
    
    // Mostrar container das salas
    $('#salas-container').show();
    $('#empty-state').hide();
    
    // Configurar estado inicial das abas
    inicializarEstadoAbas(salasFilteradas[0]?.id);
    
    // Configurar eventos dos botões após renderização completa
    setTimeout(() => {
      reconfigurarEventosPAs();
    }, 200);
    
  } catch (error) {
    console.error('Erro ao renderizar dados da loja:', error);
    mostrarErroCarregamento('Erro ao exibir dados da loja');
  }
}

async function renderizarAbasSalas(salas) {
  const $salasTab = $('#salas-tab');
  const $salasContent = $('#salas-tab-content');
  
  // Limpar conteúdo anterior
  $salasTab.empty();
  $salasContent.empty();
  
  // Renderizar cada sala
  for (let i = 0; i < salas.length; i++) {
    const sala = salas[i];
    const isActive = i === 0;
    
    // Criar aba da sala
    const $abaSala = $(`
      <li class="nav-item" role="presentation">
        <button class="nav-link ${isActive ? 'active' : ''}" 
                id="sala-${sala.id}-tab" 
                data-sala-id="${sala.id}"
                type="button" 
                role="tab" 
                aria-controls="sala-${sala.id}" 
                aria-selected="${isActive}">
          <i class='bx bx-door-open me-2'></i>${sala.nome}
        </button>
      </li>
    `);
    $salasTab.append($abaSala);
    
    // Criar painel da sala
    const $painelSala = $(`
      <div class="tab-pane fade ${isActive ? 'show active' : ''}" 
           id="sala-${sala.id}" 
           role="tabpanel" 
           aria-labelledby="sala-${sala.id}-tab">
        <div class="ilhas-container">
          <ul class="nav nav-tabs ilhas-tabs" id="ilhas-sala-${sala.id}-tab" role="tablist">
            <!-- Abas das ilhas serão carregadas aqui -->
          </ul>
          <div class="tab-content ilhas-content" id="ilhas-sala-${sala.id}-content">
            <!-- Conteúdo das ilhas será carregado aqui -->
          </div>
        </div>
      </div>
    `);
    $salasContent.append($painelSala);
  }
}

async function renderizarConteudoSala(sala, dadosGlobais) {
  try {
    if (!sala.ilhas || sala.ilhas.length === 0) {
      mostrarSalaSemIlhas(sala.id);
      return;
    }
    
    const $ilhasTab = $(`#ilhas-sala-${sala.id}-tab`);
    const $ilhasContent = $(`#ilhas-sala-${sala.id}-content`);
    
    // Limpar conteúdo anterior
    $ilhasTab.empty();
    $ilhasContent.empty();
    
    // Renderizar cada ilha
    for (let i = 0; i < sala.ilhas.length; i++) {
      const ilha = sala.ilhas[i];
      const isActive = i === 0;
      
      // Criar aba da ilha
      const $abaIlha = $(`
        <li class="nav-item" role="presentation">
          <button class="nav-link ${isActive ? 'active' : ''}" 
                  id="ilha-${ilha.id}-sala-${sala.id}-tab" 
                  data-ilha-id="${ilha.id}"
                  type="button" 
                  role="tab" 
                  aria-controls="ilha-${ilha.id}-sala-${sala.id}" 
                  aria-selected="${isActive}">
            <i class='bx bx-layout me-2'></i>${ilha.nome}
          </button>
        </li>
      `);
      $ilhasTab.append($abaIlha);
      
      // Criar painel da ilha com PAs
      const $painelIlha = $(`
        <div class="tab-pane fade ${isActive ? 'show active' : ''}" 
             id="ilha-${ilha.id}-sala-${sala.id}" 
             role="tabpanel" 
             aria-labelledby="ilha-${ilha.id}-sala-${sala.id}-tab">
          <div class="pa-container">
            ${await renderizarPAsIlha(ilha, dadosGlobais)}
          </div>
        </div>
      `);
      $ilhasContent.append($painelIlha);
    }
    
  } catch (error) {
    console.error('Erro ao renderizar conteúdo da sala:', error);
    mostrarErroNaSala(sala.id, 'Erro ao carregar ilhas da sala');
  }
}

async function renderizarPAsIlha(ilha, dadosGlobais) {
  try {
    if (!ilha.posicoes || ilha.posicoes.length === 0) {
      return `
        <div class="empty-state">
          <i class='bx bx-desktop'></i>
          <h5>Nenhuma PA cadastrada</h5>
          <p>Esta ilha ainda não possui posições de atendimento.</p>
        </div>
      `;
    }
    
    // Organizar PAs em duas colunas conforme solicitado:
    // Metade de um lado e metade do outro, uma em cima da outra (vertical)
    const pasOrdenadas = ilha.posicoes.sort((a, b) => a.numero - b.numero);
    const totalPAs = pasOrdenadas.length;
    const metade = Math.ceil(totalPAs / 2);
    
    // Coluna esquerda: PAs de 1 até metade
    const colunaEsquerda = pasOrdenadas.slice(0, metade);
    // Coluna direita: PAs da metade+1 até o final
    const colunaDireita = pasOrdenadas.slice(metade);
    
    return `
      <div class="pa-grid-dual-column">
        <div class="pa-column pa-column-left">
          ${colunaEsquerda.map(pa => renderizarCardPA(pa, dadosGlobais)).join('')}
        </div>
        <div class="pa-column pa-column-right">
          ${colunaDireita.map(pa => renderizarCardPA(pa, dadosGlobais)).join('')}
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Erro ao renderizar PAs da ilha:', error);
    return `
      <div class="empty-state">
        <i class='bx bx-error-circle'></i>
        <h5>Erro ao carregar PAs</h5>
        <p>Ocorreu um erro ao carregar as posições de atendimento.</p>
      </div>
    `;
  }
}

function renderizarCardPA(pa, dadosGlobais) {
  const statusConfig = {
    livre: { class: 'status-livre', badge: 'bg-success', text: 'Livre' },
    ocupada: { class: 'status-ocupada', badge: 'bg-primary', text: 'Ocupada' },
    manutencao: { class: 'status-manutencao', badge: 'bg-warning text-dark', text: 'Em Manutenção' },
    inativa: { class: 'status-inativa', badge: 'bg-danger', text: 'Inativa' }
  };
  
  const status = statusConfig[pa.status] || statusConfig.livre;
  const usuarioRestrito = ESTADO_CARREGAMENTO.configuracoesDjango?.usuarioRestrito || false;
  
  return `
    <div class="pa-card" data-pa-id="${pa.id}">
      <div class="pa-header">
        <div class="pa-title">
          <span>PA ${pa.numero}</span>
        </div>
        <div class="pa-status-group">
          <span class="badge ${status.badge}">${status.text}</span>
          <div class="pa-status-indicator ${status.class}" 
               title="Clique para alterar status"
               ${usuarioRestrito ? 'style="cursor: not-allowed; opacity: 0.5;"' : ''}></div>
        </div>
      </div>
      <div class="pa-content">
        ${renderizarFuncionarioPA(pa, usuarioRestrito)}
        ${renderizarPerifericosPA(pa, dadosGlobais, usuarioRestrito)}
        ${renderizarComputadoresPA(pa, dadosGlobais, usuarioRestrito)}
      </div>
    </div>
  `;
}

function renderizarFuncionarioPA(pa, usuarioRestrito) {
  if (pa.funcionario && pa.funcionario_data) {
    const funcionario = pa.funcionario_data;
    const ramalTexto = funcionario.ramal ? funcionario.ramal : 'N/A';
    
    let infoAdicional = '';
    if (funcionario.cargo || funcionario.departamento) {
      infoAdicional = `
        <div class="funcionario-info">
          ${funcionario.cargo ? `<span class="funcionario-cargo"><i class='bx bx-briefcase me-1'></i>${funcionario.cargo}</span>` : ''}
          ${funcionario.departamento ? `<span class="funcionario-departamento"><i class='bx bx-building me-1'></i>${funcionario.departamento}</span>` : ''}
        </div>
      `;
    }
    
    return `
      <div class="pa-funcionario">
        <div>
          <span><strong>Funcionário:</strong> ${funcionario.nome_completo}</span>
          <button class="btn btn-outline-secondary btn-sm ramal-badge ms-2" 
                  data-pa-id="${pa.id}"
                  data-action="change"
                  title="Ramal: ${ramalTexto}"
                  ${usuarioRestrito ? 'disabled' : ''}>
            <i class='bx bx-phone'></i> ${ramalTexto}
          </button>
        </div>
        ${infoAdicional}
      </div>
    `;
  } else if (pa.funcionario) {
    // Fallback para quando só temos o nome (compatibilidade)
    return `
      <div class="pa-funcionario">
        <div>
          <span><strong>Funcionário:</strong> ${pa.funcionario}</span>
          <button class="btn btn-outline-secondary btn-sm ramal-badge ms-2" 
                  data-pa-id="${pa.id}"
                  data-action="change"
                  ${usuarioRestrito ? 'disabled' : ''}>
            <i class='bx bx-phone'></i> 
          </button>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="pa-funcionario">
        <div>
          <span><strong>Funcionário:</strong> <em>Não atribuído</em></span>
          <button class="btn btn-primary btn-sm assign-funcionario-btn ms-2" 
                  data-pa-id="${pa.id}"
                  data-action="assign"
                  ${usuarioRestrito ? 'disabled' : ''}>
            <i class='bx bx-user-plus'></i> Atribuir
          </button>
        </div>
      </div>
    `;
  }
}

function renderizarPerifericosPA(pa, dadosGlobais, usuarioRestrito) {
  let html = `
    <div class="pa-perifericos">
      <h6><i class='bx bx-devices me-2'></i>Periféricos</h6>
      <div class="perifericos-list">
  `;
  
  if (pa.perifericos && pa.perifericos.length > 0) {
    pa.perifericos.forEach(periferico => {
      html += `
        <span class="periferico-tag" data-periferico-id="${periferico.id}" data-periferico-tipo="${periferico.tipo}">
          ${periferico.tipo} ${periferico.marca} ${periferico.modelo ? `(${periferico.modelo})` : ''}
          ${!usuarioRestrito ? '<i class="fas fa-times remove-periferico-btn ms-1" title="Remover"></i>' : ''}
        </span>
      `;
    });
  } else {
    html += `<span class="text-muted">Nenhum periférico atribuído</span>`;
  }
  
  html += `</div>`;
  
  // Mostrar periféricos faltantes se houver
  if (pa.faltando && pa.faltando.length > 0) {
    html += `
      <div class="perifericos-faltantes mt-2">
        <h6><i class='bx bx-error text-warning me-2'></i>Faltando</h6>
        <div class="perifericos-faltantes-list">
    `;
    
    pa.faltando.forEach(tipo => {
      // Buscar o ID do tipo de periférico no cache ou dados globais
      let tipoId = null;
      
      // Tentar encontrar o tipo nos dados globais primeiro
      if (dadosGlobais?.tipos_perifericos) {
        const tipoEncontrado = dadosGlobais.tipos_perifericos.find(t => t.nome === tipo);
        if (tipoEncontrado) {
          tipoId = tipoEncontrado.id;
        }
      }
      
      // Se não encontrou, tentar no cache global
      if (!tipoId && window.tiposPerifericosCache) {
        const tipoEncontrado = window.tiposPerifericosCache.find(t => t.nome === tipo);
        if (tipoEncontrado) {
          tipoId = tipoEncontrado.id;
        }
      }
      
      html += `
        <div class="periferico-faltante-item">
          <span class="periferico-faltante-nome">${tipo}</span>
          <button class="btn btn-outline-warning btn-sm add-periferico-btn" 
                  data-pa-id="${pa.id}"
                  data-tipo-id="${tipoId || ''}"
                  data-tipo-nome="${tipo}"
                  ${usuarioRestrito ? 'disabled' : ''}>
            <i class='bx bx-plus'></i> Adicionar
          </button>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  
  return html;
}

function renderizarComputadoresPA(pa, dadosGlobais, usuarioRestrito) {
  let html = `
    <div class="pa-computadores">
      <h6><i class='bx bx-desktop me-2'></i>Computadores</h6>
      <div class="computadores-list">
  `;
  
  if (pa.computadores && pa.computadores.length > 0) {
    pa.computadores.forEach(computador => {
      html += `
        <span class="computador-tag" data-computador-id="${computador.id}">
          ${computador.marca}
          ${!usuarioRestrito ? '<i class="fas fa-times remove-computador-btn ms-1" title="Remover"></i>' : ''}
        </span>
      `;
    });
  } else {
    html += `
      <button class="btn btn-primary btn-sm assign-computador-btn-main" 
              data-pa-id="${pa.id}"
              ${usuarioRestrito ? 'disabled' : ''}>
        <i class='bx bx-plus'></i> Atribuir Computador
      </button>
    `;
  }
  
  html += `</div></div>`;
  
  return html;
}

// =============================================================================
// FUNÇÕES DE CONFIGURAÇÃO DE EVENTOS
// =============================================================================

function reconfigurarEventosPAs() {
  try {
    // Reconfigurar eventos dos indicadores de status
    if (window.EventHandlers && window.EventHandlers.setupStatusIndicators) {
      window.EventHandlers.setupStatusIndicators();
    }
    
    // Reconfigurar eventos dos botões de funcionários
    $('.assign-funcionario-btn').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const paId = $(this).data('pa-id');
      
      if (window.mostrarDropdownFuncionarios) {
        window.mostrarDropdownFuncionarios(this, paId);
      } else {
        console.error('Função mostrarDropdownFuncionarios não encontrada');
      }
    });
    
    // Eventos dos botões de periféricos são gerenciados pelo controle_salas_perifericos.js
    // Removendo event handler duplicado para evitar conflitos
    
    // Reconfigurar eventos dos botões de remoção de periféricos
    $('.remove-periferico-btn').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const perifericoTag = $(this).closest('.periferico-tag');
      const paCard = $(this).closest('.pa-card');
      const paId = paCard.data('pa-id');
      const perifericoId = perifericoTag.data('periferico-id');
      
      if (window.confirmarRemocaoPeriferico) {
        window.confirmarRemocaoPeriferico(perifericoId, paId, perifericoTag.text().replace('×', '').trim(), perifericoTag);
      } else {
        console.error('Função confirmarRemocaoPeriferico não encontrada');
      }
    });
    
    // Reconfigurar eventos dos botões de computadores
    $('.assign-computador-btn-main').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const paCard = $(this).closest('.pa-card');
      const paId = paCard.data('pa-id');
      
      if (window.mostrarDropdownComputadores) {
        window.mostrarDropdownComputadores(this, paId);
      } else {
        console.error('Função mostrarDropdownComputadores não encontrada');
      }
    });
    
    // Reconfigurar eventos dos botões de remoção de computadores
    $('.remove-computador-btn').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const computadorTag = $(this).closest('.computador-tag');
      const paCard = $(this).closest('.pa-card');
      const paId = paCard.data('pa-id');
      const computadorId = computadorTag.data('computador-id');
      
      if (window.removerComputadorDaPA) {
        window.removerComputadorDaPA(paId, computadorId);
      } else {
        console.error('Função removerComputadorDaPA não encontrada');
      }
    });
    
    // Reconfigurar eventos para tags de periféricos (menu de contexto)
    $('.periferico-tag').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      if (window.mostrarMenuPeriferico) {
        window.mostrarMenuPeriferico($(this));
      }
    });
    
    // Reconfigurar eventos para tags de computadores (menu de contexto)
    $('.computador-tag').off('click.carregamento').on('click.carregamento', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      if (window.mostrarMenuComputador) {
        window.mostrarMenuComputador($(this));
      }
    });
    
  } catch (error) {
    console.error('Erro ao reconfigurar eventos das PAs:', error);
  }
}

// =============================================================================
// FUNÇÕES DE UTILIDADE E ESTADO
// =============================================================================

function aplicarFiltrosUsuario(salas) {
  const config = ESTADO_CARREGAMENTO.configuracoesDjango;
  
  if (!config?.usuarioRestrito) {
    return salas; // Usuário sem restrição vê todas as salas
  }
  
  if (!config.salasPermitidas || config.salasPermitidas.length === 0) {
    return []; // Usuário restrito sem salas permitidas
  }
  
  // Filtrar apenas salas permitidas
  return salas.filter(sala => config.salasPermitidas.includes(sala.id.toString()));
}

function atualizarInfoLoja(lojaId) {
  const $selectLoja = $('#select-loja');
  const $lojaInfo = $('#loja-info-text');
  const $lojaNome = $('#loja-atual-nome');
  
  const lojaTexto = $selectLoja.find(`option[value="${lojaId}"]`).text();
  
  if (lojaTexto) {
    $lojaNome.text(lojaTexto);
    $lojaInfo.show();
  }
}

function inicializarEstadoAbas(primeiraSalaId) {
  if (primeiraSalaId) {
    // Atualizar estado global se disponível
    if (window.STATE) {
      window.STATE.currentSalaId = primeiraSalaId;
      
      // Inicializar state das ilhas da primeira sala
      const primeiraIlha = document.querySelector(`#sala-${primeiraSalaId} .ilhas-tabs .nav-link.active`);
      if (primeiraIlha) {
        const ilhaId = primeiraIlha.getAttribute('data-ilha-id');
        if (ilhaId) {
          if (!window.STATE.currentIlhaIds) {
            window.STATE.currentIlhaIds = {};
          }
          window.STATE.currentIlhaIds[primeiraSalaId] = ilhaId;
        }
      }
    }
  }
}

// =============================================================================
// FUNÇÕES DE LOADING E ESTADOS
// =============================================================================

function mostrarLoadingGeral(mensagem = 'Carregando...') {
  const $loading = $('#loading-inicial');
  $loading.find('p').text(mensagem);
  $loading.show();
  $('#salas-container').hide();
  $('#empty-state').hide();
}

function ocultarLoadingGeral() {
  $('#loading-inicial').hide();
}

function mostrarLoadingNaSala(salaId, ilhaId = null) {
  const seletor = ilhaId ? 
    `#ilha-${ilhaId}-sala-${salaId} .pa-container` : 
    `#sala-${salaId} .pa-container`;
  
  $(seletor).html(`
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2">Atualizando dados...</p>
    </div>
  `);
}

function mostrarEstadoVazio() {
  $('#loading-inicial').hide();
  $('#salas-container').hide();
  $('#empty-state').show();
}

function mostrarEstadoSemPermissao() {
  $('#loading-inicial').hide();
  $('#salas-container').hide();
  
  const $emptyState = $('#empty-state');
  $emptyState.find('i').attr('class', 'bx bx-lock-alt');
  $emptyState.find('h5').text('Acesso Restrito');
  $emptyState.find('p').text('Você não possui permissão para visualizar salas desta loja.');
  $emptyState.find('.btn').hide();
  $emptyState.show();
}

function mostrarSalaSemIlhas(salaId) {
  $(`#sala-${salaId} .ilhas-container`).html(`
    <div class="empty-state">
      <i class='bx bx-layout'></i>
      <h5>Nenhuma ilha cadastrada</h5>
      <p>Esta sala ainda não possui ilhas configuradas.</p>
    </div>
  `);
}

function mostrarErroCarregamento(mensagem) {
  $('#loading-inicial').hide();
  $('#salas-container').hide();
  
  const $emptyState = $('#empty-state');
  $emptyState.find('i').attr('class', 'bx bx-error-circle');
  $emptyState.find('h5').text('Erro ao Carregar');
  $emptyState.find('p').text(mensagem);
  $emptyState.find('.btn').text('Tentar Novamente').show();
  $emptyState.show();
  
  // Mostrar mensagem de erro também
  if (window.mostrarMensagem) {
    window.mostrarMensagem(mensagem, 'error');
  }
}

function mostrarErroNaSala(salaId, mensagem) {
  $(`#sala-${salaId}`).html(`
    <div class="empty-state">
      <i class='bx bx-error-circle'></i>
      <h5>Erro ao Carregar Sala</h5>
      <p>${mensagem}</p>
    </div>
  `);
}

// =============================================================================
// SISTEMA DE CACHE
// =============================================================================

function salvarDadosCache(chave, dados) {
  try {
    const item = {
      dados: dados,
      timestamp: Date.now(),
      expiracao: Date.now() + (CARREGAMENTO_CONFIG.cache.expiracaoMinutos * 60 * 1000)
    };
    
    ESTADO_CARREGAMENTO.dadosCache.set(chave, item);
    
    // Limpar cache antigo ocasionalmente
    if (ESTADO_CARREGAMENTO.dadosCache.size > 10) {
      limparCacheExpirado();
    }
  } catch (error) {
    console.warn('Erro ao salvar no cache:', error);
  }
}

function obterDadosCache(chave) {
  try {
    const item = ESTADO_CARREGAMENTO.dadosCache.get(chave);
    
    if (!item) return null;
    
    // Verificar se expirou
    if (Date.now() > item.expiracao) {
      ESTADO_CARREGAMENTO.dadosCache.delete(chave);
      return null;
    }
    
    return item.dados;
  } catch (error) {
    console.warn('Erro ao obter do cache:', error);
    return null;
  }
}

function limparCacheExpirado() {
  const agora = Date.now();
  
  for (const [chave, item] of ESTADO_CARREGAMENTO.dadosCache.entries()) {
    if (agora > item.expiracao) {
      ESTADO_CARREGAMENTO.dadosCache.delete(chave);
    }
  }
}

function limparTodoCache() {
  ESTADO_CARREGAMENTO.dadosCache.clear();
}

// =============================================================================
// EXPOSIÇÃO GLOBAL E INICIALIZAÇÃO
// =============================================================================

// Expor funções globalmente para uso por outros módulos
Object.assign(window, {
  carregarDadosLoja,
  carregarDadosSala,
  mostrarLoadingNaSala,
  mostrarLoadingGeral,
  ocultarLoadingGeral,
  limparTodoCache,
  reconfigurarEventosPAs
});

// Auto-inicialização quando o DOM estiver pronto
$(document).ready(function() {
  try {
    // Aguardar um pouco para garantir que outros scripts tenham carregado
    setTimeout(inicializarCarregamento, 100);
  } catch (error) {
    console.error('Erro ao inicializar carregamento automático:', error);
  }
}); 