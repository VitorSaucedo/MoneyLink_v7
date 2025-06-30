/**
 * Sistema de Modais de Manutenção - MoneyLink Pro
 * @description Gerencia modais de observações de manutenção para periféricos e computadores
 * @author Sistema TI
 * @version 1.0
 */

(function($) {
    'use strict';

    // =================== VARIÁVEIS DOM ===================
    
    /** Elementos do modal de observações de manutenção */
    const manutencaoObsModalBackdrop = $('#manutencao-obs-backdrop');
    const manutencaoObsModal = $('#manutencao-obs-modal');
    const manutencaoItemNome = $('#manutencao-item-nome');
    const manutencaoObsInput = $('#manutencao-observacoes-input');
    const manutencaoObsModalSaveBtn = $('#manutencao-obs-modal-save-btn');
    const manutencaoObsModalCancelBtn = $('#manutencao-obs-modal-cancel-btn');
    const manutencaoObsModalCloseBtn = $('#manutencao-obs-modal-close-btn');
    
    /** Dados temporários para o modal de manutenção */
    let dadosParaManutencao = null; // { tipoItem: 'periferico'/'computador', itemId, paId, itemNome, itemElement }

    // =================== FUNÇÕES PRINCIPAIS ===================

    /**
     * Abre o modal de observações de manutenção
     * @param {string} itemNome - Nome do item em manutenção (periférico ou computador)
     */
    function abrirModalObservacoesManutencao(itemNome) {
        manutencaoItemNome.text(itemNome);
        manutencaoObsInput.val(''); // Limpar input anterior
        manutencaoObsModalBackdrop.addClass('show').fadeIn(200);
        manutencaoObsModal.addClass('show').fadeIn(200);
        $('body').addClass('modal-open');
        
        // Focar no input de observações
        setTimeout(() => {
            manutencaoObsInput.focus();
        }, 250);
    }

    /**
     * Fecha o modal de observações de manutenção
     */
    function fecharModalObservacoesManutencao() {
        manutencaoObsModalBackdrop.fadeOut(200, function() { 
            $(this).removeClass('show'); 
        });
        manutencaoObsModal.fadeOut(200, function() { 
            $(this).removeClass('show'); 
        });
        $('body').removeClass('modal-open');
        dadosParaManutencao = null; // Limpar dados temporários
    }

    /**
     * Define os dados temporários para o modal de manutenção
     * @param {Object} dados - Dados do item para manutenção
     * @param {string} dados.tipoItem - Tipo do item ('periferico' ou 'computador')
     * @param {number} dados.itemId - ID do item
     * @param {number} dados.paId - ID da PA
     * @param {string} dados.itemNome - Nome do item
     * @param {jQuery} dados.itemElement - Elemento jQuery do item
     * @param {string} [dados.perifericoTipo] - Tipo do periférico (apenas para periféricos)
     */
    function definirDadosParaManutencao(dados) {
        dadosParaManutencao = dados;
    }

    // =================== EVENT LISTENERS ===================

    /**
     * Event listener para o botão de salvar observações de manutenção
     */
    manutencaoObsModalSaveBtn.on('click', function() {
        if (!dadosParaManutencao) {
            console.warn('Nenhum dado para manutenção encontrado');
            return;
        }

        const observacoes = manutencaoObsInput.val().trim();
        const { tipoItem, itemId, paId, itemElement, perifericoTipo } = dadosParaManutencao;

        // Direcionar para a função apropriada baseado no tipo do item
        if (tipoItem === 'periferico') {
            // Verificar se a função existe no escopo global
            if (window.atualizarStatusPerifericoNoServidor) {
                window.atualizarStatusPerifericoNoServidor(
                    itemId, 
                    'manutencao', 
                    paId, 
                    itemElement, 
                    perifericoTipo, 
                    observacoes
                );
            } else {
                console.error('Função atualizarStatusPerifericoNoServidor não encontrada');
                window.mostrarMensagem('Erro: Função de atualização de periférico não encontrada', 'error');
            }
        } else if (tipoItem === 'computador') {
            // Verificar se a função existe no escopo global
            if (window.atualizarStatusComputadorNoServidor) {
                window.atualizarStatusComputadorNoServidor(
                    itemId, 
                    'manutencao', 
                    paId, 
                    itemElement, 
                    observacoes
                );
            } else {
                console.error('Função atualizarStatusComputadorNoServidor não encontrada');
                window.mostrarMensagem('Erro: Função de atualização de computador não encontrada', 'error');
            }
        } else {
            console.error('Tipo de item desconhecido:', tipoItem);
            window.mostrarMensagem('Erro: Tipo de item desconhecido', 'error');
        }

        fecharModalObservacoesManutencao();
    });

    /**
     * Event listener para o botão de cancelar
     */
    manutencaoObsModalCancelBtn.on('click', fecharModalObservacoesManutencao);

    /**
     * Event listener para o botão de fechar (X)
     */
    manutencaoObsModalCloseBtn.on('click', fecharModalObservacoesManutencao);

    /**
     * Event listener para fechar ao clicar no backdrop
     */
    manutencaoObsModalBackdrop.on('click', function(event) {
        if (event.target === this) {
            fecharModalObservacoesManutencao();
        }
    });

    /**
     * Event listener para fechar modal com a tecla ESC
     */
    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && manutencaoObsModal.hasClass('show')) {
            fecharModalObservacoesManutencao();
        }
    });

    /**
     * Event listener para submeter formulário com Enter (Ctrl+Enter)
     */
    manutencaoObsInput.on('keydown', function(event) {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            manutencaoObsModalSaveBtn.trigger('click');
        }
    });

    // =================== EXPORTAÇÃO GLOBAL ===================

    // Exportar funções para o escopo global para compatibilidade
    window.abrirModalObservacoesManutencao = abrirModalObservacoesManutencao;
    window.fecharModalObservacoesManutencao = fecharModalObservacoesManutencao;
    window.definirDadosParaManutencao = definirDadosParaManutencao;
    
    // Exportar variáveis para compatibilidade
    window.dadosParaManutencao = dadosParaManutencao;

    // =================== INICIALIZAÇÃO ===================

})(jQuery); 