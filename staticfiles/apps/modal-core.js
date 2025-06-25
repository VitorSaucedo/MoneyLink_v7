console.log('MODAL-CORE EM EXECUÇÃO!!');


// USO UNIVERSAL: Salva o estado do modal ativo na sessão
function saveActiveModalState(modalId) {
    if (modalId) {
        sessionStorage.setItem('activeModal', modalId.replace('#', ''));
        console.log(`Estado do modal salvo: ${modalId}`);
    } else {
        sessionStorage.removeItem('activeModal');
        console.log('Estado do modal removido');
    }
}

// USO UNIVERSAL: Restaura o estado do último modal ativo
function restoreActiveModalState() {
    const activeModalId = sessionStorage.getItem('activeModal');
    if (activeModalId) {
        const modal = document.getElementById(activeModalId);
        if (modal) {
            modal.classList.add('active');
            console.log(`Modal restaurado: ${activeModalId}`);
        }
    }
}

// USO UNIVERSAL: Abre um modal e gerencia o estado
function openModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    console.log(`Tentando abrir o modal com ID: ${cleanedModalId}`);

    document.querySelectorAll('.modal.active').forEach(modal => {
        if (modal.id !== cleanedModalId) {
            modal.classList.remove('active');
            console.log(`Fechando modal: ${modal.id}`);
        }
    });

    const modal = document.getElementById(cleanedModalId);
    if (modal) {
        modal.classList.add('active');
        saveActiveModalState(cleanedModalId);
        console.log(`Modal com ID: ${cleanedModalId} aberto com sucesso`);
    } else {
        console.error(`Modal com ID: ${cleanedModalId} não encontrado`);
    }
}



// USO UNIVERSAL: Fecha todos os modais ativos
function closeAllModals(forceClose = false) {
    if (!forceClose) {
        return;
    }
    
    document.querySelectorAll('.modal.active').forEach(modal => {
        console.log(`Fechando modal com ID: ${modal.id}`);
        modal.classList.remove('active');
    });
    saveActiveModalState(null);
}

// USO UNIVERSAL: Fecha um modal específico
function fecharModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const modal = document.getElementById(cleanedModalId);
    
    if (modal) {
        modal.classList.remove('active');
        console.log(`Modal com ID: ${cleanedModalId} fechado com sucesso`);
        saveActiveModalState(null);
    } else {
        console.error(`Modal com ID: ${cleanedModalId} não encontrado`);
    }
}

// USO UNIVERSAL: Abre modal com opções
function abrirModalOptions(modalId) {
    console.log(`Tentando abrir modal via options: ${modalId}`);
    
    document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
        if (modal.id !== modalId.replace('#', '')) {
            modal.classList.remove('active');
            console.log(`Fechando modal: ${modal.id}`);
        }
    });

    openModal(modalId);
}





// USO UNIVERSAL: Converte dados para formato cliente loja
function converterParaFormatoClienteLoja(agendamento) {
    return {
        id: agendamento.id,
        nome: agendamento.nome_cliente,
        cpf: agendamento.cpf_cliente,
        numero: agendamento.numero_cliente,
        diaAgendado: agendamento.dia_agendado,
        diaAgendadoFormatado: agendamento.diaAgendadoFormatado,
        tabulacaoAtendente: agendamento.tabulacao_atendente,
        atendenteAgendou: agendamento.atendente_nome,
        lojaAgendada: agendamento.loja_nome
    };
}

// USO UNIVERSAL: Preenche select de vendedores
function preencherSelectVendedores(selectElement) {
    Object.values(vendedoresListaClientes).forEach(vendedor => {
        const option = document.createElement('option');
        option.value = vendedor.id;
        option.textContent = vendedor.nome;
        selectElement.appendChild(option);
    });
}

