/**
 * admin_data_loader.js - Carregamento dinâmico de dados para formulários de administração
 * 
 * Este arquivo é responsável por:
 * - Carregar dados de dropdowns via AJAX
 * - Substituir a funcionalidade dos templates Python
 * - Gerenciar cache de dados para melhor performance
 */

// Namespace para o carregador de dados
window.TIAdminDataLoader = {
  // Cache para armazenar dados carregados
  cache: {
    lojas: null,
    funcionarios: null,
    salas: null,
    ilhas: null,
    tipos_perifericos: null
  },
  
  // API URLs - configurar conforme as rotas do Django
  urls: {
    lojas: '/ti/api/lojas/',
    funcionarios: '/ti/api/funcionarios/',
    salas: '/ti/api/salas-por-loja/',
    ilhas: '/ti/api/ilhas-por-sala/',
    tipos_perifericos: '/ti/api/tipos-perifericos/'
  },
  
  /**
   * Inicializa o carregador de dados
   */
  init: function() {
    console.log('🔄 Inicializando TIAdminDataLoader...');
    this.loadInitialData();
    this.setupEventListeners();
  },
  
  /**
   * Carrega dados iniciais necessários
   */
  loadInitialData: function() {
    // Carregar lojas em todos os selects de loja
    this.loadLojas();
    
    // Carregar funcionários em todos os selects de funcionário
    this.loadFuncionarios();
    
    // Carregar tipos de periféricos
    this.loadTiposPeriferico();
  },
  
  /**
   * Configura event listeners para atualizações dinâmicas
   */
  setupEventListeners: function() {
    const self = this;
    
    // Quando uma loja for selecionada, carregar salas correspondentes
    $(document).on('change', 'select[name="loja"]', function() {
      const lojaId = $(this).val();
      const formId = $(this).closest('form').attr('id');
      
      if (lojaId) {
        self.loadSalasByLoja(lojaId, formId);
      } else {
        self.clearSalasDropdowns(formId);
      }
    });
    
    // Quando uma sala for selecionada, carregar ilhas correspondentes
    $(document).on('change', 'select[name="sala"]', function() {
      const salaId = $(this).val();
      const formId = $(this).closest('form').attr('id');
      
      if (salaId) {
        self.loadIlhasBySala(salaId, formId);
      } else {
        self.clearIlhasDropdowns(formId);
      }
    });
  },
  
  /**
   * Helper function to get CSRF token
   */
  getCSRFToken: function() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
           $('[name=csrfmiddlewaretoken]').val() || '';
  },

  /**
   * Carrega lista de lojas
   */
  loadLojas: function() {
    const self = this;
    
    // Se já está em cache, usar dados do cache
    if (this.cache.lojas) {
      this.populateLojasDropdowns(this.cache.lojas);
      return;
    }
    
    // Carregar lojas via AJAX
    $.ajax({
      url: this.urls.lojas,
      method: 'GET',
      headers: {
        'X-CSRFToken': this.getCSRFToken()
      },
      dataType: 'json',
      success: function(response) {
        // A API retorna {data: {lojas: [...]}} então acessamos response.data.lojas
        const lojas = response.data?.lojas || [];
        self.cache.lojas = lojas;
        self.populateLojasDropdowns(lojas);
        console.log('✅ Lojas carregadas com sucesso:', lojas.length, 'lojas encontradas');
      },
      error: function(xhr, status, error) {
        console.error('❌ Erro ao carregar lojas:', error);
        // Fallback para dados vazios em caso de erro
        const fallbackLojas = [];
        self.cache.lojas = fallbackLojas;
        self.populateLojasDropdowns(fallbackLojas);
        self.showError('Erro ao carregar lojas. Verifique sua conexão e tente novamente.');
      }
    });
  },
  
  /**
   * Carrega lista de funcionários
   */
  loadFuncionarios: function() {
    const self = this;
    
    // Se já está em cache, usar dados do cache
    if (this.cache.funcionarios) {
      this.populateFuncionariosDropdowns(this.cache.funcionarios);
      return;
    }
    
    // Em produção, usar AJAX:
    $.ajax({
      url: this.urls.funcionarios,
      method: 'GET',
      headers: {
        'X-CSRFToken': this.getCSRFToken()
      },
      dataType: 'json',
      success: function(data) {
        // A API retorna {funcionarios: [...]} então acessamos data.funcionarios
        const funcionarios = data.funcionarios || [];
        self.cache.funcionarios = funcionarios;
        self.populateFuncionariosDropdowns(funcionarios);
        console.log('✅ Funcionários carregados com sucesso:', funcionarios.length, 'funcionários encontrados');
      },
      error: function(xhr, status, error) {
        console.error('❌ Erro ao carregar funcionários:', error);
        // Fallback para dados vazios em caso de erro
        const fallbackFuncionarios = [];
        self.cache.funcionarios = fallbackFuncionarios;
        self.populateFuncionariosDropdowns(fallbackFuncionarios);
        self.showError('Erro ao carregar funcionários. Verifique sua conexão e tente novamente.');
      }
    });
  },
  
  /**
   * Carrega tipos de periféricos
   */
  loadTiposPeriferico: function() {
    const self = this;
    
    // Se já está em cache, usar dados do cache
    if (this.cache.tipos_perifericos) {
      this.populateTiposPerifericoDropdown(this.cache.tipos_perifericos);
      return;
    }
    
    // Carregar tipos de periféricos via AJAX
    $.ajax({
      url: this.urls.tipos_perifericos,
      method: 'GET',
      headers: {
        'X-CSRFToken': this.getCSRFToken()
      },
      dataType: 'json',
      success: function(response) {
        // A API retorna {data: {tipos_perifericos: [...]}} então acessamos response.data.tipos_perifericos
        const tipos = response.data?.tipos_perifericos || [];
        // Converter formato da API para o formato esperado pelo dropdown
        const tiposFormatados = tipos.map(tipo => ({
          value: tipo.id,
          text: tipo.nome
        }));
        self.cache.tipos_perifericos = tiposFormatados;
        self.populateTiposPerifericoDropdown(tiposFormatados);
        console.log('✅ Tipos de periféricos carregados com sucesso:', tiposFormatados.length, 'tipos encontrados');
      },
      error: function(xhr, status, error) {
        console.error('❌ Erro ao carregar tipos de periférico:', error);
        // Fallback para dados vazios em caso de erro
        const fallbackTipos = [];
        self.cache.tipos_perifericos = fallbackTipos;
        self.populateTiposPerifericoDropdown(fallbackTipos);
        self.showError('Erro ao carregar tipos de periféricos. Verifique sua conexão e tente novamente.');
      }
    });
  },
  
  /**
   * Carrega salas baseadas na loja selecionada (usando função centralizada)
   * @param {string} lojaId - ID da loja
   * @param {string} formId - ID do formulário (opcional)
   */
  loadSalasByLoja: function(lojaId, formId) {
    if (window.TIAdminUtils && window.TIAdminUtils.carregarSalasPorLoja) {
      const $salaSelect = formId ? $(`#${formId} select[name="sala"]`) : $('select[name="sala"]');
      window.TIAdminUtils.carregarSalasPorLoja(lojaId, $salaSelect);
    } else {
      // Fallback para compatibilidade
      const self = this;
      
      if (!lojaId) {
        this.clearSalasDropdowns(formId);
        return;
      }

      const cacheKey = `salas_${lojaId}`;
      if (this.cache[cacheKey]) {
        this.populateSalasDropdowns(this.cache[cacheKey], formId);
        return;
      }

      $.ajax({
        url: `${this.urls.salas}${lojaId}/`,
        method: 'GET',
        headers: {
          'X-CSRFToken': this.getCSRFToken()
        },
        dataType: 'json',
        success: function(response) {
          const salas = response.data?.salas || [];
          self.cache[cacheKey] = salas;
          self.populateSalasDropdowns(salas, formId);
          console.log('✅ Salas carregadas com sucesso:', salas.length, 'salas encontradas');
        },
        error: function(xhr, status, error) {
          console.error('❌ Erro ao carregar salas:', error);
          const fallbackSalas = [];
          self.cache[cacheKey] = fallbackSalas;
          self.populateSalasDropdowns(fallbackSalas, formId);
          self.showError('Erro ao carregar salas. Verifique sua conexão e tente novamente.');
        }
      });
    }
  },
  
  /**
   * Carrega ilhas baseadas na sala selecionada (usando função centralizada)
   * @param {string} salaId - ID da sala
   * @param {string} formId - ID do formulário (opcional)
   */
  loadIlhasBySala: function(salaId, formId) {
    if (window.TIAdminUtils && window.TIAdminUtils.carregarIlhasPorSala) {
      const $ilhaSelect = formId ? $(`#${formId} select[name="ilha"]`) : $('select[name="ilha"]');
      window.TIAdminUtils.carregarIlhasPorSala(salaId, $ilhaSelect);
    } else {
      // Fallback para compatibilidade
      const self = this;
      
      if (!salaId) {
        this.clearIlhasDropdowns(formId);
        return;
      }

      const cacheKey = `ilhas_${salaId}`;
      if (this.cache[cacheKey]) {
        this.populateIlhasDropdowns(this.cache[cacheKey], formId);
        return;
      }

      $.ajax({
        url: `${this.urls.ilhas}${salaId}/`,
        method: 'GET',
        headers: {
          'X-CSRFToken': this.getCSRFToken()
        },
        dataType: 'json',
        success: function(response) {
          const ilhas = response.ilhas || [];
          self.cache[cacheKey] = ilhas;
          self.populateIlhasDropdowns(ilhas, formId);
          console.log('✅ Ilhas carregadas com sucesso:', ilhas.length, 'ilhas encontradas');
        },
        error: function(xhr, status, error) {
          console.error('❌ Erro ao carregar ilhas:', error);
          const fallbackIlhas = [];
          self.cache[cacheKey] = fallbackIlhas;
          self.populateIlhasDropdowns(fallbackIlhas, formId);
          self.showError('Erro ao carregar ilhas. Verifique sua conexão e tente novamente.');
        }
      });
    }
  },
  
  /**
   * Popula dropdowns de lojas
   */
  populateLojasDropdowns: function(lojas) {
    const selects = $('select[name="loja"], #loja_sala, #loja_ilha, #loja_computador, #loja_monitor, #loja_pa, #loja_coordenador, #id_loja_periferico');
    
    selects.each(function() {
      const $select = $(this);
      const currentValue = $select.val();
      
      // Limpar opções existentes (exceto a primeira)
      $select.find('option:not(:first)').remove();
      
      // Adicionar novas opções
      lojas.forEach(function(loja) {
        $select.append(`<option value="${loja.id}">${loja.nome}</option>`);
      });
      
      // Restaurar valor selecionado se existir
      if (currentValue) {
        $select.val(currentValue);
      }
    });
  },
  
  /**
   * Popula dropdowns de funcionários
   */
  populateFuncionariosDropdowns: function(funcionarios) {
    const selects = $('#funcionario_ramal, #funcionario_chip, #funcionario_coordenador, #email_funcionario, #funcionario_storm, #funcionario_sistema');
    
    selects.each(function() {
      const $select = $(this);
      const currentValue = $select.val();
      
      // Limpar opções existentes (exceto a primeira)
      $select.find('option:not(:first)').remove();
      
      // Adicionar novas opções
      funcionarios.forEach(function(funcionario) {
        $select.append(`<option value="${funcionario.id}">${funcionario.nome_completo}</option>`);
      });
      
      // Restaurar valor selecionado se existir
      if (currentValue) {
        $select.val(currentValue);
      }
    });
  },
  
  /**
   * Popula dropdown de tipos de periféricos
   */
  populateTiposPerifericoDropdown: function(tipos) {
    const $select = $('#id_tipo');
    
    if ($select.length) {
      const currentValue = $select.val();
      
      // Limpar opções existentes (exceto a primeira)
      $select.find('option:not(:first)').remove();
      
      // Adicionar novas opções
      tipos.forEach(function(tipo) {
        $select.append(`<option value="${tipo.value}">${tipo.text}</option>`);
      });
      
      // Restaurar valor selecionado se existir
      if (currentValue) {
        $select.val(currentValue);
      }
    }
  },
  
  /**
   * Popula dropdowns de salas
   */
  populateSalasDropdowns: function(salas, formId) {
    let selects;
    
    if (formId) {
      // Buscar apenas no formulário específico
      selects = $(`#${formId} select[name="sala"], #${formId} select[name="sala_em_uso"]`);
    } else {
      // Buscar em todos os formulários
      selects = $('select[name="sala"], select[name="sala_em_uso"], #sala_ilha, #sala, #sala_coordenador');
    }
    
    selects.each(function() {
      const $select = $(this);
      const currentValue = $select.val();
      
      // Limpar opções existentes (exceto a primeira)
      $select.find('option:not(:first)').remove();
      
      // Adicionar novas opções
      salas.forEach(function(sala) {
        $select.append(`<option value="${sala.id}" data-loja="${sala.loja_id}">${sala.nome}</option>`);
      });
      
      // Restaurar valor selecionado se existir
      if (currentValue) {
        $select.val(currentValue);
      }
    });
  },
  
  /**
   * Popula dropdowns de ilhas
   */
  populateIlhasDropdowns: function(ilhas, formId) {
    let selects;
    
    if (formId) {
      // Buscar apenas no formulário específico
      selects = $(`#${formId} select[name="ilha"], #${formId} select[name="ilha_em_uso"]`);
    } else {
      // Buscar em todos os formulários
      selects = $('select[name="ilha"], select[name="ilha_em_uso"], #ilha');
    }
    
    selects.each(function() {
      const $select = $(this);
      const currentValue = $select.val();
      
      // Limpar opções existentes (exceto a primeira)
      $select.find('option:not(:first)').remove();
      
      // Adicionar novas opções
      ilhas.forEach(function(ilha) {
        $select.append(`<option value="${ilha.id}" data-quantidade-pas="${ilha.quantidade_pas}">${ilha.nome}</option>`);
      });
      
      // Restaurar valor selecionado se existir
      if (currentValue) {
        $select.val(currentValue);
      }
    });
  },
  
  /**
   * Limpa dropdowns de salas
   */
  clearSalasDropdowns: function(formId) {
    let selects;
    
    if (formId) {
      selects = $(`#${formId} select[name="sala"], #${formId} select[name="sala_em_uso"]`);
    } else {
      selects = $('select[name="sala"], select[name="sala_em_uso"], #sala_ilha, #sala, #sala_coordenador');
    }
    
    selects.each(function() {
      const $select = $(this);
      $select.find('option:not(:first)').remove();
      $select.val('');
    });
    
    // Também limpar ilhas quando salas são limpas
    this.clearIlhasDropdowns(formId);
  },
  
  /**
   * Limpa dropdowns de ilhas
   */
  clearIlhasDropdowns: function(formId) {
    let selects;
    
    if (formId) {
      selects = $(`#${formId} select[name="ilha"], #${formId} select[name="ilha_em_uso"]`);
    } else {
      selects = $('select[name="ilha"], select[name="ilha_em_uso"], #ilha');
    }
    
    selects.each(function() {
      const $select = $(this);
      $select.find('option:not(:first)').remove();
      $select.val('');
    });
  },
  
  /**
   * Exibe mensagem de erro
   */
  showError: function(message) {
    if (window.TIAdminNotifications && window.TIAdminNotifications.showError) {
      window.TIAdminNotifications.showError(message);
    } else {
      console.error(message);
      alert(message);
    }
  }
};

// Inicializar quando o documento estiver pronto
$(document).ready(function() {
  // Aguardar um pouco para garantir que outros módulos foram carregados
  setTimeout(function() {
    window.TIAdminDataLoader.init();
  }, 100);
});