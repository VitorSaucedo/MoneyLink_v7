/**
 * controle_salas_carregamento.js - Sistema de carregamento e cache de dados das salas
 * 
 * Este arquivo contém as funcionalidades relacionadas ao carregamento de dados:
 * - Sistema de cache inteligente
 * - Carregamento otimizado de salas/ilhas
 * - Indicadores de carregamento
 * - Renderização de dados na interface
 * 
 * DEPENDÊNCIAS:
 * - controle_salas_mensagens.js (função mostrarMensagem)
 * - controle_salas_funcionarios.js (atualizarVisualizacaoFuncionarioPA)
 * - controle_salas_perifericos.js (atualizarPerifericosNaPA)
 * - controle_salas_computadores.js (atualizarVisualizacaoComputadoresPA)
 */

// Variáveis globais para carregamento
let dadosCarregados = {};
let carregamentosEmCurso = {};
let modoCarregamento = 'otimizado'; // 'otimizado' ou 'sob_demanda'

/**
 * Mostrar indicador de carregamento na sala/ilha
 * @param {string} salaId - ID da sala
 * @param {string|null} ilhaId - ID da ilha (opcional)
 */
function mostrarLoadingNaSala(salaId, ilhaId = null) {
  const containerSeletor = ilhaId 
    ? `#ilha-${ilhaId}`
    : `#sala-${salaId}`;
  
  const container = document.querySelector(containerSeletor);
  if (container) {
    // Adicionar overlay de carregamento se não existir
    if (!container.querySelector('.loading-overlay')) {
      const loadingHtml = `
        <div class="loading-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                                      background-color: rgba(255,255,255,0.7); z-index: 1000; display: flex; 
                                      justify-content: center; align-items: center;">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
        </div>
      `;
      container.style.position = 'relative'; // Assegurar posicionamento relativo
      container.insertAdjacentHTML('beforeend', loadingHtml);
    }
  }
}

/**
 * Esconder indicador de carregamento na sala/ilha
 * @param {string} salaId - ID da sala
 * @param {string|null} ilhaId - ID da ilha (opcional)
 */