// USO UNIVERSAL: Event Listeners após carregamento do DOM
document.addEventListener('DOMContentLoaded', function() {
    const mensagensContainer = document.getElementById('mensagens');
    const temMensagemSucesso = mensagensContainer && 
                              mensagensContainer.querySelector('.success');

    document.querySelectorAll('.btn-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            fecharModal(modalId);
        });
    });

    const modalEdicaoCliente = document.getElementById('modalEdicaoCliente');
    if (modalEdicaoCliente) {
        const tabulacaoVendedor = modalEdicaoCliente.querySelector('#tabulacaoVendedor');
        if (tabulacaoVendedor) {
            tabulacaoVendedor.addEventListener('change', handleTabulacaoVendedorChange);
            console.log('Listener adicionado ao select de tabulação do vendedor');
        } else {
            console.error('Select de tabulação do vendedor não encontrado');
        }
    } else {
        console.error('Modal de edição cliente não encontrado');
    }

    document.querySelectorAll('.modal-sec form').forEach(form => {
        form.addEventListener('submit', handleSubModalFormSubmit);
    });

    document.querySelectorAll('.modal-sec .btn-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal-sec').id;
            closeSubModal(modalId);
        });
    });

    document.querySelectorAll('.modal-sec').forEach(modalSec => {
        modalSec.addEventListener('click', function(event) {
            if (event.target === this) {
                closeSubModal(this.id);
            }
        });
    });

    document.addEventListener('click', function(event) {
        // Verifica se o clique foi fora de um modal-sec
        if (event.target.classList.contains('modal-sec')) {
            return;
        }

        // Se o clique foi fora de um modal, fecha o modal
        if (event.target.classList.contains('modal-sec')) {
            fecharModal(event.target.id);
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
                fecharModal(modal.id);
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const keepModalId = urlParams.get('keepModal');
    const lastActiveModal = sessionStorage.getItem('lastActiveModal');

    if (keepModalId) {
        console.log(`Restaurando modal específico: ${keepModalId}`);
        openModal(keepModalId);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (lastActiveModal) {
        console.log(`Restaurando último modal ativo: ${lastActiveModal}`);
        openModal(lastActiveModal);
        sessionStorage.removeItem('lastActiveModal');
    }

    // Verifica se deve abrir o modal padrão após reload
    const defaultModal = sessionStorage.getItem('defaultModal');
    if (defaultModal) {
        console.log(`Abrindo modal padrão após reload: ${defaultModal}`);
        openModal(defaultModal);
        sessionStorage.removeItem('defaultModal');
    }

    // Adiciona listener específico para o form de meta
    const formMeta = document.querySelector('form[name="form_type"][value="adicionar_meta"]');
    if (formMeta) {
        formMeta.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const tipoMeta = document.querySelector('#tipo_meta');
            const setorField = document.querySelector('#setor');
            const lojaField = document.querySelector('#loja');
            
            if (tipoMeta && tipoMeta.value === 'INDIVIDUAL') {
                if (setorField) setorField.required = true;
                if (lojaField) lojaField.required = true;
            } else {
                if (setorField) setorField.required = false;
                if (lojaField) lojaField.required = false;
            }
            
            this.submit();
        });
    }

    // Adiciona listener para o tipo de meta
    const tipoMetaSelect = document.querySelector('#tipo_meta');
    const setorContainer = document.querySelector('#setor_container');
    const lojaContainer = document.querySelector('#loja_container');
    
    if (tipoMetaSelect) {
        tipoMetaSelect.addEventListener('change', function() {
            if (setorContainer && lojaContainer) {
                const isIndividual = this.value === 'INDIVIDUAL';
                setorContainer.style.display = isIndividual ? 'block' : 'none';
                lojaContainer.style.display = isIndividual ? 'block' : 'none';
            }
        });
        
        // Dispara o evento change para configurar o estado inicial
        tipoMetaSelect.dispatchEvent(new Event('change'));
    }

    // Adiciona listener específico para formulários em modais
    document.querySelectorAll('.modal form, .modal-sec form').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            handleSubModalFormSubmit(event);
        });
    });    
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', handleModalClick);
});

