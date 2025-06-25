$(document).ready(function() {
    // --- Configuração ---
    const apiUrlGeral = '/rh/api/get/infogeral/'; // Corrigido prefixo
    const apiUrlFuncionarios = '/rh/api/get/infofuncionarios/'; // Corrigido prefixo
    const apiUrlNovoFuncionario = '/rh/api/post/userfuncionario/'; // Corrigido prefixo
    const $form = $('form'); // Seleciona o formulário principal da página
    const $messageContainer = $('#message-container'); // <<< ADICIONADO AQUI

    // --- Elementos do DOM ---
    const $empresaSelect = $('#empresa');
    const $departamentoSelect = $('#departamento');
    const $setorSelect = $('#setor');
    const $cargoSelect = $('#cargo');
    const $horarioSelect = $('#horario');
    const $equipeSelect = $('#equipe');
    const $cpfInput = $('#cpf');
    const $dataNascimentoInput = $('#data_nascimento'); // Adicionado para o campo de data
    const $submitButton = $form.find('button[type="submit"]');

    // --- Cache de Dados ---
    let todosDepartamentos = [];
    let todosSetores = [];
    let todosCargos = [];
    let todosEmpresas = [];
    let todosHorarios = [];
    let todosEquipes = [];
    let listaCpfsExistentes = []; // Armazena CPFs para validação rápida

    // --- Funções Auxiliares ---

    // Obtém o token CSRF do cookie
    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // Exibe mensagens como Toasts (ATUALIZADO)
    function showMessage(type, message, duration = 5000) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.row'));
        setTimeout(() => alertDiv.remove(), duration);
    }

    // Limpa e reseta um select
    function resetSelect($select, defaultOptionText) {
        $select.html(`<option value="">--- ${defaultOptionText} ---</option>`);
        $select.prop('disabled', true);
    }

    // Validação básica de CPF (algoritmo)
    function validarCPF(cpf) {
        cpf = cpf.replace(/[^\d]/g, '');
        if (cpf.length !== 11) return false;
        
        // Validação do CPF
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let resto = 11 - (soma % 11);
        let digitoVerificador1 = resto > 9 ? 0 : resto;
        
        if (digitoVerificador1 !== parseInt(cpf.charAt(9))) return false;
        
        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(cpf.charAt(i)) * (11 - i);
        }
        resto = 11 - (soma % 11);
        let digitoVerificador2 = resto > 9 ? 0 : resto;
        
        return digitoVerificador2 === parseInt(cpf.charAt(10));
    }

    // --- Funções de Carregamento e População ---

    // Carrega dados gerais e de funcionários
    function carregarDadosIniciais() {
        console.log("Iniciando carregamento de dados...");
        // Usar Promise.all para carregar ambos em paralelo
        Promise.all([
            $.getJSON(apiUrlGeral).fail(function() { console.error("Falha ao carregar dados gerais."); return $.Deferred().resolve(null); }), // Continua mesmo se falhar
            $.getJSON(apiUrlFuncionarios).fail(function() { console.error("Falha ao carregar funcionários."); return $.Deferred().resolve(null); }) // Continua mesmo se falhar
        ]).then(([dataGeral, dataFuncionarios]) => {

            if (dataGeral) {
                console.log("Dados gerais carregados:", dataGeral);
                // Armazena dados em cache
                todosEmpresas = dataGeral.empresas || [];
                todosDepartamentos = dataGeral.departamentos || [];
                todosSetores = dataGeral.setores || [];
                todosCargos = dataGeral.cargos || [];
                todosHorarios = dataGeral.horarios || [];
                todosEquipes = dataGeral.equipes || [];

                // Popula selects principais
                popularSelect($empresaSelect, todosEmpresas, 'id', 'nome', 'Selecione uma Empresa', false);
                popularSelect($horarioSelect, todosHorarios, 'id', 'nome', 'Selecione um Horário', false);
                popularSelect($equipeSelect, todosEquipes, 'id', 'nome', 'Selecione uma Equipe', false);

                // Habilita selects principais se tiverem opções
                $empresaSelect.prop('disabled', todosEmpresas.length === 0);
                $horarioSelect.prop('disabled', todosHorarios.length === 0);
                $equipeSelect.prop('disabled', todosEquipes.length === 0);
            } else {
                showMessage('error', 'Não foi possível carregar os dados básicos do formulário.');
                // Desabilita selects que dependem dos dados gerais
                $empresaSelect.prop('disabled', true);
                $horarioSelect.prop('disabled', true);
                $equipeSelect.prop('disabled', true);
            }

            if (dataFuncionarios) {
                console.log("Funcionários carregados:", dataFuncionarios);
                listaCpfsExistentes = (dataFuncionarios || []).map(f => f.cpf.replace(/[\D]/g, '')); // Garante limpeza correta
            } else {
                 showMessage('warning', 'Não foi possível carregar a lista de funcionários para validação de CPF.');
            }

        }).catch(error => {
            // Este catch pode não ser atingido devido aos .fail() individuais, mas é bom ter
            console.error("Erro GERAL ao carregar dados iniciais:", error);
            showMessage('error', 'Erro crítico ao carregar dados. Tente recarregar a página.');
        });
    }

    // Popula Departamentos e Cargos com base na Empresa
    function popularSelectsDependentes(empresaId) {
        if (!empresaId) {
            resetSelect($('#departamento'), 'Selecione a Empresa Primeiro');
            resetSelect($('#setor'), 'Selecione o Departamento Primeiro');
            resetSelect($('#cargo'), 'Selecione a Empresa Primeiro');
            $('#lojas-container').html('<p class="text-muted small">Selecione a empresa primeiro para carregar as lojas disponíveis.</p>');
            return;
        }

        $.ajax({
            url: '/rh/api/get/infogeralemp/',
            method: 'GET',
            success: function(response) {
                const empresa = response.empresas.find(e => e.id === parseInt(empresaId));
                if (!empresa) return;

                // Popular departamentos
                const departamentos = empresa.departamentos.map(dept => ({
                    id: dept.id,
                    nome: dept.nome
                }));
                popularSelect($('#departamento'), departamentos, 'id', 'nome', 'Selecione um Departamento', false);

                // Popular cargos
                const cargos = empresa.cargos.map(cargo => ({
                    id: cargo.id,
                    nome: cargo.nome
                }));
                popularSelect($('#cargo'), cargos, 'id', 'nome', 'Selecione um Cargo', false);

                // Popular lojas
                popularLojas(empresa.lojas);
            },
            error: function(xhr, status, error) {
                showMessage('danger', 'Erro ao carregar dados dependentes: ' + error);
            }
        });
    }

    // Popula Setores com base no Departamento
    function popularSetores(departamentoId) {
        if (!departamentoId) {
            resetSelect($setorSelect, 'Selecione o Departamento Primeiro');
            return;
        }

        $.ajax({
            url: '/rh/api/get/infogeralemp/',
            method: 'GET',
            success: function(response) {
                const departamento = response.empresas
                    .flatMap(e => e.departamentos)
                    .find(d => d.id === parseInt(departamentoId));
                
                if (!departamento) return;

                const setores = departamento.setores.map(setor => ({
                    id: setor.id,
                    nome: setor.nome
                }));
                popularSelect($setorSelect, setores, 'id', 'nome', 'Selecione um Setor', false);
            },
            error: function(xhr, status, error) {
                showMessage('danger', 'Erro ao carregar setores: ' + error);
            }
        });
    }

    // Função genérica para popular um select
    function popularSelect($select, data, valueField, textField, defaultOptionText, isDisabled = true) {
        $select.html(`<option value="">--- ${defaultOptionText} ---</option>`);
        data.forEach(item => {
            $select.append(`<option value="${item[valueField]}">${item[textField]}</option>`);
        });
        $select.prop('disabled', isDisabled);
    }

    // Função para popular o container de lojas
    function popularLojas(lojas) {
        const container = $('#lojas-container');
        container.empty();
        
        if (!lojas || lojas.length === 0) {
            container.html('<p class="text-muted small">Nenhuma loja disponível para esta empresa.</p>');
            return;
        }
        
        const checkboxGroup = $('<div class="checkbox-group"></div>');
        lojas.forEach(loja => {
            const checkbox = $(`
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="lojas" value="${loja.id}" id="loja_${loja.id}">
                    <label class="form-check-label" for="loja_${loja.id}">
                        ${loja.nome}
                    </label>
                </div>
            `);
            checkboxGroup.append(checkbox);
        });
        
        container.html(checkboxGroup);
    }

    // Função para carregar dados dos cards (funcionários ativos e inativos)
    function carregarDadosCards() {
        console.log("Carregando dados dos cards de funcionários...");
        
        // URL da API que retorna as quantidades
        const apiUrlCards = '/rh/api/get/infocardsnovo/';
        
        // Requisição AJAX para obter os dados
        $.ajax({
            url: apiUrlCards,
            type: 'GET',
            success: function(response) {
                console.log("Dados dos cards recebidos:", response);
                
                // Atualiza o card de funcionários ativos
                const $cardAtivos = $('.dashboard-card.border-success .card-body p');
                $cardAtivos.text(response.qtd_ativos || 0);
                
                // Atualiza o card de funcionários inativos
                const $cardInativos = $('.dashboard-card.border-danger .card-body p');
                $cardInativos.text(response.qtd_inativos || 0);
                
                console.log("Cards atualizados com sucesso.");
            },
            error: function(xhr, status, error) {
                console.error("Erro ao carregar dados dos cards:", error);
                // Não exibe mensagem de erro para o usuário para não interromper a experiência
            }
        });
    }

    // --- Funções de Validação e Submissão ---

    // Verifica se CPF é válido e se já existe
    function handleCPFChange() {
        const cpf = $cpfInput.val();
        const cpfLimpo = cpf.replace(/[^\d]+/g, '');
        $cpfInput.removeClass('is-invalid is-valid'); // Limpa classes de validação

        if (cpfLimpo.length === 11) {
            if (!validarCPF(cpf)) {
                $cpfInput.addClass('is-invalid');
                showMessage('error', 'CPF inválido.');
                return false; // Inválido
            } else if (listaCpfsExistentes.includes(cpfLimpo)) {
                $cpfInput.addClass('is-invalid'); // Ou 'is-warning' se preferir
                showMessage('error', 'Este CPF já está cadastrado.');
                return false; // Já existe
            } else {
                $cpfInput.addClass('is-valid');
                $messageContainer.empty(); // Limpa mensagens anteriores
                return true; // Válido e não existe
            }
        } else if (cpfLimpo.length > 0) {
            // Se não tem 11 dígitos mas não está vazio, marca como inválido
             $cpfInput.addClass('is-invalid');
             return false; // Incompleto/Inválido
        }
         return true; // Vazio ou incompleto, mas não necessariamente inválido ainda
    }

    // Submete o formulário via AJAX
    function submeterFormulario(event) {
        event.preventDefault(); // Impede o envio tradicional
        $messageContainer.empty(); // Limpa mensagens anteriores

        // Valida CPF antes de enviar
        if (!handleCPFChange()) {
            $cpfInput.focus();
            return;
        }

        // Validação de campos obrigatórios do HTML5 (boa prática adicional)
        if (!$form[0].checkValidity()) {
            $form[0].reportValidity(); // Mostra mensagens de validação nativas do browser
            return;
        }

        // Formatação dos dados
        const cpf = $cpfInput.val().replace(/[^\d]+/g, ''); // Formata CPF
        const dataNascimento = $dataNascimentoInput.val(); // Obtém a data de nascimento

        // Log dos dados antes de enviar
        console.log("Dados a serem enviados:", {
            apelido: $('#apelido').val(),
            nome_completo: $('#nome_completo').val(),
            cpf: cpf,
            data_nascimento: dataNascimento,
            empresa: $empresaSelect.val(),
            departamento: $departamentoSelect.val(),
            setor: $setorSelect.val(),
            cargo: $cargoSelect.val(),
            horario: $horarioSelect.val(),
            equipe: $equipeSelect.val(),
            // Adicione outros campos conforme necessário
        });

        // Log da foto
        const fotoFile = $('#foto')[0].files[0]; // Obtém o arquivo da foto
        if (fotoFile) {
            console.log("Arquivo de foto a ser enviado:", fotoFile.name);
        } else {
            console.log("Nenhum arquivo de foto selecionado.");
        }

        // Envia a requisição POST diretamente
        const formData = new FormData($form[0]); // Cria FormData a partir do formulário

        // Adiciona as lojas selecionadas
        const lojasSelecionadas = [];
        $('input[name="lojas"]:checked').each(function() {
            lojasSelecionadas.push($(this).val());
        });
        lojasSelecionadas.forEach(lojaId => {
            formData.append('lojas', lojaId);
        });
        console.log("Lojas selecionadas:", lojasSelecionadas);

        const submitButtonText = $submitButton.html();
        $submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...');

        $.ajax({
            url: apiUrlNovoFuncionario,
            type: 'POST',
            data: formData,
            processData: false, // Necessário para FormData
            contentType: false, // Necessário para FormData
            headers: {
                'X-CSRFToken': getCsrfToken() // Inclui o token CSRF
            },
            success: function(response) {
                if (response && response.message) {
                    console.log("Sucesso:", response);
                    showMessage('success', response.message); // Exibe a mensagem de sucesso recebida da API
                    $form[0].reset(); // Limpa o formulário
                    // Reseta selects dependentes e validação de CPF
                    resetSelect($departamentoSelect, 'Selecione a Empresa Primeiro');
                    resetSelect($setorSelect, 'Selecione o Departamento Primeiro');
                    resetSelect($cargoSelect, 'Selecione a Empresa Primeiro');
                    $cpfInput.removeClass('is-valid is-invalid');
                    // Recarrega a lista de CPFs para incluir o novo
                    carregarDadosIniciais();
                    carregarDadosCards();
                } else {
                    showMessage('error', 'Erro ao adicionar funcionário. Tente novamente.');
                }
            },
            error: function(xhr, status, error) {
                showMessage('error', 'Erro ao adicionar funcionário: ' + error);
            },
            complete: function() {
                $submitButton.prop('disabled', false).html(submitButtonText); // Restaura o botão
            }
        });
    }

    // --- Event Listeners ---

    // Ao mudar a Empresa, popula os selects dependentes
    $empresaSelect.change(function() {
        popularSelectsDependentes($(this).val());
    });

    // Ao mudar o Departamento, popula os Setores
    $departamentoSelect.change(function() {
        popularSetores($(this).val());
    });

    // Ao sair do campo CPF ou mudar seu valor, valida
    $cpfInput.on('blur change', handleCPFChange);

    // Intercepta o envio do formulário
    $form.submit(submeterFormulario);

    // --- Inicialização ---
    carregarDadosIniciais(); // Carrega dados quando a página estiver pronta
    carregarDadosCards(); // Carrega dados dos cards de quantidade de funcionários

    // Aplica máscara ao CPF (Exemplo usando jQuery Mask Plugin - inclua a lib no seu base.html)
    // Se você não usa essa lib, remova ou adapte esta linha.
    if ($.fn.mask) {
        $cpfInput.mask('000.000.000-00');
    } else {
        console.warn('jQuery Mask Plugin não encontrado. Máscara de CPF não aplicada.');
    }

}); 