// static/js/siape/forms/consulta_cliente.js

// --- Função para formatar número para o padrão BR (1.234,56) ---
function formatCurrencyBR(value) {
  if (value === null || value === undefined || value === '') {
    return '0,00'; // Retorna 0,00 para valores nulos ou vazios
  }
  // Tenta converter para número, tratando possíveis erros
  let num = parseFloat(value);
  if (isNaN(num)) {
    console.warn('Valor inválido para formatação:', value);
    return 'Inválido'; // Ou retorna 0,00 ou outra string indicativa
  }
  // Usa toLocaleString para formatação correta em pt-BR
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// --- Fim da função de formatação ---

$(document).ready(function () {
  // Inicialmente, carrega os agendamentos do usuário
  buscarAgendamentos();
  
  // Certifique-se que o card de agendamento está oculto
  $('.agendamento-card').hide();

  // Tornar a calculadora colapsável quando clicar no header
  $('.calculadora-card .card-header').on('click', function() {
    const cardBody = $('#card-body-calculadora');
    const card = $(this).closest('.calculadora-card');
    // Alternar a classe collapsed para controlar o estado
    card.toggleClass('collapsed');
    // Se estiver fechando, limpar os campos da calculadora
    if (card.hasClass('collapsed')) {
      $('#calc_parcela').val('');
      $('#calc_prazo').val('');
      $('.resultado-calculo').hide();
    }
  });

  // Calculadora de coeficiente: torná-la colapsável ao clicar no header
  $('.calculadora-coeficiente-card .card-header').on('click', function() {
    $(this).closest('.calculadora-coeficiente-card').toggleClass('collapsed');
  });

  $('#consultaClienteForm').on('submit', function (e) {
    e.preventDefault();
    // Oculta o card de detalhes de agendamento se estiver visível
    if ($('.observacao-agendamento-card').is(':visible')) {
      $('.observacao-agendamento-card').slideUp();
    }

    // Captura e limpa o CPF
    const rawCpf = $('#cpf_cliente').val();
    const cpf = rawCpf.replace(/[^\d]/g, '');

    if (!cpf || cpf.length !== 11) {
      alert('Por favor, insira um CPF válido com 11 dígitos.');
      return;
    }

    // Requisição AJAX para buscar a ficha do cliente
    $.ajax({
      url: '/siape/api/get/ficha-cliente/',
      type: 'GET',
      data: { cpf: cpf },
      success: function (response) {
        const cliente = response.cliente;
        const debitos = response.debitos;

        // Exibe coluna 2 (Ficha) e o card de agendamento em coluna 3
        $('#col2').slideDown();
        $('.agendamento-card').slideDown();

        // Adiciona a classe para justificar o layout como space-around
        $('#three-col-layout').addClass('all-columns-visible');

        // Preenche o ID do cliente no formulário de agendamento
        if (cliente && cliente.id) {
          $('#agendamento_cliente_id').val(cliente.id);
        }

        // Preenche Informações Pessoais (Formatando Renda Bruta)
        $('#cliente_nome').text(cliente.nome || '-');
        $('#cliente_cpf').text(cliente.cpf || '-');
        $('#cliente_uf').text(cliente.uf || '-');
        $('#cliente_rjur').text(cliente.rjur || '-');
        $('#cliente_situacao').text(cliente.situacao_funcional || '-');
        $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

        // Preenche o card "Margem 5%" (Formatado)
        $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
        $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
        $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

        // Preenche o card "Margem 5% Benefício" (Formatado)
        $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
        $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
        $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

        // Preenche o card "Margem 35%" (Formatado)
        $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
        $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
        $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

        // Preenche o card "Totais" (Formatado)
        $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
        $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

        // Preenche a tabela de Débitos (Formatando Parcela e Saldo Devedor)
        const tbody = $('#tabelaDebitosBody');
        tbody.empty();

        if (debitos.length > 0) {
          debitos.forEach(d => {
            const parcela = parseFloat(d.parcela) || 0;
            const prazo = parseInt(d.prazo_restante) || 0;
            
            console.log('Dados iniciais:', { parcela, prazo });
            
            // Calcula o saldo devedor com desconto baseado no prazo
            const devedor = parcela * prazo;
            let percentual = 0;
            
            console.log('Valor devedor calculado:', devedor);
            
            // Define o percentual de desconto baseado no prazo
            if (prazo <= 96 && prazo >= 84) {
              percentual = 0.40;
              console.log('Faixa 84-96: 40% de desconto');
            } else if (prazo <= 83 && prazo >= 72) {
              percentual = 0.35;
              console.log('Faixa 72-83: 35% de desconto');
            } else if (prazo <= 71 && prazo >= 60) {
              percentual = 0.30;
              console.log('Faixa 60-71: 30% de desconto');
            } else if (prazo <= 59 && prazo >= 40) {
              percentual = 0.25;
              console.log('Faixa 40-59: 25% de desconto');
            } else if (prazo <= 39 && prazo >= 1) {
              percentual = 0.15;
              console.log('Faixa 1-39: 15% de desconto');
            }
            
            console.log('Percentual de desconto aplicado:', percentual);
            
            const desconto = devedor * percentual;
            const saldoDevedor = devedor - desconto;
            
            console.log('Cálculos finais:', {
              desconto,
              saldoDevedor
            });

            tbody.append(`
              <tr>
                <td>${d.matricula || '-'}</td>
                <td>${d.banco || '-'}</td>
                <td>${d.orgao || '-'}</td>
                <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                <td>${prazo}</td>
                <td>${d.tipo_contrato || '-'}</td>
                <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
              </tr>
            `);
          });
        } else {
          tbody.append(`
            <tr>
              <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
            </tr>
          `);
        }

        // (Opcional) rolar até a ficha do cliente
        $('html, body').animate({
          scrollTop: $('#col2').offset().top - 20
        }, 400);
      },
      error: function (xhr) {
        let msg = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          msg = xhr.responseJSON.erro;
        }
        alert(msg);
        console.error('Erro na consulta:', xhr);
      }
    });
  });

  // --- Manipulador para o formulário de Agendamento --- //
  $('#appointment-form').on('submit', function(e) {
    e.preventDefault();

    const formData = $(this).serialize();
    const submitButton = $(this).find('button[type="submit"]');
    const buttonText = submitButton.html();

    console.log("Enviando dados do agendamento:", formData);

    submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Agendando...');
    $.ajax({
      url: '/siape/api/post/agendamento-cliente/',
      type: 'POST',
      data: formData,
      success: function(response) {
        console.log("Resposta do servidor (sucesso):", response);
        if (response.status === 'sucesso') {
          alert(response.mensagem || 'Agendamento realizado com sucesso!');
          $('#appointment-form')[0].reset();
          buscarAgendamentos();
        }
      },
      error: function(xhr) {
        console.error("Erro na requisição de agendamento:", xhr);
        let errorMsg = 'Erro ao tentar agendar.';
        if (xhr.responseJSON && xhr.responseJSON.mensagem) {
          errorMsg = xhr.responseJSON.mensagem;
        } else if (xhr.statusText) {
          errorMsg += ` (${xhr.statusText})`;
        }
        alert(errorMsg);
      },
      complete: function() {
        submitButton.prop('disabled', false).html(buttonText);
      }
    });
  });

  /**
   * Busca os agendamentos do usuário via API
   */
  function buscarAgendamentos() {
    $('#lista-agendamentos').html(`
      <div class="text-center text-muted py-3">
        <i class='bx bx-loader-alt bx-spin'></i> Carregando agendamentos...
      </div>
    `);

    $.ajax({
      url: '/siape/api/get/agendamentos-cliente/',
      type: 'GET',
      success: function(response) {
        if (response.status === 'sucesso' && response.agendamentos) {
          popularListaAgendamentos(response.agendamentos);
        } else {
          $('#lista-agendamentos').html(`
            <div class="text-center text-muted py-3">
              <i class='bx bx-error-circle'></i> Não foi possível carregar os agendamentos.
            </div>
          `);
        }
      },
      error: function(xhr) {
        console.error("Erro ao buscar agendamentos:", xhr);
        $('#lista-agendamentos').html(`
          <div class="text-center text-muted py-3">
            <i class='bx bx-error-circle'></i> Erro ao carregar agendamentos.
          </div>
        `);
      }
    });
  }

  /**
   * Popula a lista de agendamentos no HTML com os dados recebidos.
   * @param {Array<Object>} agendamentos - Um array de objetos de agendamento 
   */
  function popularListaAgendamentos(agendamentos) {
    const listaElement = $('#lista-agendamentos');
    
    // Limpa a lista atual
    listaElement.empty();

    if (!agendamentos || agendamentos.length === 0) {
      // Se não há agendamentos, mostra uma mensagem
      listaElement.html(`
        <div class="empty-message">
          <i class='bx bx-calendar-x'></i>
          <p>Nenhum agendamento encontrado</p>
        </div>
      `);
      return;
    }

    // Cria uma lista formatada com os agendamentos
    const listGroup = $('<ul>').addClass('list-group');
    
    agendamentos.forEach(agendamento => {
      // Cria o item da lista (<li>)
      const listItem = $('<li>').addClass('list-group-item d-flex justify-content-between align-items-center agendamento-item');
      
      // Adicionamos o cliente_id e agendamento_id como atributos de dados para o nome do cliente
      listItem.html(`
        <div class="agendamento-info-cliente">
          <strong class="agendamento-nome" 
                  data-cliente-id="${agendamento.cliente_id || ''}" 
                  data-agendamento-id="${agendamento.id || ''}">${agendamento.cliente_nome}</strong>
          <small class="d-block text-muted agendamento-cpf">${agendamento.cliente_cpf}</small>
        </div>
        <div class="agendamento-data-hora text-center">
          <span class="agendamento-data">${agendamento.data}</span>
          <strong class="agendamento-hora">${agendamento.hora}</strong>
        </div>
        <div class="agendamento-acoes">
          <button class="status-btn agendamento-confirmar" id="btn-confirmar-${agendamento.id}" title="Confirmar agendamento">
            <i class='bx bx-check-circle agendamento-icone'></i>
          </button>
        </div>
      `);
      
      // Adiciona o item à lista
      listGroup.append(listItem);
    });
    
    // Adiciona a lista ao contêiner
    listaElement.append(listGroup);

    // Adiciona o evento de clique ao nome do cliente para carregar sua ficha
    $('.agendamento-nome').css('cursor', 'pointer').on('click', function() {
      const clienteId = $(this).data('cliente-id');
      const agendamentoId = $(this).data('agendamento-id');
      
      if (clienteId && agendamentoId) {
        carregarFichaClienteComAgendamento(clienteId, agendamentoId);
      } else if (clienteId) {
        carregarFichaClientePorId(clienteId);
      } else {
        alert('ID do cliente não disponível para este agendamento.');
      }
    });

    // Adiciona tooltip para indicar a ação
    $('.agendamento-nome').attr('title', 'Clique para ver ficha completa');

    // Estilização para indicar clicabilidade
    $('<style>')
      .text(`
        .agendamento-nome {
          color: #0275d8;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .agendamento-nome:hover {
          text-decoration: underline;
          color: #014c8c;
        }
      `)
      .appendTo('head');

    // Adiciona estilos CSS dinamicamente
    $('<style>')
      .text(`
        .status-btn {
          background: transparent;
          border: none;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .status-btn i {
          font-size: 1.5rem;
          color: #9e9e9e; /* Cinza médio */
          transition: all 0.3s ease;
        }
        .status-btn:hover {
          background: transparent;
        }
        .status-btn:hover i {
          color: #4caf50; /* Verde */
          transform: scale(1.2);
        }
        /* Estilo quando o agendamento está confirmado */
        .status-btn.confirmed i {
          color: #4caf50; /* Verde */
        }
        /* Dark mode */
        html.dark .status-btn i {
          color: #757575;
        }
        html.dark .status-btn:hover i,
        html.dark .status-btn.confirmed i {
          color: #81c784;
        }
      `)
      .appendTo('head');
    
    // Adiciona funcionalidade para o botão de confirmação
    $('.status-btn').on('click', function() {
      const agendamentoId = $(this).attr('id').replace('btn-confirmar-', '');
      const btnElement = $(this);
      // Item pai da lista para remoção animada posteriormente
      const listItem = $(this).closest('li.agendamento-item');
      
      // Verifica se já está confirmado
      if (btnElement.hasClass('confirmed')) {
        return;
      }
      
      // Mostra indicador de carregamento no botão
      const iconOriginal = btnElement.find('i').attr('class');
      btnElement.find('i').attr('class', 'bx bx-loader-alt bx-spin');
      btnElement.prop('disabled', true);
      
      // Faz a chamada AJAX para confirmar o agendamento
      $.ajax({
        url: '/siape/api/post/confirm-agendamento/',
        type: 'POST',
        data: {
          agendamento_id: agendamentoId
        },
        success: function(response) {
          if (response.status === 'sucesso') {
            // Adiciona a classe para mudar a cor do ícone
            btnElement.addClass('confirmed');
            
            // Exibe mensagem de sucesso
            const toast = $(`<div class="toast-success">Agendamento confirmado</div>`);
            $('body').append(toast);
            setTimeout(() => toast.fadeOut(function() { $(this).remove(); }), 3000);
            
            // Anima a remoção do item da lista
            listItem.fadeOut(500, function() {
              // Após a animação, recarrega a lista completa
              buscarAgendamentos();
            });
          } else {
            alert('Erro ao confirmar agendamento: ' + response.mensagem);
            btnElement.find('i').attr('class', iconOriginal);
            btnElement.prop('disabled', false);
          }
        },
        error: function(xhr) {
          let mensagem = 'Erro ao confirmar agendamento.';
          if (xhr.responseJSON && xhr.responseJSON.mensagem) {
            mensagem = xhr.responseJSON.mensagem;
          }
          alert(mensagem);
          console.error('Erro ao confirmar agendamento:', xhr);
          
          // Restaura o ícone original em caso de erro
          btnElement.find('i').attr('class', iconOriginal);
          btnElement.prop('disabled', false);
        }
      });
    });
  }

  /**
   * Carrega a ficha do cliente e informações do agendamento selecionado
   * @param {number|string} clienteId - ID do cliente a ser consultado
   * @param {number|string} agendamentoId - ID do agendamento
   */
  function carregarFichaClienteComAgendamento(clienteId, agendamentoId) {
    // Mostra indicador de carregamento
    $('#col2').html(`
      <div class="text-center my-5">
        <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
        <p class="mt-3">Carregando dados do cliente...</p>
      </div>
    `).slideDown();

    // Faz a requisição para a API com o ID do cliente e do agendamento
    $.ajax({
      url: '/siape/api/get/infocliente/',
      type: 'GET',
      data: { 
        cliente_id: clienteId,
        agendamento_id: agendamentoId 
      },
      success: function(response) {
        if (response.status === 'sucesso') {
          // Processa os dados do cliente e preenche a ficha
          const cliente = response.cliente;
          const debitos = response.debitos;

          // Restaura a estrutura HTML da coluna 2
          $('#col2').html(`
            <div class="header-title mb-3">
              <h1 class="titulo-pagina ficha-cliente-title">
                <i class='bx bx-folder-open me-2'></i>Ficha do Cliente
              </h1>
            </div>
            <div class="container-ficha_cliente">
              <!-- CARD: Informações Pessoais -->
              <div class="card mb-4" id="card-info-pessoal">
                <div class="card-header">
                  <i class='bx bx-user me-2'></i> Informações Pessoais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-user me-2'></i><strong>Nome:</strong> <span id="cliente_nome"></span></p>
                  <p><i class='bx bx-id-card me-2'></i><strong>CPF:</strong> <span id="cliente_cpf"></span></p>
                  <p><i class='bx bx-map me-2'></i><strong>UF:</strong> <span id="cliente_uf"></span></p>
                  <p><i class='bx bx-building me-2'></i><strong>RJur:</strong> <span id="cliente_rjur"></span></p>
                  <p><i class='bx bx-user-check me-2'></i><strong>Situação Funcional:</strong> <span id="cliente_situacao"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Renda Bruta:</strong> R$ <span id="cliente_renda_bruta"></span></p>
                </div>
              </div>

              <!-- CARDS: Margens 5% e 5% Benefício lado a lado -->
              <div class="flex-container margem5-container mb-4">
                <!-- Margem 5% -->
                <div class="card" id="card-margem5">
                  <div class="card-header">
                    <i class='bx bx-percentage me-2'></i> Margem 5%
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_5"></span></p>
                  </div>
                </div>
                <!-- Margem 5% Benefício -->
                <div class="card" id="card-margem5-beneficio">
                  <div class="card-header">
                    <i class='bx bx-money me-2'></i> Margem 5% Benefício
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_brutaBeneficio_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizadoBeneficio_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldoBeneficio_5"></span></p>
                  </div>
                </div>
              </div>

              <!-- CARD: Margem 35% -->
              <div class="card mb-4" id="card-margem35">
                <div class="card-header">
                  <i class='bx bx-percentage me-2'></i> Margem 35%
                </div>
                <div class="card-body">
                  <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_35"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_35"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_35"></span></p>
                </div>
              </div>

              <!-- CARD: Totais -->
              <div class="card mb-4" id="card-totais">
                <div class="card-header">
                  <i class='bx bx-calculator me-2'></i> Totais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-money me-2'></i><strong>Total Utilizado:</strong> R$ <span id="cliente_total_util"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Total Disponível:</strong> R$ <span id="cliente_total_saldo"></span></p>
                </div>
              </div>

              <!-- CARD: Débitos -->
              <div class="card mb-4" id="card-debitos">
                <div class="card-header">
                  <i class='bx bx-file me-2'></i> Débitos
                </div>
                <div class="card-body">
                  <table class="table table-bordered">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Banco</th>
                        <th>Órgão</th>
                        <th>Parcela</th>
                        <th>Prazo</th>
                        <th>Tipo de Contrato</th>
                        <th>Saldo Devedor</th>
                      </tr>
                    </thead>
                    <tbody id="tabelaDebitosBody">
                      <!-- JS popula aqui -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `);

          // Preenche o ID do cliente no formulário de agendamento
          $('#agendamento_cliente_id').val(cliente.id);
          
          // Exibe o card de agendamento
          $('.agendamento-card').slideDown();

          // Preenche Informações Pessoais
          $('#cliente_nome').text(cliente.nome || '-');
          $('#cliente_cpf').text(cliente.cpf || '-');
          $('#cliente_uf').text(cliente.uf || '-');
          $('#cliente_rjur').text(cliente.rjur || '-');
          $('#cliente_situacao').text(cliente.situacao_funcional || '-');
          $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

          // Preenche o card "Margem 5%" (Formatado)
          $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
          $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
          $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

          // Preenche o card "Margem 5% Benefício" (Formatado)
          $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
          $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
          $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

          // Preenche o card "Margem 35%" (Formatado)
          $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
          $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
          $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

          // Preenche o card "Totais" (Formatado)
          $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
          $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

          // Preenche a tabela de Débitos
          const tbody = $('#tabelaDebitosBody');
          tbody.empty();

          if (debitos && debitos.length > 0) {
            debitos.forEach(d => {
              const parcela = parseFloat(d.parcela) || 0;
              const prazo = parseInt(d.prazo_restante) || 0;
              
              console.log('Dados iniciais:', { parcela, prazo });
              
              // Calcula o saldo devedor com desconto baseado no prazo
              const devedor = parcela * prazo;
              let percentual = 0;
              
              console.log('Valor devedor calculado:', devedor);
              
              // Define o percentual de desconto baseado no prazo
              if (prazo <= 96 && prazo >= 84) {
                percentual = 0.40;
                console.log('Faixa 84-96: 40% de desconto');
              } else if (prazo <= 83 && prazo >= 72) {
                percentual = 0.35;
                console.log('Faixa 72-83: 35% de desconto');
              } else if (prazo <= 71 && prazo >= 60) {
                percentual = 0.30;
                console.log('Faixa 60-71: 30% de desconto');
              } else if (prazo <= 59 && prazo >= 40) {
                percentual = 0.25;
                console.log('Faixa 40-59: 25% de desconto');
              } else if (prazo <= 39 && prazo >= 1) {
                percentual = 0.15;
                console.log('Faixa 1-39: 15% de desconto');
              }
              
              console.log('Percentual de desconto aplicado:', percentual);
              
              const desconto = devedor * percentual;
              const saldoDevedor = devedor - desconto;
              
              console.log('Cálculos finais:', {
                desconto,
                saldoDevedor
              });

              tbody.append(`
                <tr>
                  <td>${d.matricula || '-'}</td>
                  <td>${d.banco || '-'}</td>
                  <td>${d.orgao || '-'}</td>
                  <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                  <td>${prazo}</td>
                  <td>${d.tipo_contrato || '-'}</td>
                  <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
                </tr>
              `);
            });
          } else {
            tbody.append(`
              <tr>
                <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
              </tr>
            `);
          }

          // Se temos informações do agendamento, exibe o card na coluna 1
          if (response.agendamento) {
            $('#detalhe_agendamento_data').text(response.agendamento.data || '');
            $('#detalhe_agendamento_hora').text(response.agendamento.hora || '');
            $('#detalhe_agendamento_observacao').text(response.agendamento.observacao || 'Nenhuma observação registrada');
            $('.observacao-agendamento-card').slideDown();
          } else {
            // Se não temos informações de agendamento, esconde o card
            $('.observacao-agendamento-card').hide();
          }

          // Adiciona a classe para justificar o layout como space-around
          $('#three-col-layout').addClass('all-columns-visible');

          // Rola até a ficha do cliente
          $('html, body').animate({
            scrollTop: $('#col2').offset().top - 20
          }, 400);
        } else {
          $('#col2').html(`
            <div class="alert alert-warning my-4">
              <i class='bx bx-error-circle me-2'></i> Não foi possível carregar os dados do cliente.
            </div>
          `);
        }
      },
      error: function(xhr) {
        let mensagem = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          mensagem = xhr.responseJSON.erro;
        }
        
        $('#col2').html(`
          <div class="alert alert-danger my-4">
            <i class='bx bx-error-circle me-2'></i> ${mensagem}
          </div>
        `);
        
        console.error('Erro ao buscar cliente:', xhr);
      }
    });
  }

  /**
   * Carrega a ficha do cliente a partir do ID e exibe os dados
   * @param {number|string} clienteId - ID do cliente a ser consultado
   * @param {Object} agendamentoInfo - Informações do agendamento (opcional)
   */
  function carregarFichaClientePorId(clienteId, agendamentoInfo) {
    // Mostra indicador de carregamento
    $('#col2').html(`
      <div class="text-center my-5">
        <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
        <p class="mt-3">Carregando dados do cliente...</p>
      </div>
    `).slideDown();

    // Se temos informações de agendamento, exibe o card de observação
    if (agendamentoInfo) {
      $('#detalhe_agendamento_data').text(agendamentoInfo.data || '');
      $('#detalhe_agendamento_hora').text(agendamentoInfo.hora || '');
      $('#detalhe_agendamento_observacao').text(agendamentoInfo.observacao || 'Nenhuma observação registrada');
      $('.observacao-agendamento-card').slideDown();
    } else {
      // Se não temos informações de agendamento, esconde o card
      $('.observacao-agendamento-card').hide();
    }

    // Faz a requisição para a API
    $.ajax({
      url: '/siape/api/get/infocliente/',
      type: 'GET',
      data: { cliente_id: clienteId },
      success: function(response) {
        if (response.status === 'sucesso') {
          const cliente = response.cliente;
          const info_pessoal = response.info_pessoal;
          const debitos = response.debitos;

          // Restaura a estrutura HTML da coluna 2
          $('#col2').html(`
            <div class="header-title mb-3">
              <h1 class="titulo-pagina ficha-cliente-title">
                <i class='bx bx-folder-open me-2'></i>Ficha do Cliente
              </h1>
            </div>
            <div class="container-ficha_cliente">
              <!-- CARD: Informações Pessoais -->
              <div class="card mb-4" id="card-info-pessoal">
                <div class="card-header">
                  <i class='bx bx-user me-2'></i> Informações Pessoais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-user me-2'></i><strong>Nome:</strong> <span id="cliente_nome"></span></p>
                  <p><i class='bx bx-id-card me-2'></i><strong>CPF:</strong> <span id="cliente_cpf"></span></p>
                  <p><i class='bx bx-map me-2'></i><strong>UF:</strong> <span id="cliente_uf"></span></p>
                  <p><i class='bx bx-building me-2'></i><strong>RJur:</strong> <span id="cliente_rjur"></span></p>
                  <p><i class='bx bx-user-check me-2'></i><strong>Situação Funcional:</strong> <span id="cliente_situacao"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Renda Bruta:</strong> R$ <span id="cliente_renda_bruta"></span></p>
                </div>
              </div>

              <!-- CARDS: Margens 5% e 5% Benefício lado a lado -->
              <div class="flex-container margem5-container mb-4">
                <!-- Margem 5% -->
                <div class="card" id="card-margem5">
                  <div class="card-header">
                    <i class='bx bx-percentage me-2'></i> Margem 5%
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_5"></span></p>
                  </div>
                </div>
                <!-- Margem 5% Benefício -->
                <div class="card" id="card-margem5-beneficio">
                  <div class="card-header">
                    <i class='bx bx-money me-2'></i> Margem 5% Benefício
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_brutaBeneficio_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizadoBeneficio_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldoBeneficio_5"></span></p>
                  </div>
                </div>
              </div>

              <!-- CARD: Margem 35% -->
              <div class="card mb-4" id="card-margem35">
                <div class="card-header">
                  <i class='bx bx-percentage me-2'></i> Margem 35%
                </div>
                <div class="card-body">
                  <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_35"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_35"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_35"></span></p>
                </div>
              </div>

              <!-- CARD: Totais -->
              <div class="card mb-4" id="card-totais">
                <div class="card-header">
                  <i class='bx bx-calculator me-2'></i> Totais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-money me-2'></i><strong>Total Utilizado:</strong> R$ <span id="cliente_total_util"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Total Disponível:</strong> R$ <span id="cliente_total_saldo"></span></p>
                </div>
              </div>

              <!-- CARD: Débitos -->
              <div class="card mb-4" id="card-debitos">
                <div class="card-header">
                  <i class='bx bx-file me-2'></i> Débitos
                </div>
                <div class="card-body">
                  <table class="table table-bordered">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Banco</th>
                        <th>Órgão</th>
                        <th>Parcela</th>
                        <th>Prazo</th>
                        <th>Tipo de Contrato</th>
                        <th>Saldo Devedor</th>
                      </tr>
                    </thead>
                    <tbody id="tabelaDebitosBody">
                      <!-- JS popula aqui -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `);

          // Preenche o ID do cliente no formulário de agendamento
          $('#agendamento_cliente_id').val(cliente.id);
          
          // Exibe o card de agendamento
          $('.agendamento-card').slideDown();

          // Preenche Informações Pessoais
          $('#cliente_nome').text(cliente.nome || '-');
          $('#cliente_cpf').text(cliente.cpf || '-');
          $('#cliente_uf').text(cliente.uf || '-');
          $('#cliente_rjur').text(cliente.rjur || '-');
          $('#cliente_situacao').text(cliente.situacao_funcional || '-');
          $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

          // Preenche o card "Margem 5%" (Formatado)
          $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
          $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
          $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

          // Preenche o card "Margem 5% Benefício" (Formatado)
          $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
          $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
          $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

          // Preenche o card "Margem 35%" (Formatado)
          $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
          $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
          $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

          // Preenche o card "Totais" (Formatado)
          $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
          $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

          // Preenche a tabela de Débitos
          const tbody = $('#tabelaDebitosBody');
          tbody.empty();

          if (debitos && debitos.length > 0) {
            debitos.forEach(d => {
              const parcela = parseFloat(d.parcela) || 0;
              const prazo = parseInt(d.prazo_restante) || 0;
              
              console.log('Dados iniciais:', { parcela, prazo });
              
              // Calcula o saldo devedor com desconto baseado no prazo
              const devedor = parcela * prazo;
              let percentual = 0;
              
              console.log('Valor devedor calculado:', devedor);
              
              // Define o percentual de desconto baseado no prazo
              if (prazo <= 96 && prazo >= 84) {
                percentual = 0.40;
                console.log('Faixa 84-96: 40% de desconto');
              } else if (prazo <= 83 && prazo >= 72) {
                percentual = 0.35;
                console.log('Faixa 72-83: 35% de desconto');
              } else if (prazo <= 71 && prazo >= 60) {
                percentual = 0.30;
                console.log('Faixa 60-71: 30% de desconto');
              } else if (prazo <= 59 && prazo >= 40) {
                percentual = 0.25;
                console.log('Faixa 40-59: 25% de desconto');
              } else if (prazo <= 39 && prazo >= 1) {
                percentual = 0.15;
                console.log('Faixa 1-39: 15% de desconto');
              }
              
              console.log('Percentual de desconto aplicado:', percentual);
              
              const desconto = devedor * percentual;
              const saldoDevedor = devedor - desconto;
              
              console.log('Cálculos finais:', {
                desconto,
                saldoDevedor
              });

              tbody.append(`
                <tr>
                  <td>${d.matricula || '-'}</td>
                  <td>${d.banco || '-'}</td>
                  <td>${d.orgao || '-'}</td>
                  <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                  <td>${prazo}</td>
                  <td>${d.tipo_contrato || '-'}</td>
                  <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
                </tr>
              `);
            });
          } else {
            tbody.append(`
              <tr>
                <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
              </tr>
            `);
          }

          // Adiciona a classe para justificar o layout como space-around
          $('#three-col-layout').addClass('all-columns-visible');

          // Rola até a ficha do cliente
          $('html, body').animate({
            scrollTop: $('#col2').offset().top - 20
          }, 400);
        } else {
          $('#col2').html(`
            <div class="alert alert-warning my-4">
              <i class='bx bx-error-circle me-2'></i> Não foi possível carregar os dados do cliente.
            </div>
          `);
        }
      },
      error: function(xhr) {
        let mensagem = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          mensagem = xhr.responseJSON.erro;
        }
        
        $('#col2').html(`
          <div class="alert alert-danger my-4">
            <i class='bx bx-error-circle me-2'></i> ${mensagem}
          </div>
        `);
        
        console.error('Erro ao buscar cliente:', xhr);
      }
    });
  }

  // Eventos para a calculadora de saldo devedor
  $('#calcular_saldo').on('click', function() {
    calcularSaldoDevedor();
  });
  
  // Também calcular quando o usuário pressionar Enter em qualquer dos campos
  $('#calc_parcela, #calc_prazo').on('keypress', function(e) {
    if (e.which === 13) { // Código da tecla Enter
      calcularSaldoDevedor();
    }
  });
  
  // Função para calcular o saldo devedor
  function calcularSaldoDevedor() {
    // Obter valores dos campos
    const parcela = parseFloat($('#calc_parcela').val()) || 0;
    const prazo = parseInt($('#calc_prazo').val()) || 0;
    
    if (parcela <= 0 || prazo <= 0) {
      alert('Por favor, informe valores válidos para parcela e prazo.');
      return;
    }
    
    // Calcular saldo total
    const saldoTotal = parcela * prazo;
    console.log('Saldo total calculado:', saldoTotal);
    
    // Determinar o percentual de desconto baseado no prazo
    let percentual = 0;
    
    if (prazo <= 96 && prazo >= 84) {
      percentual = 0.40; // 40%
      console.log('Faixa 84-96: 40% de desconto');
    } else if (prazo <= 83 && prazo >= 72) {
      percentual = 0.35; // 35%
      console.log('Faixa 72-83: 35% de desconto');
    } else if (prazo <= 71 && prazo >= 60) {
      percentual = 0.30; // 30%
      console.log('Faixa 60-71: 30% de desconto');
    } else if (prazo <= 59 && prazo >= 40) {
      percentual = 0.25; // 25%
      console.log('Faixa 40-59: 25% de desconto');
    } else if (prazo <= 39 && prazo >= 1) {
      percentual = 0.15; // 15%
      console.log('Faixa 1-39: 15% de desconto');
    }
    
    // Calcular desconto e saldo final
    const desconto = saldoTotal * percentual;
    const saldoFinal = saldoTotal - desconto;
    
    console.log('Cálculos finais:', {
      percentual,
      desconto,
      saldoFinal
    });
    
    // Exibir resultados formatados
    $('#calc_saldo_total').text(formatCurrencyBR(saldoTotal));
    $('#calc_percentual').text((percentual * 100).toFixed(0)); // Percentual não precisa de formato BR
    $('#calc_desconto').text(formatCurrencyBR(desconto));
    $('#calc_saldo_final').text(formatCurrencyBR(saldoFinal));
    
    // Mostrar a seção de resultados
    $('.resultado-calculo').slideDown();
  }

  // Eventos para calcular o saldo liberado (coeficiente)
  $('#calcular_coeficiente').on('click', function() {
    calcularSaldoLiberado();
  });
  $('#coef_parcela, #coef_coeficiente').on('keypress', function(e) {
    if (e.which === 13) {  // Enter
      calcularSaldoLiberado();
    }
  });

  // Evento para limpar campos da calculadora de coeficiente
  $('#limpar_coeficiente').on('click', function() {
    // Limpa os campos de entrada
    $('#coef_parcela').val('');
    $('#coef_coeficiente').val('');
    // Limpa o resultado e esconde a seção
    $('#resultado_coeficiente').text('');
    $('.resultado-coeficiente').slideUp();
    // Foca no primeiro campo
    $('#coef_parcela').focus();
  });

  // Função para calcular o saldo liberado (parcela / coeficiente)
  function calcularSaldoLiberado() {
    const parcela = parseFloat($('#coef_parcela').val()) || 0;
    const coef = parseFloat($('#coef_coeficiente').val()) || 0;

    if (parcela <= 0 || coef <= 0) {
      alert('Por favor, informe valores válidos para parcela e coeficiente.');
      return;
    }

    const saldoLiberado = parcela / coef;
    console.log('Saldo liberado calculado:', saldoLiberado);

    // Exibe o resultado formatado
    $('#resultado_coeficiente').text(formatCurrencyBR(saldoLiberado));
    $('.resultado-coeficiente').slideDown();
  }

  // Toggle collapse no card de Consulta de Cliente
  $('.consulta-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.consulta-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Detalhes do Agendamento
  $('.observacao-agendamento-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.observacao-agendamento-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Agendamento
  $('.agendamento-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.agendamento-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Meus Agendamentos
  $('.agendamentos-list-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.agendamentos-list-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Cartão Benefício
  $('.calculadora-beneficio-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.calculadora-beneficio-card').toggleClass('collapsed');
  });

  // Eventos para calcular Cartão Benefício
  $('#calcular_beneficio').on('click', function() {
    calcularBeneficio();
  });
  $('#beneficio_margemLiq').on('keypress', function(e) {
    if (e.which === 13) { // Enter
      calcularBeneficio();
    }
  });

  // Função para calcular os valores do Cartão Benefício
  function calcularBeneficio() {
    const margemLiq = parseFloat($('#beneficio_margemLiq').val()) || 0;
    if (margemLiq <= 0) {
      alert('Por favor, insira valor válido para Margem Líquida.');
      return;
    }
    const parcela = margemLiq * 0.90;
    const limite = parcela * 23;
    const saque = limite * 0.70;

    // Exibe resultados formatados
    $('#beneficio_parcela').text(formatCurrencyBR(parcela));
    $('#beneficio_limite').text(formatCurrencyBR(limite));
    $('#beneficio_saque').text(formatCurrencyBR(saque));
    $('.resultado-beneficio').slideDown();
  }

  // Evento para limpar campos da Calculadora de Cartão Benefício
  $('#limpar_beneficio').on('click', function() {
    $('#beneficio_margemLiq').val('');
    $('#beneficio_parcela').text('');
    $('#beneficio_limite').text('');
    $('#beneficio_saque').text('');
    $('.resultado-beneficio').slideUp();
    $('#beneficio_margemLiq').focus();
  });
}); // Fim do $(document).ready