document.getElementById('modalConfirmacaoAgendamento')
    .querySelector('#tabulacaoAtendente')
    .addEventListener('change', handleTabulacaoChange);

// USO UNIVERSAL: Fecha um sub-modal específico
function closeSubModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const modal = document.getElementById(cleanedModalId);
    
    if (modal && modal.classList.contains('modal-sec')) {
        modal.classList.remove('active');
        console.log(`Sub-modal com ID: ${cleanedModalId} fechado com sucesso`);
    } else {
        console.error(`Sub-modal com ID: ${cleanedModalId} não encontrado ou não é um modal secundário`);
    }
}

// USO UNIVERSAL: Gerencia cliques em modais
function handleModalClick(event) {
    if (event.target.classList.contains('modal-sec')) {
        closeSubModal(event.target.id);
        event.stopPropagation();
    }
}

// USO UNIVERSAL: Gerencia submissão de formulários em sub-modais
function handleSubModalFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formType = form.querySelector('input[name="form_type"]').value;

    console.log(`Processando submit do formulário tipo: ${formType}`);

    // Adicionando os novos tipos de formulário permitidos
    const tiposPermitidos = [
        'criar_campanha', 
        'consulta_cliente', 
        'importar_csv', 
        'adicionar_registro', 
        'adicionar_meta', 
        'alterar_status_meta', 
        'excluir_registro', 
        'agendamento', 
        'status_tac', 
        'lista_clientes', 
        'confirmacao_agendamento',
        'delete_funcionario', 
        'criar_horario', 
        'excluir_cargo', 
        'criar_cargo', 
        'criar_departamento', 
        'delete_loja', 
        'criar_loja', 
        'criar_empresa', 
        'associar_grupos', 
        'cadastrar_usuario', 
        'cadastro_funcionario',
        'importar_csv_money',
        'importar_situacao',
        'cliente_rua',
        'registro_equipe',
        'adicionar_membro',
        'registrar_pontos',
        'modalAniversariantes'
    ];

    // Se o tipo de formulário estiver na lista permitida, permite o submit normal
    if (tiposPermitidos.includes(formType)) {
        console.log(`Submetendo formulário de ${formType} normalmente.`);
        form.submit(); // Permite o submit padrão
        return; // Sai da função
    }

    // Fecha todos os modais antes do submit
    document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
        modal.classList.remove('active');
        console.log(`Fechando modal: ${modal.id}`);
    });

    // Limpa todos os estados salvos
    sessionStorage.removeItem('activeModal');
    sessionStorage.removeItem('lastActiveModal');
    sessionStorage.removeItem('defaultModal');

    // Define a URL correta com base no tipo de formulário
    let url;
    if (formType === 'update_funcionario' || formType === 'update_user') {
        url = form.action; // A URL já está definida no action do formulário
    } else {
        console.error('Tipo de formulário não reconhecido:', formType);
        return; // Sai da função se o tipo não for reconhecido
    }

    $.ajax({
        url: url,
        method: form.method,
        data: new FormData(form),
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('Formulário enviado com sucesso');
            // Lógica de sucesso
        },
        error: function(xhr, status, error) {
            console.error('Erro ao enviar formulário:', error);
            mostrarMensagem('Erro ao processar formulário', 'error');
        }
    });
}


// USO UNIVERSAL: Exibe mensagens temporárias
function mostrarMensagem(texto, tipo) {
    const mensagem = $(`<div class="alert alert-${tipo}">${texto}</div>`);
    $('#mensagens').append(mensagem);
    setTimeout(() => mensagem.fadeOut('slow', function() { $(this).remove(); }), 3000);
}

// USO UNIVERSAL: Fecha um sub-modal
function fecharSubModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const subModal = document.getElementById(cleanedModalId);
    
    if (subModal) {
        subModal.classList.remove('active');
        console.log(`Sub-modal com ID: ${cleanedModalId} fechado com sucesso`);
    } else {
        console.error(`Sub-modal com ID: ${cleanedModalId} não encontrado`);
    }
}