function esconderLoadingNaSala(salaId, ilhaId = null) {
  const containerSeletor = ilhaId 
    ? `#ilha-${ilhaId}`
    : `#sala-${salaId}`;
  
  const container = document.querySelector(containerSeletor);
  if (container) {
    const overlay = container.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
}

/**
 * Carregar dados da sala/ilha especificada
 * @param {string} salaId - ID da sala
 * @param {string|null} ilhaId - ID da ilha (opcional)
 * @param {boolean} forcarRecarga - Forçar recarga ignorando cache
 * @returns {Promise} Promise do carregamento
 */
async function carregarDadosSala(salaId, ilhaId = null, forcarRecarga = false) {
  // Chave única para esta combinação de sala/ilha/loja
  const lojaId = $('#select-loja').val();
  const cacheKey = `sala_${salaId}_ilha_${ilhaId || 'todas'}_loja_${lojaId}`;
  
  // Evitar múltiplas requisições simultâneas para a mesma sala/ilha
  if (carregamentosEmCurso[cacheKey]) {
    return;
  }
  
  // Verificar se já temos os dados em cache, exceto se forçar recarga
  if (!forcarRecarga && dadosCarregados[cacheKey]) {
    renderizarDadosSala(dadosCarregados[cacheKey], salaId, ilhaId);
    return;
  }
  
  // Marcar que estamos carregando esta sala/ilha
  carregamentosEmCurso[cacheKey] = true;
  
  try {
    // Construir URL com parâmetros de filtro
    let url = '/ti/api/controle-salas-data/';
    let params = { sala_id: salaId };
    if (ilhaId) {
      params.ilha_id = ilhaId;
    }
    if (lojaId) {
      params.loja_id = lojaId;
    }
    
    // Fazer a requisição usando jQuery
    const response = await $.ajax({
      url: url,
      method: 'GET',
      data: params,
      dataType: 'json'
    });
    
    // Processar a resposta
    if (response.success) {
      // Armazenar dados em cache
      dadosCarregados[cacheKey] = response;
      
      // Armazenar tipos de periféricos comuns globalmente
      if (response.data && response.data.tipos_perifericos_comuns) {
        window.tiposPerifericosComuns = response.data.tipos_perifericos_comuns;
      }
      
      // Renderizar os dados na interface
      renderizarDadosSala(response, salaId, ilhaId);
    } else {
      throw new Error(response.error || 'Erro ao carregar dados da sala');
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    if (typeof window.mostrarMensagem === 'function') {
      window.mostrarMensagem(`Erro ao carregar dados: ${error.message}`, 'error');
    }
  } finally {
    // Finalizar indicadores de carregamento
    esconderLoadingNaSala(salaId, ilhaId);
    delete carregamentosEmCurso[cacheKey];
  }
}

/**
 * Renderizar os dados recebidos da API na interface
 * @param {Object} data - Dados recebidos da API
 * @param {string} salaId - ID da sala
 * @param {string|null} ilhaId - ID da ilha (opcional)
 */
function renderizarDadosSala(data, salaId, ilhaId = null) {
  // Obtemos as posições da resposta, considerando a nova estrutura da API
  const responseData = data.data || data;
  const posicoes = responseData.posicoes || [];
  
  // Para cada posição, encontramos o elemento correspondente e atualizamos
  posicoes.forEach(pa => {
    const $paCardElement = $(`.pa-card[data-pa-id="${pa.id}"]`);
    if ($paCardElement.length === 0) return; // Pular se o elemento não for encontrado
    
    // Atualizar status da PA
    if (typeof window.atualizarVisualizacaoStatusPA === 'function') {
      window.atualizarVisualizacaoStatusPA($paCardElement[0], pa.status);
    }
    
    // Atualizar funcionário
    if (pa.funcionario && typeof window.atualizarVisualizacaoFuncionarioPA === 'function') {
      window.atualizarVisualizacaoFuncionarioPA($paCardElement[0], pa.funcionario, pa.status);
    } else {
      // Limpar dados de funcionário
      const $funcionarioInfoElem = $paCardElement.find('.funcionario-info');
      if ($funcionarioInfoElem.length > 0) {
        $funcionarioInfoElem.html('<span class="text-muted">Sem funcionário atribuído</span>');
      }
    }
    
    // Atualizar periféricos
    if (typeof window.atualizarPerifericosNaPA === 'function') {
      window.atualizarPerifericosNaPA($paCardElement[0], pa.perifericos, pa.faltando);
    }
    
    // Atualizar computadores
    if (typeof window.atualizarVisualizacaoComputadoresPA === 'function') {
      window.atualizarVisualizacaoComputadoresPA($paCardElement[0], pa.computadores);
    }
  });
  
  // Se temos mais dados para carregar (paginação)
  if (data.meta && data.meta.mais_resultados) {
    console.log('Há mais resultados disponíveis');
  }
}

/**
 * Limpar cache de dados (útil para forçar recarga)
 * @param {string|null} chaveEspecifica - Chave específica para limpar (opcional)
 */
function limparCacheCarregamento(chaveEspecifica = null) {
  if (chaveEspecifica) {
    delete dadosCarregados[chaveEspecifica];
  } else {
    dadosCarregados = {};
  }
}

/**
 * Verificar se dados estão em cache
 * @param {string} salaId - ID da sala
 * @param {string|null} ilhaId - ID da ilha (opcional)
 * @returns {boolean} Se os dados estão em cache
 */
function temDadosEmCache(salaId, ilhaId = null) {
  const lojaId = $('#select-loja').val();
  const cacheKey = `sala_${salaId}_ilha_${ilhaId || 'todas'}_loja_${lojaId}`;
  return !!dadosCarregados[cacheKey];
}

// Tornar funções disponíveis globalmente
window.mostrarLoadingNaSala = mostrarLoadingNaSala;
window.esconderLoadingNaSala = esconderLoadingNaSala;
window.carregarDadosSala = carregarDadosSala;
window.renderizarDadosSala = renderizarDadosSala;
window.limparCacheCarregamento = limparCacheCarregamento;
window.temDadosEmCache = temDadosEmCache;

// Tornar variáveis globais disponíveis
window.dadosCarregados = dadosCarregados;
window.carregamentosEmCurso = carregamentosEmCurso;
window.modoCarregamento = modoCarregamento; 