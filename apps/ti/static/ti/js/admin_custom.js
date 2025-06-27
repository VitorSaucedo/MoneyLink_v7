// JavaScript customizado para a página admin.html
document.addEventListener('DOMContentLoaded', function() {
    // Cadastro de Computador via AJAX
    const formComputador = document.getElementById('form-computador');
    const statusComputador = document.getElementById('status_computador');
    const camposEmUso = document.getElementById('campos_em_uso');
    const camposManutencao = document.getElementById('campos_manutencao');
    const salaEmUso = document.getElementById('sala_em_uso');
    const ilhaEmUso = document.getElementById('ilha_em_uso');
    const paEmUso = document.getElementById('pa_em_uso');
    
    // Função para mostrar/esconder campos condicionais baseado no status
    if (statusComputador && camposEmUso && camposManutencao) {
        statusComputador.addEventListener('change', function() {
            const status = this.value;
            
            // Esconder todos os campos condicionais primeiro
            camposEmUso.style.display = 'none';
            camposManutencao.style.display = 'none';
            
            // Mostrar campos específicos baseado no status selecionado
            if (status === 'em_uso') {
                camposEmUso.style.display = 'block';
            } else if (status === 'manutencao') {
                camposManutencao.style.display = 'block';
            }
        });
        
        // Disparar o evento change no carregamento da página
        statusComputador.dispatchEvent(new Event('change'));
    }
    
    // Carregar ilhas quando uma sala for selecionada no formulário de computador (usando função centralizada)
    if (salaEmUso && ilhaEmUso) {
        salaEmUso.addEventListener('change', function() {
            const salaId = this.value;
            
            // Limpar opções atuais de ilha
            ilhaEmUso.innerHTML = '<option value="">-- Selecione uma ilha --</option>';
            
            // Limpar opções de PA
            if (paEmUso) {
                paEmUso.innerHTML = '<option value="">-- Primeiro selecione uma ilha --</option>';
            }
            
            if (window.TIAdminUtils && window.TIAdminUtils.carregarIlhasPorSala) {
                window.TIAdminUtils.carregarIlhasPorSala(salaId, ilhaEmUso);
            } else {
                // Fallback para compatibilidade
                if (salaId) {
                    fetch(`/ti/api/ilhas-por-sala/${salaId}/`)
                        .then(response => response.json())
                        .then(data => {
                            data.ilhas.forEach(ilha => {
                                const option = document.createElement('option');
                                option.value = ilha.id;
                                option.textContent = ilha.nome;
                                ilhaEmUso.appendChild(option);
                            });
                        })
                        .catch(error => console.error('Erro ao carregar ilhas:', error));
                }
            }
        });
    }
    
    // Carregar PAs quando uma ilha for selecionada no formulário de computador (usando função centralizada)
    if (ilhaEmUso && paEmUso) {
        ilhaEmUso.addEventListener('change', function() {
            const ilhaId = this.value;
            const lojaId = window.TIAdminUtils ? window.TIAdminUtils.getSelectedLojaAdmin() : null;
            
            // Limpar opções atuais de PA
            paEmUso.innerHTML = '<option value="">-- Selecione uma PA --</option>';
            
            if (window.TIAdminUtils && window.TIAdminUtils.carregarPAsPorIlha) {
                window.TIAdminUtils.carregarPAsPorIlha(ilhaId, paEmUso, lojaId);
            } else {
                // Fallback para compatibilidade
                if (ilhaId) {
                    fetch(`/ti/api/listar-posicoes-atendimento/?ilha=${ilhaId}&status=livre&page_size=100`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.results && data.results.length > 0) {
                                data.results.forEach(pa => {
                                    const option = document.createElement('option');
                                    option.value = pa.id;
                                    option.textContent = `PA ${pa.numero}`;
                                    paEmUso.appendChild(option);
                                });
                            } else {
                                const option = document.createElement('option');
                                option.value = '';
                                option.textContent = '-- Nenhuma PA disponível nesta ilha --';
                                paEmUso.appendChild(option);
                            }
                        })
                        .catch(error => console.error('Erro ao carregar PAs:', error));
                }
            }
        });
    }
    
    // Submissão do formulário via AJAX
    if (formComputador) {
        formComputador.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Obter os dados do formulário
            const formData = new FormData(this);
            
            // Enviar via AJAX
            fetch('/ti/api/ajax/computador/cadastrar/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Exibir mensagem de sucesso
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-success alert-dismissible fade show';
                    alertDiv.innerHTML = `
                        <strong>Sucesso!</strong> ${data.message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    `;
                    
                    // Inserir a mensagem no topo do card
                    const cardBody = formComputador.closest('.card-body');
                    cardBody.insertBefore(alertDiv, cardBody.firstChild);
                    
                    // Limpar o formulário
                    formComputador.reset();
                    
                    // Esconder campos condicionais
                    if (camposEmUso) camposEmUso.style.display = 'none';
                    if (camposManutencao) camposManutencao.style.display = 'none';
                    
                    // Remover a mensagem após 5 segundos
                    setTimeout(() => {
                        alertDiv.remove();
                    }, 5000);
                } else {
                    // Exibir mensagem de erro
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
                    alertDiv.innerHTML = `
                        <strong>Erro!</strong> ${data.message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    `;
                    
                    // Inserir a mensagem no topo do card
                    const cardBody = formComputador.closest('.card-body');
                    cardBody.insertBefore(alertDiv, cardBody.firstChild);
                }
            })
            .catch(error => {
                console.error('Erro ao cadastrar computador:', error);
                
                // Exibir mensagem de erro genérica
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger alert-dismissible fade show';
                alertDiv.innerHTML = `
                    <strong>Erro!</strong> Ocorreu um erro ao processar a requisição.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                
                // Inserir a mensagem no topo do card
                const cardBody = formComputador.closest('.card-body');
                cardBody.insertBefore(alertDiv, cardBody.firstChild);
            });
        });
    }
    
    // Atribuição de periféricos a PAs
    const perifericoSelect = document.querySelector('form[name="formAtribuicaoPa"] [name="periferico"]');
    const paSelect = document.querySelector('form[name="formAtribuicaoPa"] [name="posicao_atendimento"]');

    if (perifericoSelect && paSelect) {
        perifericoSelect.addEventListener('change', function() {
            const perifericoId = this.value;
            // Limpar opções atuais de PA, exceto a primeira (placeholder)
            while (paSelect.options.length > 1) {
                paSelect.remove(1);
            }
            // Definir a primeira opção como placeholder e selecionada por padrão
            paSelect.options[0].textContent = '-- Carregando PAs... --';
            paSelect.options[0].selected = true;
            paSelect.disabled = true;

            if (perifericoId) {
                // Construir URL dinamicamente
                const baseUrl = '/ti/api/pas-para-atribuicao-periferico/';
                fetch(`${baseUrl}${perifericoId}/`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        paSelect.options[0].textContent = '-- Selecione uma PA --'; // Restaurar placeholder
                        if (data.posicoes_atendimento && data.posicoes_atendimento.length > 0) {
                            data.posicoes_atendimento.forEach(pa => {
                                const option = new Option(pa.nome, pa.id);
                                paSelect.add(option);
                            });
                        } else {
                            paSelect.options[0].textContent = '-- Nenhuma PA compatível encontrada --';
                        }
                        paSelect.disabled = false;
                    })
                    .catch(error => {
                        console.error('Erro ao carregar PAs:', error);
                        paSelect.options[0].textContent = '-- Erro ao carregar PAs --';
                        paSelect.disabled = false;
                    });
            } else {
                paSelect.options[0].textContent = '-- Selecione um periférico primeiro --';
                paSelect.disabled = true;
            }
        });

        // Disparar o evento change no carregamento da página se um periférico já estiver selecionado
        if (perifericoSelect.value) {
            perifericoSelect.dispatchEvent(new Event('change'));
        }
    }

    // Cadastro em lote de periféricos
    const addToListBtn = document.getElementById('add-to-list-btn');
    const perifericos_form = document.getElementById('perifericos-form');
    const perifericos_lote_input = document.getElementById('perifericos-lote-input');
    const perifericos_pendentes_body = document.getElementById('perifericos-pendentes-body');
    const empty_state_row = document.getElementById('empty-state-row');
    const limpar_lista_btn = document.getElementById('limpar-lista-btn');
    const save_all_btn = document.getElementById('save-all-btn');
    const contagem_pendentes = document.getElementById('contagem-pendentes');
    
    // Formulário de inputs
    const perifericos_form_inputs = document.getElementById('perifericos-form-inputs');
    
    // Inputs para adicionar novos periféricos
    const tipo_input = document.querySelector('#perifericos-form-inputs [name="tipo"]');
    const marca_input = document.querySelector('#perifericos-form-inputs [name="marca"]');
    const modelo_input = document.querySelector('#perifericos-form-inputs [name="modelo"]');
    const data_aquisicao_input = document.querySelector('#perifericos-form-inputs [name="data_aquisicao"]');
    const loja_input = document.querySelector('#perifericos-form-inputs [name="loja"]');
    const quantidade_input = document.querySelector('#perifericos-form-inputs [name="quantidade"]');
    
    // Prevenir submit do formulário de inputs (que deve apenas adicionar à lista)
    if (perifericos_form_inputs) {
        perifericos_form_inputs.addEventListener('submit', function(event) {
            event.preventDefault();
            adicionarPerifericos();
            return false;
        });
    }
    
    // Lista de periféricos pendentes
    let perifericos_pendentes = [];
    
    // Função para atualizar o contador e estado dos botões
    function atualizarContador() {
        const total = perifericos_pendentes.length;
        if (contagem_pendentes) {
            contagem_pendentes.textContent = total.toString();
        }
        
        // Atualizar estado dos botões
        if (save_all_btn) save_all_btn.disabled = total === 0;
        if (limpar_lista_btn) limpar_lista_btn.disabled = total === 0;
        
        // Mostrar ou esconder a linha de estado vazio
        if (empty_state_row) {
            if (total === 0) {
                empty_state_row.style.display = 'table-row';
            } else {
                empty_state_row.style.display = 'none';
            }
        }
    }
    
    // Função para atualizar o campo hidden com a lista de periféricos
    function atualizarCampoHidden() {
        if (perifericos_lote_input) {
            perifericos_lote_input.value = JSON.stringify(perifericos_pendentes);
        }
    }
    
    // Função para validar os inputs do formulário
    function validarInputs() {
        if (!tipo_input || !tipo_input.value) {
            alert('Por favor, selecione o tipo de periférico.');
            if (tipo_input) tipo_input.focus();
            return false;
        }
        
        if (!marca_input || !marca_input.value) {
            alert('Por favor, informe a marca do periférico.');
            if (marca_input) marca_input.focus();
            return false;
        }
        
        if (!modelo_input || !modelo_input.value) {
            alert('Por favor, informe o modelo do periférico.');
            if (modelo_input) modelo_input.focus();
            return false;
        }
        
        if (!loja_input || !loja_input.value) {
            alert('Por favor, selecione a loja.');
            if (loja_input) loja_input.focus();
            return false;
        }
        
        if (!quantidade_input || !quantidade_input.value || parseInt(quantidade_input.value) < 1) {
            alert('Por favor, informe uma quantidade válida (maior que zero).');
            if (quantidade_input) quantidade_input.focus();
            return false;
        }
        
        return true;
    }
    
    // Função para obter o texto do elemento selecionado
    function getSelectedOptionText(selectElement) {
        if (!selectElement || !selectElement.value) return '';
        return selectElement.options[selectElement.selectedIndex].text;
    }
    
    // Função para adicionar um periférico à lista de pendentes
    function adicionarPerifericos() {
        if (!validarInputs()) return;
        
        const novo_periferico = {
            tipo_id: parseInt(tipo_input.value),
            tipo_nome: getSelectedOptionText(tipo_input),
            marca: marca_input.value,
            modelo: modelo_input.value,
            data_aquisicao: data_aquisicao_input ? data_aquisicao_input.value || null : null,
            loja_id: parseInt(loja_input.value),
            loja_nome: getSelectedOptionText(loja_input),
            quantidade: parseInt(quantidade_input.value)
        };
        
        // Adicionar à lista
        perifericos_pendentes.push(novo_periferico);
        
        // Atualizar tabela
        renderizarPerifericos();
        
        // Atualizar contador e campo hidden
        atualizarContador();
        atualizarCampoHidden();
        
        // Limpar inputs (exceto loja que pode ser a mesma)
        if (marca_input) marca_input.value = '';
        if (modelo_input) modelo_input.value = '';
        if (quantidade_input) quantidade_input.value = '1';
        
        // Focar no tipo para próximo cadastro
        if (tipo_input) tipo_input.focus();
    }
    
    // Função para renderizar os periféricos na tabela
    function renderizarPerifericos() {
        if (!perifericos_pendentes_body) return;
        
        // Limpar tbody (mantendo a linha de estado vazio)
        const rows = perifericos_pendentes_body.querySelectorAll('tr:not(#empty-state-row)');
        rows.forEach(row => row.remove());
        
        // Adicionar os periféricos pendentes
        perifericos_pendentes.forEach((periferico, index) => {
            const tr = document.createElement('tr');
            tr.classList.add('periferico-row');
            
            // Adicionar classe para highlight temporário se for o último adicionado
            if (index === perifericos_pendentes.length - 1) {
                tr.classList.add('periferico-row-highlight');
            }
            
            tr.innerHTML = `
                <td>${periferico.tipo_nome}</td>
                <td>${periferico.marca}</td>
                <td>${periferico.modelo}</td>
                <td>${periferico.quantidade}</td>
                <td>${periferico.loja_nome}</td>
                <td>
                    <button type="button" class="btn-remover-periferico" data-index="${index}">
                        <i class='bx bx-trash'></i> Remover
                    </button>
                </td>
            `;
            
            perifericos_pendentes_body.appendChild(tr);
        });
        
        // Adicionar event listeners aos botões de remover
        const btns_remover = document.querySelectorAll('.btn-remover-periferico');
        btns_remover.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removerPerifericos(index);
            });
        });
    }
    
    // Função para remover um periférico da lista
    function removerPerifericos(index) {
        if (index >= 0 && index < perifericos_pendentes.length) {
            perifericos_pendentes.splice(index, 1);
            renderizarPerifericos();
            atualizarContador();
            atualizarCampoHidden();
        }
    }
    
    // Função para limpar toda a lista
    function limparLista() {
        if (confirm('Tem certeza que deseja limpar toda a lista de periféricos pendentes?')) {
            perifericos_pendentes = [];
            renderizarPerifericos();
            atualizarContador();
            atualizarCampoHidden();
        }
    }
    
    // Event Listeners para os botões
    if (addToListBtn) {
        addToListBtn.addEventListener('click', function(event) {
            event.preventDefault();
            adicionarPerifericos();
        });
    }
    
    if (limpar_lista_btn) {
        limpar_lista_btn.addEventListener('click', limparLista);
    }
    
    // Validação do formulário de envio da lista
    if (perifericos_form) {
        perifericos_form.addEventListener('submit', function(event) {
            if (perifericos_pendentes.length === 0) {
                event.preventDefault();
                alert('Não há periféricos para salvar.');
                return false;
            }
            
            return true;
        });
    }
    
    // Inicialização
    atualizarContador();

    // Filtrar salas por loja selecionada no formulário de Ilha (usando função centralizada)
    const lojaIlhaSelect = document.getElementById('loja_ilha');
    const salaIlhaSelect = document.getElementById('sala_ilha');
    
    if (lojaIlhaSelect && salaIlhaSelect) {
        lojaIlhaSelect.addEventListener('change', function() {
            const lojaId = this.value;
            
            if (window.TIAdminUtils && window.TIAdminUtils.carregarSalasPorLoja) {
                window.TIAdminUtils.carregarSalasPorLoja(lojaId, salaIlhaSelect);
            } else {
                // Fallback para compatibilidade
                if (lojaId) {
                    fetch(`/ti/api/salas-por-loja/${lojaId}/`)
                        .then(response => response.json())
                        .then(data => {
                            salaIlhaSelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                            
                            data.salas.forEach(sala => {
                                const option = document.createElement('option');
                                option.value = sala.id;
                                option.textContent = sala.nome;
                                option.setAttribute('data-loja', lojaId);
                                salaIlhaSelect.appendChild(option);
                            });
                        })
                        .catch(error => console.error('Erro ao carregar salas:', error));
                } else {
                    salaIlhaSelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                }
            }
        });
    }
    
    // Filtrar salas por loja selecionada no formulário de PA (usando função centralizada)
    const lojaPASelect = document.getElementById('loja_pa');
    const salaPASelect = document.getElementById('sala');
    const ilhaPASelect = document.getElementById('ilha');
    
    if (lojaPASelect && salaPASelect) {
        lojaPASelect.addEventListener('change', function() {
            const lojaId = this.value;
            
            if (window.TIAdminUtils && window.TIAdminUtils.carregarSalasPorLoja) {
                window.TIAdminUtils.carregarSalasPorLoja(lojaId, salaPASelect);
            } else {
                // Fallback para compatibilidade
                if (lojaId) {
                    fetch(`/ti/api/salas-por-loja/${lojaId}/`)
                        .then(response => response.json())
                        .then(data => {
                            salaPASelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                            
                            data.salas.forEach(sala => {
                                const option = document.createElement('option');
                                option.value = sala.id;
                                option.textContent = sala.nome;
                                option.setAttribute('data-loja', lojaId);
                                salaPASelect.appendChild(option);
                            });
                        })
                        .catch(error => console.error('Erro ao carregar salas:', error));
                } else {
                    salaPASelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                }
            }
            
            // Limpar também a seleção da ilha
            if (ilhaPASelect) {
                ilhaPASelect.innerHTML = '<option value="">-- Selecione uma Ilha --</option>';
            }
        });
    }
    
    // Filtrar salas por loja selecionada no formulário de Coordenador (usando função centralizada)
    const lojaCoordenadorSelect = document.getElementById('loja_coordenador');
    const salaCoordenadorSelect = document.getElementById('sala_coordenador');
    
    if (lojaCoordenadorSelect && salaCoordenadorSelect) {
        lojaCoordenadorSelect.addEventListener('change', function() {
            const lojaId = this.value;
            
            if (window.TIAdminUtils && window.TIAdminUtils.carregarSalasPorLoja) {
                window.TIAdminUtils.carregarSalasPorLoja(lojaId, salaCoordenadorSelect);
            } else {
                // Fallback para compatibilidade
                if (lojaId) {
                    fetch(`/ti/api/salas-por-loja/${lojaId}/`)
                        .then(response => response.json())
                        .then(data => {
                            salaCoordenadorSelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                            
                            data.salas.forEach(sala => {
                                const option = document.createElement('option');
                                option.value = sala.id;
                                option.textContent = sala.nome;
                                option.setAttribute('data-loja', lojaId);
                                salaCoordenadorSelect.appendChild(option);
                            });
                        })
                        .catch(error => console.error('Erro ao carregar salas:', error));
                } else {
                    salaCoordenadorSelect.innerHTML = '<option value="">-- Selecione uma Sala --</option>';
                }
            }
        });
    }
    
    // Função para carregar ilhas por sala selecionada
    function carregarIlhasPorSala(salaId, ilhaSelectId) {
        if (!salaId) return;
        
        fetch(`/ti/api/ilhas-por-sala/${salaId}/`)
            .then(response => response.json())
            .then(data => {
                const ilhaSelect = document.getElementById(ilhaSelectId);
                if (ilhaSelect) {
                    ilhaSelect.innerHTML = '<option value="">-- Selecione uma Ilha --</option>';
                    
                    data.ilhas.forEach(ilha => {
                        const option = document.createElement('option');
                        option.value = ilha.id;
                        option.textContent = ilha.nome;
                        ilhaSelect.appendChild(option);
                    });
                }
            })
            .catch(error => console.error('Erro ao carregar ilhas:', error));
    }
    
    // Carregar ilhas baseado na sala selecionada
    if (salaPASelect && ilhaPASelect) {
        salaPASelect.addEventListener('change', function() {
            const salaId = this.value;
            carregarIlhasPorSala(salaId, 'ilha');
        });
    }
});