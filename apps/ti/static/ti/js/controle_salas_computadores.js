/**
 * Sistema de Computadores - MoneyLink Pro (Otimizado)
 * @description Gerencia dropdowns, atribuições, remoções e status de computadores
 * @author Sistema TI
 * @version 2.0 - Refatorado
 */

(function($) {
    'use strict';

    // =================== CONFIGURAÇÕES CENTRALIZADAS ===================
    
    const CONFIG = {
        urls: {
            computadoresDisponiveis: '/ti/api/computadores-disponiveis/',
            adicionarComputador: '/ti/api/pa/{pa_id}/adicionar-computador/',
            removerComputador: '/ti/api/pa/{pa_id}/remover-computador/',
            atualizarStatus: '/ti/api/computador/{computador_id}/atualizar-status/'
        },
        classes: {
            dropdown: 'computador-dropdown-menu',
            actionMenu: 'computador-action-menu',
            statusMenu: 'computador-status-menu',
            tag: 'computador-tag',
            marcaItem: 'computador-marca-dropdown',
            statusItem: 'computador-status-item',
            assignBtn: 'assign-computador-btn-main',
            addBtn: 'add-computador-btn',
            removeBtn: 'remove-computador-btn'
        },
        animation: { fadeSpeed: 150, hideSpeed: 100 },
        layout: { dropdownWidth: 320, dropdownHeight: 450, minMargin: 20 },
        zIndex: { dropdown: 999999, loader: 9999 },
        cache: { timeout: 300000 } // 5 minutos
    };

    // =================== TEMPLATES HTML ===================
    
    const TEMPLATES = {
        dropdownEmpty: (paId) => 
            `<div class="${CONFIG.classes.dropdown} p-2 text-muted" id="dropdown-computador-pa-${paId}">Nenhum computador disponível para atribuição.</div>`,
        
        dropdownInfo: () => 
            `<div class="dropdown-info-message" style="padding:8px 15px; font-size:0.9em; color:#666; border-bottom:1px solid #eee; margin-bottom:5px; background-color:#f8f9fa;">
                <i class='bx bx-info-circle me-1'></i> Clique na marca para atribuir um computador aleatório.
            </div>`,
        
        marcaItem: (marca, computadoresIds, qtd) => 
            `<div class="${CONFIG.classes.marcaItem}" data-marca="${marca}" data-computadores-ids="${JSON.stringify(computadoresIds)}"
                  style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                <span class="nome" style="font-weight:500;">${marca}</span>
                <span class="badge bg-info" style="font-size:0.8em;">${qtd} ${qtd === 1 ? 'disponível' : 'disponíveis'}</span>
            </div>`,
        
        loader: (paId, rect) => 
            `<div id="dropdown-loader-computador-${paId}" style="position: fixed; z-index: ${CONFIG.zIndex.loader}; left: ${rect.right + 10}px; top: ${rect.top}px;">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`,
        
        error: (paId, rect) => 
            `<div id="error-message-computador-${paId}" style="position: fixed; z-index: ${CONFIG.zIndex.loader}; left: ${rect.right + 10}px; top: ${rect.top}px; background: white; padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: red;">
                Falha ao carregar computadores
            </div>`,
        
        computadorTag: (computador, paId) => 
            `<span class="${CONFIG.classes.tag}" data-computador-id="${computador.id}" data-pa-id="${paId}">
                ${computador.marca} ${computador.condicao ? `(${computador.condicao === 'novo' ? 'Novo' : 'Antigo'})` : ''}
                <i class='bx bx-x-circle ${CONFIG.classes.removeBtn} ms-1' title='Remover este computador' style="cursor:pointer; vertical-align: middle;"></i>
            </span>`,
        
        assignButton: (paId) => 
            `<button type="button" class="btn btn-sm btn-info ${CONFIG.classes.assignBtn}" data-pa-id="${paId}" data-action="open_computador_add_dropdown">
                <i class='bx bx-plus-circle me-1'></i> Atribuir Computador
            </button>`,
        
        actionMenu: () => 
            `<div class="${CONFIG.classes.actionMenu}">
                <div class="computador-action-option" data-action="update-status">
                    <i class='bx bx-edit-alt me-2'></i>Atualizar Status
                </div>
                <div class="computador-action-option remove-action" data-action="remove">
                    <i class='bx bx-trash me-2'></i>Remover da PA
                </div>
            </div>`,
        
        statusMenu: (computadorNome) => 
            `<div class="${CONFIG.classes.statusMenu}">
                <div class="computador-status-header">Atualizar Status: ${computadorNome}</div>
                <div class="${CONFIG.classes.statusItem}" data-status="manutencao">
                    <span class="status-indicator status-manutencao"></span>Em Manutenção
                </div>
                <div class="${CONFIG.classes.statusItem}" data-status="disponivel">
                    <span class="status-indicator status-disponivel"></span>Livre (Disponível)
                </div>
            </div>`
    };

    // =================== ESTADO GLOBAL ===================
    
    const STATE = {
        cache: null,
        cacheTime: null,
        activeDropdown: null,
        activeActionMenu: null,
        activeStatusMenu: null
    };

    // =================== FUNÇÕES UTILITÁRIAS ===================
    
    const Utils = {
        closeAllMenus() {
            [STATE.activeActionMenu, STATE.activeStatusMenu].forEach(menu => {
                if (menu) { menu.remove(); }
            });
            STATE.activeActionMenu = STATE.activeStatusMenu = null;
        },

        closePeripheralsMenus() {
            if (typeof window.fecharMenusPerifericoAtivos === 'function') {
                window.fecharMenusPerifericoAtivos();
            }
        },

        isValidCache() {
            return STATE.cache && STATE.cacheTime && 
                   (Date.now() - STATE.cacheTime) < CONFIG.cache.timeout;
        },

        clearCache() {
            STATE.cache = STATE.cacheTime = null;
        },

        setCache(data) {
            STATE.cache = data;
            STATE.cacheTime = Date.now();
        },

        getErrorMessage(error) {
            if (error.responseJSON?.error) return error.responseJSON.error;
            if (error.statusText) return `${error.statusText} (Status: ${error.status || 'N/A'})`;
            if (error.message) return error.message;
            return 'Erro desconhecido.';
        },

        showMessage(message, type = 'info') {
            if (typeof window.mostrarMensagem === 'function') {
                window.mostrarMensagem(message, type);
            }
        },

        groupByBrand(computadores) {
            return computadores.reduce((acc, comp) => {
                acc[comp.marca] = acc[comp.marca] || [];
                acc[comp.marca].push(comp);
                return acc;
            }, {});
        },

        calculatePosition(buttonRect, dropdownWidth = CONFIG.layout.dropdownWidth) {
            const viewportHeight = window.innerHeight;
            const dropdownHeight = CONFIG.layout.dropdownHeight;
            const spaceBelow = viewportHeight - buttonRect.bottom;
            const openUpwards = spaceBelow < dropdownHeight;
            
            let leftPos = buttonRect.left;
            if (leftPos + dropdownWidth > window.innerWidth - CONFIG.layout.minMargin) {
                leftPos = Math.max(CONFIG.layout.minMargin, buttonRect.right - dropdownWidth);
            }
            
            let topPos, maxHeight;
            if (openUpwards) {
                topPos = Math.max(CONFIG.layout.minMargin, buttonRect.top - dropdownHeight);
                maxHeight = buttonRect.top - 40;
            } else {
                topPos = buttonRect.bottom + 5;
                maxHeight = viewportHeight - topPos - CONFIG.layout.minMargin;
            }
            
            return { leftPos, topPos, maxHeight };
        }
    };

    // =================== API E REQUISIÇÕES ===================
    
    const API = {
        async request(url, options = {}) {
            return $.ajax({
                url,
                method: options.method || 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val(),
                    ...options.headers
                },
                data: options.data,
                contentType: options.contentType || 'application/json; charset=utf-8',
                dataType: 'json'
            });
        },

        async fetchComputadores() {
            if (Utils.isValidCache()) return STATE.cache;
            
            try {
                const response = await this.request(CONFIG.urls.computadoresDisponiveis);
                if (response.computadores) {
                    Utils.setCache(response.computadores);
                    return response.computadores;
                }
                throw new Error(response.error || 'Erro ao buscar computadores disponíveis.');
            } catch (error) {
                console.error("Erro ao buscar computadores:", error);
                Utils.showMessage(`Erro ao buscar computadores: ${Utils.getErrorMessage(error)}`, 'error');
                return null;
            }
        },

        async adicionarComputador(paId, computadorId) {
            const url = CONFIG.urls.adicionarComputador.replace('{pa_id}', paId);
            return this.request(url, {
                method: 'POST',
                data: JSON.stringify({ computador_id: computadorId })
            });
        },

        async removerComputador(paId, computadorId) {
            const url = CONFIG.urls.removerComputador.replace('{pa_id}', paId);
            return this.request(url, {
                method: 'POST',
                data: JSON.stringify({ computador_id: computadorId })
            });
        },

        async atualizarStatus(computadorId, status, paId, observacoes = null) {
            const url = CONFIG.urls.atualizarStatus.replace('{computador_id}', computadorId);
            return this.request(url, {
                method: 'POST',
                data: JSON.stringify({ status, pa_id: paId, observacoes })
            });
        }
    };

    // =================== DROPDOWN DE COMPUTADORES ===================
    
    const Dropdown = {
        createHTML(computadores, paId) {
            if (!computadores?.length) return TEMPLATES.dropdownEmpty(paId);
            
            const grouped = Utils.groupByBrand(computadores);
            const items = [TEMPLATES.dropdownInfo()];
            
            Object.entries(grouped).forEach(([marca, comps]) => {
                if (comps.length > 0) {
                    const ids = comps.map(c => c.id);
                    items.push(TEMPLATES.marcaItem(marca, ids, comps.length));
                }
            });
            
            return `<div class="${CONFIG.classes.dropdown}" id="dropdown-computador-pa-${paId}" style="min-width:${CONFIG.layout.dropdownWidth}px;">${items.join('')}</div>`;
        },

        position(dropdown, buttonRect) {
            const { leftPos, topPos, maxHeight } = Utils.calculatePosition(buttonRect);
            dropdown.css({
                position: 'fixed',
                top: topPos + 'px',
                left: leftPos + 'px',
                display: 'none',
                zIndex: CONFIG.zIndex.dropdown,
                maxHeight: maxHeight + 'px',
                overflowY: 'auto'
            }).fadeIn(CONFIG.animation.fadeSpeed);
        },

        attachEvents(dropdown, paId) {
            dropdown.find(`.${CONFIG.classes.marcaItem}`).on('click', function() {
                const computadoresIds = $(this).data('computadores-ids');
                if (!computadoresIds?.length) return;
                
                const randomId = computadoresIds[Math.floor(Math.random() * computadoresIds.length)];
                const paCard = $(`.pa-card[data-pa-id="${paId}"]`);
                
                $(this).css('background-color', '#e6f7ff').find('.badge')
                       .removeClass('bg-info').addClass('bg-primary');
                
                Actions.addComputador(paId, randomId, paCard);
                this.close();
            }).hover(
                function() { $(this).css('background-color', '#f0f8ff'); },
                function() { $(this).css('background-color', ''); }
            );
        },

        async toggle(button) {
            const paId = $(button).data('pa-id');
            const existing = $(`#dropdown-computador-pa-${paId}`);
            
            if (STATE.activeDropdown && STATE.activeDropdown.attr('id') !== `dropdown-computador-pa-${paId}`) {
                STATE.activeDropdown.fadeOut(CONFIG.animation.hideSpeed, function() { $(this).remove(); });
                STATE.activeDropdown = null;
            }
            
            if (existing.length) {
                existing.fadeOut(CONFIG.animation.hideSpeed, function() { $(this).remove(); });
                STATE.activeDropdown = null;
                return;
            }
            
            const rect = button.getBoundingClientRect();
            $('body').append(TEMPLATES.loader(paId, rect));
            
            const computadores = await API.fetchComputadores();
            $(`#dropdown-loader-computador-${paId}`).remove();
            
            if (computadores) {
                $('body').append(this.createHTML(computadores, paId));
                STATE.activeDropdown = $(`#dropdown-computador-pa-${paId}`);
                this.position(STATE.activeDropdown, rect);
                this.attachEvents(STATE.activeDropdown, paId);
            } else {
                $('body').append(TEMPLATES.error(paId, rect));
                setTimeout(() => $(`#error-message-computador-${paId}`).fadeOut(300, function() { $(this).remove(); }), 3000);
            }
        },

        close() {
            if (STATE.activeDropdown) {
                STATE.activeDropdown.fadeOut(CONFIG.animation.hideSpeed, function() { $(this).remove(); });
                STATE.activeDropdown = null;
            }
        }
    };

    // =================== AÇÕES E OPERAÇÕES ===================
    
    const Actions = {
        async addComputador(paId, computadorId, paCard) {
            const existingTag = paCard.find(`.${CONFIG.classes.tag}`);
            if (existingTag.length) {
                const existing = existingTag.text().trim();
                if (!confirm(`A PA já possui o computador "${existing}" atribuído.\n\nDeseja substituí-lo?\n\nAtenção: Cada PA pode ter apenas um computador.`)) {
                    return;
                }
            }
            
            try {
                const response = await API.adicionarComputador(paId, computadorId);
                if (response.success) {
                    UI.updateVisualization(paCard, response.lista_computadores_pa || []);
                    Utils.clearCache();
                    Utils.showMessage(response.message || 'Computador atribuído com sucesso!', 'success');
                } else {
                    Utils.showMessage('Erro ao atribuir computador: ' + (response.error || 'Erro desconhecido'), 'error');
                }
            } catch (error) {
                console.error('Erro AJAX:', error);
                Utils.showMessage(error.responseJSON?.error || 'Erro ao comunicar com o servidor.', 'error');
            }
        },

        async removeComputador(paId, computadorId, paCard) {
            try {
                const response = await API.removerComputador(paId, computadorId);
                if (response.success) {
                    UI.updateVisualization(paCard, response.lista_computadores_pa || []);
                    Utils.clearCache();
                    Utils.showMessage(response.message || 'Computador removido com sucesso!', 'success');
                } else {
                    Utils.showMessage('Erro ao remover computador: ' + (response.error || 'Erro desconhecido'), 'error');
                }
            } catch (error) {
                console.error('Erro AJAX:', error);
                Utils.showMessage(error.responseJSON?.error || 'Erro ao comunicar com o servidor.', 'error');
            }
        },

        async updateStatus(computadorId, status, paId, tagElement, observacoes = null) {
            try {
                const response = await API.atualizarStatus(computadorId, status, paId, observacoes);
                if (response.success) {
                    Utils.showMessage(response.message || 'Status atualizado!', 'success');
                    if (response.computador_removido_da_pa) {
                        const paCard = tagElement.closest('.pa-card');
                        UI.updateVisualization(paCard, response.lista_computadores_pa || []);
                        Utils.clearCache();
                    }
                } else {
                    Utils.showMessage('Erro ao atualizar status: ' + response.error, 'error');
                }
            } catch (error) {
                console.error('Erro AJAX:', error);
                Utils.showMessage(error.responseJSON?.error || 'Erro servidor (status comp.)', 'error');
            }
        }
    };

    // =================== INTERFACE E MENUS ===================
    
    const UI = {
        updateVisualization(paCard, computadores) {
            const container = paCard.find('.computadores-list-container');
            container.empty();
            
            const computador = computadores?.[0];
            if (computador) {
                container.append(TEMPLATES.computadorTag(computador, paCard.data('pa-id')));
            } else {
                container.append(TEMPLATES.assignButton(paCard.data('pa-id')));
            }
        },

        showActionMenu(tag) {
            Utils.closeAllMenus();
            Utils.closePeripheralsMenus();
            
            $('body').append(TEMPLATES.actionMenu());
            STATE.activeActionMenu = $(`.${CONFIG.classes.actionMenu}`);
            
            const rect = tag[0].getBoundingClientRect();
            STATE.activeActionMenu.css({
                top: (rect.bottom + window.scrollY + 5) + 'px',
                left: (rect.left + window.scrollX) + 'px'
            }).show();
            
            this.attachActionEvents(tag);
        },

        attachActionEvents(tag) {
            const computadorId = tag.data('computador-id');
            const paId = tag.data('pa-id');
            const nome = tag.contents().filter(function() { return this.nodeType === 3; }).text().trim();
            const paCard = tag.closest('.pa-card');
            
            STATE.activeActionMenu.find('.computador-action-option').hover(
                function() { $(this).addClass('hover'); },
                function() { $(this).removeClass('hover'); }
            );
            
            STATE.activeActionMenu.find('[data-action="update-status"]').on('click', (e) => {
                e.stopPropagation();
                Utils.closeAllMenus();
                this.showStatusMenu(computadorId, nome, paId, tag);
            });
            
            STATE.activeActionMenu.find('[data-action="remove"]').on('click', (e) => {
                e.stopPropagation();
                Utils.closeAllMenus();
                Actions.removeComputador(paId, computadorId, paCard);
            });
            
            $(document).off('click.closeActionMenu').on('click.closeActionMenu', (e) => {
                if (!$(e.target).closest(`.${CONFIG.classes.actionMenu}, .${CONFIG.classes.tag}`).length) {
                    Utils.closeAllMenus();
                    $(document).off('click.closeActionMenu');
                }
            });
        },

        showStatusMenu(computadorId, nome, paId, tagElement) {
            Utils.closeAllMenus();
            
            $('body').append(TEMPLATES.statusMenu(nome));
            STATE.activeStatusMenu = $(`.${CONFIG.classes.statusMenu}`);
            
            const rect = tagElement[0].getBoundingClientRect();
            STATE.activeStatusMenu.css({
                top: (rect.bottom + window.scrollY + 5) + 'px',
                left: (rect.left + window.scrollX) + 'px'
            }).show();
            
            STATE.activeStatusMenu.find(`.${CONFIG.classes.statusItem}`).hover(
                function() { $(this).addClass('hover'); },
                function() { $(this).removeClass('hover'); }
            ).on('click', (e) => {
                e.stopPropagation();
                const status = $(e.currentTarget).data('status');
                Utils.closeAllMenus();
                
                if (status === 'manutencao' && typeof window.definirDadosParaManutencao === 'function') {
                    window.definirDadosParaManutencao({
                        tipoItem: 'computador',
                        itemId: computadorId,
                        paId: paId,
                        itemNome: nome,
                        itemElement: tagElement
                    });
                    if (typeof window.abrirModalObservacoesManutencao === 'function') {
                        window.abrirModalObservacoesManutencao(nome);
                    }
                } else {
                    Actions.updateStatus(computadorId, status, paId, tagElement);
                }
            });
            
            $(document).off('click.closeStatusMenu').on('click.closeStatusMenu', (e) => {
                if (!$(e.target).closest(`.${CONFIG.classes.statusMenu}, .${CONFIG.classes.tag}`).length) {
                    Utils.closeAllMenus();
                    $(document).off('click.closeStatusMenu');
                }
            });
        }
    };

    // =================== EVENT HANDLERS ===================
    
    const EventHandlers = {
        init() {
            $(document).on('click', `.${CONFIG.classes.assignBtn}, .${CONFIG.classes.addBtn}`, (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Verificar se o botão está desabilitado
                if ($(e.currentTarget).prop('disabled')) {
                    return;
                }
                
                Utils.closeAllMenus();
                Dropdown.toggle(e.currentTarget);
            });

            $(document).on('click', `.${CONFIG.classes.tag}`, (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tag = $(e.currentTarget);
                if ($(e.target).hasClass(CONFIG.classes.removeBtn)) {
                    // Verificar se o ícone de remover está presente (não foi removido para usuários restritos)
                    if ($(e.target).length === 0) {
                        return;
                    }
                    
                    const computadorId = tag.data('computador-id');
                    const paId = tag.data('pa-id');
                    const paCard = tag.closest('.pa-card');
                    Actions.removeComputador(paId, computadorId, paCard);
                    return;
                }
                
                UI.showActionMenu(tag);
            });

            $(document).on('click', (e) => {
                const target = $(e.target);
                
                if (STATE.activeDropdown && !target.closest(`.${CONFIG.classes.dropdown}, .${CONFIG.classes.assignBtn}, .${CONFIG.classes.addBtn}`).length) {
                    Dropdown.close();
                }
                
                if (!target.closest('.periferico-action-menu, .periferico-status-menu, .periferico-tag').length) {
                    Utils.closePeripheralsMenus();
                }
                
                if (!target.closest(`.${CONFIG.classes.actionMenu}, .${CONFIG.classes.statusMenu}, .${CONFIG.classes.tag}`).length &&
                    !target.hasClass(CONFIG.classes.assignBtn) && !target.hasClass(CONFIG.classes.addBtn)) {
                    Utils.closeAllMenus();
                }
            });
        }
    };

    // =================== INICIALIZAÇÃO E EXPORTAÇÃO ===================
    
    $(document).ready(() => {
        EventHandlers.init();
        console.log('✅ Sistema de Computadores (Otimizado) carregado com sucesso');
    });

    // Exportação global para compatibilidade
    Object.assign(window, {
        fecharMenusComputadorAtivos: Utils.closeAllMenus,
        fetchDisponiveisComputadores: API.fetchComputadores,
        toggleDropdownDisponiveisComputadores: (btn) => Dropdown.toggle(btn),
        adicionarComputadorAPa: Actions.addComputador,
        removerComputadorDaPa: Actions.removeComputador,
        atualizarVisualizacaoComputadoresPA: UI.updateVisualization,
        atualizarStatusComputadorNoServidor: Actions.updateStatus,
        computadoresDisponiveisCache: STATE.cache
    });

})(jQuery);