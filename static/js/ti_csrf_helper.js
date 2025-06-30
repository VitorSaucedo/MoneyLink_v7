/**
 * Helper para garantir CSRF token em todas as requisições AJAX do módulo TI
 */

// Configuração global do jQuery para incluir CSRF token automaticamente
$(document).ready(function() {
    // Função para obter CSRF token
    function getCsrfToken() {
        // Tentar várias formas de obter o token
        let token = $('[name=csrfmiddlewaretoken]').val();
        
        if (!token) {
            token = $('meta[name=csrf-token]').attr('content');
        }
        
        if (!token) {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrftoken') {
                    token = value;
                    break;
                }
            }
        }
        
        return token;
    }

    // Configurar CSRF token para todas as requisições AJAX
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            // Só adicionar para métodos que precisam
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                const token = getCsrfToken();
                if (token) {
                    xhr.setRequestHeader("X-CSRFToken", token);
                }
            }
        }
    });

    $(document).ajaxError(function(event, xhr, settings, error) {
        console.error('❌ Erro AJAX:', {
            url: settings.url,
            method: settings.type,
            status: xhr.status,
            error: error,
            response: xhr.responseText
        });
        
        // Alertas específicos para problemas comuns
        if (xhr.status === 403) {
            console.error('🚫 Erro 403: Verifique o CSRF token');
        } else if (xhr.status === 404) {
            console.error('🔍 Erro 404: URL não encontrada -', settings.url);
        } else if (xhr.status === 500) {
            console.error('🔥 Erro 500: Erro interno do servidor');
        }
    });
});

// Função utilitária global para fazer requisições AJAX padronizadas
window.TIApiRequest = {
    get: function(url, data = {}) {
        return $.ajax({
            url: url,
            method: 'GET',
            data: data,
            dataType: 'json'
        });
    },
    
    post: function(url, data = {}) {
        return $.ajax({
            url: url,
            method: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            dataType: 'json'
        });
    },
    
    formPost: function(url, formData) {
        return $.ajax({
            url: url,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json'
        });
    }
}; 