/**
 * Handler de erros padronizado para APIs do módulo TI
 */

window.TIErrorHandler = {
    /**
     * Trata erros de requisições AJAX
     */
    handleAjaxError: function(xhr, textStatus, errorThrown, context = '') {
        console.error('Erro AJAX detectado:', {
            context: context,
            status: xhr.status,
            statusText: xhr.statusText,
            textStatus: textStatus,
            errorThrown: errorThrown,
            responseText: xhr.responseText
        });

        let message = 'Erro interno do sistema';
        let details = '';

        switch (xhr.status) {
            case 400:
                message = 'Dados inválidos enviados';
                try {
                    const response = JSON.parse(xhr.responseText);
                    details = response.error || response.message || '';
                } catch (e) {
                    details = xhr.responseText;
                }
                break;
                
            case 401:
                message = 'Sessão expirada - faça login novamente';
                setTimeout(() => {
                    window.location.href = '/login/';
                }, 3000);
                break;
                
            case 403:
                message = 'Acesso negado - verifique suas permissões';
                details = 'Possível problema com CSRF token';
                break;
                
            case 404:
                message = 'Recurso não encontrado';
                details = `URL: ${xhr.responseURL || 'não identificada'}`;
                break;
                
            case 405:
                message = 'Método não permitido';
                details = 'Verifique se está usando GET/POST corretamente';
                break;
                
            case 500:
                message = 'Erro interno do servidor';
                details = 'Contate o suporte técnico se persistir';
                break;
                
            case 502:
            case 503:
            case 504:
                message = 'Servidor temporariamente indisponível';
                details = 'Tente novamente em alguns instantes';
                break;
                
            default:
                if (xhr.status === 0) {
                    message = 'Erro de conectividade';
                    details = 'Verifique sua conexão com a internet';
                } else {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        message = response.error || response.message || message;
                        details = response.details || '';
                    } catch (e) {
                        // Manter mensagem padrão
                    }
                }
        }

        this.showError(message, details, context);
        return { message, details };
    },

    /**
     * Mostra mensagem de erro na interface
     */
    showError: function(message, details = '', context = '') {
        // Tentar usar sistema de notificação existente
        if (typeof window.mostrarMensagem === 'function') {
            window.mostrarMensagem(message, 'error');
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(message, 'error');
        } else {
            // Fallback: criar alerta customizado
            this.createErrorAlert(message, details, context);
        }
        
        // Log detalhado no console para debug
        console.error(`TI Error [${context}]:`, { message, details });
    },

    /**
     * Cria alerta de erro customizado
     */
    createErrorAlert: function(message, details, context) {
        // Remover alertas existentes
        $('.ti-error-alert').remove();
        
        const alertId = 'ti-error-alert-' + Date.now();
        const detailsText = details ? `<small class="d-block mt-1 text-muted">${details}</small>` : '';
        const contextText = context ? `<small class="d-block text-muted">[${context}]</small>` : '';
        
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show ti-error-alert" 
                 id="${alertId}" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;">
                <i class="bx bx-error-circle me-2"></i>
                <strong>Erro:</strong> ${message}
                ${detailsText}
                ${contextText}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        $('body').append(alertHtml);
        
        // Auto-remover após 8 segundos
        setTimeout(() => {
            $(`#${alertId}`).fadeOut(500, function() {
                $(this).remove();
            });
        }, 8000);
    },

    /**
     * Trata erros de carregamento de dados
     */
    handleDataLoadError: function(error, context = 'carregamento de dados') {
        console.error('Erro no carregamento:', error);
        
        if (error.responseJSON) {
            const response = error.responseJSON;
            this.showError(
                response.error || response.message || 'Erro ao carregar dados',
                response.details || '',
                context
            );
        } else if (error.status) {
            this.handleAjaxError(error, '', '', context);
        } else {
            this.showError('Erro inesperado no carregamento', error.message || '', context);
        }
    },

    /**
     * Valida resposta da API
     */
    validateApiResponse: function(response, context = '') {
        if (!response) {
            throw new Error('Resposta vazia da API');
        }
        
        if (response.success === false) {
            this.showError(
                response.error || response.message || 'Erro na API',
                response.details || '',
                context
            );
            return false;
        }
        
        return true;
    },

    /**
     * Wrapper para requisições AJAX com tratamento de erro automático
     */
    safeAjaxRequest: function(options, context = '') {
        const originalError = options.error;
        
        options.error = (xhr, textStatus, errorThrown) => {
            this.handleAjaxError(xhr, textStatus, errorThrown, context);
            
            if (originalError && typeof originalError === 'function') {
                originalError(xhr, textStatus, errorThrown);
            }
        };
        
        return $.ajax(options);
    }
};

// Configurar handler global para erros AJAX não tratados
$(document).ajaxError(function(event, xhr, settings, thrownError) {
    // Só tratar se não foi tratado especificamente
    if (!settings.errorHandled) {
        const context = settings.url ? `URL: ${settings.url}` : 'Requisição AJAX';
        window.TIErrorHandler.handleAjaxError(xhr, '', thrownError, context);
    }
}); 